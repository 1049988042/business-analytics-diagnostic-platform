'use client';
import {useEffect,useRef,useState} from 'react';
import {responseKey} from '../lib/analysis-session';
import StepConclusion from './step-conclusion';
import BehaviorDiagnosis from './behavior-diagnosis';
import {cachedRead} from '../lib/client-cache';
import {pct} from '../lib/discovery/explanation';

const dimensionLabels:Record<string,string>={channel:'渠道',device:'设备'};
const metricLabels:Record<string,string>={visitors:'去重访客',buyers:'去重购买访客',conversion:'购买转化率',frequency:'购买用户人均交易次数',aov:'客单价',revenue:'GMV',transactions:'交易数'};
type Scope=Array<{dimension:string;value:string}>;
const number=(n:number,digits=2)=>n.toLocaleString('zh-CN',{maximumFractionDigits:digits});
function value(n:number|null,metric:string){return n==null?'—':metric==='conversion'?number(n*100,4)+'%':['revenue','aov'].includes(metric)?'$'+number(n):number(n,metric==='frequency'?4:2)}
function change(n:number|null,metric:string){return n==null?'无法比较':(n>0?'+':n<0?'−':'')+(metric==='conversion'?number(Math.abs(n)*100,4)+' 个百分点':value(Math.abs(n),metric))}

