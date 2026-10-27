import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeDocument, makeDocument, mergeComments } from '../src/feedback-store.js';

const ENDPOINT = '/__feedback';
const MAX_BYTES = 2 * 1024 * 1024;

export function createFeedbackMiddleware(directory) {
  const file = path.join(directory, 'comments.json');
  let writes = Promise.resolve();
  async function read() {
    try { return normalizeDocument(JSON.parse(await readFile(file, 'utf8'))); }
    catch (error) {
      if (error.code === 'ENOENT') return makeDocument([]);
      throw new Error('项目批注文件无法读取；原文件已保留，请检查 .feedback/comments.json');
    }
  }
  return async function feedbackMiddleware(req, res, next) {
    if (req.url?.split('?')[0] !== ENDPOINT) return next();
    const reply = (status, value) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(value));
    };
    try {
      const host = req.headers.host || '';
      const hostname = new URL(`http://${host}`).hostname;
      const local = ['127.0.0.1', 'localhost', '[::1]'].includes(hostname);
      const origin = req.headers.origin;
      const sameOrigin = origin === `http://${host}` || origin === `https://${host}`;
      if (!local || req.headers['sec-fetch-site'] === 'cross-site' || (origin && !sameOrigin)) {
        return reply(403, { error: '批注文件只允许本机同源页面访问' });
      }
      if (req.method === 'GET') {
        await writes;
        return reply(200, await read());
      }
      if (req.method !== 'POST') return reply(405, { error: '不支持此操作' });
      if (!sameOrigin || !req.headers['content-type']?.startsWith('application/json')) {
        return reply(403, { error: '只接受本机页面提交的 JSON 批注' });
      }
      let bytes = 0;
      const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) return reply(413, { error: '批注文件超过 2 MB' });
        chunks.push(chunk);
      }
      let incoming;
      try { incoming = normalizeDocument(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (error) { return reply(400, { error: error.message }); }
      const operation = writes.then(async () => {
        const current = await read();
        const document = makeDocument(mergeComments(current.comments, incoming.comments));
        const serialized = JSON.stringify(document, null, 2) + '\n';
        if (Buffer.byteLength(serialized) > MAX_BYTES) throw new Error('项目批注文件超过 2 MB，请先导出备份');
        await mkdir(directory, { recursive: true });
        const temporary = path.join(directory, `comments-${randomUUID()}.tmp`);
        try {
          await writeFile(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
          await rename(temporary, file);
        } finally { await rm(temporary, { force: true }).catch(() => {}); }
        return document;
      });
      writes = operation.catch(() => {});
      return reply(200, await operation);
    } catch (error) { return reply(500, { error: error.message || '本机文件保存失败' }); }
  };
}

export default function feedbackPlugin() {
  return {
    name: 'whatsai-local-feedback',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(createFeedbackMiddleware(path.join(server.config.root, '.feedback')));
    },
  };
}
