package alert

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type discordPayload struct {
	Content string `json:"content"`
}

func SendDiscord(webhookURL, msg string) error {
	if webhookURL == "" {
		return fmt.Errorf("empty webhook url")
	}
	b, _ := json.Marshal(discordPayload{Content: msg})
	req, _ := http.NewRequest("POST", webhookURL, bytes.NewBuffer(b))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Discord returns 204 No Content on success.
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("discord webhook error: status=%d", resp.StatusCode)
	}
	return nil
}
