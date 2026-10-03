'use client';
import {sessionSummary,type AnalysisSession,type ExplorationNode} from '../lib/analysis-session';
import {pct} from '../lib/discovery/explanation';
const labels:Record<string,string>={revenue:'GMV',transactions:'交易数',buyers:'购买人数',visitors:'访客数',conversion:'购买转化率',aov:'客单价',frequency:'购买用户人均交易次数',channel:'渠道',device:'设备'};
const number=(n:number)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:2,minimumFractionDigits:2});
function value(n:number|null,k:string){return n==null?'无法比较':k==='conversion'?number(n*100)+'%':['revenue','aov'].includes(k)?'$'+number(n):number(n)}
function delta(n:number|null,k:string){return n==null?'无法比较':(n>0?'+':n<0?'−':'')+(k==='conversion'?number(Math.abs(n)*100)+' 个百分点':value(Math.abs(n),k))}
const path=(n:ExplorationNode)=>n.path.map(k=>labels[k]).join(' → ');
export function scopeLabel(s:AnalysisSession,n:ExplorationNode){return ['渠道：'+(s.filters.channel||'全部渠道'),'设备：'+(s.filters.device||'全部设备'),...n.scope.map(x=>labels[x.dimension]+'：'+x.value)].join(' · ')}
export default function AnalysisSummary({session,onContinue}: {session:AnalysisSession;onContinue:(n:ExplorationNode)=>void}){
 const summary=sessionSummary(session),r=summary.root;
 return <section className="session-summary" aria-label="本次分析小结">
  <h2>本次分析小结</h2><p className="analysis-summary">{summary.coverage}</p>
  <h3>1. 发生了什么</h3>
  <p>{session.period.current.start} 至 {session.period.current.end}，对比 {session.period.previous.start} 至 {session.period.previous.end}。</p>
  <p>全局筛选：渠道 {session.filters.channel||'全部渠道'} · 设备 {session.filters.device||'全部设备'}。</p>
  <p>{labels[session.root]}：上期 {value(r.previous,session.root)} → 本期 {value(r.current,session.root)}；环比 {pct(r.relative)}；净变化 {delta(r.delta,session.root)}。</p>
  <h3>2. 哪些指标驱动了变化</h3>
  {summary.drivers.length?summary.drivers.map(n=><article key={n.id}><strong>{path(n)} · {n.explored?'已展开':'尚未展开'}</strong><p>{labels[n.metric]}环比 {pct(n.result.relative)}；对{labels[n.parentMetric!]}的 Shapley 算术影响 {delta(n.result.amount,n.parentMetric!)}（{n.result.role}）。{!n.explored&&'这是已计算的指标影响，尚未继续定位原因。'}</p></article>):<p>当前起始指标没有进一步的严格乘法拆解，继续通过维度定位或行为诊断观察变化。</p>}
  <h3>3. 变化集中在哪里</h3>
  {summary.dimensions.length?summary.dimensions.map(n=>{
   const d=n.result.dimension,c=n.result.candidate,groups=[...c.highlights.positive,...c.highlights.negative];
   return <article key={n.id}><strong>{path(n)} → {n.scope.map(x=>labels[x.dimension]+'：'+x.value+' → ')}{labels[n.dimension!]}</strong><p>在以下范围内：{scopeLabel(session,n)}。</p><p>{d.notice}</p>
    {groups.length?groups.map((g:any)=><p key={g.id}>{g.name}：{d.nature==='additive'?'严格分组贡献':d.nature==='distinct'?'去重人数分组变化':'比例指标变化'} {delta(g.delta,n.metric)}；上期 {value(g.previousValue,n.metric)} → 本期 {value(g.currentValue,n.metric)}。</p>):<p>当前样本或变化信号不足，没有符合推荐条件的突出分组；不据此判断业务原因。</p>}
    <button onClick={()=>onContinue(n)}>回到此分析范围</button>
   </article>;
  }):<p>尚未主动展开维度分析。后台扫描或默认展示不计作已探索路径。</p>}
  <details><summary>查看实际探索记录（{session.history.length} 条）</summary><ol>{session.history.map(h=>{const n=session.nodes[h.nodeId];return <li key={h.sequence}>{h.action.startsWith('present')?'已展示':h.action.includes('back')?'返回':'主动查看'}：{n?path(n):h.nodeId}{n?.dimension?' → '+labels[n.dimension]:''}{n?.group?'：'+n.group:''} · {h.scope.length?h.scope.map(x=>labels[x.dimension]+'：'+x.value).join(' → '):'全局筛选范围'}</li>})}</ol></details>
  <h3>4. 值得继续关注但尚未展开</h3>
  {summary.missing.length?summary.missing.map(n=><article className="session-followup" key={n.id}><strong>{path(n)}{n.dimension?' → '+labels[n.dimension]:''}{n.group?'：'+n.group:''}</strong><p>范围：{scopeLabel(session,n)}。</p><p>{n.kind==='metric'?`${labels[n.metric]}环比 ${pct(n.result.relative)}，对${labels[n.parentMetric!]}形成 ${delta(n.result.amount,n.parentMetric!)} 算术影响（${n.result.role}）。`:n.kind==='group'?`${n.group} 属于符合样本条件的突出变化分组，尚未继续下钻。`:'该维度达到现有推荐规则的变化信号要求，尚未主动展开。'}</p><button onClick={()=>onContinue(n)}>继续分析{n.group||labels[n.dimension||n.metric]}</button></article>):<p>当前已计算的重要分支没有遗漏；这不代表所有业务原因已得到验证。</p>}
  <h3>5. 当前结论与限制</h3>
  <ul><li>指标驱动来自固定 Metric Tree 与分层 Shapley，是数学拆解结论，不代表业务因果。</li><li>可加指标仅在同一范围内使用严格贡献；去重指标只描述分组变化，跨组人数可能重叠，不能相加或当作精确贡献率。</li><li>客单价、转化率等比例指标的分组变化不能直接相加解释整体变化。</li><li>尚未展开的重要分支与未查询的维度路径不属于已经深入验证的结论。</li><li>当前数据不能直接证明价格、成本或营销活动等业务原因，需要业务数据进一步验证。</li></ul>
  {summary.diagnoses.map(n=><article key={n.id}><strong>{n.kind==='behavior'?'行为诊断线索':'商品结构线索'} · {scopeLabel(session,n)}</strong>{n.kind==='behavior'?<p>{n.result.summary} 同会话交集率不等于严格有序漏斗，也不能连乘为购买转化率。</p>:<p>已查看商品结构；商品收入口径与全店 GMV 不同，不能据此直接解释客单价变化。</p>}</article>)}
  <details><summary>查看数据版本和覆盖规则</summary><p>指标版本：{session.metricVersion}；覆盖规则：{session.coverageVersion}。重要指标按父指标绝对 Shapley 影响判断；维度使用服务端推荐信号和样本规则。规则用于提示值得继续查看的变化，不代表统计显著性。</p><pre>{JSON.stringify(session.sourceVersions,null,2)}</pre></details>
 </section>
}
