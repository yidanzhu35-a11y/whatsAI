import React from 'react';
import {Term} from './terms.jsx';

export function BatchExplanation({batch=24,steps=300}) {
  return <div className="batch-explanation">
    <strong>批次大小回答“每步用多少”，训练步数回答“更新多少次”。</strong>
    <p>每步抽取 <b>{batch}</b> 个“前文 → 下一字”样本，合起来计算一次更新；重复 <b>{steps}</b> 步，就更新 {steps} 次、累计抽取 <b>{(batch*steps).toLocaleString()}</b> 次样本。抽到的样本可以重复。</p>
    <p className="caption">完整读遍一次训练数据通常叫一轮（epoch）。本实验是随机抽样，训练步数不代表读过多少条不同句子。实际大模型训练还可能分多次计算、积累梯度后再更新，需看有效批次大小。</p>
  </div>;
}

export function TrainingBudget({batch,steps,current}) {
  return <div className="training-budget"><p>每一步：抽 {batch} 个样本 → 计算损失和梯度 → 更新一次参数。</p><p>计划 {steps} 步，共抽取 {(batch*steps).toLocaleString()} 次；现在完成 {current} 次更新。<Term name="批次"/>与<Term name="训练步"/>可以分别调整。</p></div>;
}
