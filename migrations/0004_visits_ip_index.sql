-- Per-IP panel: history pages and aggregates filter by ip, newest first.
CREATE INDEX IF NOT EXISTS visits_ip_ts ON visits (ip, ts);