export function DimensionResults({data,selected,onSelect,onDrill,scope,metric,metricPath,onBack,onExpand,onBehavior,showConclusion=false}:any){
 const recommendation=data.recommendation,result=data.dimensions.find((d:any)=>d.dimension===selected),candidate=recommendation.candidates.find((c:any)=>c.dimension===selected);
 const terminal=!data.availableDimensions.length;
 const canDrill=!!result&&data.availableDimensions.some((d:string)=>d!==result.dimension);
 return <>
  <div className="dimension-path"><span>指标驱动</span><strong>{metricPath.join(' → ')}</strong><span>维度定位</span><strong>{scope.length?scope.map((s:any)=>dimensionLabels[s.dimension]+'：'+s.value).join(' → '):'当前全局筛选范围'}</strong></div>
  {scope.length>0&&<button className="dimension-back" onClick={onBack}>返回上一级</button>}
  <p className="muted">当前范围：{metricLabels[metric]} {value(data.decomposition.metrics[metric].previous,metric)} → {value(data.decomposition.metrics[metric].current,metric)}，环比 {pct(data.decomposition.metrics[metric].relative)}。</p>
  <div className="dimension-recommendation" role="status"><h4>{recommendation.reason.text}</h4>{recommendation.status==='recommended'&&candidate&&<p>{candidate.reason.find((r:any)=>r.code==='quality')?.text}</p>}</div>
  {selected&&recommendation.status!=='recommended'&&<p className="muted">当前先展示{dimensionLabels[selected]}，这不代表它是唯一推荐方向；可切换其他可用维度。</p>}
  {!terminal&&<div className="dimension-choices" aria-label="选择继续查看的维度"><span>选择查看维度：</span>{data.availableDimensions.map((d:string)=><button key={d} className={selected===d?'primary':''} aria-pressed={selected===d} onClick={()=>onSelect(d)}>查看{dimensionLabels[d]}{recommendation.dimension===d?'（系统推荐）':''}</button>)}</div>}
  {result&&<>
   <h4>按{dimensionLabels[result.dimension]}定位{metricLabels[metric]}变化</h4>
   <p className="dimension-notice">{result.notice}</p>
   <div className="driver-sources">{(['positive','negative'] as const).map(sign=><section key={sign}><h4>{sign==='positive'?'增加最明显的分组':'减少最明显的分组'}</h4>{candidate.highlights[sign].length?candidate.highlights[sign].map((g:any)=><div key={g.id}><strong>{g.name}</strong><b>{metricLabels[metric]} {change(g.delta,metric)}</b><span>上期 {value(g.previousValue,metric)} · 本期 {value(g.currentValue,metric)} · 环比 {pct(g.relative)}</span>{metric==='conversion'&&<details onToggle={e=>{if(e.currentTarget.open)onBehavior?.(result.dimension,g)}}><summary>查看该分组的行为诊断</summary><BehaviorDiagnosis diagnosis={g.diagnosis}/></details>}{canDrill&&<button onClick={()=>onDrill(result.dimension,g.name)} aria-label={'继续分析 '+g.name}>继续分析 {g.name}</button>}{!canDrill&&<small>当前已无其他可用维度</small>}</div>):<p className="muted">暂无满足样本条件的{sign==='positive'?'增加':'减少'}分组。</p>}</section>)}</div>
   {showConclusion&&result.stepConclusion&&<StepConclusion text={result.stepConclusion.text}/>}
   <details onToggle={e=>{if(e.currentTarget.open)onExpand?.(result.dimension)}}><summary>查看全部{dimensionLabels[result.dimension]}分组（{result.groups.length}）</summary><div className="tablewrap"><table><thead><tr><th>{dimensionLabels[result.dimension]}</th><th>上期</th><th>本期</th><th>变化</th><th>样本说明</th><th>下一步</th></tr></thead><tbody>{result.groups.map((g:any)=><tr key={g.id}><td>{g.name}</td><td>{value(g.previousValue,metric)}</td><td>{value(g.currentValue,metric)}</td><td>{change(g.delta,metric)}</td><td>{candidate.excluded.find((e:any)=>e.id===g.id)?.reason||'可参与推荐'}</td><td>{canDrill?<button onClick={()=>onDrill(result.dimension,g.name)}>继续分析</button>:'已到可用维度末端'}{metric==='conversion'&&<details onToggle={e=>{if(e.currentTarget.open)onBehavior?.(result.dimension,g)}}><summary>行为诊断</summary><BehaviorDiagnosis diagnosis={g.diagnosis}/></details>}</td></tr>)}</tbody></table></div></details>
   {!canDrill&&<p className="muted">渠道和设备的可用分析已到此层。当前数据只能定位变化范围，需要业务数据进一步验证原因。</p>}
  </>}
  {!terminal&&<details className="dimension-evidence"><summary>为什么这样推荐？查看扫描结果与评分依据</summary><p>评分用于确定探索优先级，不代表因果或显著性检验。去重指标的分组变化可能重叠。</p>{recommendation.candidates.map((c:any)=><section key={c.dimension}><h4>{c.label} · {number(c.score)} 分{c.usable?'':' · 信号或样本不足'}</h4><p>变化最明显的有效分组：{c.leadingGroup||'无'}；有效分组 {c.eligibleGroups}/{c.totalGroups}。</p>{c.reason.map((r:any)=><p key={r.code}>{r.text}</p>)}<details><summary>查看数值评分明细</summary><pre>{JSON.stringify({score:c.score,scale:c.scale,concentration:c.concentration,cancellation:c.cancellation,quality:c.quality,positiveMovement:c.positiveMovement,negativeMovement:c.negativeMovement,reason:c.reason},null,2)}</pre></details></section>)}<p>评分差 {recommendation.reason.scoreGap==null?'—':number(recommendation.reason.scoreGap)}；接近阈值 {recommendation.reason.tieThreshold==null?'—':number(recommendation.reason.tieThreshold)}。</p></details>}
 </>
}

