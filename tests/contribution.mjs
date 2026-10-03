import assert from 'node:assert/strict';
import {factors,contribution} from '../lib/discovery/contribution.ts';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const [c,p] of [[{revenue:200,transactions:20},{revenue:100,transactions:10}],[{revenue:100,transactions:20},{revenue:200,transactions:10}],[{revenue:100,transactions:5},{revenue:100,transactions:10}],[{revenue:0,transactions:5},{revenue:100,transactions:10}]]){
 const f=factors(c,p);close(f.items.reduce((n,i)=>n+i.amount,0),c.revenue-p.revenue);
 const reverse=factors(p,c);f.items.forEach((i,n)=>close(i.amount,-reverse.items[n].amount));
}
assert.ok(factors({revenue:0,transactions:0},{revenue:100,transactions:10}).reason);
const joint=[{period:'previous',channel:'A',device:'desktop',revenue:100,transactions:10},{period:'current',channel:'A',device:'desktop',revenue:50,transactions:5},{period:'current',channel:'B',device:'mobile',revenue:100,transactions:10}];
let result=contribution(joint,{revenue:150,transactions:15},{revenue:100,transactions:10});
assert.equal(result.channels[0].name,'B');assert.equal(result.channels[0].share,200);assert.equal(result.channels[1].share,-100);
for(const c of result.channels)close(c.devices.reduce((n,d)=>n+d.delta,0),c.delta);
close(result.channels.reduce((n,c)=>n+c.delta,0),result.delta);
result=contribution([{period:'current',channel:'new',device:'mobile',revenue:100,transactions:10},{period:'previous',channel:'gone',device:'desktop',revenue:100,transactions:10}],{revenue:100,transactions:10},{revenue:100,transactions:10});
assert.ok(result.channels.every(c=>c.share===null));assert.equal(result.channels.length,2);
assert.throws(()=>contribution(joint,{revenue:1000,transactions:15},{revenue:100,transactions:10}),/未对齐/);
await import('./discovery.mjs');
const {scan}=await import('../lib/discovery/service.ts');
for(const filters of [{},{channel:'Direct'},{device:'mobile'},{channel:'missing'}]){const r=await scan({filters,mode:'month'});assert.equal(r.status,'ready');close(r.contribution.delta,r.aggregates.current.revenue-r.aggregates.previous.revenue);for(const c of r.contribution.channels)close(c.delta,c.devices.reduce((n,d)=>n+d.delta,0));}
console.log('Contribution reconciliation, reverse symmetry, zero orders, cancellation, new/disappearing channels and filtered SQL passed');
