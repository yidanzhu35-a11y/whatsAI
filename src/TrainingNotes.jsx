import React from 'react';
import {Term} from './terms.jsx';
import {Copy} from './copy.jsx';

export function BatchExplanation({batch=24,steps=300}) {
  return <div className="batch-explanation">
    <strong><Copy id="tn-be-title">批次大小回答“每步用多少”，训练步数回答“更新多少次”。</Copy></strong>
    <p><Copy id="tn-be-1">每步抽取 </Copy><b>{batch}</b><Copy id="tn-be-2"> 个“前文 → 下一字”样本，合起来计算一次更新；重复 </Copy><b>{steps}</b><Copy id="tn-be-3"> 步，就更新 {steps} 次、累计抽取 </Copy><b>{(batch*steps).toLocaleString()}</b><Copy id="tn-be-4"> 次样本。抽到的样本可以重复。</Copy></p>
    <p className="caption"><Copy id="tn-be-cap">完整读遍一次训练数据通常叫一轮（epoch）。本实验是随机抽样，训练步数不代表读过多少条不同句子。实际大模型训练还可能分多次计算、积累梯度后再更新，需看有效批次大小。</Copy></p>
  </div>;
}

export function TrainingBudget({batch,steps,current}) {
  return <div className="training-budget"><p><Copy id="tn-tb-1">{`每一步：抽 ${batch} 个样本 → 计算损失和梯度 → 更新一次参数。`}</Copy></p><p><Copy id="tn-tb-2">{`计划 ${steps} 步，共抽取 ${(batch*steps).toLocaleString()} 次；现在完成 ${current} 次更新。`}</Copy><Term name="批次"/><Copy id="tn-tb-3">与</Copy><Term name="训练步"/><Copy id="tn-tb-4">可以分别调整。</Copy></p></div>;
}