export default function DimensionAnalysis({snapshot,metric,metricPath,initialScope=[],initialDimension=null,initialExplore=false,responses={},onRecord}:any){
 const [scope,setScope]=useState<Scope>(initialScope),[data,setData]=useState<any>(null),[selected,setSelected]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [accepted,setAccepted]=useState(false);
 const responseCache=useRef(responses);responseCache.current=responses;
 const intent=useRef(initialExplore),[loadedScope,setLoadedScope]=useState('');
 const context=JSON.stringify({filters:snapshot.inputFilters,mode:snapshot.period.mode,month:snapshot.period.month,expectedSourceVersions:snapshot.sourceVersions}),scopeKey=JSON.stringify(scope);
 // Keep the chosen view at each scope, including ambiguous recommendations.
 // Returning from a group restores its parent's group list, not the chooser.
 const selections=useRef(new Map<string,string>());
 const viewKey=JSON.stringify([context,metric,scopeKey]);
 const choose=(dimension:string)=>{selections.current.set(viewKey,dimension);intent.current=true;setAccepted(true);setSelected(dimension);if(data&&selected===dimension)onRecord?.({type:'dimensions',metric,scope,data,selected:dimension,explored:true})};
 useEffect(()=>{
  const controller=new AbortController();let active=true;setLoading(true);setError('');setData(null);setSelected(null);setAccepted(false);
  const request={...JSON.parse(context),metric,operation:'dimension_analysis',recommendation:'auto',scope:JSON.parse(scopeKey)};
  const saved=responseCache.current[responseKey(metric,scope)];
  (saved?Promise.resolve(saved):cachedRead('analysis?input='+encodeURIComponent(JSON.stringify(request)),undefined,controller.signal)).then(result=>{
   if(!active)return;if(result.status!=='ready')throw Error(result.reason||'当前范围无法比较');
   if(JSON.stringify(result.sourceVersions)!==JSON.stringify(request.expectedSourceVersions))throw Error('数据已更新，请返回经营概览重新进入分析');
   const remembered=selections.current.get(viewKey)||(scopeKey===JSON.stringify(initialScope)?initialDimension:null);
   // Recommendation controls the default view only; every available dimension remains selectable.
   const preferred=[remembered,result.recommendation.dimension,...result.availableDimensions].find(d=>result.dimensions.some((item:any)=>item.dimension===d))||null;
   setLoadedScope(scopeKey);setData(result);setSelected(preferred);setAccepted(!!preferred);
  }).catch(e=>{if(active&&e.name!=='AbortError')setError(e.message)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;controller.abort()};
 },[context,metric,scopeKey,viewKey,retry]);
 useEffect(()=>{if(data&&loadedScope===scopeKey)onRecord?.({type:'dimensions',metric,scope,data,selected,explored:intent.current||scope.length>0})},[data,selected,loadedScope,scopeKey,metric,onRecord]);
 const back=()=>{intent.current=false;const parent=scope.slice(0,-1);onRecord?.({type:'back',metric,scope:parent});setScope(parent)};
 const drill=(dimension:string,value:string)=>{if(!data?.availableDimensions.includes(dimension)||scope.some(s=>s.dimension===dimension))return;selections.current.set(viewKey,dimension);intent.current=true;setScope([...scope,{dimension,value}])};
 return <section className="analysis-node dimension-analysis" aria-busy={loading}>
  <div className="dimension-stage">进入维度分析</div><h3>{metricLabels[metric]}：变化集中在哪里？</h3><p className="muted">系统比较当前可用的渠道和设备，推荐继续定位的方向。渠道和设备是观察角度，不是子指标。</p>
  {loading&&<p role="status">正在扫描当前范围的可用维度…</p>}
  {error&&<div role="alert"><p>{error}</p><button onClick={()=>setRetry(retry+1)}>重试</button>{scope.length>0&&<button className="dimension-back" onClick={back}>返回上一级</button>}</div>}
  {data&&loadedScope===scopeKey&&<DimensionResults data={data} selected={selected} onSelect={choose} onDrill={drill} scope={scope} metric={metric} metricPath={metricPath} onBack={back} showConclusion={accepted} onExpand={(dimension:string)=>onRecord?.({type:'groups',metric,scope,dimension})} onBehavior={(dimension:string,g:any)=>onRecord?.({kind:'behavior',metric,scope:[...scope,{dimension,value:g.name}],result:g.diagnosis,explored:true})}/>}
 </section>
}
