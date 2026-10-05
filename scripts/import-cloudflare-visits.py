#!/usr/bin/env python3
"""Backfill merulox.com page views from Cloudflare request logs into D1.

Source: Cloudflare GraphQL `httpRequestsAdaptiveGroups` for the merulox.com
zone (free plan keeps ~31 days of IP-level data; rows are sampled, so each
group's `count` becomes the row weight). Only rows before the first live
beacon are imported, so nothing is double counted.

Filters: eyeball GET 200 requests to real site HTML routes (from dist/), with
user agents that do not look like bots. Scanners that fake browser UAs remain.
Location comes from the DB-IP Lite city database (CC BY 4.0), because the logs
only carry the country.

Rows get source='cloudflare', entry=0 (not visits), referrer NULL, and an
import_key so re-running is idempotent. Undo:
    DELETE FROM visits WHERE source = 'cloudflare';

Run (needs maxminddb; wrangler auth reused from ~/.wrangler):
    nix-shell -p "python3.withPackages(ps:[ps.maxminddb])" \
      --run "python3 scripts/import-cloudflare-visits.py [--dry-run]"
"""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import urllib.request

import maxminddb

SITE = pathlib.Path(__file__).resolve().parent.parent
DB_NAME = "merulox-visits"
HOSTS = ["merulox.com", "www.merulox.com"]
GEO_DIR = pathlib.Path.home() / ".cache/merulox-visits"
GEO_DB = GEO_DIR / "dbip-city-lite.mmdb"
BOT = re.compile(
    r"bot|crawl|spider|slurp|headless|preview|monitor|lighthouse|curl|wget|python|"
    r"httpclient|okhttp|java/|go-http|scrapy|facebookexternalhit|semrush|ahrefs",
    re.I,
)
QUERY = """query($z:String!,$s:Time!,$e:Time!){viewer{zones(filter:{zoneTag:$z}){
httpRequestsAdaptiveGroups(limit:10000,orderBy:[datetime_ASC],filter:{datetime_geq:$s,datetime_lt:$e,
requestSource:"eyeball",clientRequestHTTPMethodName:"GET",edgeResponseStatus:200,
clientRequestHTTPHost_in:%s}){count dimensions{datetime clientIP clientCountryName clientRequestPath userAgent}}}}}""" % json.dumps(HOSTS)


def token():
    text = (pathlib.Path.home() / ".wrangler/config/default.toml").read_text()
    return re.search(r'oauth_token\s*=\s*"([^"]+)"', text).group(1)


def api(url, body=None):
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"},
    )
    return json.load(urllib.request.urlopen(request, timeout=90))


def d1(sql_or_file, is_file=False):
    flag = "--file" if is_file else "--command"
    out = subprocess.run(
        ["npx", "--no-install", "wrangler", "d1", "execute", DB_NAME, "--remote", "-y", "--json", flag, sql_or_file],
        cwd=SITE, capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out[out.index("["):])


def site_routes():
    routes = set()
    for page in (SITE / "dist").rglob("index.html"):
        route = "/" + str(page.parent.relative_to(SITE / "dist")).strip(".").strip("/")
        if route.startswith("/visits"):
            continue
        routes.add(route.rstrip("/") or "/")
    if not routes:
        sys.exit("dist/ is empty; run npm run build first")
    return routes


def clean(path):
    return path.rstrip("/") or "/"


def ensure_geo():
    if GEO_DB.exists():
        return
    GEO_DIR.mkdir(parents=True, exist_ok=True)
    month = dt.date.today().strftime("%Y-%m")
    url = f"https://download.db-ip.com/free/dbip-city-lite-{month}.mmdb.gz"
    GEO_DB.write_bytes(gzip.decompress(urllib.request.urlopen(url, timeout=300).read()))


