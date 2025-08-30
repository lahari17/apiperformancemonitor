package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct{ Pool *pgxpool.Pool }

type URL struct {
	ID              int32     `json:"id"`
	URL             string    `json:"url"`
	ExpectedStatus  int32     `json:"expected_status"`
	ThresholdSlowMs int32     `json:"threshold_slow_ms"`
	CreatedAt       time.Time `json:"created_at"`
}

type Check struct {
	ID         int64      `json:"id"`
	URLID      int32      `json:"url_id"`
	StatusCode *int32     `json:"status_code"`
	LatencyMs  *int32     `json:"latency_ms"`
	OK         bool       `json:"ok"`
	Error      *string    `json:"error"`
	CheckedAt  time.Time  `json:"checked_at"`
}

func New(ctx context.Context, dsn string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil { return nil, err }
	return &Store{Pool: pool}, nil
}

func (s *Store) AddURL(ctx context.Context, url string, exp, slow int32) (int32, error) {
	var id int32
	err := s.Pool.QueryRow(ctx, `
INSERT INTO urls(url, expected_status, threshold_slow_ms)
VALUES($1,$2,$3)
ON CONFLICT(url) DO UPDATE SET expected_status=EXCLUDED.expected_status
RETURNING id`, url, exp, slow).Scan(&id)
	return id, err
}

func (s *Store) ListURLs(ctx context.Context) ([]URL, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id,url,expected_status,threshold_slow_ms,created_at FROM urls ORDER BY id`)
	if err != nil { return nil, err }
	defer rows.Close()
	var out []URL
	for rows.Next() {
		var u URL
		if err := rows.Scan(&u.ID, &u.URL, &u.ExpectedStatus, &u.ThresholdSlowMs, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Store) InsertCheck(ctx context.Context, c Check) error {
	_, err := s.Pool.Exec(ctx, `
INSERT INTO checks(url_id,status_code,latency_ms,ok,error,checked_at)
VALUES($1,$2,$3,$4,$5,$6)`, c.URLID, c.StatusCode, c.LatencyMs, c.OK, c.Error, c.CheckedAt)
	return err
}

func (s *Store) RecentChecks(ctx context.Context, urlID int32, limit int) ([]Check, error) {
	rows, err := s.Pool.Query(ctx, `
SELECT id,url_id,status_code,latency_ms,ok,error,checked_at
FROM checks WHERE url_id=$1 ORDER BY checked_at DESC LIMIT $2`, urlID, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var out []Check
	for rows.Next() {
		var c Check
		if err := rows.Scan(&c.ID,&c.URLID,&c.StatusCode,&c.LatencyMs,&c.OK,&c.Error,&c.CheckedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
type Latest struct {
  URL   URL   `json:"url"`
  Check Check `json:"check"`
}

func (s *Store) LatestStatus(ctx context.Context) ([]Latest, error) {
  rows, err := s.Pool.Query(ctx, `
    SELECT u.id,u.url,u.expected_status,u.threshold_slow_ms,u.created_at,
           c.id,c.status_code,c.latency_ms,c.ok,c.error,c.checked_at
    FROM urls u
    JOIN LATERAL (
      SELECT id,status_code,latency_ms,ok,error,checked_at
      FROM checks WHERE url_id=u.id
      ORDER BY checked_at DESC
      LIMIT 1
    ) c ON true
    ORDER BY u.id;
  `)
  if err != nil { return nil, err }
  defer rows.Close()
  var out []Latest
  for rows.Next() {
    var u URL; var c Check
    if err := rows.Scan(&u.ID,&u.URL,&u.ExpectedStatus,&u.ThresholdSlowMs,&u.CreatedAt,
                        &c.ID,&c.StatusCode,&c.LatencyMs,&c.OK,&c.Error,&c.CheckedAt); err != nil {
      return nil, err
    }
    out = append(out, Latest{URL: u, Check: c})
  }
  return out, rows.Err()
}
