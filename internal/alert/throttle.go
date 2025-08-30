package alert

import (
	"sync"
	"time"
)

// State values we care about
const (
	StateOK    = "OK"
	StateDown  = "DOWN"       // timeout/error or non-expected status
	StateSlow  = "SLOW"       // above latency threshold
)

type key struct{ URL, Kind string } // Kind: DOWN|SLOW

type entry struct {
	LastState string
	LastSent  time.Time
}

type Throttle struct {
	mu   sync.Mutex
	ttl  time.Duration
	data map[key]entry
}

func NewThrottle(ttl time.Duration) *Throttle {
	return &Throttle{ttl: ttl, data: make(map[key]entry)}
}

// Decide returns (shouldNotify, isRecovery)
func (t *Throttle) Decide(u string, kind string, nowState string) (bool, bool) {
	k := key{URL: u, Kind: kind}
	now := time.Now()

	t.mu.Lock()
	defer t.mu.Unlock()

	prev, ok := t.data[k]

	// State change?
	if !ok || prev.LastState != nowState {
		// record and send immediately on state change
		t.data[k] = entry{LastState: nowState, LastSent: now}
		// recovery iff prev existed and was not OK and now is OK
		return true, ok && prev.LastState != StateOK && nowState == StateOK
	}

	// No state change: throttle repeats
	if now.Sub(prev.LastSent) >= t.ttl && nowState != StateOK {
		prev.LastSent = now
		t.data[k] = prev
		return true, false
	}

	return false, false
}
