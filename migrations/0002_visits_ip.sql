-- Store the visitor IP (Cloudflare CF-Connecting-IP) for the dev visits tab.
ALTER TABLE visits ADD COLUMN ip TEXT;
