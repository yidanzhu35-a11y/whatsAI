import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FEEDBACK_KEY, makeDocument, normalizeDocument, mergeComments, nextTimestamp, commentsMarkdown, feedbackChapter, saveBrowserComments, saveFeedbackCopies } from './feedback-store.js';
import { captureAnchor, findAnchor, pageContext } from './feedback-anchor.js';
import './feedback.css';

const localFile = import.meta.env.DEV;
const labelForKind = { text: '选中文字', element: '界面元素', chapter: '整章意见' };

function loadBrowser() {
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
    return { comments: raw ? normalizeDocument(JSON.parse(raw)).comments : [], error: '' };
  } catch (problem) {
    return { comments: [], error: `浏览器副本读取失败：${problem.message}。原副本未覆盖；新批注需确认项目文件保存成功，或导出备份。` };
  }
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function Feedback({ chapter, chapters, go }) {
  const [initial] = useState(loadBrowser);
  const [comments, setComments] = useState(initial.comments);
  const commentsRef = useRef(initial.comments);
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  const blockClick = useRef(0);
  const [draft, setDraft] = useState(null);
  const [filter, setFilter] = useState('open');
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [target, setTarget] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(initial.error);
  const [fileError, setFileError] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const draftSavePending = useRef(false);
  const [fileState, setFileState] = useState(localFile ? 'loading' : 'browser');
  const [storageOk, setStorageOk] = useState(!initial.error);
  const textarea = useRef(null);
  const launcher = useRef(null);
  const upload = useRef(null);
  const writeQueue = useRef(Promise.resolve());
  const saveSequence = useRef(0);
  const pointerStart = useRef(null);
  const undo = useRef(null);

  const remember = useCallback(next => {
    commentsRef.current = next;
    setComments(next);
    try {
      const saved = saveBrowserComments(localStorage, next);
      commentsRef.current = saved;
      setComments(saved);
      setStorageOk(true);
      setStorageError('');
      return true;
    } catch (problem) {
      setStorageOk(false);
      setStorageError(`浏览器副本未保存：${problem.message}。原副本未覆盖；请确认项目文件已保存，或导出备份。`);
      return false;
    }
  }, []);

  const syncToFile = useCallback(next => {
    if (!localFile) return Promise.resolve(false);
    const sequence = ++saveSequence.current;
    setFileState('saving');
    const task = writeQueue.current.catch(() => {}).then(async () => {
      const response = await fetch('/__feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(makeDocument(next)),
        signal: AbortSignal.timeout(8000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '项目文件保存失败');
      const saved = normalizeDocument(result);
      remember(mergeComments(commentsRef.current, saved.comments));
      if (sequence === saveSequence.current) { setFileState('saved'); setFileError(''); }
      return true;
    });
    writeQueue.current = task;
    return task.catch(problem => {
      if (sequence === saveSequence.current) { setFileState('failed'); setFileError(problem.message); }
      return false;
    });
  }, [remember]);

  const syncFromFile = useCallback(async () => {
    if (!localFile) return;
    try {
      const response = await fetch('/__feedback', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '项目文件读取失败');
      const remote = normalizeDocument(result);
      const merged = mergeComments(commentsRef.current, remote.comments);
      remember(merged);
      if (JSON.stringify(merged) !== JSON.stringify(remote.comments)) syncToFile(merged);
      else { setFileState('saved'); setFileError(''); }
    } catch (problem) { setFileState('failed'); setFileError(problem.message); }
  }, [remember, syncToFile]);

  useEffect(() => { syncFromFile(); }, [syncFromFile]);
  useEffect(() => {
    if (open) syncFromFile();
    const focus = () => { if (open) syncFromFile(); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [open, syncFromFile]);
  useEffect(() => {
    const receive = event => {
      if (event.key !== FEEDBACK_KEY || !event.newValue) return;
      try {
        const next = mergeComments(commentsRef.current, normalizeDocument(JSON.parse(event.newValue)).comments);
        if (JSON.stringify(next) !== JSON.stringify(commentsRef.current)) {
          remember(next);
          syncToFile(next);
        }
      } catch { setError('另一个标签页的批注没有成功合并，请导出备份后检查。'); }
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, [remember, syncToFile]);

  const change = async next => {
    try {
      normalizeDocument(makeDocument(next));
      setMessage('');
      const receipt = await saveFeedbackCopies(next, remember, syncToFile);
      if (!receipt.saved) throw new Error('批注尚未保存：浏览器副本和项目文件都未写入。内容暂留在当前页面，请导出备份，不要刷新或关闭。');
      setError('');
      return receipt;
    } catch (problem) { setError(problem.message); return null; }
  };

  useEffect(() => {
    const hasUnsaved = Boolean(draft?.body.trim()) || (comments.length > 0 && !storageOk && fileState !== 'saved');
    if (!hasUnsaved) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft, comments.length, storageOk, fileState]);

  const stopPicking = useCallback(() => {
    pickingRef.current = false;
    setPicking(false);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('feedback-panel-open', open && !picking);
    document.body.classList.toggle('feedback-picking', picking);
    return () => {
      document.body.classList.remove('feedback-panel-open', 'feedback-picking');
    };
  }, [open, picking]);

  useEffect(() => {
    const start = event => { pointerStart.current = { x: event.clientX, y: event.clientY }; };
    const pick = event => {
      if (!pickingRef.current || event.target.closest?.('[data-feedback-ui]') || !event.target.closest?.('.site')) return;
      if (event.type === 'pointerup' && pointerStart.current && !window.getSelection()?.toString().trim() &&
          Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y) > 8) return;
      const captured = captureAnchor(event.target);
      if (!captured) return;
      blockClick.current = Date.now() + 500;
      stopPicking();
      setDraft({ ...captured.anchor, chapter, chapterTitle: chapters[chapter], body: '' });
      setTarget(captured.element);
      setActiveId(null);
      setOpen(true);
      setMessage('位置已选好，写下你希望修改的内容。');
      window.getSelection()?.removeAllRanges();
    };
    const preventAction = event => {
      if (event.target.closest?.('[data-feedback-ui]') || !event.target.closest?.('.site')) return;
      if (pickingRef.current || Date.now() < blockClick.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (pickingRef.current) pick(event);
      }
    };
    const escape = event => {
      if (event.key !== 'Escape') return;
      if (pickingRef.current) { stopPicking(); setOpen(true); }
      else if (open) { setOpen(false); launcher.current?.focus(); }
    };
    document.addEventListener('pointerdown', start, true);
    document.addEventListener('pointerup', pick, true);
    document.addEventListener('click', preventAction, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', start, true);
      document.removeEventListener('pointerup', pick, true);
      document.removeEventListener('click', preventAction, true);
      document.removeEventListener('keydown', escape);
    };
  }, [chapter, chapters, open, stopPicking]);

  useEffect(() => { if (draft && open && !picking) textarea.current?.focus(); }, [draft?.id, draft?.selector, open, picking]);
  useEffect(() => { setTarget(null); }, [chapter]);
  useEffect(() => {
    if (!target) { setBounds(null); return; }
    let frame;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!target.isConnected || !target.getClientRects().length) { setBounds(null); return; }
        const rect = target.getBoundingClientRect();
        setBounds({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [target, open, picking]);

  const startPicking = () => {
    window.getSelection()?.removeAllRanges();
    setMessage(''); setTarget(null);
    pickingRef.current = true;
    setPicking(true);
  };
  const startChapter = () => {
    setDraft({ kind: 'chapter', quote: '', selector: '', context: pageContext(), chapter, chapterTitle: chapters[chapter], body: '' });
    setTarget(null); setActiveId(null);
  };
  const saveDraft = async event => {
    event.preventDefault();
    if (!draft?.body.trim() || draftSavePending.current) return;
    draftSavePending.current = true;
    setSavingDraft(true);
    const previous = draft.id ? commentsRef.current.find(item => item.id === draft.id) : null;
    const now = nextTimestamp(previous?.updatedAt);
    const item = {
      ...draft, id: draft.id || crypto.randomUUID(), body: draft.body.trim(),
      createdAt: previous?.createdAt || now, updatedAt: now, status: previous?.status || 'open',
    };
    // Keep the same identity when retrying a failed save.
    setDraft(item);
    try {
      const receipt = await change(mergeComments(commentsRef.current, [item]));
      if (receipt) {
        setDraft(null); setActiveId(item.id); setFilter(item.status);
        setMessage(receipt.fileSaved ? '批注已保存到项目文件。可以继续选下一处。' : localFile ? '批注已保存在本浏览器；项目文件尚未同步。可导出备份。' : '批注已保存在本浏览器。可导出备份。');
      }
    } catch (problem) { setError(problem.message); }
    finally { draftSavePending.current = false; setSavingDraft(false); }
  };
  const updateComment = (item, values) => {
    const latest = commentsRef.current.find(entry => entry.id === item.id) || item;
    change(mergeComments(commentsRef.current, [{ ...latest, ...values, updatedAt: nextTimestamp(latest.updatedAt) }]));
  };
  const locate = item => {
    setActiveId(item.id); setTarget(null);
    if (window.innerWidth < 1100) setOpen(false);
    go(feedbackChapter(item));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const found = findAnchor(item);
      if (found) {
        let ancestor = found.parentElement;
        while (ancestor) { if (ancestor.tagName === 'DETAILS') ancestor.open = true; ancestor = ancestor.parentElement; }
        found.scrollIntoView({ block: 'center', behavior: 'instant' });
        setTarget(found);
        setMessage('已定位。页面选项可能已变化，批注中保留了当时的记录。');
      } else setMessage('已切换到对应章节；原文或界面状态已变化，请参考批注里的原文和页面选项。');
    }));
  };

  const importFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('文件超过 2 MB');
      const imported = normalizeDocument(JSON.parse(await file.text()));
      if (await change(mergeComments(commentsRef.current, imported.comments))) {
        setMessage('批注已合并；已有编号保留较新的修改。'); setFilter('all');
      }
    } catch (problem) { setError(problem.message || '导入失败，原批注未改动'); }
  };

  const active = comments.filter(item => !item.deletedAt);
  const pending = active.filter(item => item.status === 'open').length;
  const shown = active.filter(item => (filter === 'all' || filter === item.status) &&
    `${item.body} ${item.quote} ${item.chapterTitle}`.toLowerCase().includes(query.trim().toLowerCase()));
  const status = fileState === 'saved' ? (comments.length ? '已保存到项目文件' : '本机保存已就绪') : fileState === 'saving' ? '正在保存到项目…' :
    fileState === 'loading' ? '正在读取项目批注…' : storageOk ? '已保留在本浏览器' : '尚无可靠副本，请导出';

  return <div data-feedback-ui className="feedback-tool">
    {!open && !picking && <button ref={launcher} className="feedback-launcher" onClick={() => setOpen(true)} aria-label={`打开页面批注，${pending} 条待处理`}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 15a3 3 0 0 1-3 3H9l-5 4V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9Z" stroke="currentColor" strokeWidth="1.7"/><path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.7"/></svg>
      批注{pending > 0 && <span>{pending}</span>}
    </button>}
    {picking && <div className="feedback-pickbar" role="status"><span>拖选文字，或点击一处界面</span><button onClick={() => { stopPicking(); setOpen(true); }}>取消选择 <kbd>Esc</kbd></button></div>}
    {bounds && !picking && <div className="feedback-outline" style={bounds} aria-hidden="true"><span>批注位置</span></div>}
    {open && !picking && <aside className="feedback-panel" aria-label="页面批注">
      <div className="feedback-heading"><div><span className="feedback-eyebrow">边看边改</span><h2>页面批注 <small>{active.length}</small></h2></div><button aria-label="收起批注面板" onClick={() => { setOpen(false); setTarget(null); }}>×</button></div>
      <div className="feedback-save-state" role="status"><i className={fileState === 'saved' || storageOk ? '' : 'warning'}/>{status}</div>
      {fileState === 'failed' && <div className="feedback-warning">项目文件暂未同步：{fileError}。{storageOk ? '批注已保留在本浏览器，可导出备份。' : '浏览器副本也未保存，请先导出备份，不要刷新。'}<button onClick={syncFromFile}>重试同步</button></div>}
      {storageError && <div className="feedback-warning" role="alert">{storageError}</div>}
      {error && <div className="feedback-warning" role="alert">{error}<button aria-label="关闭批注提示" onClick={() => setError('')}>关闭提示</button></div>}
      <div className="feedback-scroll">
        {draft ? <form className="feedback-editor" onSubmit={saveDraft}>
          <div className="feedback-meta">{draft.chapterTitle} · {labelForKind[draft.kind]}</div>
          {draft.quote && <blockquote>{draft.quote}</blockquote>}
          <label htmlFor="feedback-body">{draft.id ? '编辑批注' : '你的意见'}</label>
          <textarea ref={textarea} id="feedback-body" disabled={savingDraft} value={draft.body} maxLength={10000} placeholder="例如：这一句我没看懂，请补充它和前一步的关系。" onChange={event => setDraft({ ...draft, body: event.target.value })} onKeyDown={event => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); saveDraft(event); }
          }}/>
          <div className="feedback-editor-actions"><button type="button" disabled={savingDraft} onClick={() => { setDraft(null); setTarget(null); }}>取消</button><button className="feedback-primary" type="submit" disabled={!draft.body.trim() || savingDraft}>{savingDraft ? '正在保存…' : '保存批注'}</button></div>
          <small>Ctrl / ⌘ + Enter 保存</small>
        </form> : <div className="feedback-new"><p>不必截图。选择文字、按钮或图表，再写下意见。</p><button className="feedback-primary" onClick={startPicking}>＋ 选择页面位置</button><button className="feedback-chapter-button" onClick={startChapter}>给「{chapters[chapter]}」整章留意见</button></div>}
        {message && <p className="feedback-message" role="status">{message}{undo.current && <button onClick={() => {
          const restore = { ...undo.current, updatedAt: nextTimestamp(commentsRef.current.find(item => item.id === undo.current.id)?.updatedAt) };
          delete restore.deletedAt;
          change(mergeComments(commentsRef.current, [restore])); undo.current = null; setMessage('已撤销删除。');
        }}>撤销删除</button>}</p>}
        <div className="feedback-filters" role="group" aria-label="筛选批注">{[['open', `待处理 ${pending}`], ['resolved', '已处理'], ['all', '全部']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        {active.length > 3 && <input className="feedback-search" aria-label="搜索批注" placeholder="搜索批注或引用原文" value={query} onChange={event => setQuery(event.target.value)}/>}
        <div className="feedback-list">
          {shown.length === 0 && <div className="feedback-empty">{active.length ? '这里暂时没有批注。' : '第一条意见从这里开始。\n文字、图表、交互都可以评论。'}</div>}
          {shown.map(item => <article className={`feedback-card ${activeId === item.id ? 'feedback-card-active' : ''}`} key={item.id}>
            <div className="feedback-card-top"><span>#{active.findIndex(entry => entry.id === item.id) + 1} · {item.chapterTitle}</span><span>{item.status === 'resolved' ? '已处理' : labelForKind[item.kind]}</span></div>
            {item.quote && <button className="feedback-quote" onClick={() => locate(item)} title="定位到页面位置">{item.quote}</button>}
            <p className="feedback-body">{item.body}</p>
            {item.context && <details className="feedback-context"><summary>记录时的页面选项</summary><p>{item.context}</p></details>}
            <div className="feedback-card-actions"><button onClick={() => locate(item)}>定位</button><button disabled={Boolean(draft)} onClick={() => { setDraft({ ...item }); setActiveId(item.id); }}>编辑</button><button onClick={() => updateComment(item, { status: item.status === 'open' ? 'resolved' : 'open' })}>{item.status === 'open' ? '标记已处理' : '恢复待处理'}</button><button aria-label={`删除第 ${active.findIndex(entry => entry.id === item.id) + 1} 条批注`} onClick={() => {
              undo.current = item; updateComment(item, { deletedAt: nextTimestamp(item.updatedAt) }); setMessage('批注已删除。');
            }}>删除</button></div>
          </article>)}
        </div>
      </div>
      <div className="feedback-bottom"><div className="feedback-transfer"><button onClick={() => download('whatsAI-comments.json', JSON.stringify(makeDocument(comments), null, 2), 'application/json')}>导出备份</button><button onClick={() => download('whatsAI-comments.md', commentsMarkdown(comments), 'text/markdown;charset=utf-8')}>导出清单</button><button onClick={() => upload.current?.click()}>导入</button><input type="file" ref={upload} accept=".json,application/json" onChange={importFile} hidden/></div><p>{localFile ? '写完后告诉我「按批注修改」，我能读取项目里的批注。' : '批注只保存在这个浏览器。导出 JSON 可换电脑，导出清单可发给我。'}</p><small>{localFile ? '本机文件 .feedback/comments.json · 不自动上传 GitHub' : '无需账号、API 或上传页面'}</small></div>
    </aside>}
  </div>;
}
