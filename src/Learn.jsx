import React,{useState} from 'react';
import {TRAIN_TEXT,VALID_TEXT,VOCAB,CONTEXT,EMBED,cleanData,samples,contextOf} from './model.js';
import {Tag,Fold,Intro,Workbar} from './ui.jsx';
import {Term} from './terms.jsx';
import {trainingRows} from './data-rows.js';
export {Concept} from './Concept.jsx';

export function DataPage({dedupe,setDedupe,go,model}) {
 const [tab,setTab]=useState('train'),[line,setLine]=useState(0),[pos,setPos]=useState(12);
 const rows=tab==='train'?trainingRows():VALID_TEXT.map((text,i)=>({text,line:i+1,duplicateOf:null})),text=rows[Math.min(line,rows.length-1)].text,at=Math.min(pos,text.length-1);
 const symbol=text[at],inputIds=contextOf(text.slice(0,at)),tokenId=inputIds.at(-1),inputSymbol=VOCAB[tokenId],vector=Array.from(model.E.slice(tokenId*EMBED,(tokenId+1)*EMBED));
 const changeLine=n=>{setLine(n);setPos(Math.min(12,rows[n].text.length-1))};
 return <><div className="split"><Intro no="02" title="模型需要从具体文本中学习。">
  <p>接下来亲手训练一个<strong>预测下一字的微型语言模型</strong>，从随机的初始数字开始学习。这是语言模型的一种训练任务；图片分类、语音识别等任务会使用不同的输入和目标。</p>
  <p>为此，先收集一批句子：把前文交给模型，再用原文紧接着的字检查预测。程序据此调整模型里的<Term name="参数"/>——参与预测、能通过训练修改的数字。</p>
  <p>用于调整参数的句子组成<strong>训练集</strong>。另留<strong>验证集</strong>只检查效果、不更新参数，观察模型在没有用于训练的文本上表现如何。下面选一句话，查看它怎样变成输入与目标。</p>
 </Intro><div className="interactive"><div className="workbench"><Workbar title="数据工作区"><Tag>训练文本</Tag></Workbar>
  <div className="file-layout"><div className="file-list"><button aria-pressed={tab==='train'} className={tab==='train'?'active':''} onClick={()=>{setTab('train');setLine(0)}}><b>训练集</b><small>train.txt · {cleanData(dedupe).length} 行</small></button><button aria-pressed={tab==='val'} className={tab==='val'?'active':''} onClick={()=>{setTab('val');setLine(0)}}><b>验证集</b><small>validation.txt · {VALID_TEXT.length} 行</small></button></div><div><p className="file-purpose">{tab==='train'?'train 是“训练”。这里的句子参与预测、计算损失和参数更新。':'validation 是“验证”。这些句子只用于检查效果，不参与参数更新。'} .txt 表示纯文本文件。</p><div className="data-lines" aria-label="文本样本">{rows.map((r,i)=>{const removed=tab==='train'&&dedupe&&r.duplicateOf!==null;return <button key={r.line} disabled={removed} aria-pressed={!removed&&line===i} className={[!removed&&line===i?'line-selected':'',removed?'line-removed':'',r.duplicateOf!==null?'line-duplicate':''].join(' ')} onClick={()=>changeLine(i)}><span className="line-number">{String(r.line).padStart(2,'0')}</span><span className="line-copy">{removed?<del>{r.text}</del>:r.text}</span>{r.duplicateOf!==null&&<small className="duplicate-label">{removed?'已移除':'重复'} · 同 {String(r.duplicateOf).padStart(2,'0')} 行</small>}</button>})}</div></div></div>
  {tab==='train'&&<div className="data-clean"><h3>体验一次数据清洗：去掉重复句子</h3><p>完全相同的句子重复出现，会让它在训练中被抽到更多次。这里演示去重；实际清洗还可能包括检查乱码、错误内容和数据来源。</p><label><input type="checkbox" checked={dedupe} onChange={e=>{setDedupe(e.target.checked);setLine(0)}}/> 移除 3 条重复文本</label><span role="status">原始 {TRAIN_TEXT.length} 行 · 已移除 1 行空白 · {dedupe?'已移除 3 条重复句，划线行不参与训练':'3 条重复句仍参与训练'} · 当前训练集 {cleanData(dedupe).length} 句</span><small className="reset-hint">切换此选项会用新数据重新开始工作台实验；此前的检查点会保留，避免把两份数据的曲线混在一起。</small></div>}
 </div><div className="tokenizer"><h3>一条句子怎样变成多个预测样本？</h3><p>点击一个字符，把它设为要预测的目标。绿色是模型得到的前文，黄色是训练程序用来检查预测的原文答案。</p><div className="tokens">{Array.from(text).map((c,i)=><button key={i} onClick={()=>setPos(i)} className={i===at?'target-token':i<at&&i>=at-CONTEXT?'context-token':''} aria-pressed={i===at} aria-label={`第${i+1}个字符 ${c}`}><b>{c}</b><small>{VOCAB.indexOf(c)}</small></button>)}</div>
  <div className="sample-pair"><div><small>输入 · 目标之前最多 {CONTEXT} 个字符</small><code>{contextOf(text.slice(0,at)).map(i=>VOCAB[i]).join(' ')}</code></div><div className="answer"><small>目标 · 原文中接着出现的字</small><strong>{symbol}</strong></div></div>
  <p className="caption">本实验每个字符是一个 <Term name="token"/>。字符下方显示它的 <Term name="词表编号"/>。{tab==='val'?'当前查看的是验证样本：构造方式相同，但只检查预测，不更新参数。':`当前训练集可得到 ${samples(cleanData(dedupe)).length} 个这样的预测样本。`}</p>
  {at<CONTEXT&&<p className="caption padding-hint">这里的前文只有 {at} 个字符，□ 补齐了空缺的位置，使模型每次都接收四个位置。</p>}
  <Fold title="字符下的数字如何进入模型？"><p>模型要用数字计算。<Term name="词表"/>先把字符与编号对应起来，再用编号取出一组可训练的数字，也就是字符的<Term name="向量"/>。本实验每个字符用 8 个数字表示（本实验选用 8 维）。训练会调整向量中的数字，字符编号保持不变。</p><div className="representation-demo"><div><small>{at===0?'输入补位符':'前文的最后一字'}</small><strong>{inputSymbol}</strong></div><div><small>词表编号</small><strong>{tokenId}</strong></div><div><small>按编号取出的 8 个数字</small><code>[{vector.map(v=>v.toFixed(3)).join(', ')}]</code></div></div></Fold>
 </div></div></div>
<div className="actions"><button className="primary" onClick={()=>go(2)}>用一条样本，走一次参数更新</button></div></>;
}
export {SingleStep} from './SingleStep.jsx';
