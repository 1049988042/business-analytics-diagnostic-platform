import assert from 'node:assert/strict';
import {sql} from './storage.mjs';import {ingest} from '../lib/imports.ts';
import {compareMetrics,findings,metricTree} from '../lib/discovery/engine.ts';
import {periods,scan} from '../lib/discovery/service.ts';
let count=0;function check(name,fn){fn();count++;console.log('PASS',name)}
const baseline={revenue:10000,transactions:100,visitors:1000,buyers:80,sessions:1200,views:600,adds:300,checkouts:150,purchases:100,view_add_n:240,add_checkout_n:120,checkout_purchase_n:90};
const current={...baseline,revenue:12000,transactions:120,buyers:60};
const metrics=compareMetrics(current,baseline),cards=findings(metrics,[],[],'2017-03-01');
check('growth and conversion decline are both scanned',()=>{assert.equal(metrics.find(m=>m.key==='revenue').direction,'growth');assert.equal(metrics.find(m=>m.key==='conversion').pp,-2.0000000000000004);assert.ok(cards.some(c=>c.type==='指标背离'))});
check('stable data does not manufacture findings',()=>assert.equal(findings(compareMetrics(baseline,baseline),[],[],'2017-03-01').length,0));
check('zero baseline does not produce infinite growth',()=>{const m=compareMetrics(current,{...baseline,revenue:0}).find(m=>m.key==='revenue');assert.equal(m.relative,null);assert.equal(m.flagged,true)});
check('zero denominator is unavailable, not 0 percent',()=>{const m=compareMetrics({...current,visitors:0},baseline).find(m=>m.key==='conversion');assert.equal(m.current,null);assert.equal(m.flagged,false)});
check('small samples retain values but do not flag',()=>{const m=compareMetrics({...current,visitors:30},baseline).find(m=>m.key==='conversion');assert.ok(m.reason);assert.equal(m.flagged,false)});
check('metric tree includes transactions per buyer',()=>{const tree=metricTree(current);assert.equal(tree.visitors*tree.conversion*tree.frequency*tree.aov,tree.revenue)});
const dates=[];for(let i=0;i<90;i++)dates.push(new Date(Date.UTC(2017,0,1+i)).toISOString().slice(0,10));
check('default compares March to February, with unequal day counts explicit',()=>{const p=periods(dates,[]);assert.equal(p.month,'2017-03');assert.equal(p.previous.start,'2017-02-01');assert.equal(p.current.days,31);assert.equal(p.previous.days,28)});
check('single month selection compares to immediately previous calendar month',()=>assert.equal(periods(dates,['2017-02']).previous.start,'2017-01-01'));
check('one available month falls back to two complete seven-day windows',()=>{const p=periods(dates.slice(0,31),[],undefined,'auto');assert.equal(p.mode,'week');assert.equal(p.current.start,'2017-01-25');assert.equal(p.previous.start,'2017-01-18')});
check('missing days block comparison',()=>assert.ok(periods(dates.filter(d=>d!=='2017-02-10'),[]).reason));
check('missing previous month is not silently compared with an older month',()=>assert.ok(periods(dates.filter(d=>!d.startsWith('2017-02')),[],'2017-03','month').reason));
check('structure uses revenue shares with sample guards',()=>{const items=[{kind:'channel',segment:'A',currentRevenue:7000,previousRevenue:5000,currentTransactions:70,previousTransactions:50},{kind:'channel',segment:'B',currentRevenue:3000,previousRevenue:5000,currentTransactions:30,previousTransactions:50}];assert.equal(findings([],items,[],'2017-03-01').length,2)});
check('daily scan requires full seven prior days and an absolute-size guard',()=>{const daily=dates.slice(0,8).map(date=>({date,revenue:200,transactions:20}));daily[7].revenue=500;assert.equal(findings([],[],daily,'2017-01-08').length,1);assert.equal(findings([],[],daily.filter((d,i)=>i!==2),'2017-01-08').length,0)});
// Integration fixture: repeat visitors across dates. Monthly COUNT DISTINCT must not sum daily counts.
for(const month of ['2017-01','2017-02','2017-03']){
 const records=dates.filter(d=>d.startsWith(month)).flatMap((date,day)=>Array.from({length:20},(_,u)=>({date:date.replaceAll('-',''),fullVisitorId:'user'+u,visitId:day*20+u+1,channelGrouping:u<10?'Direct':'Organic Search',device:{deviceCategory:'desktop'},totals:{transactions:u<5?'1':'0',transactionRevenue:u<5?'100000000':'0'},hits:[{time:1,hitNumber:1,eCommerceAction:{action_type:'2'},product:[]},{time:2,hitNumber:2,eCommerceAction:{action_type:'3'},product:[]}]})));
 await ingest(month,0,records);sql.prepare('INSERT INTO months(month,import_id) VALUES(?,?)').run(month,month);
}
const result=await scan({filters:{}});
check('real SQL counts monthly distinct visitors, not daily sums',()=>{assert.equal(result.status,'ready');assert.equal(result.aggregates.current.visitors,20);assert.equal(result.aggregates.current.transactions,155);assert.equal(result.aggregates.previous.transactions,140)});
check('SQL and source versions accompany findings',()=>{assert.equal(result.evidence.length,4);assert.equal(result.sourceVersions.length,2);assert.ok(result.evidence.every(e=>e.sql&&Array.isArray(e.params)))});
const filtered=await scan({filters:{channel:'Direct'},mode:'month'});check('channel filter applies to numerators and denominators',()=>assert.equal(filtered.aggregates.current.visitors,10));
const empty=await scan({filters:{channel:'missing'}});check('covered dates with no segment data yield zero amounts and null ratios',()=>{assert.equal(empty.aggregates.current.revenue,0);assert.equal(empty.metrics.find(m=>m.key==='conversion').current,null)});
check('sample mode is excluded from business discovery',()=>{});assert.equal((await scan({filters:{sample:true}})).status,'unavailable');
console.log(count+' discovery checks passed');
