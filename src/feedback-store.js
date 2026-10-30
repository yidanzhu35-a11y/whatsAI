export const FEEDBACK_VERSION = 1;
export const FEEDBACK_KEY = 'whatsAI-feedback-v1';
export const MAX_COMMENTS = 1000;

const text = (value, limit, name) => {
  if (typeof value !== 'string' || value.length > limit) throw new Error(`${name}格式不正确或太长`);
  return value;
};
const date = value => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('批注时间格式不正确');
  return new Date(value).toISOString();
};

export function normalizeDocument(value) {
  if (!value || value.version !== FEEDBACK_VERSION || !Array.isArray(value.comments)) {
    throw new Error('请导入由本工具导出的批注 JSON 文件');
  }
  if (value.comments.length > MAX_COMMENTS) throw new Error(`最多保存 ${MAX_COMMENTS} 条批注`);
  const ids = new Set();
  const comments = value.comments.map(item => {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id)) throw new Error('批注编号不正确');
    if (ids.has(item.id)) throw new Error('批注文件中有重复编号');
    ids.add(item.id);
    // Version 1 records include the former chapter 6 (使用模型). Chapter
    // navigation can change without invalidating persisted review history.
    if (!Number.isInteger(item.chapter) || item.chapter < 0 || item.chapter > 6) throw new Error('章节编号不正确');
    if (!['text', 'element', 'chapter'].includes(item.kind)) throw new Error('批注位置类型不正确');
    if (!['open', 'resolved'].includes(item.status)) throw new Error('批注状态不正确');
    const comment = {
      id: item.id,
      chapter: item.chapter,
      chapterTitle: text(item.chapterTitle, 100, '章节标题'),
      kind: item.kind,
      quote: text(item.quote, 1600, '引用原文'),
      selector: text(item.selector, 1600, '位置记录'),
      context: text(item.context, 1600, '页面选项'),
      body: text(item.body, 10000, '批注内容'),
      status: item.status,
      createdAt: date(item.createdAt),
      updatedAt: date(item.updatedAt),
    };
    if (!comment.body.trim()) throw new Error('批注内容不能为空');
    if (item.deletedAt) comment.deletedAt = date(item.deletedAt);
    return comment;
  });
  return { version: FEEDBACK_VERSION, comments };
}

export function mergeComments(left, right) {
  const byId = new Map();
  for (const comment of [...left, ...right]) {
    const previous = byId.get(comment.id);
    // Keep deletion records so an older browser or import cannot revive a deleted note.
    if (!previous || comment.updatedAt > previous.updatedAt ||
        (comment.updatedAt === previous.updatedAt && JSON.stringify(comment) > JSON.stringify(previous))) {
      byId.set(comment.id, comment);
    }
  }
  if (byId.size > MAX_COMMENTS) throw new Error(`批注总数超过 ${MAX_COMMENTS} 条，请先导出备份`);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function makeDocument(comments) {
  return { version: FEEDBACK_VERSION, comments };
}

// Preserve the original chapter number/title in storage; only redirect navigation.
export function feedbackChapter(comment) {
  return comment.chapter === 6 ? 4 : comment.chapter;
}

export function saveBrowserComments(storage, comments) {
  const raw = storage.getItem(FEEDBACK_KEY);
  // Re-read before every write. A damaged/unavailable store must never be
  // overwritten, but a later successful read should allow saving again.
  const existing = raw ? normalizeDocument(JSON.parse(raw)).comments : [];
  const merged = mergeComments(existing, normalizeDocument(makeDocument(comments)).comments);
  storage.setItem(FEEDBACK_KEY, JSON.stringify(makeDocument(merged)));
  return merged;
}

export async function saveFeedbackCopies(comments, saveBrowser, saveFile) {
  let browserSaved = false, fileSaved = false;
  try { browserSaved = Boolean(saveBrowser(comments)); } catch {}
  try { fileSaved = Boolean(await saveFile(comments)); } catch {}
  return { saved: browserSaved || fileSaved, browserSaved, fileSaved };
}

export function nextTimestamp(previous) {
  return new Date(Math.max(Date.now(), Date.parse(previous || '') + 1 || 0)).toISOString();
}

export function commentsMarkdown(comments) {
  const active = comments.filter(item => !item.deletedAt);
  return '# 看见模型训练 · 页面批注\n\n' + active.map((item, i) => {
    const quote = item.quote ? `\n原文 / 界面：\n> ${item.quote.replace(/\n/g, '\n> ')}\n` : '';
    const context = item.context ? `\n记录时的页面选项：${item.context}\n` : '';
    return `## ${i + 1}. ${item.chapterTitle} · ${item.status === 'resolved' ? '已处理' : '待处理'}\n\n编号：${item.id}\n${quote}${context}\n${item.body}\n`;
  }).join('\n---\n\n');
}
