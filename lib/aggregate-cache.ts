import {batchRows,type ReadQuery} from './db';

// Private, bounded Worker-isolate cache. No HTTP/public cache and no identity data.
// Always read active source versions from D1 before calling; never cache that read.
// SQL + bind values + import versions identify the exact aggregation, not the KPI.
const entries=new Map<string,{expires:number;value:any[];bytes:number}>();

const TTL=5*60_000,MAX_ENTRIES=128,MAX_BYTES=8*1024*1024;
let bytes=0;
export function clearAggregateCache(){entries.clear();bytes=0}
function remember(key:string,value:any[]){
 const size=new TextEncoder().encode(JSON.stringify(value)).byteLength;
 if(size>MAX_BYTES/4)return;
 const old=entries.get(key);if(old){bytes-=old.bytes;entries.delete(key)}
 while(entries.size>=MAX_ENTRIES||bytes+size>MAX_BYTES){const first=entries.keys().next().value!;bytes-=entries.get(first)!.bytes;entries.delete(first)}
 entries.set(key,{expires:Date.now()+TTL,value:structuredClone(value),bytes:size});bytes+=size;
}
const cacheKey=(query:ReadQuery,sourceVersions:any[])=>JSON.stringify([JSON.stringify(['aggregate-v1',sourceVersions]),query.sql,query.params||[]]);
// A grouped raw aggregate is exactly the total for that group's filtered scope.
// Seed only server-computed raw rows under the identical query/version key.
export function seedAggregate(query:ReadQuery,sourceVersions:any[],value:any[]){remember(cacheKey(query,sourceVersions),value)}
export async function cachedAggregates(queries:ReadQuery[],sourceVersions:any[]){
 // Only completed plain data crosses requests; in-flight work stays request-local.
 const pending=new Map<string,Promise<any[]>>();
 const started=performance.now(),stats={requested:queries.length,executed:0,hits:0,coalesced:0,databaseMs:0,elapsedMs:0,cache:'worker-memory-v1',ttlSeconds:TTL/1000};
 const misses:Array<{key:string;query:ReadQuery;resolve:(v:any[])=>void;reject:(e:unknown)=>void}>=[];
 const promises=queries.map(query=>{
  const key=cacheKey(query,sourceVersions),hit=entries.get(key);
  if(hit&&hit.expires>Date.now()){stats.hits++;entries.delete(key);entries.set(key,hit);return Promise.resolve(hit.value)}
  if(hit){entries.delete(key);bytes-=hit.bytes}
  const running=pending.get(key);if(running){stats.coalesced++;return running}
  const promise=new Promise<any[]>((resolve,reject)=>{misses.push({key,query,resolve,reject})});pending.set(key,promise);return promise;
 });
 // Attach rejection handlers before starting the batch. A failed batch is never cached.
 const all=Promise.all(promises);
 if(misses.length){stats.executed=misses.length;const start=performance.now();
  try{const result=await batchRows(misses.map(m=>m.query));stats.databaseMs=performance.now()-start;
   misses.forEach((m,i)=>{remember(m.key,result[i]);m.resolve(result[i]);pending.delete(m.key)});
  }catch(error){misses.forEach(m=>{m.reject(error);pending.delete(m.key)})}
 }
 const results=structuredClone(await all);stats.elapsedMs=performance.now()-started;return {results,stats};
}
