const normalize = value => (value || '').replace(/\s+/g, ' ').trim();
const root = () => document.querySelector('.site');
const label = element => normalize(element?.getAttribute('aria-label') || element?.innerText || element?.textContent || element?.getAttribute('title') || '');
const isTool = element => element?.closest?.('[data-feedback-ui]');

function selectorFor(element) {
  const parts = [];
  for (let current = element; current && current !== root(); current = current.parentElement) {
    const tag = current.tagName.toLowerCase();
    const siblings = [...current.parentElement.children].filter(sibling => sibling.tagName === current.tagName);
    parts.unshift(`${tag}:nth-of-type(${siblings.indexOf(current) + 1})`);
  }
  return `.site > ${parts.join(' > ')}`;
}

export function pageContext() {
  const main = document.querySelector('#main');
  if (!main) return '';
  const values = [...main.querySelectorAll('select')].map(select => {
    const name = select.getAttribute('aria-label') || select.closest('label')?.childNodes[0]?.textContent || '选项';
    return `${normalize(name)}：${select.selectedOptions[0]?.text || select.value}`;
  });
  for (const element of main.querySelectorAll('.combination, button.selected, .run-stats')) {
    values.push(label(element));
  }
  return [...new Set(values.filter(Boolean))].join('；').slice(0, 1600);
}

export function captureAnchor(target) {
  const selection = window.getSelection();
  let element = target instanceof Element ? target : target?.parentElement;
  const selected = selection?.toString().trim();
  let kind = 'element';
  let quote;
  if (selected && selection.rangeCount) {
    const range = selection.getRangeAt(0);
    const common = range.commonAncestorContainer;
    const candidate = common.nodeType === Node.ELEMENT_NODE ? common : common.parentElement;
    if (root()?.contains(candidate) && !isTool(candidate)) {
      element = candidate;
      quote = selected;
      kind = 'text';
    }
  }
  if (!root()?.contains(element) || isTool(element)) return null;
  if (kind === 'element') {
    element = element.closest('canvas,svg,button,input,select,summary,h1,h2,h3,p,li,dt,dd,label,.tag,.workbar') || element;
    quote = label(element) || (element.tagName === 'INPUT' ? `输入控件：${element.type}` : '选中的界面区域');
  }
  return {
    element,
    anchor: { kind, quote: quote.slice(0, 1600), selector: selectorFor(element).slice(0, 1600), context: pageContext() },
  };
}

export function findAnchor(comment) {
  if (comment.kind === 'chapter') return document.querySelector('#main h1');
  const quote = normalize(comment.quote);
  let candidate;
  try { candidate = document.querySelector(comment.selector); } catch { /* Changed or imported selector. */ }
  if (candidate && root()?.contains(candidate) && !isTool(candidate) &&
      (label(candidate).includes(quote) || quote === '选中的界面区域')) return candidate;
  // Fall back to the smallest matching block when surrounding markup has changed.
  const matches = [...(root()?.querySelectorAll('h1,h2,h3,p,li,dt,dd,button,summary,label,div,span,canvas,svg') || [])]
    .filter(element => !isTool(element) && label(element).includes(quote));
  matches.sort((a, b) => label(a).length - label(b).length);
  return matches[0] || null;
}
