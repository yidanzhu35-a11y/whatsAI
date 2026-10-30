import React,{useState,useEffect,useRef,useSyncExternalStore} from 'react';

// 展示文案编辑层：只有被 <Copy> 标注的文案可改，数据/逻辑字符串天然不可改。
// 每个覆盖项存 {from: 源码里的默认文案, to: 当前文案}；to 为空字符串表示删除该处文案。

const STORAGE_KEY='whatsai-copy-overrides-v1';
const overrides=new Map();
let editMode=false;
let version=0;
const listeners=new Set();

function load(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return;
    for(const [k,v] of Object.entries(JSON.parse(raw))){
      if(v&&typeof v==='object')overrides.set(k,{from:String(v.from??''),to:String(v.to??'')});
    }
  }catch{}
}
load();

function persist(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(Object.fromEntries(overrides)));}catch{}
}
function bump(){version++;listeners.forEach(f=>f())}

export function copySubscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}
export function copyVersion(){return version}
function useCopyVersion(){return useSyncExternalStore(copySubscribe,copyVersion,copyVersion)}
export function isEditMode(){return editMode}
export function setEditMode(v){editMode=!!v;bump()}
export function setOverride(id,to,from){
  if(to==null)overrides.delete(id);
  else overrides.set(id,{from:String(from??''),to:String(to)});
  persist();bump();
}
export function resetAllOverrides(){overrides.clear();try{localStorage.removeItem(STORAGE_KEY)}catch{};bump()}
export function overrideCount(){return overrides.size}
export function overrideList(){return [...overrides.entries()].map(([id,v])=>({id,from:v.from,to:v.to}))}

function textOf(children){
  const arr=React.Children.toArray(children);
  if(arr.length===0)return '';
  if(arr.every(c=>typeof c==='string'||typeof c==='number'))return arr.map(String).join('');
  return '';
}

function CopyEditor({id,base}){
  const [draft,setDraft]=useState(base);
  const input=useRef(null);
  const multi=base.length>46||base.includes('\n');
  useEffect(()=>{input.current?.focus();input.current?.select()},[]);
  const commit=()=>{
    if(draft!==base)setOverride(id,draft,base);
    input.current?.blur();
  };
  const cancel=()=>{setDraft(base);input.current?.blur()};
  const common={ref:input,className:'copy-edit',value:draft,onChange:e=>setDraft(e.target.value),
    onBlur:commit,onKeyDown:e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel()}
      else if(e.key==='Enter'&&(!multi||e.ctrlKey||e.metaKey)){e.preventDefault();commit()}
    },title:'修改展示文案：点外部或 Ctrl/⌘+Enter 保存，Esc 取消；清空并保存=删除这句话'};
  return <span className="copy-edit-wrap" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
    {multi?<textarea rows={Math.min(6,Math.max(2,draft.split('\n').length))} {...common}/>:<input {...common}/>}
  </span>;
}

export function Copy({id,children,value}){
  useCopyVersion();
  const rich=React.Children.count(children)>0;
  const base=value!==undefined?String(value):textOf(children);
  if(!isEditMode()){
    const stored=overrides.get(id);
    if(stored&&stored.to==='')return null;
    if(stored)return <>{stored.to}</>;
    return rich?<>{children}</>:<>{base}</>;
  }
  const current=overrides.get(id)?.to??base;
  return <CopyEditor id={id} base={current}/>;
}

export function CopyToolbar(){
  useCopyVersion();
  const editing=isEditMode();
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    if(!editing)return;
    const block=e=>{
      if(e.target.closest?.('.copy-edit')||e.target.closest?.('[data-copy-ui]')||e.target.closest?.('[data-feedback-ui]')||e.target.closest?.('[data-gloss-dialog]'))return;
      if(!e.target.closest?.('.site'))return;
      e.preventDefault();e.stopImmediatePropagation();
    };
    document.addEventListener('click',block,true);
    document.addEventListener('pointerdown',block,true);
    return()=>{
      document.removeEventListener('click',block,true);
      document.removeEventListener('pointerdown',block,true);
    };
  },[editing]);
  const count=overrideCount();
  const exportJson=()=>{
    const data=overrideList();
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='whatsAI-copy-overrides.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  };
  return <div data-copy-ui className="copy-tool">
    <button className={'copy-launcher'+(editing?' active':'')} onClick={()=>{setEditMode(!editing);setOpen(!open)}}>
      {editing?'完成编辑':'文本编辑'}{count>0&&<span>{count}</span>}
    </button>
    {editing&&open&&<aside className="copy-panel" aria-label="文本编辑">
      <div className="copy-heading"><span className="copy-eyebrow">改字不动交互</span><h2>文本编辑</h2></div>
      <p>点任意有虚线的文字即可修改。清空并保存 = 从页面删除这句话。编辑模式下页面交互暂停，点「完成编辑」恢复。</p>
      <p className="copy-note">训练数据、数值结果和概念名称不可编辑；改动会保存在本浏览器，也可导出 JSON 让我落回源码。</p>
      <div className="copy-actions">
        <button className="copy-primary" onClick={exportJson}>导出修改清单</button>
        <button disabled={count===0} onClick={()=>{if(confirm('确定清空全部文本修改，恢复默认文案？'))resetAllOverrides()}}>恢复全部默认</button>
      </div>
    </aside>}
  </div>;
}
