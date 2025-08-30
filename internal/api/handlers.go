package api

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"apiperformancemonitor/internal/store"
)

type Server struct{ S *store.Store }

func (s *Server) Routes(r *gin.Engine) {
	r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })
	r.POST("/urls", s.addURL)
	r.GET("/urls", s.listURLs)
	r.GET("/checks", s.recentChecks)
	r.GET("/status", s.latestStatus)
}

func (s *Server) addURL(c *gin.Context) {
	var body struct {
		URL      string `json:"url"`
		Expected int32  `json:"expected_status"`
		SlowMs   int32  `json:"slow_ms"`
	}
	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
	}
	if body.Expected == 0 { body.Expected = 200 }
	if body.SlowMs == 0 { body.SlowMs = 2000 }

	id, err := s.S.AddURL(context.Background(), body.URL, body.Expected, body.SlowMs)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"id": id})
}

func (s *Server) listURLs(c *gin.Context) {
	urls, err := s.S.ListURLs(context.Background())
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, urls)
}

func (s *Server) recentChecks(c *gin.Context) {
	id, _ := strconv.Atoi(c.Query("url_id"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	cs, err := s.S.RecentChecks(context.Background(), int32(id), limit)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, cs)
}

func (s *Server) latestStatus(c *gin.Context) {
	rows, err := s.S.LatestStatus(context.Background())
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, rows)
}
