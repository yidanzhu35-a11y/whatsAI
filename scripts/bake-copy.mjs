#!/usr/bin/env node
// 把页面导出的 copy overrides JSON 机械烘焙回 src/ 源文件。
// 用法：node scripts/bake-copy.mjs <path-to-overrides.json>
// 先验证全部记录，再统一写入；任何硬失败都不会改动文件。
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const jsonPath=process.argv[2];
if(!jsonPath){console.error('usage: node scripts/bake-copy.mjs <overrides.json>');process.exit(2)}
const records=JSON.parse(readFileSync(jsonPath,'utf8'));

const fileFor=id=>{
  if(id.startsWith('title:')||id.startsWith('subtitle:'))return 'src/content.js';
  if(id.startsWith('cd-')||id.startsWith('sc:'))return 'src/Concept.jsx';
  if(id.startsWith('dp-'))return 'src/Learn.jsx';
  if(id.startsWith('ms-'))return 'src/ModelSetup.jsx';
  if(id.startsWith('ss-'))return 'src/SingleStep.jsx';
  if(id.startsWith('tb-')||id.startsWith('cp-')||id.startsWith('rc-')||id.startsWith('um-'))return 'src/Workbench.jsx';
  if(id.startsWith('tn-'))return 'src/TrainingNotes.jsx';
  if(id.startsWith('br-'))return 'src/Branches.jsx';
  if(id.startsWith('ap-'))return 'src/App.jsx';
  if(id.startsWith('term:'))return 'src/terms.jsx';
  throw new Error('no target file mapping for '+id);
};

function quoteJs(s){return "'"+s.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'"}

// ---- content.js：按数组下标替换元素 ----
function bakeContent(content,rec){
  const [,kind,idxRaw]=rec.id.match(/^(title|subtitle):(\d+)$/);
  const idx=+idxRaw;
  const constName=kind==='subtitle'?'subtitles':'titles';
  const re=new RegExp('export const '+constName+" = \\[([^\\]]*)\\]");
  const m=content.match(re);
  if(!m)throw new Error(rec.id+': '+constName+' array not found');
  const elems=[...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x=>x[1]);
  if(idx>=elems.length)throw new Error(rec.id+': index out of range');
  if(elems[idx]!==rec.from){
    console.log('  WARN '+rec.id+': current source is “'+elems[idx]+'”, not the recorded “'+rec.from+'” (stale browser tab); replacing with target anyway');
  }
  let n=0;
  const rebuilt=m[1].replace(/'((?:[^'\\]|\\.)*)'/g,full=>{const i=n++;return i===idx?quoteJs(rec.to):full});
  return content.replace(re,whole=>whole.replace(m[1],rebuilt));
}

// ---- JSX：在对应 Copy 元素的文本区内替换 ----
function bakeJsx(content,rec){
  const idPatterns=[
    'id="'+rec.id+'"',
    'id={`'+rec.id+'`}',
  ];
  let idAt=-1,idLen=0;
  for(const p of idPatterns){const i=content.indexOf(p);if(i>=0){idAt=i;idLen=p.length;break}}
  if(idAt<0)throw new Error(rec.id+': Copy id not found in source');
  const openEnd=content.indexOf('>',idAt+idLen);
  if(openEnd<0)throw new Error(rec.id+': malformed opening tag');
  const close=content.indexOf('</Copy>',openEnd);
  if(close<0)throw new Error(rec.id+': closing tag not found');
  const region=content.slice(openEnd+1,close);
  const occurrences=region.split(rec.from).length-1;
  if(occurrences===0)throw new Error(rec.id+': source text “'+rec.from+'” not found inside Copy');
  if(occurrences>1)throw new Error(rec.id+': source text appears '+occurrences+' times inside Copy (ambiguous)');
  if(rec.to===''){
    console.log('  NOTE '+rec.id+': empty target — Copy element left with empty children (renders nothing); review manually');
  }
  const nextRegion=region.replace(rec.from,rec.to);
  return content.slice(0,openEnd+1)+nextRegion+content.slice(close);
}

// ---- 第一阶段：全部验证 ----
const targets=new Map();
for(const rec of records){
  const rel=fileFor(rec.id);
  if(!targets.has(rel))targets.set(rel,readFileSync(path.join(root,rel),'utf8'));
  const cur=targets.get(rel);
  targets.set(rel,rel==='src/content.js'?bakeContent(cur,rec):bakeJsx(cur,rec));
}

// ---- 第二阶段：写入 ----
for(const [rel,next] of targets){
  writeFileSync(path.join(root,rel),next,'utf8');
  console.log('baked -> '+rel);
}
console.log('done: '+records.length+' record(s) applied');
