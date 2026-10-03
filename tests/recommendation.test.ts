import assert from 'node:assert/strict';
import {recommend,RULES} from '../lib/discovery/recommendation';
import {dimensionResult} from '../lib/discovery/foundation';
import {analyze,analysisPlan} from '../lib/discovery/analysis';
import {queryLog} from './analysis-db';

const parent=(visitors:number)=>({visitors,buyers:100,transactions:120,revenue:12000});
function dimension(name:string,deltas:number[],names?:string[]){
 const raw=deltas.flatMap((delta,i)=>[{dimension:names?.[i]||'Group '+i,period:'previous',...parent(2000)},{dimension:names?.[i]||'Group '+i,period:'current',...parent(2000+delta)}]);
 return dimensionResult('visitors',name,raw,parent(11000),parent(10000));
}
const concentrated=dimension('device',[900,50,50]),dispersed=dimension('channel',[250,250,250,250]);
let result=recommend([dispersed,concentrated]);
assert.equal(result.status,'recommended');assert.equal(result.dimension,'device');
assert.equal(result.candidates[0].leadingGroup,'Group 0');
assert.deepEqual(result,recommend([concentrated,dispersed]));
result=recommend([dimension('channel',[900,50,50]),dimension('device',[334,333,333])]);
assert.equal(result.dimension,'channel');
result=recommend([dimension('channel',[700,150,150]),dimension('device',[699,151,150])]);
assert.equal(result.status,'ambiguous');assert.equal(result.dimension,null);assert.equal(result.choices.length,2);
assert.ok(result.reason.scoreGap!<=result.reason.tieThreshold!);
const offsets=recommend([dimension('channel',[1500,-1499,0])]);
assert.equal(offsets.candidates[0].positiveMovement,1500);assert.equal(offsets.candidates[0].negativeMovement,1499);
assert.ok(Number.isFinite(offsets.candidates[0].score));assert.equal(offsets.candidates[0].exactContribution,false);
assert.equal(recommend([dimension('channel',[0,0,0])]).status,'insufficient');
assert.equal(recommend([dimension('channel',[1000])]).status,'insufficient');
assert.equal(recommend([dimension('channel',[900,50,50],['(not set)','A','B'])]).status,'insufficient');
const small=dimension('channel',[900,50,50]);small.samples={currentVisitors:20,previousVisitors:20};
assert.equal(recommend([small]).status,'insufficient');
const invalid=dimension('device',[900,50,50]);invalid.groups[0].delta=null;
assert.equal(recommend([invalid]).candidates[0].excluded[0].reason,'无法计算变化');
assert.equal(recommend([concentrated,dispersed],['device']).dimension,'channel');
assert.equal(recommend([concentrated,dispersed],['device','channel']).status,'exhausted');
assert.equal(recommend([]).status,'not_requested');
assert.equal(RULES.minimumParentVisitors,200);
assert.throws(()=>analysisPlan({recommendation:'auto',dimensions:['channel']}),/自动推荐/);
assert.throws(()=>analysisPlan({scope:[{dimension:'channel',value:''}]}),/无效/);
assert.deepEqual(analysisPlan({recommendation:'auto',scope:[{dimension:'device',value:'mobile'}]}).dimensions,['channel']);
assert.deepEqual(analysisPlan({recommendation:'auto',filters:{channel:'Organic Search'}}).dimensions,['device']);
assert.deepEqual(analysisPlan({recommendation:'auto',filters:{channel:'Organic Search',device:'mobile'}}).dimensions,[]);
assert.throws(()=>analysisPlan({recommendation:'auto',scope:[{dimension:'device',value:'mobile'},{dimension:'device',value:'mobile'}]}),/无效/);
queryLog.length=0;
const auto:any=await analyze({metric:'visitors',filters:{months:['2017-03']},recommendation:'auto'});
assert.equal(auto.status,'ready');assert.equal(auto.performance.totalQueries,5);assert.equal(queryLog.length,5);assert.equal(auto.dimensions.length,2);
for(const [dimension,value,remaining] of [['channel','Organic Search','device'],['device','mobile','channel']]){
 const scoped:any=await analyze({metric:'visitors',filters:{months:['2017-03']},recommendation:'auto',scope:[{dimension,value}],expectedSourceVersions:auto.sourceVersions});
 const explicit:any=await analyze({metric:'visitors',filters:{months:['2017-03'],[dimension]:value},dimensions:[remaining]});
 assert.deepEqual(scoped.dimensions,explicit.dimensions);assert.deepEqual(scoped.aggregates,explicit.aggregates);
 assert.equal(scoped.performance.totalQueries,3);assert.deepEqual(scoped.availableDimensions,[remaining]);
 assert.ok(scoped.recommendation.candidates.every((c:any)=>c.dimension!==dimension));
 assert.ok(scoped.evidence.every((q:any)=>q.params.includes(value)));
}
const allFixed:any=await analyze({metric:'visitors',filters:{months:['2017-03'],device:'mobile'},recommendation:'auto',scope:[{dimension:'channel',value:'Organic Search'}]});
assert.equal(allFixed.recommendation.status,'exhausted');assert.deepEqual(allFixed.dimensions,[]);
console.log('Phase 2 recommendation and unified SQL integration: all assertions passed.');
