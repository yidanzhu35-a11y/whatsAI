import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createFeedbackMiddleware } from '../scripts/feedback-plugin.mjs';
import { FEEDBACK_KEY, makeDocument, normalizeDocument, mergeComments, commentsMarkdown, feedbackChapter, saveBrowserComments, saveFeedbackCopies } from '../src/feedback-store.js';

const comment = (id = 'note-one', overrides = {}) => ({
  id, chapter: 0, chapterTitle: '概念地图', kind: 'text', quote: '预训练',
  selector: '.site > main > p', context: '模型类型：语言模型',
  body: '请解释预训练得到的是什么。', status: 'open',
  createdAt: '2026-10-26T02:00:00.000Z', updatedAt: '2026-10-26T02:00:00.000Z', ...overrides,
});

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'whatsai-feedback-test-'));
  const middleware = createFeedbackMiddleware(directory);
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.ok(directory.startsWith(path.join(os.tmpdir(), 'whatsai-feedback-test-')));
    await rm(directory, { recursive: true, force: true });
  });
  return {
    directory, origin,
    get: () => fetch(origin + '/__feedback'),
    post: (document, headers = {}) => fetch(origin + '/__feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers },
      body: JSON.stringify(document),
    }),
  };
}

test('imports validate every comment and reject invalid or oversized input', () => {
  const valid = normalizeDocument(makeDocument([comment()]));
  assert.equal(valid.comments[0].body, comment().body);
  for (const overrides of [{ chapter: 7 }, { id: 123 }, { body: ' ' }, { body: 'x'.repeat(10001) }, { updatedAt: 'invalid' }]) {
    assert.throws(() => normalizeDocument(makeDocument([comment('test', overrides)])));
  }
  assert.throws(() => normalizeDocument(makeDocument([comment(), comment()])));
  assert.throws(() => normalizeDocument({ comments: [] }));
});

test('merging preserves concurrent notes, newest edits, deletion and explicit undo', () => {
  const original = comment();
  const edited = comment('note-one', { body: '修改过的意见', updatedAt: '2026-10-26T03:00:00.000Z' });
  assert.equal(mergeComments([edited], [original])[0].body, '修改过的意见');
  const removed = { ...edited, deletedAt: '2026-10-26T04:00:00.000Z', updatedAt: '2026-10-26T04:00:00.000Z' };
  assert.ok(mergeComments([removed], [original])[0].deletedAt);
  const restored = { ...edited, updatedAt: '2026-10-26T05:00:00.000Z' };
  const result = mergeComments([removed, comment('note-two')], [restored]);
  assert.equal(result.length, 2);
  assert.equal(result.find(item => item.id === 'note-one').deletedAt, undefined);
});

test('Markdown handoff contains context and excludes deleted notes', () => {
  const markdown = commentsMarkdown([comment(), comment('deleted', { deletedAt: comment().updatedAt })]);
  assert.match(markdown, /概念地图/);
  assert.match(markdown, /模型类型：语言模型/);
  assert.match(markdown, /请解释预训练/);
  assert.doesNotMatch(markdown, /编号：deleted/);
});

test('local endpoint persists real files and merges simultaneous browser saves', async t => {
  const app = await fixture(t);
  assert.deepEqual(await (await app.get()).json(), makeDocument([]));
  const responses = await Promise.all([
    app.post(makeDocument([comment('first')])), app.post(makeDocument([comment('second')])),
  ]);
  assert.ok(responses.every(response => response.status === 200));
  const onDisk = normalizeDocument(JSON.parse(await readFile(path.join(app.directory, 'comments.json'), 'utf8')));
  assert.equal(onDisk.comments.length, 2);
  assert.deepEqual(await (await app.get()).json(), onDisk);
});

test('stale browser saves cannot resurrect deleted comments on disk', async t => {
  const app = await fixture(t);
  const deleted = comment('note-one', { deletedAt: '2026-10-26T04:00:00.000Z', updatedAt: '2026-10-26T04:00:00.000Z' });
  await app.post(makeDocument([deleted]));
  const result = await (await app.post(makeDocument([comment()]))).json();
  assert.equal(result.comments[0].deletedAt, deleted.deletedAt);
});

