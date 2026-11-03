import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { orchestrateTweets } from '../src/lib/orchestrate-tweets.mjs';

const sourceRoot = process.env.TWEET_SOURCE_ROOT || path.resolve(import.meta.dirname, '..');
const child = '2117295097469702209';
const parent = '2117294670841876720';
const url = id => `https://x.com/merulox/status/${id}`;
const graphTweet = (id, reply) => ({ rest_id: id, core: { user_results: { result: { core: { screen_name: 'merulox' } } } }, legacy: {
 id_str: id, full_text: id === child ? "i'll optimize the UX" : 'spent tokens refactoring',
 ...(reply ? { in_reply_to_status_id_str: reply, in_reply_to_screen_name: 'merulox' } : {}),
} });
const timeline = nodes => ({ data: { user: { result: { timeline: { timeline: { instructions: [{ entries: nodes.map(node => ({ content: { itemContent: { tweet_results: { result: node } } } })) }] } } } } } });
function harness() {
 const listeners = [], sent = [], tabCalls = [];
 const state = { tweets_cache: { tweets: [{ text: 'stale standalone', url: url(child), threadResolved: true, threadVersion: 6, isReply: false }] } };
 const event = { addListener() {} };
 const context = vm.createContext({ URL, Intl, Date, Map, Set, Promise, console, setTimeout, clearTimeout,
  self: { LOG_INGEST_TOKEN: 'fixture-token' }, importScripts() {},
  fetch: async (endpoint, options) => { if (options?.method === 'POST') { sent.push(JSON.parse(options.body)); return { ok: true }; } return { ok: true, json: async () => ({ tweet: null }) }; },
  chrome: { runtime: { id: 'fixture-extension', onMessage: { addListener(fn) { listeners.push(fn); } }, onInstalled: event, onStartup: event },
   alarms: { get: async () => ({}), create: async () => {}, onAlarm: event },
   storage: { local: { get: async key => typeof key === 'string' ? { [key]: structuredClone(state[key]) } : structuredClone(state), set: async value => Object.assign(state, structuredClone(value)) } },
   tabs: { create: async (...args) => { tabCalls.push(args); return { id: 42 }; }, update: async (...args) => tabCalls.push(args), remove: async () => {} },
  },
 });
 vm.runInContext(fs.readFileSync(path.join(sourceRoot, 'extension/background.js'), 'utf8'), context);
 return { context, state, sent, tabCalls, async message(msg, sender = { id: 'fixture-extension', url: 'https://x.com/merulox', tab: { id: 7 } }) {
  for (const listener of listeners) {
   let finish; const done = new Promise(resolve => { finish = resolve; });
   const result = listener(msg, sender, finish);
   if (result === true) await done;
   else if (result?.then) await result;
  }
 } };
}

test('passive X response corrects cached standalone and renders child under its parent without opening tabs', async () => {
 const h = harness();
 await h.message({ action: 'xGraphql', op: 'UserTweetsAndReplies', json: timeline([graphTweet(child, parent), graphTweet(parent)]) });
 const repaired = h.state.tweets_cache.tweets.find(t => t.url === url(child));
 assert.equal(repaired.isReply, true);
 assert.equal(repaired.replyToUrl, url(parent));
 assert.equal(h.sent.length, 2, 'both destinations receive corrected data');
 const ordered = orchestrateTweets(h.sent[0].tweets);
 assert.deepEqual(ordered.map(t => t.url), [url(parent), url(child)]);
 assert.equal(h.tabCalls.length, 0);
 // Later DOM observations must not replace the authoritative captured relationship.
 await h.message({ action: 'pushTweets', tweets: [{ ...repaired, text: 'fresh DOM text', threadSource: undefined, isReply: false, replyToUrl: null }] });
 assert.equal(h.sent.at(-1).tweets[0].replyToUrl, url(parent));
 // A passive refresh must retain enriched context only for the same parent.
 const context = [{ text: 'parent context', url: url(parent) }];
 h.state.tweets_cache.tweets.find(t => t.url === url(child)).replyThread = context;
 await h.message({ action: 'xGraphql', op: 'UserTweets', json: timeline([graphTweet(child, parent)]) });
 assert.deepEqual(h.state.tweets_cache.tweets.find(t => t.url === url(child)).replyThread, context);
 await h.message({ action: 'xGraphql', op: 'UserTweets', json: timeline([graphTweet(child, '2117291367202279783')]) });
 assert.equal(h.state.tweets_cache.tweets.find(t => t.url === url(child)).replyThread, undefined);
});

test('capture ignores messages from non-X content scripts', async () => {
 const h = harness();
 await h.message({ action: 'xGraphql', op: 'UserTweets', json: timeline([graphTweet(child, parent)]) }, { id: 'fixture-extension', url: 'https://example.com/', tab: { id: 7 } });
 assert.equal(h.sent.length, 0);
});

test('GraphQL rest_id is sufficient without duplicate legacy id_str', () => {
 const h = harness(); const node = graphTweet(child, parent); delete node.legacy.id_str;
 h.context.input = node;
 const parsed = vm.runInContext('tweetFromGraphql(input)', h.context);
 assert.equal(parsed?.replyToUrl, url(parent));
});

test('missing public metadata does not prove a post is standalone', async () => {
 const h = harness();
 assert.equal(await vm.runInContext(`resolveThreadViaApi('${url(child)}')`, h.context), null);
});
