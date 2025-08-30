package main

import (
	"context"
	"log"
	"os"
	"time"
	"strconv"
	"github.com/joho/godotenv"
	"github.com/gin-gonic/gin"
	"github.com/gin-contrib/cors"

	"apiperformancemonitor/internal/api"
	"apiperformancemonitor/internal/config"
	"apiperformancemonitor/internal/monitor"
	"apiperformancemonitor/internal/store"
	"apiperformancemonitor/internal/alert"
)

func main() {
	_ = godotenv.Load() // loads .env if present

	cfg := config.Load()
	if cfg.DatabaseURL == "" { log.Fatal("DATABASE_URL not set") }

	ctx := context.Background()
	st, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil { log.Fatal(err) }

	throttleMinutes := 15
	if v := os.Getenv("ALERT_THROTTLE_MINUTES"); v != "" {
		if n, err := strconv.Atoi(v); err == nil { throttleMinutes = n }
	}
	// start monitor worker
	runner := &monitor.Runner{
		S:        st,
		Interval: time.Duration(cfg.CheckIntervalSec) * time.Second,
		Timeout:  time.Duration(cfg.TimeoutMs) * time.Millisecond,
		SlowMs:   cfg.SlowMs,
		EmailCfg: alert.SMTP{
			Host: cfg.SMTPHost, Port: cfg.SMTPPort, User: cfg.SMTPUser, Pass: cfg.SMTPPass, From: cfg.SMTPFrom,
		},
		EmailTo: cfg.AlertEmails,
		Throttle: alert.NewThrottle(time.Duration(throttleMinutes) * time.Minute),
	}
	go runner.Start(ctx)

	// API
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))


	srv := &api.Server{S: st}
	srv.Routes(r)

	port := os.Getenv("PORT")
	if port == "" { port = "8080" }
	if err := r.Run(":" + port); err != nil { log.Fatal(err) }
}
