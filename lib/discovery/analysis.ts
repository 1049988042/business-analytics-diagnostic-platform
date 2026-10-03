import {analysisResult} from './analysis-result';
import {cachedAggregates,seedAggregate} from '../aggregate-cache';
import {where,comparisonMonths,type Filters} from '../query';
import {rows} from '../db';
import {periods,monthEnd} from './periods';
import {periodQuery} from './aggregation';
import {METRIC_RULES} from './foundation';
export type AnalysisRequest={metric?:string;comparison?:{mode?:string;months?:string[];month?:string};filters?:Filters;scope?:Array<{dimension:string;value:string}>;dimensions?:string[];recommendation?:'auto';operation?:'metric_decomposition'|'dimension_analysis'|'behavioral_diagnosis';expectedSourceVersions?:any[];mode?:string;month?:string};
export function analysisPlan(input:AnalysisRequest){
 const metric=input.metric||'revenue';if(!Object.hasOwn(METRIC_RULES,metric))throw Error('不支持的指标');
 const f:Filters={...(input.filters||{})};if(input.comparison?.months){if(f.months&&JSON.stringify([...f.months].sort())!==JSON.stringify([...input.comparison.months].sort()))throw Error('对比月份与全局筛选冲突');f.months=input.comparison.months;}
 if(f.months!=null&&!Array.isArray(f.months))throw Error('月份无效');where(f);
 if(f.channel!=null&&typeof f.channel!=='string'||f.device!=null&&typeof f.device!=='string'||f.sample!=null&&typeof f.sample!=='boolean')throw Error('筛选条件无效');
 const scope=input.scope||[],used=new Set<string>();if(!Array.isArray(scope)||scope.length>2)throw Error('下钻条件无效');
 for(const s of scope){if(!['channel','device'].includes(s.dimension)||used.has(s.dimension)||typeof s.value!=='string'||!s.value.trim()||s.value.length>200)throw Error('下钻维度无效');const d=s.dimension as 'channel'|'device';if(f[d]&&f[d]!==s.value)throw Error('下钻条件与全局筛选冲突');f[d]=s.value;used.add(d)}
 if(input.recommendation!=null&&input.recommendation!=='auto')throw Error('推荐模式无效');
 const availableDimensions=METRIC_RULES[metric].dimensions.filter((d:string)=>!f[d as 'channel'|'device']);
 if(input.recommendation==='auto'&&input.dimensions?.length)throw Error('自动推荐时由当前可用维度决定扫描范围');
 const dimensions=input.recommendation==='auto'?availableDimensions:input.dimensions||[];if(!Array.isArray(dimensions)||dimensions.length>2||new Set(dimensions).size!==dimensions.length||dimensions.some(d=>!METRIC_RULES[metric].dimensions.some((allowed:string)=>allowed===d)))throw Error('不支持的维度');
 if(dimensions.some(d=>f[d as 'channel'|'device']))throw Error('已固定的维度不能重复分析');
 if(input.operation&&!['metric_decomposition','dimension_analysis','behavioral_diagnosis'].includes(input.operation))throw Error('分析类型无效');
 return {metric,filters:f,dimensions,scope,recommendation:input.recommendation,availableDimensions,operation:input.operation||'metric_decomposition',mode:input.comparison?.mode||input.mode||'overview',month:input.comparison?.month||input.month};
}
export async function analyze(input:AnalysisRequest={}){
 const started=performance.now(),plan=analysisPlan(input);if(plan.filters.sample)return {status:'unavailable' as const,reason:'开发样例不计算经营变化'};
 const versions=await rows('SELECT month,import_id FROM months ORDER BY month');let period:any;
 if(plan.mode==='overview'){
 const comparison=comparisonMonths(plan.filters.months||[],versions.map(v=>v.month));const span=(months:string[])=>{const start=months[0]+'-01',end=monthEnd(months.at(-1)!);return {start,end,days:Math.round((Date.parse(end)-Date.parse(start))/86400000)+1}};
 period=comparison.reason?{reason:comparison.reason}:{mode:'overview',current:span(comparison.current),previous:span(comparison.previous),reason:''};
 }else{
 const dates=(await rows('SELECT s.date FROM sessions s WHERE '+where({}).sql+' GROUP BY s.date ORDER BY s.date')).map(r=>r.date);period=periods(dates,plan.filters.months||[],plan.month,plan.mode);
 }
 if(period.reason)return {status:'unavailable' as const,reason:period.reason,period};
 const sourceVersions=versions.filter(v=>v.month>=period.previous.start.slice(0,7)&&v.month<=period.current.end.slice(0,7));
 if(input.expectedSourceVersions&&JSON.stringify(input.expectedSourceVersions)!==JSON.stringify(sourceVersions))throw Error('数据已更新，请返回概览重新查看分析');
 const queries=[periodQuery(plan.filters,period),...plan.dimensions.map(d=>periodQuery(plan.filters,period,d))];
 const {results,stats}=await cachedAggregates(queries,versions);
 const after=await rows('SELECT month,import_id FROM months ORDER BY month');if(JSON.stringify(versions)!==JSON.stringify(after))throw Error('分析期间数据更新，请重新分析');
 // Preserve exact per-group distinct counts; never sum groups into a parent.
 // This removes the redundant total scan on subsequent group drill-downs.
 for(let i=0;i<plan.dimensions.length;i++){
  const dimension=plan.dimensions[i],groups=new Map<string,any[]>();
  for(const row of results[i+1]){if(typeof row.dimension!=='string'||!row.dimension.trim())continue;const {dimension:value,...raw}=row;const group=groups.get(value)||[];group.push(raw);groups.set(value,group)}
  for(const [value,raw] of groups)seedAggregate(periodQuery({...plan.filters,[dimension]:value},period),versions,raw);
 }
 return analysisResult({plan,period,sourceVersions,queries,results,stats,started});
}
