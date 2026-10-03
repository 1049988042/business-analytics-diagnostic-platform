import './discovery.mjs';
import assert from 'node:assert/strict';
import {sql} from './storage.mjs';
import {dashboard,runPlan,shoppingTransitions,comparisonMonths,where} from '../lib/query.ts';
import {periods} from '../lib/discovery/service.ts';
const months=['2017-01','2017-02','2017-03'];
assert.deepEqual(comparisonMonths(['2017-03'],months).previous,['2017-02']);
assert.ok(comparisonMonths([],months).reason);
assert.ok(comparisonMonths(['2017-01','2017-03'],months).reason);
assert.deepEqual(comparisonMonths(['2017-03','2017-04'],['2017-01','2017-02','2017-03','2017-04']).previous,['2017-01','2017-02']);
assert.equal(periods(['2017-01-01'],[]).mode,'month');
for(const filters of [{months:['2017-03']},{months:['2017-02'],channel:'Direct'},{months:['2017-03'],channel:'missing'},{}, {sample:true}]){
 const d=await dashboard(filters),metrics=['revenue','transactions','aov','visitors','buyers','conversion','sessions'];
 const old=await runPlan({dimension:'total',metrics,filters});
 for(const k of metrics)assert.equal(d.total[k],old.rows[0][k],k);
 assert.deepEqual(d.transitions,(await shoppingTransitions(filters)).rows);
 if(!d.comparison.reason){const prior=await runPlan({dimension:'total',metrics:metrics.slice(0,6),filters:{...filters,months:d.comparison.previous}});for(const k of metrics.slice(0,6)){const a=d.total[k],b=prior.rows[0][k];assert.equal(d.comparison.changes[k].relative,b==null||b===0||a==null?null:(a-b)/Math.abs(b)*100)}}
}
const plan=sql.prepare('EXPLAIN QUERY PLAN SELECT SUM(s.revenue) FROM sessions s WHERE '+where({}).sql).all();
assert.ok(plan.some(r=>r.detail.includes('SEARCH s USING INDEX sessions_month_import')));
console.log('Dashboard totals, funnel parity, period boundaries, missing baselines and indexed lookup passed');
console.log(plan.map(r=>r.detail).join('\n'));

const monthly=await dashboard({});
const reference=await runPlan({dimension:'month',metrics:['revenue','transactions','visitors','conversion','aov']});
assert.deepEqual(monthly.monthly,reference.rows);
assert.deepEqual(['2017-01','2017-02','2017-03'].map(m=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5)),0)).getUTCDate()),[31,28,31]);
console.log('Monthly trend including AOV and 31/28/31 calendar-day denominators passed');
