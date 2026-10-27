import React,{useState} from 'react';
import {TRAIN_TEXT,VALID_TEXT,VOCAB,CONTEXT,EMBED,HIDDEN,cleanData,samples,contextOf} from './model.js';
import {Tag,Fold,Intro,Workbar} from './ui.jsx';
import {Term} from './terms.jsx';
import {BatchExplanation} from './TrainingNotes.jsx';
export {Concept} from './Concept.jsx';

export function DataPage({dedupe,setDedupe,go,model}) {
 const [tab,setTab]=useState('train'),[line,setLine]=useState(0),[pos,setPos]=useState(12);
 const rows=tab==='train'?cleanData(dedupe):VALID_TEXT,text=rows[Math.min(line,rows.length-1)],at=Math.min(pos,text.length-1);
 const symbol=text[at],inputIds=contextOf(text.slice(0,at)),tokenId=inputIds.at(-1),inputSymbol=VOCAB[tokenId],vector=Array.from(model.E.slice(tokenId*EMBED,(tokenId+1)*EMBED));
 const changeLine=n=>{setLine(n);setPos(Math.min(12,rows[n].length-1))};
 return <><div className="split"><Intro no="02" title="模型需要从具体文本中学习。">
  <p>接下来亲手训练一个<strong>预测下一字的微型语言模型</strong>，从随机的初始数字开始学习。这是语言模型的一种训练任务；图片分类、语音识别等任务会使用不同的输入和目标。</p>
  <p>为此，先收集一批句子：把前文交给模型，再用原文紧接着的字检查预测。程序据此调整模型里的<Term name="参数"/>——参与预测、能通过训练修改的数字。</p>
  <p>用于调整参数的句子组成<strong>训练集</strong>。另留<strong>验证集</strong>只检查效果、不更新参数，观察模型在没有用于训练的文本上表现如何。下面选一句话，查看它怎样变成输入与目标。</p>
 </Intro><div className="interactive"><div className="workbench"><Workbar title="数据工作区"><Tag>实际教学数据</Tag></Workbar>
  <div className="file-layout"><div className="file-list"><button aria-pressed={tab==='train'} className={tab==='train'?'active':''} onClick={()=>{setTab('train');setLine(0)}}><b>训练集</b><small>train.txt · {cleanData(dedupe).length} 行</small></button><button aria-pressed={tab==='val'} className={tab==='val'?'active':''} onClick={()=>{setTab('val');setLine(0)}}><b>验证集</b><small>validation.txt · {VALID_TEXT.length} 行</small></button></div><div><p className="file-purpose">{tab==='train'?'train 是“训练”。这里的句子参与预测、计算损失和参数更新。':'validation 是“验证”。这些句子只用于检查效果，不参与参数更新。'} .txt 表示纯文本文件。</p><div className="data-lines" aria-label="文本样本">{rows.map((r,i)=><button key={i} aria-pressed={line===i} className={line===i?'line-selected':''} onClick={()=>changeLine(i)}><span>{String(i+1).padStart(2,'0')}</span>{r}</button>)}</div></div></div>
  <div className="data-clean"><h3>体验一次数据清洗：去掉重复句子</h3><p>完全相同的句子重复出现，会让它在训练中被抽到更多次。这里演示去重；实际清洗还可能包括检查乱码、错误内容和数据来源。</p><label><input type="checkbox" checked={dedupe} onChange={e=>{setDedupe(e.target.checked);setLine(0)}}/> 移除 3 条重复文本</label><span>原始 {TRAIN_TEXT.length} 行 · 已移除 1 行空白 · 当前训练集 {cleanData(dedupe).length} 句</span><small className="reset-hint">切换此选项会用新数据重新开始工作台实验；此前的检查点会保留，避免把两份数据的曲线混在一起。</small></div>
 </div><div className="tokenizer"><h3>一条句子怎样变成多个预测样本？</h3><p>点击一个字符，把它设为要预测的目标。绿色是模型得到的前文，黄色是训练程序用来检查预测的原文答案。</p><div className="tokens">{Array.from(text).map((c,i)=><button key={i} onClick={()=>setPos(i)} className={i===at?'target-token':i<at&&i>=at-CONTEXT?'context-token':''} aria-pressed={i===at} aria-label={`第${i+1}个字符 ${c}`}><b>{c}</b><small>{VOCAB.indexOf(c)}</small></button>)}</div>
  <div className="sample-pair"><div><small>输入 · 目标之前最多 {CONTEXT} 个字符</small><code>{contextOf(text.slice(0,at)).map(i=>VOCAB[i]).join(' ')}</code></div><div className="answer"><small>目标 · 原文中接着出现的字</small><strong>{symbol}</strong></div></div>
  <p className="caption">本实验每个字符是一个 <Term name="token"/>。字符下方显示它的 <Term name="词表编号"/>。{tab==='val'?'当前查看的是验证样本：构造方式相同，但只检查预测，不更新参数。':`当前训练集可得到 ${samples(cleanData(dedupe)).length} 个这样的预测样本。`}</p>
  {at<CONTEXT&&<p className="caption padding-hint">这里的前文只有 {at} 个字符，□ 补齐了空缺的位置，使模型每次都接收四个位置。</p>}
  <Fold title="字符下的数字如何进入模型？"><p>模型要用数字计算。<Term name="词表"/>先把字符与编号对应起来，再用编号取出一组可训练的数字，也就是字符的<Term name="向量"/>。本实验每个字符用 8 个数字表示（8 是设计小模型时选定的维度，不是统一规定）。训练会调整向量中的数字，字符编号保持不变。</p><div className="representation-demo"><div><small>{at===0?'输入补位符':'前文的最后一字'}</small><strong>{inputSymbol}</strong></div><div><small>词表编号</small><strong>{tokenId}</strong></div><div><small>按编号取出的 8 个数字</small><code>[{vector.map(v=>v.toFixed(3)).join(', ')}]</code></div></div></Fold>
 </div></div></div>
 <Fold title="训练前，模型已经存在了吗？配置和参数有什么区别？"><p>先由工程师确定结构并创建参数，训练才有可以调整的对象。本实验的<Term name="权重"/>从随机数字开始，<Term name="偏置"/>从 0 开始；这些初始值还没有从句子中学到规律。</p><p className="parameter-example">一个计算例子：<code>结果 = 权重 × 输入 + 偏置</code>。权重决定输入乘多少，偏置是再加上的数；两者都可以通过训练修改。</p><div className="table-scroll"><table className="config-explained"><thead><tr><th>本实验的设置</th><th>它控制什么</th><th>训练过程中怎样变化</th></tr></thead><tbody>
  <tr><td>{CONTEXT} 个输入字符</td><td>每次预测能读取多长的前文</td><td>结构设置，本实验固定；其他模型可不同</td></tr><tr><td>{EMBED} 维字符向量</td><td>每个字符用 8 个数字参与计算</td><td>维度固定，里面的数字会学习</td></tr><tr><td>{HIDDEN} 个隐藏层单元</td><td>中间一层进行 24 组计算，再计算各字符概率</td><td>单元数固定，与它们相关的权重和偏置会学习</td></tr><tr><td>{model.parameterCount.toLocaleString()} 个可训练参数</td><td>词表大小与上述结构共同决定的数字总数</td><td>参数总数固定，各参数数值按训练结果更新</td></tr></tbody></table></div><p>工程师还能设置<Term name="学习率"/>、<Term name="批次"/>和<Term name="训练步"/>数。这些控制训练过程的设置叫超参数，不是模型学出的数字。</p>
  <BatchExplanation/>
  <p><strong>行业里怎样选结构？</strong>在大语言模型领域，<Term name="Transformer"/>及其变体是一条主流架构路线，例如公开的 Qwen3 系列。它的<Term name="注意力层"/>能根据输入组合不同位置的信息。这里的微型前馈网络用于看清训练计算；它的 4 字符、8 维配置不代表主流大模型配置。</p>
  <p className="caption">架构是模型怎样组成，训练框架是实现计算的软件工具，例如 PyTorch。做具体应用时，可以先测试已有模型，再按需要微调，通常比从零训练所需的数据和计算更少。不同任务仍要验证效果。参考：<a href="https://huggingface.co/docs/transformers/en/model_doc/qwen3" target="_blank" rel="noreferrer">Qwen3 结构</a> · <a href="https://huggingface.co/docs/transformers/en/training" target="_blank" rel="noreferrer">微调实践</a>。</p>
  <Fold title="参考一个真实 Transformer 的配置：GPT-2 小型版本"><p>以下是公开的历史模型配置，用来理解各字段，不是所有语言模型的推荐配置。</p><div className="table-scroll"><table className="config-explained"><thead><tr><th>配置字段</th><th>数值</th><th>含义</th></tr></thead><tbody><tr><td>n_positions</td><td>1,024</td><td>支持的位置数量，不等于 1,024 个汉字</td></tr><tr><td>n_embd</td><td>768</td><td>每个 token 表示中的数字个数</td></tr><tr><td>n_layer</td><td>12</td><td>堆叠 12 个 Transformer 块</td></tr><tr><td>n_head</td><td>12</td><td>每层注意力的头数</td></tr><tr><td>vocab_size</td><td>50,257</td><td>词表中的 token 数量</td></tr></tbody></table></div><p>这些字段规定结构，通常在一次训练中保持固定。改变维度或层数往往会改变参数形状，不能直接套用原有参数文件。</p><a href="https://huggingface.co/openai-community/gpt2/blob/main/config.json" target="_blank" rel="noreferrer">查看 GPT-2 配置原文件</a> · <a href="https://arxiv.org/abs/1706.03762" target="_blank" rel="noreferrer">Transformer 原论文</a></Fold>
 </Fold><div className="actions"><button className="primary" onClick={()=>go(2)}>用一条样本，走一次参数更新</button></div></>;
}
export {SingleStep} from './SingleStep.jsx';
