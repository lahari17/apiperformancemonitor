package alert

import (
	"crypto/tls"
	"fmt"
	"net/smtp"

	"github.com/jordan-wright/email"
)

type SMTP struct {
	Host string
	Port int
	User string
	Pass string
	From string
}

func Send(cfg SMTP, to []string, subject, html, text string) error {
	e := email.NewEmail()
	e.From = cfg.From
	e.To = to
	e.Subject = subject
	e.Text = []byte(text)
	e.HTML = []byte(html)

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	auth := smtp.PlainAuth("", cfg.User, cfg.Pass, cfg.Host)
	return e.SendWithStartTLS(addr, auth, &tls.Config{ServerName: cfg.Host})
}
