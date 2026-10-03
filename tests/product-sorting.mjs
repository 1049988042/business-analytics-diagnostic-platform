import assert from 'node:assert/strict';
import {ingest} from '../lib/imports.ts';import {runPlan} from '../lib/query.ts';
await ingest('sample-v1',0,Array.from({length:150},(_,i)=>({fullVisitorId:String(i),visitId:i+1,date:'20170101',totals:{},hits:[{time:1,hitNumber:1,eCommerceAction:{action_type:'6'},transaction:{transactionId:'t'+i},product:[{productSKU:'sku'+i,v2ProductName:'商品'+String(i).padStart(3,'0'),productQuantity:i,productRevenue:i*1e6}]}]})));
const base={dimension:'product',metrics:['quantity','product_revenue'],filters:{sample:true}};
const desc=await runPlan({...base,sort:'quantity',direction:'desc'});assert.equal(desc.rows.length,100);assert.equal(desc.rows[0].quantity,149);
const asc=await runPlan({...base,sort:'quantity',direction:'asc'});assert.equal(asc.rows[0].quantity,0);assert.equal(asc.rows[99].quantity,99);
const names=await runPlan({...base,sort:'dimension',direction:'asc'});assert.equal(names.rows[0].product_name,'商品000');
console.log('3 product sorting checks passed, including full dataset sorting before LIMIT 100');
