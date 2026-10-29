// A real, small character language model. No API calls or remote inference.
// Four character embeddings -> tanh hidden layer -> softmax next character.
export const TRAIN_TEXT = [
 '天空乌云密布，随后下起了雨。','天空乌云密布，随后下起了雨。','今天乌云密布，下午下起了雨。','夜里乌云密布，窗外下起了雨。','早晨乌云密布，天空下起了雨。','天空乌云密布，随后下起了雨。',
 '冬天气温很低，天空下起了雪。','今天气温很低，夜里下起了雪。','山上气温很低，随后下起了雪。','冬天寒风吹来，窗外下起了雪。',
 '今天阳光明媚，天气十分晴朗。','早晨阳光明媚，天空十分晴朗。','下午阳光明媚，天气十分温暖。','春天阳光明媚，天气十分温暖。',
 '下雨时出门，需要带上雨伞。','今天出门下雨，需要带上雨伞。','窗外正在下雨，出门带上雨伞。','天空开始下雨，记得带上雨伞。',
 '冬天出门很冷，需要穿上外套。','今天气温很低，出门穿上外套。','山上寒风吹来，记得穿上外套。','夜里天气很冷，需要穿上外套。',
 '早晨起床以后，先喝一杯温水。','今天早晨起床，先喝一杯温水。','运动结束以后，需要喝一杯水。','下午运动结束，记得喝一杯水。',
 '小明走进教室，开始认真读书。','今天走进教室，大家开始读书。','下午走进书房，小明开始读书。','早晨走进书房，开始认真读书。',
 '今天公园很暖，大家一起散步。','春天公园很暖，小明一起散步。','下午天气晴朗，大家一起散步。','今天阳光温暖，大家一起散步。',
 '今天阳光明媚，天气十分晴朗。', ''
];
export const VALID_TEXT = ['下午乌云密布，窗外下起了雨。','冬天山上很冷，天空下起了雪。','今天早晨很冷，需要穿上外套。','早晨天气晴朗，大家一起散步。','小明走进书房，开始认真读书。','窗外开始下雨，记得带上雨伞。'];
export const VOCAB = ['□', ...Array.from(new Set([...TRAIN_TEXT,...VALID_TEXT].join(''))).sort()];
export const CONTEXT = 4, EMBED = 8, HIDDEN = 24;
export const PARAM_KEYS = ['E','W1','b1','W2','b2'];
export function rng(seed=42){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function encode(text){return Array.from(text).map(c=>VOCAB.indexOf(c)).map(i=>i<0?0:i);}
export function contextOf(text){let a=encode(text).slice(-CONTEXT);while(a.length<CONTEXT)a.unshift(0);return a;}
export function samples(lines){let all=[];for(const line of lines){const ids=encode(line);for(let i=0;i<ids.length;i++){let x=ids.slice(Math.max(0,i-CONTEXT),i);while(x.length<CONTEXT)x.unshift(0);all.push({x,y:ids[i]});}}return all;}
export function cleanData(dedupe=true){const nonempty=TRAIN_TEXT.filter(x=>x.trim());return dedupe?[...new Set(nonempty)]:nonempty;}
export class TinyLM{
 constructor(seed=42){this.random=rng(seed);this.step=0;const rand=(n,s)=>Float64Array.from({length:n},()=> (this.random()*2-1)*s);this.E=rand(VOCAB.length*EMBED,.35);this.W1=rand(CONTEXT*EMBED*HIDDEN,.18);this.b1=new Float64Array(HIDDEN);this.W2=rand(HIDDEN*VOCAB.length,.18);this.b2=new Float64Array(VOCAB.length);}
 forward(x){const V=VOCAB.length,N=CONTEXT*EMBED;let input=new Float64Array(N);for(let c=0;c<CONTEXT;c++)for(let e=0;e<EMBED;e++)input[c*EMBED+e]=this.E[x[c]*EMBED+e];let h=new Float64Array(HIDDEN);for(let j=0;j<HIDDEN;j++){let a=this.b1[j];for(let i=0;i<N;i++)a+=input[i]*this.W1[i*HIDDEN+j];h[j]=Math.tanh(a);}let logits=new Float64Array(V);for(let k=0;k<V;k++){let a=this.b2[k];for(let j=0;j<HIDDEN;j++)a+=h[j]*this.W2[j*V+k];logits[k]=a;}let max=Math.max(...logits),p=logits.map(v=>Math.exp(v-max)),sum=p.reduce((a,b)=>a+b,0);p=p.map(v=>v/sum);return {input,h,p,logits};}
 gradients(batch){let g=Object.fromEntries(PARAM_KEYS.map(k=>[k,new Float64Array(this[k].length)]));let loss=0;const V=VOCAB.length,N=CONTEXT*EMBED;for(const {x,y} of batch){let {input,h,p}=this.forward(x);loss-=Math.log(Math.max(p[y],1e-300));let dz=p.slice();dz[y]-=1;let dh=new Float64Array(HIDDEN);for(let k=0;k<V;k++){g.b2[k]+=dz[k];for(let j=0;j<HIDDEN;j++){g.W2[j*V+k]+=h[j]*dz[k];dh[j]+=this.W2[j*V+k]*dz[k];}}let di=new Float64Array(N);for(let j=0;j<HIDDEN;j++){let da=dh[j]*(1-h[j]*h[j]);g.b1[j]+=da;for(let i=0;i<N;i++){g.W1[i*HIDDEN+j]+=input[i]*da;di[i]+=this.W1[i*HIDDEN+j]*da;}}for(let c=0;c<CONTEXT;c++)for(let e=0;e<EMBED;e++)g.E[x[c]*EMBED+e]+=di[c*EMBED+e];}for(const k of PARAM_KEYS)for(let i=0;i<g[k].length;i++)g[k][i]/=batch.length;return {g,loss:loss/batch.length};}
 apply(g,lr){for(const k of PARAM_KEYS)for(let i=0;i<this[k].length;i++)this[k][i]-=lr*g[k][i];this.step++;}
 train(data,lr=.4,batchSize=24){const batch=Array.from({length:batchSize},()=>data[Math.floor(this.random()*data.length)]);const {g,loss}=this.gradients(batch);this.apply(g,lr);return loss;}
 loss(data){return data.reduce((v,s)=>v-Math.log(Math.max(this.forward(s.x).p[s.y],1e-300)),0)/data.length;}
 snapshot(){return {step:this.step,...Object.fromEntries(PARAM_KEYS.map(k=>[k,Array.from(this[k])]))};}
 static from(s){let m=new TinyLM();for(const k of PARAM_KEYS)m[k]=Float64Array.from(s[k]);m.step=s.step;return m;}
 get parameterCount(){return PARAM_KEYS.reduce((n,k)=>n+this[k].length,0);}
 generate(prompt,count=24,temp=.8,seed=123){let text=prompt,out=[],random=rng(seed);for(let n=0;n<count;n++){let {p}=this.forward(contextOf(text));let scaled=Array.from(p,(v,i)=>i===0?0:Math.pow(v,1/temp));let sum=scaled.reduce((a,b)=>a+b,0),r=random()*sum,idx=1;for(let i=1;i<scaled.length;i++){r-=scaled[i];if(r<=0){idx=i;break;}}out.push({token:VOCAB[idx],p:p[idx]});text+=VOCAB[idx];if(VOCAB[idx]==='。')break;}return out;}
}
export function distribution(model,text){return Array.from(model.forward(contextOf(text)).p);}
export function evaluate(model,data){return {step:model.step,train:model.loss(data),val:model.loss(samples(VALID_TEXT))};}
