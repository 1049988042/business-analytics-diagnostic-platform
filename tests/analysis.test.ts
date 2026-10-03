import {clearAggregateCache} from '../lib/aggregate-cache';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decompose,dimensionResult,diagnose,recommend} from '../lib/discovery/foundation';
import {analyze,analysisPlan} from '../lib/discovery/analysis';
import {scan} from '../lib/discovery/service';
import {queryLog} from './analysis-db';
const c={revenue:130964.27,transactions:993,visitors:57888,buyers:809},p={revenue:108756.52,transactions:733,visitors:51364,buyers:666};
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const real=decompose(c,p);
assert.equal(real.metrics.revenue.title,'GMV 为什么增长 20.42%？');
close(real.branches.revenue[0].amount,36433.70504184132);close(real.branches.revenue[1].amount,-14225.955041841318);
assert.equal(real.leading.revenue,'transactions');assert.equal(real.leading.transactions,'visitors');
for(const check of Object.values(real.checks))assert.equal(check.passed,true);
for(let i=1;i<=200;i++){
 const a={revenue:i*78,transactions:i+9,visitors:i*131,buyers:i+3},b={revenue:i*67,transactions:i+4,visitors:i*120,buyers:i+1};
 const f=decompose(a,b),reverse=decompose(b,a);
 for(const check of Object.values(f.checks))assert.equal(check.passed,true);
 f.branches.revenue.forEach((n,j)=>close(n.amount,-reverse.branches.revenue[j].amount));
 f.branches.transactions.forEach((n,j)=>close(n.amount,-reverse.branches.transactions[j].amount));
}
assert.equal(decompose({...c,buyers:0},p).checks.transactions.status,'unavailable');
assert.equal(decompose({...c,transactions:0},p).checks.gmv.status,'unavailable');
assert.equal(decompose(c,c).leading.revenue,null);
const overlap=dimensionResult('visitors','channel',[{dimension:'A',period:'current',...c},{dimension:'A',period:'previous',...p},{dimension:'B',period:'current',...c},{dimension:'B',period:'previous',...p}],c,p);
assert.equal(overlap.exactContribution,false);assert.equal(overlap.conservation,null);assert.ok(overlap.notice.includes('不可相加'));
assert.equal(overlap.groups.reduce((n,r)=>n+r.delta,0),13048);assert.equal(overlap.parent.delta,6524);
assert.throws(()=>dimensionResult('revenue','channel',[],c,p),/守恒/);
assert.equal(diagnose(c,p).type,'BehavioralDiagnosis');assert.equal(diagnose(c,p).ordered,false);
assert.equal(recommend([overlap]).dimension,'channel');
assert.throws(()=>analysisPlan({dimensions:['region']}),/维度/);
assert.throws(()=>analysisPlan({filters:{device:'mobile'},scope:[{dimension:'device',value:'desktop'}]}),/冲突/);
assert.throws(()=>analysisPlan({scope:[{dimension:'device',value:'mobile'}],dimensions:['device']}),/重复/);
assert.throws(()=>analysisPlan({filters:{months:['2017-03']},comparison:{months:['2017-02']}}),/冲突/);
assert.deepEqual(analysisPlan({dimensions:['device','channel']}).dimensions,['device','channel']);
let count=0;
for(const filters of [{months:['2017-03']},{months:['2017-03'],channel:'Organic Search'},{months:['2017-03'],device:'mobile'}]){
 const fresh=await analyze({filters}),legacy=await scan({filters,mode:'overview'});
 assert.ok(fresh.status==='ready');assert.deepEqual(fresh.aggregates,legacy.aggregates);assert.deepEqual(fresh.decomposition,legacy.decomposition);assert.deepEqual(fresh.diagnosis,legacy.diagnosis);count++;
}
clearAggregateCache();queryLog.length=0;
const both:any=await analyze({metric:'visitors',filters:{months:['2017-03']},dimensions:['channel','device']});
assert.equal(both.status,'ready');if(both.status==='ready'){
 assert.equal(both.performance.aggregateQueries,3);assert.equal(queryLog.filter(q=>/GROUP BY period$/.test(q.sql)).length,1);
 assert.ok(both.dimensions.every((d:any)=>d.exactContribution===false));assert.deepEqual(both.availableDimensions,['channel','device']);
 await assert.rejects(()=>analyze({filters:{months:['2017-03']},expectedSourceVersions:[]}),/已更新/);
}
for(const [first,value,next] of [['channel','Organic Search','device'],['device','mobile','channel']]){
 const result:any=await analyze({metric:'transactions',filters:{months:['2017-03']},scope:[{dimension:first,value}],dimensions:[next]});
 assert.equal(result.status,'ready');if(result.status==='ready'){assert.equal(result.dimensions[0].conservation?.passed,true);assert.deepEqual(result.availableDimensions,[next]);}
}
const injected:any=await analyze({filters:{months:['2017-03'],channel:"' OR 1=1 --"}});
if(injected.status==='ready')assert.equal(injected.aggregates.current.transactions,0);
console.log(JSON.stringify({passed:true,randomCases:200,legacyParityCases:count,realCase:real,sqlQueries:queryLog.length},null,2));
if(process.env.ANALYSIS_RESULT)fs.writeFileSync(process.env.ANALYSIS_RESULT,JSON.stringify(real,null,2));

