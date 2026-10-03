import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {cachedAggregates,clearAggregateCache} from '../lib/aggregate-cache';
import {analyze} from '../lib/discovery/analysis';
import {periodQuery} from '../lib/discovery/aggregation';
import {dashboard,preparePlan,measures,where} from '../lib/query';
import {rows,queryLog,execute} from './analysis-db';

const keys=['revenue','transactions','aov','visitors','buyers','conversion','sessions','views','adds','checkouts','purchases','ordered','cart_conversion'];
// Independent pre-change dashboard SQL: preserves NULL versus zero and distinct semantics.
async function originalTotal(filters:any){const w=where(filters);return (await rows(`SELECT ${keys.map(k=>measures[k]+' AS '+k)},SUM(CASE WHEN s.views=1 AND s.adds=1 THEN 1 ELSE 0 END) n0,SUM(CASE WHEN s.adds=1 AND s.checkouts=1 THEN 1 ELSE 0 END) n1,SUM(CASE WHEN s.checkouts=1 AND s.purchases=1 THEN 1 ELSE 0 END) n2 FROM sessions s WHERE ${w.sql}`,w.args))[0]}
const scopes=[{months:['2017-03']},{months:['2017-03'],channel:'Organic Search'},{months:['2017-03'],device:'mobile'},{months:['2017-03'],channel:'Direct',device:'desktop'},{months:['2017-03'],channel:'missing'},{months:['2017-02']},{months:['2017-02','2017-03']},{sample:true}];
for(const filters of scopes){
 const actual=await dashboard(filters),expected=await originalTotal(filters);
 assert.deepEqual({...actual.total},{...expected});
 if(actual.comparison.previousTotal){const q=preparePlan({dimension:'total',metrics:keys.slice(0,6),filters:{...filters,months:['2017-02']}});assert.deepEqual({...actual.comparison.previousTotal},{...(await rows(q.sql,q.params))[0]})}
 const warm=await dashboard(filters);assert.deepEqual(warm.total,actual.total);assert.equal(warm.performance.aggregation.executed,0);
}
clearAggregateCache();
const filters={months:['2017-03']},overview=await dashboard(filters);
const tree:any=await analyze({filters});assert.equal(tree.performance.aggregateQueries,0);
const dimensions:any=await analyze({filters,metric:'visitors',recommendation:'auto'});assert.equal(dimensions.performance.aggregateQueries,2);
const otherMetric:any=await analyze({filters,metric:'aov',recommendation:'auto'});assert.equal(otherMetric.performance.aggregateQueries,0);
assert.deepEqual(otherMetric.aggregates,dimensions.aggregates);
// Caller mutation cannot corrupt a shared cached row.
dimensions.aggregates.current.revenue=-99;
assert.equal((await analyze({filters}) as any).aggregates.current.revenue,overview.total.revenue);
clearAggregateCache();
const duplicateQuery={sql:'SELECT COUNT(*) n FROM sessions'};
const concurrent=await cachedAggregates([duplicateQuery,duplicateQuery],[]);
assert.equal(concurrent.stats.executed,1);assert.equal(concurrent.stats.coalesced,1);
// Active import change invalidates cached aggregates even within TTL.
execute("UPDATE months SET import_id='replacement' WHERE month='2017-03'");
const replaced:any=await analyze({filters});assert.equal(replaced.performance.aggregateQueries,1);assert.equal(replaced.aggregates.current.transactions,0);
await assert.rejects(()=>analyze({filters,expectedSourceVersions:tree.sourceVersions}),/已更新/);
execute("UPDATE months SET import_id='mar' WHERE month='2017-03'");
const bad={sql:'SELECT * FROM nonexistent_table'};queryLog.length=0;
await assert.rejects(()=>cachedAggregates([bad],[]));await assert.rejects(()=>cachedAggregates([bad],[]));assert.equal(queryLog.length,2);

// Synthetic SQLite benchmark, NOT production D1 latency or real GA acceptance data.
execute(`CREATE INDEX sessions_month_import ON sessions(month,import_id);
 WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<12) INSERT OR IGNORE INTO months SELECT '2017-'||printf('%02d',x),'bench-'||x FROM n;
 WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<120000)
 INSERT INTO sessions SELECT m.import_id,'bench-'||x,m.month||'-01',m.month,'u-'||(x%17000),CASE WHEN x%3=0 THEN 'Direct' ELSE 'Organic Search' END,CASE WHEN x%2=0 THEN 'mobile' ELSE 'desktop' END,x%2,80.0*(x%2),x%2,1,1,1,x%2,x%2 FROM n JOIN months m ON m.month='2017-'||printf('%02d',(x%12)+1);`);
