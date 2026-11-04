CREATE TABLE IF NOT EXISTS outbound_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  ip TEXT,
  source_path TEXT NOT NULL,
  destination TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbound_clicks_ts ON outbound_clicks(ts);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_ip_ts ON outbound_clicks(ip, ts DESC);
