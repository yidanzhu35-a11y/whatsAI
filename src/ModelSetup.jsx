import React from 'react';
import {CONTEXT,EMBED,HIDDEN} from './model.js';
import {Intro,Fold,Workbar,fmt,RAIN} from './ui.jsx';
import {Term} from './terms.jsx';

export function ModelSetup({model,started,onContinue}) {
  return <>
    <div className="split model-setup">
      <Intro no="准备" title="先建立模型，再用数据调整它。">
        <p>模型是一套把输入变成预测的计算过程。工程师先确定结构，并为计算准备一组数字；训练会反复调整这些数字，让预测更符合样本。</p>
        <p>这些可以调整的数字叫<Term name="参数"/>，包括<Term name="权重"/>和<Term name="偏置"/>。先看右边三个环节，再把一条样本送进去。</p>
      </Intro>
      <div className="interactive">
        <div className="workbench setup-workbench">
          <Workbar title="这个微型模型怎样建立"/>
          <ol className="setup-stages">
            <li><span className="setup-index">01</span><div><h3>确定结构：数字怎样参与计算</h3><p>每次读取前文的 {CONTEXT} 个字符 → 每字取出 {EMBED} 个数字 → 经过 {HIDDEN} 个<Term name="隐藏单元"/>的中间计算 → 得到各候选字的概率。</p><small>这些数量规定模型的结构，本次训练中保持固定。</small></div></li>
            <li><span className="setup-index">02</span><div><h3>准备参数：为计算填入起始数值</h3><p>例如 <code>结果 = 权重 × 输入 + 偏置</code>。权重决定输入乘多少，偏置是随后加上的数。这个结构共有 <strong>{model.parameterCount.toLocaleString()}</strong> 个可训练参数：权重从随机数开始，偏置从 0 开始。</p><div className="setup-values"><span>“雨”的一个输出权重 <code>{fmt(model.W2[RAIN])}</code></span><span>“雨”的输出偏置 <code>{fmt(model.b2[RAIN])}</code></span></div><small>{model.step===0?'当前为初始值，尚未用样本更新。':`当前为已更新 ${model.step} 次后的数值。`}训练调整数值，参数总数保持不变。</small></div></li>
            <li><span className="setup-index">03</span><div><h3>设置更新方式：每次用多少数据、改多大</h3><p>接下来先用 <strong>1 条样本</strong>算出<Term name="梯度"/>，再用<Term name="学习率"/> <strong>1.0</strong> 控制更新幅度。更新规则是：<code>新参数 = 旧参数 − 学习率 × 梯度</code>。</p><small>批次大小、学习率等控制训练过程的设置叫超参数；本次单步演示将它们固定。</small></div></li>
          </ol>
        </div>
        <div className="actions"><button className="primary" onClick={onContinue}>{started?'返回这次训练':'用一条样本开始预测'}</button></div>
      </div>
    </div>
    <Fold title="实际项目怎样选择模型结构？">
      <p>做具体应用时，常先测试已有模型，再根据任务微调。大语言模型常采用<Term name="Transformer"/>架构，其中的<Term name="注意力层"/>会根据输入组合不同位置的信息。图像模型还可以采用卷积网络等结构。</p>
      <p>本页使用小型前馈网络：前文经过固定的几层计算得到预测。4 字符、8 维和 24 个<Term name="隐藏单元"/>是这个演示的设置。PyTorch 等训练框架则是实现这些计算的软件工具。</p>
      <p className="caption">参考：<a href="https://huggingface.co/docs/transformers/en/model_doc/qwen3" target="_blank" rel="noreferrer">Qwen3 模型结构</a> · <a href="https://huggingface.co/docs/transformers/en/training" target="_blank" rel="noreferrer">微调实践</a></p>
    <Fold title="参考一个真实 Transformer 的配置：GPT-2 小型版本"><p>以下是公开的历史模型配置，用来理解各字段，不是所有语言模型的推荐配置。</p><div className="table-scroll"><table className="config-explained"><thead><tr><th>配置字段</th><th>数值</th><th>含义</th></tr></thead><tbody><tr><td>n_positions</td><td>1,024</td><td>支持的位置数量，不等于 1,024 个汉字</td></tr><tr><td>n_embd</td><td>768</td><td>每个 token 表示中的数字个数</td></tr><tr><td>n_layer</td><td>12</td><td>堆叠 12 个 Transformer 块</td></tr><tr><td>n_head</td><td>12</td><td>每层注意力的头数</td></tr><tr><td>vocab_size</td><td>50,257</td><td>词表中的 token 数量</td></tr></tbody></table></div><p>这些字段规定结构，通常在一次训练中保持固定。改变维度或层数往往会改变参数形状，不能直接套用原有参数文件。</p><a href="https://huggingface.co/openai-community/gpt2/blob/main/config.json" target="_blank" rel="noreferrer">查看 GPT-2 配置原文件</a> · <a href="https://arxiv.org/abs/1706.03762" target="_blank" rel="noreferrer">Transformer 原论文</a></Fold>
    </Fold>
  </>;
}
