-- merulox.com visit log. Coarse Cloudflare edge geolocation only:
-- no IP address, user agent, cookie, or visitor identifier is stored.
CREATE TABLE IF NOT EXISTS visits (
	id INTEGER PRIMARY KEY,
	ts INTEGER NOT NULL,
	path TEXT NOT NULL,
	entry INTEGER NOT NULL DEFAULT 0,
	referrer TEXT,
	country TEXT,
	region TEXT,
	city TEXT,
	lat REAL,
	lon REAL,
	colo TEXT
);

CREATE INDEX IF NOT EXISTS visits_ts ON visits (ts);
