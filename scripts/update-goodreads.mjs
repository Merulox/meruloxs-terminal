#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const USER_ID = "158374147";
const USER_SLUG = "158374147-merulox";
const BASE_URL = `https://www.goodreads.com/review/list_rss/${USER_ID}`;
const PROFILE_URL = `https://www.goodreads.com/user/show/${USER_SLUG}`;
const DEFAULT_OUT = "src/data/goodreads.json";
const LIMIT = Number(arg("--limit", "10"));
const COMPLETED_MAX_AGE_YEARS = Number(arg("--completed-years", "2"));
const outPath = arg("--out", DEFAULT_OUT);

const shelfGroups = {
  reading: ["currently-reading"],
  completed: ["read"],
  dropped: ["dropped", "didnotfinish", "did-not-finish", "dnf"],
  planToRead: ["to-read"],
  favorites: ["favorites"],
};

function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? fallback : process.argv[idx + 1];
}

function decode(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decode(match?.[1] || "");
}

function stripTracking(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_source");
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function parseItems(xml, shelfKey) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => {
    const item = match[1];
    const shelves = tag(item, "user_shelves")
      .split(",")
      .map((shelf) => shelf.trim())
      .filter(Boolean);
    const rating = Number(tag(item, "user_rating") || 0);
    const pages = Number(tag(item, "num_pages") || 0);

    return {
      id: tag(item, "book_id"),
      title: tag(item, "title"),
      author: tag(item, "author_name"),
      url: stripTracking(tag(item, "link")),
      image: tag(item, "book_medium_image_url") || tag(item, "book_image_url"),
      rating,
      averageRating: tag(item, "average_rating"),
      readAt: normalizeDate(tag(item, "user_read_at")),
      addedAt: normalizeDate(tag(item, "user_date_added")),
      updatedAt: normalizeDate(tag(item, "pubDate")),
      published: tag(item, "book_published"),
      pages: Number.isFinite(pages) && pages > 0 ? pages : null,
      shelves,
      sourceShelf: shelfKey,
    };
  });
}

async function fetchShelf(shelf) {
  const url = `${BASE_URL}?shelf=${encodeURIComponent(shelf)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; merulox-reading-updater/1.0)",
      "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`${shelf}: ${res.status} ${res.statusText}`);
  }

  return parseItems(await res.text(), shelf);
}

function mergeUnique(lists) {
  const seen = new Set();
  const merged = [];

  for (const book of lists.flat()) {
    const key = book.id || `${book.title}::${book.author}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(book);
  }

  return merged
    .sort((a, b) => String(b.updatedAt || b.addedAt || b.readAt).localeCompare(String(a.updatedAt || a.addedAt || a.readAt)))
    .slice(0, LIMIT);
}

function isRecentCompleted(book) {
  if (book.shelves.some((shelf) => shelfGroups.dropped.includes(shelf))) return false;

  const dateValue = book.readAt || book.updatedAt || book.addedAt;
  if (!dateValue) return false;

  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;

  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - COMPLETED_MAX_AGE_YEARS);
  return date >= cutoff;
}

const shelves = {};
const errors = [];
let fetchedAny = false;
let existing = null;

try {
  existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
} catch {
  existing = null;
}

for (const [key, group] of Object.entries(shelfGroups)) {
  const lists = [];
  const previousErrorCount = errors.length;
  for (const shelf of group) {
    try {
      const books = await fetchShelf(shelf);
      fetchedAny = true;
      lists.push(key === "completed"
        ? books.filter(isRecentCompleted)
        : books.filter((book) => book.shelves.some((userShelf) => group.includes(userShelf))));
    } catch (error) {
      errors.push({ shelf, message: error.message });
    }
  }
  const merged = mergeUnique(lists);
  const groupFailed = errors.length > previousErrorCount && lists.length === 0;
  const existingShelf = existing?.shelves?.[key];
  shelves[key] = groupFailed && Array.isArray(existingShelf) ? existingShelf : merged;
}

const data = {
  generatedAt: fetchedAny ? new Date().toISOString() : (existing?.generatedAt ?? new Date().toISOString()),
  attemptedAt: errors.length ? new Date().toISOString() : undefined,
  source: "goodreads",
  profileUrl: PROFILE_URL,
  shelves,
  errors,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`);

const counts = Object.fromEntries(Object.entries(shelves).map(([key, books]) => [key, books.length]));
console.log(JSON.stringify({ out: outPath, counts, errors }, null, 2));
