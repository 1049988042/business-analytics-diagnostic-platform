import assert from 'node:assert/strict';
import {cachedRead,clearReadCache} from '../lib/client-cache';
let calls=0;
const completions:Array<()=>void>=[];
globalThis.fetch=(async(_url:any,options:any)=>{
 calls++;
 return await new Promise<Response>((resolve,reject)=>{
  options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  completions.push(()=>resolve(Response.json({value:calls})));
 });
}) as typeof fetch;
const first=new AbortController(),second=new AbortController();
const a=cachedRead('analysis?test',undefined,first.signal),b=cachedRead('analysis?test',undefined,second.signal);
assert.equal(calls,1);first.abort();await assert.rejects(a,{name:'AbortError'});
completions.shift()!();assert.deepEqual(await b,{value:1});
assert.deepEqual(await cachedRead('analysis?test'),{value:1});assert.equal(calls,1);
clearReadCache();
const c=cachedRead('analysis?test');assert.equal(calls,2);completions.shift()!();await c;
const cancelled=new AbortController();const d=cachedRead('analysis?new',undefined,cancelled.signal);cancelled.abort();await assert.rejects(d,{name:'AbortError'});
const e=cachedRead('analysis?new');assert.equal(calls,4);completions.pop()!();await e;
// An older in-flight response must not repopulate a cleared cache.
const f=cachedRead('analysis?version');clearReadCache();completions.pop()!();await f;
const g=cachedRead('analysis?version');assert.equal(calls,6);completions.pop()!();await g;
console.log('Client cache: deduplication, independent cancellation, retry and invalidation passed.');
