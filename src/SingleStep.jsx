import React,{useRef,useState} from 'react';
import {TinyLM,VOCAB,contextOf,distribution} from './model.js';
import {Tag,Fold,Intro,ProbBars,fmt,pct,PROMPT,RAIN} from './ui.jsx';
import {Term} from './terms.jsx';
import {Copy} from './copy.jsx';
import {BatchExplanation} from './TrainingNotes.jsx';
import {ModelSetup} from './ModelSetup.jsx';

export function SingleStep({go}) {
  const model=useRef(null);
  if(!model.current) model.current=new TinyLM(42);
  const [stage,setStage]=useState(0),[setupOpen,setSetupOpen]=useState(true),[round,setRound]=useState(0);
  const [before,setBefore]=useState(null),[after,setAfter]=useState(null),[gradient,setGradient]=useState(null),[oldBias,setOldBias]=useState(null);
  const loss=before?-Math.log(before[RAIN]):null;
  const prepare=()=>{setBefore(null);setAfter(null);setGradient(null);setOldBias(null);setStage(0)};
  const reset=()=>{model.current=new TinyLM(42);setRound(0);prepare();setSetupOpen(true)};
  const next=()=>{
    if(stage===0){setBefore(distribution(model.current,PROMPT));setStage(1)}
    else if(stage===1) setStage(2);
    else if(stage===2){setGradient(model.current.gradients([{x:contextOf(PROMPT),y:RAIN}]).g);setOldBias(model.current.b2[RAIN]);setStage(3)}
    else if(stage===3){model.current.apply(gradient,1);setAfter(distribution(model.current,PROMPT));setRound(n=>n+1);setStage(4)}
    else prepare();
  };
  const stages=[
    ['准备一条输入和目标',<><Copy id="ss-st0-1">“一次训练更新”是用样本做预测、检查差距，再修改一次参数。这里先用一条样本：输入“后下起了”，目标是原文接着出现的“雨”。</Copy><strong><Copy id="ss-st0-2">先点“送入前文，计算预测”。</Copy></strong></>],
    ['模型已经给出预测',<><Copy id="ss-st1-1">下方概率来自模型当前的</Copy><Term name="参数"/><Copy id="ss-st1-2">{`。“雨”的概率是 ${pct(before?.[RAIN]??0)}。接下来把它与原文答案比较，用一个数表示这条样本的预测差距，这个数叫`}</Copy><Term name="损失"/><Copy id="ss-st1-3">。</Copy></>],
    ['已算出这条样本的损失',<><Copy id="ss-st2-1">目标是“雨”。本例用</Copy><Term name="交叉熵"/><Copy id="ss-st2-2">把模型给“雨”的概率转换为损失：目标概率越低，损失越大。算出损失后，参数仍没有改变。</Copy></>],
    ['已算出每个参数的调整依据',<><Term name="反向传播"/><Copy id="ss-st3-1">计算了每个参数的</Copy><Term name="梯度"/><Copy id="ss-st3-2">。梯度描述稍微改变这个数时损失怎样变化。下面展示“雨”的一个</Copy><Term name="偏置"/><Copy id="ss-st3-3">参数；下一步才真正修改参数。</Copy></>],
    ['完成一次参数更新',<><Term name="优化器"/><Copy id="ss-st4-1">已按梯度修改参数，再用相同前文计算一次预测。对比两栏：目标“雨”的概率提高，损失降低。重复这一流程，才是持续训练。</Copy></>],
  ];
  const actions=['送入前文，计算预测','对照“雨”，计算损失','计算参数梯度','按梯度更新参数','准备下一次更新'];
  if(setupOpen)return <ModelSetup model={model.current} started={stage>0||round>0} onContinue={()=>{setSetupOpen(false);window.scrollTo({top:0,behavior:'instant'})}}/>;
  return <>
    <div className="context-line"><span><Copy id="ss-context">本例：1 条样本 → 1 次参数更新</Copy></span><button className="text-button" onClick={()=>{setSetupOpen(true);window.scrollTo({top:0,behavior:'instant'})}}><Copy id="ss-view-structure">查看模型结构</Copy></button><Tag>本机真实计算</Tag></div>
    <ol className="step-progress" aria-label="训练步骤">{['送入前文并预测','对照目标算损失','计算梯度','更新参数'].map((label,i)=><li key={label} className={stage>i?'done':stage===i?'current':''}><span>{i+1}. <Copy id={`ss-progress-l${i}`}>{label}</Copy></span><small><Copy id={`ss-progress-s${i}`}>{stage>i?'已完成':stage===i?'接下来':'待执行'}</Copy></small></li>)}</ol>
    <div className="split single"><Intro no={stage===0?'准备':String(stage).padStart(2,'0')} title={<Copy id={`ss-st${stage}-title`}>{stages[stage][0]}</Copy>}><p>{stages[stage][1]}</p>
      <p className="caption"><Copy id="ss-caption-1">{`已完成 ${round} 次参数更新`}</Copy><Copy id="ss-caption-2">{stage>0&&stage<4?'；本轮还没有修改参数。':'。'}</Copy></p>
      {stage>=2&&<div className="loss-readout"><small><Copy id="ss-loss-before">更新前 · 这条样本的损失</Copy></small><b>{fmt(loss)}</b><span>−ln({before[RAIN].toFixed(4)})</span><small><Copy id="ss-loss-note">只需要记住：给原文答案的概率越高，这个分数越低。它不是错误百分比。</Copy></small></div>}
      {stage===4&&<p className="success-text"><Copy id="ss-success">更新后损失：</Copy>{fmt(-Math.log(after[RAIN]))}</p>}
    </Intro><div className="interactive">
      <h2><Copy id="ss-h2">一条训练样本</Copy></h2><div className="source-sentence">天空乌云密布，随后下起了雨。</div>
      <div className="sample-pair"><div><small><Copy id="ss-in-label">送给模型的输入 · 前文末四字</Copy></small><code>{contextOf(PROMPT).map(i=>VOCAB[i]).join(' · ')}</code></div><div className="answer"><small><Copy id="ss-target-label">留给训练程序核对的目标</Copy></small><strong>雨</strong></div></div>
      <div className="calculation-status" role="status"><Copy id="ss-status">{['尚未送入模型，没有本轮预测。','预测已算出，参数未改变。','损失已算出，参数未改变。','梯度已算出，参数未改变。','参数已改变，同一输入已重新计算。'][stage]}</Copy></div>
      {before?<div className="prob-comparison"><ProbBars p={before} title={<Copy id="ss-prob-before">更新前的预测</Copy>}/>{after?<ProbBars p={after} title={<Copy id="ss-prob-after">更新后的预测</Copy>} comparison/>:<div className="prediction-pending"><strong><Copy id="ss-pending-title">更新后的预测</Copy></strong><p><Copy id="ss-pending-text">完成参数更新后，这里才会显示新的概率。</Copy></p></div>}</div>:<div className="prediction-pending initial"><p><Copy id="ss-init-text">点下方按钮，观察模型对“雨”“雪”等字符给出多大概率。</Copy></p></div>}
      {stage===3&&<div className="gradient-readout"><span><Copy id="ss-grad-label">偏置 b[雨]：模型给“雨”算分时加上的数字</Copy></span><div><code>旧值 {fmt(oldBias)}</code><span>梯度 {fmt(gradient.b2[RAIN])}</span><span>学习率 1.0</span></div><small><Copy id="ss-grad-note">新值 = 旧值 − 学习率 × 梯度。这里梯度为负，更新会增大这个偏置。其他参数按各自梯度更新。</Copy></small></div>}
      {stage===4&&<p className="update-result" role="status"><Copy id="ss-update">{`b[雨]：${fmt(oldBias)} → ${fmt(model.current.b2[RAIN])}；“雨”的概率：${pct(before[RAIN])} → ${pct(after[RAIN])}。`}</Copy></p>}
      <div className="actions"><button className="primary" onClick={next}><Copy id={`ss-action-${stage}`}>{actions[stage]}</Copy></button><button className="text-button" onClick={reset}><Copy id="ss-reset">重置这个演示</Copy></button></div>
      <p className="caption"><Copy id="ss-caption-3">重置会清除本页更新，恢复初始参数。连续训练工作台使用独立模型，从初始参数开始读取整份训练集。</Copy></p>
    </div></div>
    <Fold title={<Copy id="ss-fold-title">真实训练每一步只用一条样本吗？</Copy>}><p><Copy id="ss-fold-p1">常见做法是每步用一批样本，汇总它们的损失和梯度，再更新一次参数，避免只依赖某一条样本。语言模型也常在一段文本的多个位置同时计算预测损失。</Copy></p><BatchExplanation/><a href="https://docs.pytorch.org/tutorials/beginner/basics/optimization_tutorial.html" target="_blank" rel="noreferrer"><Copy id="ss-fold-ref">参考：PyTorch 训练循环</Copy></a></Fold>
    <div className="section-next"><button className="primary" onClick={()=>go(3)}><Copy id="ss-next">进入连续训练工作台</Copy></button></div>
  </>;
}
