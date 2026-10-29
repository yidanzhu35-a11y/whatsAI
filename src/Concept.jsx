import React,{useState} from 'react';
import {modelTypes,trainingStages,learningRoutes,conceptScenario} from './concept-data.js';
import {Term,ExplainText,ChoiceHelp} from './terms.jsx';
import {Note} from './ui.jsx';

export function Concept({go}) {
  const [type,setType]=useState(modelTypes[0]),[stage,setStage]=useState(trainingStages[0]),[route,setRoute]=useState(learningRoutes[0]);
  const s=conceptScenario(type,stage,route);
  return <>
    <section className="concept-explorer" aria-label="自由组合概念">
      <div className="concept-dimensions">
        {[[type,setType,modelTypes,'希望模型具备什么能力','模型方向'],[stage,setStage,trainingStages,'处在训练的哪一阶段','训练阶段'],[route,setRoute,learningRoutes,'用什么依据改进结果','学习方式或优化路线']].map(([value,setValue,options,question,label])=><fieldset key={label}><legend>{label}</legend><p>{question}</p><div className="choice-row">{options.map(option=><ChoiceHelp key={option} name={option} selected={value===option} onChoose={()=>setValue(option)}/>)}</div></fieldset>)}
      </div>
      <div className="combination" aria-label="当前组合"><span>{type}</span><span>{stage}</span><span>{route}</span></div>
      <article className="scenario" aria-live="polite" key={`${type}-${stage}-${route}`}>
        <div className="eyebrow">场景案例 · 假设业务</div><h2>{s.title}</h2><p className="lead-small">{s.who}</p>
        {s.caveat&&<Note title="这个组合需要这样理解">{s.caveat}</Note>}
        <dl><div><dt>从哪里开始</dt><dd><ExplainText>{s.start}</ExplainText></dd></div><div><dt>准备什么数据</dt><dd>{s.data}</dd></div><div><dt>改进的依据</dt><dd><div><Term name="学习信号"/></div><ExplainText>{s.target}</ExplainText></dd></div><div><dt>训练改变什么</dt><dd><ExplainText>{s.change}</ExplainText></dd></div><div><dt>最后得到什么</dt><dd>{s.result}</dd></div></dl>
        {type!=='具身智能模型'&&route==='监督学习'&&<p className="route-context">这条路线属于监督学习（SL）。在已有模型上用输入和目标继续训练，叫监督微调（<Term name="SFT"/>）；语言助手常用问题和示范回答作为数据。</p>}
        {type!=='具身智能模型'&&route==='偏好优化'&&<p className="route-context">偏好比较可以用于不同方法：<Term name="DPO"/> 直接利用比较数据优化模型；经典 <Term name="RLHF"/> 则先训练评分模型，再进行强化学习。</p>}
        {type!=='具身智能模型'&&route==='强化学习'&&<p className="route-context">强化学习简称 RL。本例用程序得分作为<Term name="奖励"/>；如果奖励依据来自人类反馈，则可能采用 <Term name="RLHF"/> 路线。</p>}
        {type==='具身智能模型'&&<><p className="route-context">具身智能强调感知环境并采取行动，常同时处理图像、语言和设备状态，因此也可能采用多模态模型。{route==='监督学习'?'这里通过示范动作进行监督训练；在已有策略上适应新任务，就是任务微调。':route==='偏好优化'?<>这里以人类对动作的比较训练奖励模型，再进行强化学习，是 <Term name="RLHF"/> 的一种应用。</>:route==='强化学习'?<>这里用程序计算的任务得分作为<Term name="奖励"/>。</>:''}</p><a className="source-link" href="https://huggingface.co/docs/lerobot/index" target="_blank" rel="noreferrer">延伸阅读：LeRobot 的机器人数据与训练</a></>}
      </article>
    </section>
    <div className="actions"><button className="primary" onClick={()=>go(1)}>从一份数据开始</button></div>
  </>;
}