const period={previous:{start:'2017-02-01',end:'2017-02-28'},current:{start:'2017-03-01',end:'2017-03-31'}};
const current=periodQuery(filters,period),original={sql:current.sql.replace(' AND s.month BETWEEN ? AND ?',''),params:[...current.params.slice(0,-4),...current.params.slice(-2)]};
assert.deepEqual(await rows(current.sql,current.params),await rows(original.sql,original.params));
const timings=async(q:any)=>{const samples=[];for(let i=0;i<7;i++){const t=performance.now();await rows(q.sql,q.params);samples.push(performance.now()-t)}return {medianMs:[...samples].sort((a,b)=>a-b)[3],samples}};
const before=await timings(original),after=await timings(current);
clearAggregateCache();const versions=await rows('SELECT month,import_id FROM months ORDER BY month');
const cold=await cachedAggregates([current],versions),hot=await cachedAggregates([current],versions);
const report={environment:'local synthetic SQLite; 120354 sessions; not production timing',parityScopes:scopes.length,passed:true,aggregateCounts:{dashboard:overview.performance.aggregation.executed,treeAfterDashboard:tree.performance.aggregateQueries,dimensionsAfterTree:otherMetric.performance.requestedAggregateQueries-1,switchMetric:otherMetric.performance.aggregateQueries},rangeQuery:{before,after},cold:cold.stats,hot:hot.stats,queryPlan:{before:await rows('EXPLAIN QUERY PLAN '+original.sql,original.params),after:await rows('EXPLAIN QUERY PLAN '+current.sql,current.params)}};
writeFileSync('.sites-runtime/performance-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
// v31: cold overview avoids unused panels and supplies the identical server analysis.
clearAggregateCache();
const fast=await dashboard(filters,{overview:true});
assert.equal(fast.performance.aggregation.executed,2);
const independent:any=await analyze({filters});
assert.deepEqual(fast.analysis?.decomposition,independent.decomposition);
assert.deepEqual(fast.analysis?.metrics,independent.metrics);
assert.deepEqual(fast.analysis?.sourceVersions,independent.sourceVersions);
assert.deepEqual(fast.analysis?.diagnosis,independent.diagnosis);
assert.deepEqual(fast.total,(await dashboard(filters)).total);
// Both drill orders reuse group totals without summing distinct visitors across groups.
for(const [dimension,value,next] of [['channel','Organic Search','device'],['device','mobile','channel']]){
 clearAggregateCache();
 await analyze({filters,metric:'visitors',recommendation:'auto'});
 const seeded:any=await analyze({filters,metric:'visitors',scope:[{dimension,value}],recommendation:'auto'});
 assert.equal(seeded.performance.aggregateQueries,1);
 clearAggregateCache();
 const isolated:any=await analyze({filters,metric:'visitors',scope:[{dimension,value}],recommendation:'auto'});
 assert.equal(isolated.performance.aggregateQueries,2);
 assert.deepEqual(seeded.aggregates,isolated.aggregates);
 assert.deepEqual(seeded.decomposition,isolated.decomposition);
 assert.deepEqual(seeded.dimensions,isolated.dimensions);
 assert.deepEqual(seeded.availableDimensions,[next]);
}
const benchmarkOverview=async(fast:boolean)=>{const samples=[];for(let i=0;i<7;i++){clearAggregateCache();const start=performance.now();await dashboard(filters,{overview:fast});samples.push(performance.now()-start)}return {medianMs:[...samples].sort((a,b)=>a-b)[3],samples}};
const overviewComparison={environment:'synthetic SQLite, not production D1 latency',full:await benchmarkOverview(false),overview:await benchmarkOverview(true),coldScansBefore:5,coldScansAfter:2,metricClickRequestsAfter:0,drillScansBefore:2,drillScansAfter:1};
writeFileSync('.sites-runtime/performance-31.json',JSON.stringify(overviewComparison,null,2));
console.log(JSON.stringify(overviewComparison,null,2));
