// Presentation only: consume existing server aggregate, ranking and sample results.
// No new attribution, recommendation scoring, SQL or model calls.
const labels:Record<string,string>={revenue:'GMV',transactions:'交易数',visitors:'访客数',buyers:'购买人数',conversion:'购买转化率',aov:'客单价',frequency:'购买用户人均交易次数',channel:'渠道',device:'设备'};
const number=(n:number)=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2});
const value=(n:number|null,k:string)=>n==null?'不可计算':k==='conversion'?number(n*100)+'%':['revenue','aov'].includes(k)?'$'+number(n):number(n);
const delta=(n:number,k:string)=>(n>0?'+':n<0?'−':'')+(k==='conversion'?number(Math.abs(n)*100)+' 个百分点':value(Math.abs(n),k));
export function dimensionConclusion(result:any,candidate:any,filters:any){
 const metric=result.metric,label=labels[metric],dimension=labels[result.dimension];
 const scope={channel:filters.channel||null,device:filters.device||null};
 const scopeText=scope.channel||scope.device?'在 '+[scope.channel&&scope.channel+' 渠道',scope.device&&scope.device+' 设备'].filter(Boolean).join('、')+'范围内':'在全局筛选范围内（全部渠道、全部设备）';
 const relative=result.parent.relative;
 const overall=relative==null?`${label}本期 ${value(result.parent.current,metric)}，上期 ${value(result.parent.previous,metric)}，无法计算环比。`:`${label}本期${relative>0?'增长':relative<0?'下降':'持平'}${relative===0?'':' '+Math.abs(relative).toFixed(2)+'%'}。`;
 const positive=candidate?.highlights.positive||[],negative=candidate?.highlights.negative||[];
 let detail='';
 if(result.nature==='additive'){
  // These mutually exclusive groups were conservation-checked by dimensionResult.
  detail=`净变化 ${delta(result.parent.delta,metric)}。`;
  const parts=[];
  if(result.positive.length)parts.push(`主要正向贡献来自 ${result.positive[0].name}（${delta(result.positive[0].delta,metric)}）`);
  if(result.positive.length>1)parts.push('其他正向贡献包括 '+result.positive.slice(1,3).map((g:any)=>`${g.name}（${delta(g.delta,metric)}）`).join('、'));
  if(result.negative.length)parts.push('负向影响来自 '+result.negative.slice(0,3).map((g:any)=>`${g.name}（${delta(g.delta,metric)}）`).join('、'));
  detail+=parts.length?parts.join('；')+'。':'各分组净变化为零。';
 }else if(!positive.length&&!negative.length){
  detail='暂无满足现有样本条件的突出变化分组，暂不判断变化主要出现在哪里；可展开全部分组查看数据。';
 }else if(result.nature==='distinct'){
  const person=metric==='buyers'?'去重购买人数':'去重访客';
  detail='在满足样本条件的分组中，'+[
   positive.length?`${person}增加最明显的是 ${positive[0].name}（增加 ${number(positive[0].delta)}）`:null,
   negative.length?`${person}减少最明显的是 ${negative[0].name}（减少 ${number(Math.abs(negative[0].delta))}）`:null
  ].filter(Boolean).join('；')+'。各组独立去重，分组变化不能相加为整体精确贡献。';
 }else{
  const numerator=metric==='aov'?'revenue':metric==='frequency'?'transactions':'buyers',denominator=metric==='aov'?'transactions':metric==='frequency'?'buyers':'visitors';
  detail='按现有分母加权排序和样本条件，值得关注的分组为：'+[positive[0],negative[0]].filter(Boolean).map(g=>`${g.name}：${label} ${value(g.previousValue,metric)} → ${value(g.currentValue,metric)}（变化 ${delta(g.delta,metric)}）；分子${labels[numerator]} ${value(g.previous[numerator]||0,numerator)} → ${value(g.current[numerator]||0,numerator)}，分母${labels[denominator]} ${value(g.previous[denominator]||0,denominator)} → ${value(g.current[denominator]||0,denominator)}`).join('；')+'。各组比例变化不可相加，也不能直接认定为业务原因。';
 }
 return {metric,dimension:result.dimension,nature:result.nature,scope,text:`${scopeText}，${overall}从${dimension}维度看，${detail}`};
}
