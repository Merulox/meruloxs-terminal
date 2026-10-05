-- Browser capability/fingerprint snapshots captured by the first-party merulox.com client.
-- One row per tab session and stable attribute hash; repeat page loads update the latest path/time.
CREATE TABLE IF NOT EXISTS fingerprints (
	id INTEGER PRIMARY KEY,
	ts INTEGER NOT NULL,
	ip TEXT,
	path TEXT NOT NULL,
	session_id TEXT NOT NULL,
	fingerprint_hash TEXT NOT NULL,
	attributes TEXT NOT NULL,
	UNIQUE (session_id, fingerprint_hash)
);

CREATE INDEX IF NOT EXISTS fingerprints_ip_ts ON fingerprints (ip, ts DESC);
CREATE INDEX IF NOT EXISTS fingerprints_hash_ts ON fingerprints (fingerprint_hash, ts DESC);
