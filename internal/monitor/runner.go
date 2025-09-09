package monitor

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"apiperformancemonitor/internal/alert"
	"apiperformancemonitor/internal/store"
)

// Runner periodically checks URLs and emits alerts on state change,
// throttling repeat alerts and optionally sending a RECOVERED message.
type Runner struct {
	S        *store.Store
	Interval time.Duration
	Timeout  time.Duration
	SlowMs   int

	// Email channel
	EmailCfg alert.SMTP
	EmailTo  []string

	// Throttle/state tracker (init in main)
	Throttle *alert.Throttle
}

func (r *Runner) Start(ctx context.Context) {
	ticker := time.NewTicker(r.Interval)
	defer ticker.Stop()

	// initial pass
	r.runOnce(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.runOnce(ctx)
		}
	}
}

func (r *Runner) runOnce(ctx context.Context) {
	urls, err := r.S.ListURLs(ctx)
	if err != nil {
		return
	}

	sem := make(chan struct{}, 20) // concurrency cap
	for _, u := range urls {
		sem <- struct{}{}
		go func(u store.URL) {
			defer func() { <-sem }()
			r.checkOne(ctx, u)
		}(u)
	}

	// wait for all goroutines to finish
	for i := 0; i < cap(sem); i++ {
		sem <- struct{}{}
	}
}

func (r *Runner) checkOne(ctx context.Context, u store.URL) {
	// timed HTTP GET
	cctx, cancel := context.WithTimeout(ctx, r.Timeout)
	defer cancel()

	t0 := time.Now()
	req, _ := http.NewRequestWithContext(cctx, http.MethodGet, u.URL, nil)
	req.Header.Set("User-Agent", "APIPerformanceMonitor/1.0 (+https://github.com/monitor)")
	resp, err := http.DefaultClient.Do(req)
	latency := time.Since(t0).Milliseconds()

	var status *int32
	var errStr *string
	ok := false

	if err != nil {
		s := err.Error()
		errStr = &s
	} else {
		defer resp.Body.Close()
		sc := int32(resp.StatusCode)
		status = &sc
		ok = (resp.StatusCode == int(u.ExpectedStatus))
	}

	// persist observation
	_ = r.S.InsertCheck(ctx, store.Check{
		URLID:      u.ID,
		StatusCode: status,
		LatencyMs:  ptrI(int32(latency)),
		OK:         ok,
		Error:      errStr,
		CheckedAt:  time.Now(),
	})

	// derive state & reason
	state := alert.StateOK
	kind := ""   // "DOWN" or "SLOW"
	reason := "" // human summary

	if err != nil {
		state = alert.StateDown
		kind = "DOWN"
		reason = "timeout/error"
	} else if !ok {
		state = alert.StateDown
		kind = "DOWN"
		reason = fmt.Sprintf("unexpected status %d", *status)
	} else if latency > int64(r.SlowMs) {
		state = alert.StateSlow
		kind = "SLOW"
		reason = "slow response"
	}

	// Non-OK path (DOWN or SLOW): ask throttle if we should notify now
	if kind != "" {
		shouldNotify, isRecovery := r.Throttle.Decide(u.URL, kind, state)
		statusValue := "unknown"
		if status != nil {
			statusValue = fmt.Sprintf("%d", *status)
		}
		text := fmt.Sprintf("%s | %s | reason=%s status=%s latency=%dms", u.URL, kind, reason, statusValue, latency)

		// first failure (or per throttle window)
		if shouldNotify {
			alertIcon := "🔴"
			if kind == "SLOW" {
				alertIcon = "🟡"
			}
			subject := fmt.Sprintf("%s [%s] %s - %s", alertIcon, kind, u.URL, reason)
			r.sendEmail(subject, htmlForAlert(u.URL, kind, reason, status, latency), text)
			r.sendDiscord(alertIcon + " " + text)
		}

		// (defensive) recovery should not happen here since state != OK,
		// but handle just in case Decide() indicates it.
		if isRecovery && os.Getenv("ALERT_ON_RECOVERY") == "true" {
			rec := text + " | RECOVERED"
			r.sendEmail("[RECOVERED] "+u.URL, "<p>Recovered</p>", rec)
			r.sendDiscord(rec)
		}
		return
	}

	// OK path: if previously DOWN/SLOW, this is a recovery
	_, recDown := r.Throttle.Decide(u.URL, "DOWN", alert.StateOK)
	_, recSlow := r.Throttle.Decide(u.URL, "SLOW", alert.StateOK)
	if (recDown || recSlow) && os.Getenv("ALERT_ON_RECOVERY") == "true" {
		recoveryType := "DOWN"
		if recSlow && !recDown {
			recoveryType = "SLOW"
		}
		statusValue := "unknown"
		if status != nil {
			statusValue = fmt.Sprintf("%d", *status)
		}
		text := fmt.Sprintf("%s | RECOVERED from %s | status=%s latency=%dms", u.URL, recoveryType, statusValue, latency)
		htmlMsg := fmt.Sprintf("<h3>✅ %s - RECOVERED</h3><p>Your website is now accessible!</p><p>Previous status: %s<br/>Current status: %s<br/>Response time: %d ms</p>", u.URL, recoveryType, statusValue, latency)
		r.sendEmail("✅ [RECOVERED] "+u.URL+" - Your website is back online", htmlMsg, text)
		r.sendDiscord("🟢 " + text)
	}
}

func (r *Runner) sendEmail(subject, html, text string) {
	if len(r.EmailTo) == 0 {
		return
	}
	_ = alert.Send(r.EmailCfg, r.EmailTo, subject, html, text)
}

func (r *Runner) sendDiscord(msg string) {
	if os.Getenv("ENABLE_DISCORD") != "true" {
		return
	}
	if wh := os.Getenv("DISCORD_WEBHOOK_URL"); wh != "" {
		_ = alert.SendDiscord(wh, msg)
	}
}

func htmlForAlert(url, kind, reason string, status *int32, latency int64) string {
	alertIcon := "🔴"
	alertColor := "#dc3545"
	if kind == "SLOW" {
		alertIcon = "🟡"
		alertColor = "#ffc107"
	}
	return fmt.Sprintf(`
		<h3>%s %s - %s</h3>
		<p style="color: %s; font-weight: bold;">Your website is not accessible!</p>
		<p>
			<strong>URL:</strong> %s<br/>
			<strong>Issue:</strong> %s<br/>
			<strong>Status Code:</strong> %v<br/>
			<strong>Response Time:</strong> %d ms
		</p>
		<p><em>Please check your website and resolve the issue.</em></p>
	`, alertIcon, url, kind, alertColor, url, reason, status, latency)
}

func htmlFor(url, reason string, status *int32, latency int64) string {
	return fmt.Sprintf("<h3>%s</h3><p>Reason: %s<br/>Status: %v<br/>Latency: %d ms</p>", url, reason, status, latency)
}

func ptrI(v int32) *int32 { return &v }
