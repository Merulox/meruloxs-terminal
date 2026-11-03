import test from 'node:test';
import assert from 'node:assert/strict';
import { initMoodboardVisibility } from '../src/lib/moodboard-visibility.mjs';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { getEventListeners } from 'node:events';
import vm from 'node:vm';

class Element extends EventTarget {
 hidden = false; disabled = false; textContent = ''; attrs = {};
 setAttribute(key, value) { this.attrs[key] = value; }
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const response = enabled => ({ ok: true, json: async () => ({ enabled }) });
function setup(isDev, fetchImpl) {
 const section = new Element(), controls = new Element(), button = new Element(), status = new Element();
 const abort = new AbortController(); let shown = 0, hidden = 0;
 const controller = initMoodboardVisibility({ section, controls, button, status, isDev, signal: abort.signal,
  fetchImpl, pollMs: 0, onShow: () => shown++, onHide: () => hidden++ });
 return { section, controls, button, status, abort, controller, counts: () => ({ shown, hidden }) };
}

test('public starts hidden and disabled moodboard never starts loading', async () => {
 const ui = setup(false, async () => response(false));
 assert.equal(ui.section.hidden, true);
 await tick();
 assert.equal(ui.section.hidden, true);
 assert.equal(ui.controls.hidden, true);
 assert.equal(ui.counts().shown, 0);
 ui.abort.abort();
});

test('public responds to enabled/disabled refresh without duplicate initialization', async () => {
 let value = true;
 const ui = setup(false, async () => response(value));
 await tick(); assert.equal(ui.section.hidden, false); assert.equal(ui.counts().shown, 1);
 await ui.controller.refresh(); assert.equal(ui.counts().shown, 1);
 value = false; await ui.controller.refresh(); assert.equal(ui.section.hidden, true); assert.equal(ui.counts().hidden, 1);
 value = true; await ui.controller.refresh(); assert.equal(ui.section.hidden, false); assert.equal(ui.counts().shown, 2);
 ui.abort.abort(); assert.equal(ui.counts().hidden, 2);
});

test('dev keeps preview visible and PATCH persists both toggle directions', async () => {
 const writes = []; let value = true;
 const ui = setup(true, async (_url, options) => {
  if (options.method === 'PATCH') { value = JSON.parse(options.body).enabled; writes.push(value); }
  return response(value);
 });
 await tick(); assert.equal(ui.controls.hidden, false); assert.equal(ui.button.disabled, false);
 await ui.controller.toggle(); assert.equal(ui.section.hidden, false); assert.equal(ui.button.attrs['aria-pressed'], 'false');
 await ui.controller.toggle(); assert.deepEqual(writes, [false, true]); assert.equal(ui.button.attrs['aria-pressed'], 'true');
 assert.equal(ui.counts().shown, 1); ui.abort.abort();
});

test('failed write reports error without pretending public state changed', async () => {
 const ui = setup(true, async (_url, options) => options.method === 'PATCH' ? { ok: false } : response(true));
 await tick(); await ui.controller.toggle();
 assert.equal(ui.button.attrs['aria-pressed'], 'true'); assert.equal(ui.button.disabled, false);
 assert.match(ui.status.textContent, /Could not save/); assert.equal(ui.section.hidden, false); ui.abort.abort();
});

test('failed settings read hides public mood and retries successfully', async () => {
 let fail = true;
 const ui = setup(false, async () => { if (fail) throw Error('offline'); return response(true); });
 await tick(); assert.equal(ui.section.hidden, true); assert.equal(ui.counts().shown, 0);
 fail = false; await ui.controller.refresh(); assert.equal(ui.section.hidden, false); ui.abort.abort();
});

test('stale GET cannot undo a completed PATCH', async () => {
 let gets = 0, finish;
 const ui = setup(true, async (_url, options) => {
  if (options.method === 'PATCH') return response(false);
  if (++gets === 1) return response(true);
  return new Promise(resolve => { finish = resolve; });
 });
 await tick(); const stale = ui.controller.refresh(); await ui.controller.toggle();
 finish(response(true)); await stale;
 assert.equal(ui.button.attrs['aria-pressed'], 'false'); ui.abort.abort();
});

test('navigation abort prevents pending responses and old controls from mutating UI', async () => {
 let finish, calls = 0;
 const ui = setup(true, async () => { calls++; return new Promise(resolve => { finish = resolve; }); });
 ui.abort.abort(); finish(response(true)); await tick();
 assert.equal(ui.button.disabled, true); assert.equal(ui.counts().hidden, 1);
 ui.button.dispatchEvent(new Event('click')); await tick(); assert.equal(calls, 1);
});

test('public controller never issues a mutation', async () => {
 const methods = [];
 const ui = setup(false, async (_url, options) => { methods.push(options.method); return response(true); });
 await tick(); await ui.controller.toggle(); assert.deepEqual(methods, ['GET']); ui.abort.abort();
});

test('repeated moodboard hide/show removes prior animation hover listeners', () => {
 const source = readFileSync(new URL('../src/pages/music.astro', import.meta.url), 'utf8');
 const body = source.slice(source.indexOf('function startMoodAutoscroll('), source.indexOf('async function loadUserInfo('));
 const start = vm.runInNewContext(`(${stripTypeScriptTypes(body.trim())})`, {
  window: { matchMedia: () => ({ matches: true }) }, requestAnimationFrame() {},
 });
 const strip = new EventTarget();
 const track = { closest: () => strip };
 for (let i = 0; i < 3; i++) {
  const abort = new AbortController();
  start(track, abort.signal);
  assert.equal(getEventListeners(strip, 'mouseenter').length, 1);
  assert.equal(getEventListeners(strip, 'mouseleave').length, 1);
  abort.abort();
  assert.equal(getEventListeners(strip, 'mouseenter').length, 0);
  assert.equal(getEventListeners(strip, 'mouseleave').length, 0);
 }
});