import {dimensionConclusion} from '../lib/discovery/step-conclusion';
// Formatting consumes existing results, never performs additional queries.
for(const metric of ['visitors','buyers','revenue','transactions','aov','conversion','frequency']){
 const response:any=await analyze({metric,filters:{months:['2017-03']},recommendation:'auto'});
 const before=queryLog.length;
 for(const result of response.dimensions){
  const candidate=response.recommendation.candidates.find((c:any)=>c.dimension===result.dimension);
  const conclusion=dimensionConclusion(result,candidate,response.request.filters);
  assert.deepEqual(result.stepConclusion,conclusion);
  assert.match(conclusion.text,/全局筛选范围/);
  if(result.nature==='distinct'){assert.ok(!conclusion.text.includes('贡献率'));assert.ok(!conclusion.text.includes('对整体'))}
  if(result.nature==='ratio'&&(candidate.highlights.positive.length||candidate.highlights.negative.length)){assert.match(conclusion.text,/分子/);assert.match(conclusion.text,/分母/)}
  const empty=dimensionConclusion(result,{highlights:{positive:[],negative:[]}},{channel:'Organic Search',device:'mobile'});
  assert.deepEqual(empty.scope,{channel:'Organic Search',device:'mobile'});
  assert.match(empty.text,/Organic Search 渠道、mobile 设备范围内/);
  if(result.nature!=='additive')assert.match(empty.text,/暂无满足/);
 }
 assert.equal(queryLog.length,before);
}
console.log('Step templates: seven metrics, authoritative scope, nature boundaries, insufficient sample and zero additional SQL passed.');
// Deterministic wording acceptance: actual aggregate reversal, zero baseline, unchanged and offsetting effects.
const reversed=decompose(p,c);
assert.match(reversed.summaries.revenue,/下降/);
assert.ok(!reversed.summaries.revenue.includes('主要由客单价'));
assert.match(decompose(c,c).summaries.revenue,/未发现非零/);
assert.match(decompose(c,{...p,revenue:0,transactions:0,buyers:0}).summaries.revenue,/上期为零或分母不足/);
const flat=decompose({revenue:100,transactions:20,visitors:200,buyers:20},{revenue:100,transactions:10,visitors:100,buyers:10});
assert.match(flat.summaries.revenue,/正负影响相互抵消/);
assert.equal(flat.checks.gmv.passed,true);
console.log('Conclusion edge cases: decline, zero baseline, unchanged factors and offsetting effects passed.');
