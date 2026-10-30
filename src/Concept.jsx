import React,{useState} from 'react';
import {modelTypes,trainingStages,learningRoutes,conceptScenario} from './concept-data.js';
import {Term,ExplainText,ChoiceHelp} from './terms.jsx';
import {Note} from './ui.jsx';
import {Copy} from './copy.jsx';

export function Concept({go}) {
  const [type,setType]=useState(modelTypes[0]),[stage,setStage]=useState(trainingStages[0]),[route,setRoute]=useState(learningRoutes[0]);
  const s=conceptScenario(type,stage,route),sid=`${type}-${stage}-${route}`;
  return <>
    <section className="concept-explorer" aria-label="自由组合概念">
      <div className="concept-dimensions">
        {[[type,setType,modelTypes,'希望模型具备什么能力','模型方向'],[stage,setStage,trainingStages,'处在训练的哪一阶段','训练阶段'],[route,setRoute,learningRoutes,'用什么依据改进结果','学习方式或优化路线']].map(([value,setValue,options,question,label],i)=><fieldset key={label}><legend><Copy id={`cd-l${i}`}>{label}</Copy></legend><p><Copy id={`cd-q${i}`}>{question}</Copy></p><div className="choice-row">{options.map(option=><ChoiceHelp key={option} name={option} selected={value===option} onChoose={()=>setValue(option)}/>)}</div></fieldset>)}
      </div>
      <div className="combination" aria-label="当前组合"><span>{type}</span><span>{stage}</span><span>{route}</span></div>
      <article className="scenario" aria-live="polite" key={sid}>
        <div className="eyebrow"><Copy id="cd-scenario-eyebrow">场景案例 · 假设业务</Copy></div><h2><Copy id={`sc:${sid}:title`} value={s.title}></Copy></h2><p className="lead-small"><Copy id={`sc:${sid}:who`} value={s.who}></Copy></p>
        {s.caveat&&<Note title={<Copy id="cd-note-title">这个组合需要这样理解</Copy>}><Copy id={`sc:${sid}:caveat`} value={s.caveat}></Copy></Note>}
        <dl><div><dt><Copy id="cd-dt-start">从哪里开始</Copy></dt><dd><Copy id={`sc:${sid}:start`} value={s.start}><ExplainText>{s.start}</ExplainText></Copy></dd></div><div><dt><Copy id="cd-dt-data">准备什么数据</Copy></dt><dd><Copy id={`sc:${sid}:data`} value={s.data}></Copy></dd></div><div><dt><Copy id="cd-dt-target">改进的依据</Copy></dt><dd><div><Term name="学习信号"/></div><Copy id={`sc:${sid}:target`} value={s.target}><ExplainText>{s.target}</ExplainText></Copy></dd></div><div><dt><Copy id="cd-dt-change">训练改变什么</Copy></dt><dd><Copy id={`sc:${sid}:change`} value={s.change}><ExplainText>{s.change}</ExplainText></Copy></dd></div><div><dt><Copy id="cd-dt-result">最后得到什么</Copy></dt><dd><Copy id={`sc:${sid}:result`} value={s.result}></Copy></dd></div></dl>
        {type!=='具身智能模型'&&route==='监督学习'&&<p className="route-context"><Copy id="cd-route-sl-1">这条路线属于监督学习（SL）。在已有模型上用输入和目标继续训练，叫监督微调（</Copy><Term name="SFT"/><Copy id="cd-route-sl-2">）；语言助手常用问题和示范回答作为数据。</Copy></p>}
        {type!=='具身智能模型'&&route==='偏好优化'&&<p className="route-context"><Copy id="cd-route-pref-1">偏好比较可以用于不同方法：</Copy><Term name="DPO"/><Copy id="cd-route-pref-2"> 直接利用比较数据优化模型；经典 </Copy><Term name="RLHF"/><Copy id="cd-route-pref-3"> 则先训练评分模型，再进行强化学习。</Copy></p>}
        {type!=='具身智能模型'&&route==='强化学习'&&<p className="route-context"><Copy id="cd-route-rl-1">强化学习简称 RL。本例用程序得分作为</Copy><Term name="奖励"/><Copy id="cd-route-rl-2">；如果奖励依据来自人类反馈，则可能采用 </Copy><Term name="RLHF"/><Copy id="cd-route-rl-3"> 路线。</Copy></p>}
        {type==='具身智能模型'&&<><p className="route-context"><Copy id="cd-emb-1">具身智能强调感知环境并采取行动，常同时处理图像、语言和设备状态，因此也可能采用多模态模型。</Copy>{route==='监督学习'?<Copy id="cd-emb-sl">这里通过示范动作进行监督训练；在已有策略上适应新任务，就是任务微调。</Copy>:route==='偏好优化'?<><Copy id="cd-emb-pref-1">这里以人类对动作的比较训练奖励模型，再进行强化学习，是 </Copy><Term name="RLHF"/><Copy id="cd-emb-pref-2"> 的一种应用。</Copy></>:route==='强化学习'?<><Copy id="cd-emb-rl-1">这里用程序计算的任务得分作为</Copy><Term name="奖励"/><Copy id="cd-emb-rl-2">。</Copy></>:''}</p><a className="source-link" href="https://huggingface.co/docs/lerobot/index" target="_blank" rel="noreferrer"><Copy id="cd-emb-source">延伸阅读：LeRobot 的机器人数据与训练</Copy></a></>}
      </article>
    </section>
    <div className="actions"><button className="primary" onClick={()=>go(1)}><Copy id="cd-action">从一份数据开始</Copy></button></div>
  </>;
}
