// Runs on x.com/merulox — scrapes tweets from the rendered DOM
const CACHE_KEY = "tweets_cache";
const STATUS_KEY = "last_attempt";
const SCREEN_NAME = "merulox";

function extractTweets() {
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  const tweets = [];

  for (const article of articles) {
    const textEl = article.querySelector('[data-testid="tweetText"]');
    const timeEl = article.querySelector("time");
    // Only include tweets by this account (not RT'd content from others)
    const linkEl = article.querySelector(`a[href*="/${SCREEN_NAME}/status/"]`);

    if (!textEl || !linkEl) continue;

    const href = linkEl.getAttribute("href");
    tweets.push({
      text: textEl.textContent.trim(),
      date: timeEl?.getAttribute("datetime")?.slice(0, 7) ?? new Date().toISOString().slice(0, 7),
      url: `https://x.com${href}`,
    });
  }

  return tweets;
}

async function saveTweets(tweets) {
  await chrome.storage.local.set({
    [CACHE_KEY]: { tweets, fetchedAt: Date.now() },
    [STATUS_KEY]: { ok: true, time: Date.now(), count: tweets.length, error: null, source: "dom" },
  });
}

// Tweets load async — poll until they appear
function pollForTweets(maxAttempts = 15, intervalMs = 800) {
  let attempts = 0;
  const run = async () => {
    const tweets = extractTweets();
    if (tweets.length > 0) {
      await saveTweets(tweets);
      return;
    }
    if (++attempts < maxAttempts) setTimeout(run, intervalMs);
  };
  setTimeout(run, 1000);
}

pollForTweets();