test('cross-origin and malformed writes are rejected without changing existing comments', async t => {
  const app = await fixture(t);
  await app.post(makeDocument([comment()]));
  const file = path.join(app.directory, 'comments.json');
  const before = await readFile(file, 'utf8');
  assert.equal((await app.post(makeDocument([]), { Origin: 'https://example.com' })).status, 403);
  assert.equal((await app.post(makeDocument([]), { Origin: '' })).status, 403);
  assert.equal((await app.post(makeDocument([]), { 'Content-Type': 'text/plain' })).status, 403);
  assert.equal((await app.post({ version: 1, comments: [{ body: 'broken' }] })).status, 400);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('an unreadable existing file is preserved rather than silently reset', async t => {
  const app = await fixture(t);
  const file = path.join(app.directory, 'comments.json');
  await writeFile(file, 'broken JSON that must not be overwritten');
  assert.equal((await app.get()).status, 500);
  assert.equal((await app.post(makeDocument([comment()]))).status, 500);
  assert.equal(await readFile(file, 'utf8'), 'broken JSON that must not be overwritten');
});

test('former seventh-chapter comments survive read, save and reload without rewriting history', async t => {
  const app = await fixture(t);
  const legacy = comment('legacy-inference', { chapter: 6, chapterTitle: '使用模型' });
  const deleted = comment('legacy-deleted', { chapter: 6, deletedAt: comment().updatedAt });
  await writeFile(path.join(app.directory, 'comments.json'), JSON.stringify(makeDocument([legacy, deleted])));
  const loaded = await app.get();
  assert.equal(loaded.status, 200);
  assert.deepEqual((await loaded.json()).comments, [legacy, deleted]);
  assert.equal(feedbackChapter(legacy), 4);
  assert.equal(feedbackChapter(comment('branch', { chapter: 5 })), 5);
  const response = await app.post(makeDocument([comment('new-one'), comment('new-two')]));
  assert.equal(response.status, 200);
  const reloaded = await (await app.get()).json();
  assert.equal(reloaded.comments.length, 4);
  assert.deepEqual(reloaded.comments.find(c => c.id === legacy.id), legacy);
  assert.deepEqual(reloaded.comments.find(c => c.id === deleted.id), deleted);
});

function browserStore(raw = null) {
  let value = raw;
  return {
    getItem(key) { assert.equal(key, FEEDBACK_KEY); return value; },
    setItem(key, next) { assert.equal(key, FEEDBACK_KEY); value = next; },
  };
}

test('browser writes merge legacy and concurrent comments and survive reopening', () => {
  const legacy = comment('legacy', { chapter: 6, chapterTitle: '使用模型' });
  const storage = browserStore(JSON.stringify(makeDocument([legacy])));
  saveBrowserComments(storage, [comment('new-one')]);
  // A second tab starts from an older list; its write must retain the first note.
  saveBrowserComments(storage, [legacy, comment('new-two')]);
  const reopened = normalizeDocument(JSON.parse(storage.getItem(FEEDBACK_KEY)));
  assert.equal(reopened.comments.length, 3);
  assert.deepEqual(reopened.comments.find(c => c.id === legacy.id), legacy);
});

test('invalid browser data stays untouched; a transient read failure can recover', () => {
  const damaged = browserStore('{broken');
  assert.throws(() => saveBrowserComments(damaged, [comment()]));
  assert.equal(damaged.getItem(FEEDBACK_KEY), '{broken');
  const storage = browserStore();
  const read = storage.getItem;
  storage.getItem = () => { throw new Error('temporarily unavailable'); };
  assert.throws(() => saveBrowserComments(storage, [comment()]));
  storage.getItem = read;
  assert.equal(saveBrowserComments(storage, [comment()]).length, 1);
});

test('save confirmation requires an acknowledged browser or project copy', async () => {
  const fail = () => { throw new Error('unavailable'); };
  assert.deepEqual(await saveFeedbackCopies([comment()], fail, fail), {
    saved: false, browserSaved: false, fileSaved: false,
  });
  assert.equal((await saveFeedbackCopies([comment()], () => false, async () => false)).saved, false);
  assert.deepEqual(await saveFeedbackCopies([comment()], () => true, fail), {
    saved: true, browserSaved: true, fileSaved: false,
  });
  assert.deepEqual(await saveFeedbackCopies([comment()], fail, async () => true), {
    saved: true, browserSaved: false, fileSaved: true,
  });
  let acknowledge;
  let settled = false;
  const pending = saveFeedbackCopies([comment()], () => false, () => new Promise(resolve => { acknowledge = resolve; }));
  pending.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  acknowledge(true);
  assert.equal((await pending).fileSaved, true);
});
