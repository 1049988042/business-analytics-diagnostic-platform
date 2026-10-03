// Descriptive, deterministic prioritization only: neither significance nor causality.
// Distinct group movement is never presented as a share of the parent net change.
export const DIMENSION_LABELS:Record<string,string>={channel:'渠道',device:'设备'};
export const RECOMMENDATION_VERSION='dimension-signal-v2';
export const RULES={minimumScore:15,tieAbsolute:5,tieRelative:0.1,minimumGroupVisitors:50,minimumParentVisitors:200,minimumRatioDenominator:100,minimumOrders:20};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const sum=(items:any[],fn:(v:any)=>number)=>items.reduce((n,v)=>n+fn(v),0);
const unknown=(name:string)=>/^(?:\(not set\)|\(unknown\)|unknown|未知|未知渠道|未知设备|未设置|未记录|)$/i.test(name.trim());
const stable=(a:any,b:any)=>b.magnitude-a.magnitude||String(a.group.id).localeCompare(String(b.group.id));
export function recommend(results:any[],fixedDimensions:string[]=[]){
 const candidates=results.filter(r=>!fixedDimensions.includes(r.dimension)).map(r=>{
  const metric=r.metric,ratio=r.nature==='ratio';
  const denominator=metric==='aov'?'transactions':metric==='frequency'?'buyers':'visitors';
  const minimum=ratio?(metric==='conversion'?RULES.minimumRatioDenominator:RULES.minimumOrders):metric==='buyers'?RULES.minimumOrders:RULES.minimumGroupVisitors;
  const supportKey=ratio?denominator:metric==='buyers'?'buyers':'visitors';
  const raw:any[]=r.groups.map((g:any)=>{
   const current=Number(g.current[supportKey]||0),previous=Number(g.previous[supportKey]||0),support=(current+previous)/2;
   const enough=(ratio?Math.min(current,previous):Math.max(current,previous))>=minimum;
   const valid=Number.isFinite(g.delta)&&!unknown(String(g.name))&&enough;
   return {group:g,support,current,previous,valid,exclusion:!Number.isFinite(g.delta)?'无法计算变化':unknown(String(g.name))?'维度值缺失或未知':!enough?'样本不足':null};
  });
  const supportTotal=sum(raw,g=>g.support),valid=raw.filter(g=>g.valid);
  // For rates, use denominator weights for ranking, not summed rate changes.
  const weighted=raw.map(g=>({...g,magnitude:Number.isFinite(g.group.delta)?Math.abs(g.group.delta)*(ratio?(supportTotal?g.support/supportTotal:0):1):0}));
  const eligible=weighted.filter(g=>g.valid).sort(stable),gross=sum(eligible,g=>g.magnitude),allGross=sum(weighted,g=>g.magnitude);
  const positive=sum(eligible,g=>g.group.delta>0?g.magnitude:0),negative=sum(eligible,g=>g.group.delta<0?g.magnitude:0);
  const n=eligible.length,topShare=gross?(eligible[0]?.magnitude||0)/gross:0;
  const concentration=n>1?clamp((topShare-1/n)/(1-1/n)):0;
  const parentLevel=(Math.abs(r.parent.current||0)+Math.abs(r.parent.previous||0))/2;
  const floor=metric==='revenue'?100:metric==='transactions'?5:metric==='aov'?1:metric==='conversion'?0.0001:metric==='frequency'?0.01:20;
  const scale=gross/(gross+0.05*parentLevel+floor);
  const cancellation=gross?2*Math.min(positive,negative)/gross:0;
  const knownSupport=supportTotal?sum(valid,g=>g.support)/supportTotal:0;
  const sampleQuality=clamp(Math.min(r.samples?.currentVisitors||0,r.samples?.previousVisitors||0)/RULES.minimumParentVisitors);
  const movementCoverage=allGross?gross/allGross:0;
  const quality=knownSupport*sampleQuality*movementCoverage;
  const groupFactor=n>=2?1-1/(n+1):0;
  const score=100*quality*groupFactor*(0.5*scale+0.3*concentration+0.2*cancellation);
  const usable=n>=2&&score>=RULES.minimumScore&&gross>0;
  const leading=eligible.find(g=>g.magnitude>0)?.group||null;
  const label=DIMENSION_LABELS[r.dimension];
  const reason=[
   {code:'movement_scale',text:ratio?'按各组分母规模衡量比例变化强度。':'按各分组绝对变化规模衡量信号，不使用占整体净变化比例。',values:{gross,positive,negative,scale,weighted:ratio}},
   {code:'concentration',text:leading?`${label}中 ${leading.name} 的有效分组变化最突出。`:'暂无可推荐的变化分组。',values:{concentration,topShare,leadingGroup:leading?.name||null,leadingDelta:leading?.delta??null}},
   {code:'offset',text:positive>0&&negative>0?'同时存在增加和减少的分组，分别查看正向变化与负向抵消。':'有效分组的变化主要为同一方向。',values:{cancellation,positive,negative}},
   {code:'quality',text:`${n} 个有效分组 / ${raw.length} 个分组；低样本、未知维度值和无法计算的变化不参与推荐。`,values:{quality,knownSupport,sampleQuality,movementCoverage,minimum,denominator:supportKey,eligibleGroups:n,totalGroups:raw.length}}
  ];
  return {dimension:r.dimension,label,score,usable,leadingGroup:leading?.name||null,leadingGroupId:leading?.id||null,positiveMovement:positive,negativeMovement:negative,grossMovement:gross,concentration,scale,cancellation,quality,eligibleGroups:n,totalGroups:raw.length,exactContribution:r.exactContribution,reason,
   highlights:{positive:eligible.filter(g=>g.group.delta>0).slice(0,3).map(g=>g.group),negative:eligible.filter(g=>g.group.delta<0).slice(0,3).map(g=>g.group)},
   excluded:raw.filter(g=>!g.valid).map(g=>({id:g.group.id,name:g.group.name,reason:g.exclusion}))};
 }).sort((a,b)=>b.score-a.score||a.dimension.localeCompare(b.dimension));
 const eligible=candidates.filter(c=>c.usable),first=eligible[0],second=eligible[1];
 const tied=!!(first&&second&&first.score-second.score<=Math.max(RULES.tieAbsolute,RULES.tieRelative*first.score));
 const status=!candidates.length?(fixedDimensions.length>=2?'exhausted':'not_requested'):!first?'insufficient':tied?'ambiguous':'recommended';
 const choices=tied?eligible.filter(c=>first.score-c.score<=Math.max(RULES.tieAbsolute,RULES.tieRelative*first.score)).map(c=>c.dimension):first?[first.dimension]:[];
 const summary=status==='not_requested'?'当前请求尚未扫描维度。':status==='exhausted'?'当前范围的渠道和设备均已固定，已到达可用维度的末端。':status==='insufficient'?'当前维度的变化信号或样本不足，暂不推荐唯一分析方向。':tied?`${choices.map(d=>DIMENSION_LABELS[d]).join('和')}都存在明显变化，信号接近，请选择一个继续查看。`:`系统建议${fixedDimensions.length?'继续':''}查看：${first.label}。${first.reason[1].text}`;
 return {method:RECOMMENDATION_VERSION,status,dimension:status==='recommended'?first.dimension:null,choices,candidates,reason:{code:status,text:summary,scoreGap:first&&second?first.score-second.score:null,tieThreshold:first?Math.max(RULES.tieAbsolute,RULES.tieRelative*first.score):null},rules:RULES,notice:'推荐用于确定探索优先级，不代表因果。去重分组可能重叠，变化不能相加解释整体人数变化。'};
}
