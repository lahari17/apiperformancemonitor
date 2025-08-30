package config

import (
	"os"
	"strconv"
	"strings"
)

type Cfg struct {
	DatabaseURL       string
	SMTPHost          string
	SMTPPort          int
	SMTPUser          string
	SMTPPass          string
	SMTPFrom          string
	AlertEmails       []string
	CheckIntervalSec  int
	TimeoutMs         int
	SlowMs            int
}

func asInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil { return n }
	}
	return def
}

func Load() Cfg {
	var emails []string
	if v := os.Getenv("ALERT_EMAILS"); v != "" {
		parts := strings.Split(v, ",")
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" { emails = append(emails, p) }
		}
	}
	return Cfg{
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		SMTPHost:         os.Getenv("SMTP_HOST"),
		SMTPPort:         asInt("SMTP_PORT", 1025),
		SMTPUser:         os.Getenv("SMTP_USERNAME"),
		SMTPPass:         os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:         os.Getenv("SMTP_FROM"),
		AlertEmails:      emails,
		CheckIntervalSec: asInt("CHECK_INTERVAL_SECONDS", 60),
		TimeoutMs:        asInt("TIMEOUT_MS", 5000),
		SlowMs:           asInt("SLOW_MS", 2000),
	}
}
