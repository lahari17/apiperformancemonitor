CREATE TABLE IF NOT EXISTS urls (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  expected_status INT DEFAULT 200,
  threshold_slow_ms INT DEFAULT 2000,
  created_at TIMESTAMPTZ DEFAULT now()
);
 
CREATE TABLE IF NOT EXISTS checks (
  id BIGSERIAL PRIMARY KEY,
  url_id INT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  status_code INT,
  latency_ms INT,
  ok BOOLEAN,
  error TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checks_url_time ON checks(url_id, checked_at DESC);