def sql(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return repr(value)
    return "'" + str(value).replace("'", "''") + "'"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--days", type=int, default=31)
    args = parser.parse_args()

    routes = site_routes()
    first_beacon = d1("SELECT MIN(ts) AS t FROM visits WHERE source = 'beacon'")[0]["results"][0]["t"]
    end = dt.datetime.fromtimestamp(first_beacon, dt.timezone.utc) if first_beacon else dt.datetime.now(dt.timezone.utc)
    zone = api(f"https://api.cloudflare.com/client/v4/zones?name={HOSTS[0]}")["result"][0]["id"]
    retention = api("https://api.cloudflare.com/client/v4/graphql", {
        "query": "query($z:String!){viewer{zones(filter:{zoneTag:$z}){settings{httpRequestsAdaptiveGroups{notOlderThan}}}}}",
        "variables": {"z": zone},
    })["data"]["viewer"]["zones"][0]["settings"]["httpRequestsAdaptiveGroups"]["notOlderThan"]
    start = max(end - dt.timedelta(days=args.days),
                dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=retention) + dt.timedelta(minutes=10))

    ensure_geo()
    geo = maxminddb.open_database(str(GEO_DB))
    rows, fetched, cursor = [], 0, start
    while cursor < end:
        # 6-hour windows keep each query well under the 10k-group limit.
        window_end = min(cursor + dt.timedelta(hours=6), end)
        result = api("https://api.cloudflare.com/client/v4/graphql", {
            "query": QUERY,
            "variables": {"z": zone, "s": cursor.isoformat(timespec="seconds"), "e": window_end.isoformat(timespec="seconds")},
        })
        if result.get("errors"):
            sys.exit(f"graphql error: {result['errors']}")
        groups = result["data"]["viewer"]["zones"][0]["httpRequestsAdaptiveGroups"]
        if len(groups) >= 10000:
            sys.exit(f"window {cursor} hit the 10k limit; shrink the window")
        fetched += len(groups)
        for group in groups:
            d = group["dimensions"]
            path = clean(d["clientRequestPath"] or "")
            if path not in routes or BOT.search(d["userAgent"] or ""):
                continue
            ts = int(dt.datetime.fromisoformat(d["datetime"].replace("Z", "+00:00")).timestamp())
            info = geo.get(d["clientIP"]) or {}
            location = info.get("location") or {}
            subdivisions = info.get("subdivisions") or [{}]
            key = hashlib.sha256(f"{d['datetime']}|{d['clientIP']}|{path}|{d['userAgent']}".encode()).hexdigest()[:32]
            rows.append({
                "ts": ts, "path": path, "entry": 0, "referrer": None,
                "country": (d["clientCountryName"] or "")[:2].upper() or None,
                "region": (subdivisions[0].get("names") or {}).get("en"),
                "city": ((info.get("city") or {}).get("names") or {}).get("en"),
                "lat": round(location["latitude"], 2) if "latitude" in location else None,
                "lon": round(location["longitude"], 2) if "longitude" in location else None,
                "colo": None, "ip": d["clientIP"], "source": "cloudflare",
                "weight": int(group["count"]), "import_key": key,
            })
        cursor = window_end

    views = sum(r["weight"] for r in rows)
    print(f"window {start:%Y-%m-%d %H:%M} -> {end:%Y-%m-%d %H:%M} UTC; groups {fetched}; "
          f"page-view rows {len(rows)}; views {views}; IPs {len({r['ip'] for r in rows})}")
    if args.dry_run or not rows:
        return

    columns = list(rows[0])
    with tempfile.TemporaryDirectory() as tmp:
        for index in range(0, len(rows), 500):
            batch = rows[index:index + 500]
            file = pathlib.Path(tmp) / f"batch-{index}.sql"
            values = ",\n".join("(" + ", ".join(sql(r[c]) for c in columns) + ")" for r in batch)
            file.write_text(f"INSERT OR IGNORE INTO visits ({', '.join(columns)}) VALUES\n{values};\n")
            d1(str(file), is_file=True)
    total = d1("SELECT COUNT(*) AS n, SUM(weight) AS views FROM visits WHERE source = 'cloudflare'")[0]["results"][0]
    print(f"imported: {total['n']} rows / {total['views']} views with source='cloudflare'")


if __name__ == "__main__":
    main()
