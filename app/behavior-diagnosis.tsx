import {pct} from '../lib/discovery/explanation';
export default function BehaviorDiagnosis({diagnosis,title='行为诊断：定位转化阶段变化'}:any){
 return <section className="analysis-node"><h3>{title}</h3><p>购买转化率 {pct(diagnosis.conversionRelative)}。以下比较行为环节的同会话交集率。</p><p className="analysis-summary">{diagnosis.summary}</p><div className="rate-tree">{diagnosis.stages.map((s:any)=><article className="rate-node" key={s.key}><span>{s.label}</span><strong>{pct(s.relative)}</strong><small>本期 {s.current==null?'—':(s.current*100).toFixed(2)+'%'} · 上期 {s.previous==null?'—':(s.previous*100).toFixed(2)+'%'}</small><b>{s.pp==null?'无法比较':(s.pp>0?'+':'')+s.pp.toFixed(2)+' 个百分点'}{s.small?' · 小样本':''}</b></article>)}</div><p className="muted">这是同会话共现比例，不要求先后顺序或同商品，不是严格有序漏斗；不能将三个比例连乘为购买转化率。</p></section>
}
