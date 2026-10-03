import {dimensionConclusion} from './step-conclusion';
import {coverageHints} from './coverage';
import {zero} from './aggregation';
import {compareMetrics,metricTree,DEFINITIONS} from './engine';
import {factors} from './contribution';
import {ANALYSIS_VERSION,METRIC_RULES,decompose,diagnose,dimensionResult,recommend} from './foundation';

// One server-side assembly path; dashboard reuses the same raw period rows.
// No SQL, client-side attribution, or alternate calculation definitions.
export function analysisResult({plan,period,sourceVersions,queries,results,stats,started}:any){
 const c={...zero,...results[0].find((r:any)=>r.period==='current')},p={...zero,...results[0].find((r:any)=>r.period==='previous')};
 const decomposition=decompose(c,p),diagnosis=diagnose(c,p);const dimensions=plan.dimensions.map((d:string,i:number)=>dimensionResult(plan.metric,d,results[i+1],c,p));
 const recommendation=recommend(dimensions,['channel','device'].filter(d=>!!plan.filters[d as 'channel'|'device']));
 for(const dimension of dimensions)(dimension as any).stepConclusion=dimensionConclusion(dimension,recommendation.candidates.find(c=>c.dimension===dimension.dimension),plan.filters);
 return {status:'ready' as const,analysisVersion:ANALYSIS_VERSION,request:plan,period,sourceVersions,recommendation,coverage:coverageHints(decomposition,recommendation,dimensions),decomposition,diagnosis,dimensions,availableDimensions:METRIC_RULES[plan.metric].dimensions.filter((d:string)=>!plan.filters[d as 'channel'|'device']),metricRules:METRIC_RULES[plan.metric],aggregates:{current:c,previous:p},metrics:compareMetrics(c,p).filter(m=>['revenue','transactions','aov','visitors','buyers','conversion'].includes(m.key)),tree:{current:metricTree(c),previous:metricTree(p)},definitions:DEFINITIONS,inputFilters:plan.filters,filters:{channel:plan.filters.channel||'全部渠道',device:plan.filters.device||'全部设备'},contribution:{factors:factors(c,p),channels:[],current:c.revenue,previous:p.revenue,delta:c.revenue-p.revenue},evidence:queries,performance:{aggregateQueries:stats.executed,requestedAggregateQueries:queries.length,aggregation:stats,totalQueries:stats.executed+2+(plan.mode==='overview'?0:1),serverMs:performance.now()-started}};
}
