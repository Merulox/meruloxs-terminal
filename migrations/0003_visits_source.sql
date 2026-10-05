-- Distinguish live beacon rows from rows imported from Cloudflare request logs.
-- weight: page views a row represents (Cloudflare adaptive logs are sampled).
-- import_key: dedupe key so re-running the import is idempotent.
ALTER TABLE visits ADD COLUMN source TEXT NOT NULL DEFAULT 'beacon';
ALTER TABLE visits ADD COLUMN weight INTEGER NOT NULL DEFAULT 1;
ALTER TABLE visits ADD COLUMN import_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS visits_import_key ON visits (import_key) WHERE import_key IS NOT NULL;
