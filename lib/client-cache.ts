import {readGaResponse} from './ga-response';
const cache=new Map<string,{time:number,value:any}>();
type Pending={controller:AbortController;promise:Promise<any>;users:number};
const pending=new Map<string,Pending>();
let generation=0;
export function clearReadCache(){generation++;cache.clear()}
// Only aggregate read responses; never cache identity, settings or model calls.
export async function cachedRead(path:string,body?:any,signal?:AbortSignal){
 const key=path+JSON.stringify(body||null),hit=cache.get(key),version=generation;
 if(hit&&Date.now()-hit.time<60000)return hit.value;
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const requestKey=version+':'+key;
 let entry=pending.get(requestKey);
 if(!entry){
  const controller=new AbortController();
  entry={controller,users:0,promise:Promise.resolve()};
  const current=entry;
  entry.promise=(async()=>{
   const r=await fetch('/api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
   const value=await readGaResponse(r,path.split('?')[0]);
   if(!controller.signal.aborted&&version===generation){if(cache.size>=40)cache.delete(cache.keys().next().value!);cache.set(key,{time:Date.now(),value})}
   return value;
  })().finally(()=>{if(pending.get(requestKey)===current)pending.delete(requestKey)});
  pending.set(requestKey,entry);
 }
 const current=entry;current.users++;
 return new Promise((resolve,reject)=>{
  let done=false;
  const finish=(callback:()=>void)=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);current.users--;if(!current.users){if(pending.get(requestKey)===current)pending.delete(requestKey);current.controller.abort()}callback()};
  const abort=()=>finish(()=>reject(new DOMException('Aborted','AbortError')));
  signal?.addEventListener('abort',abort,{once:true});
  current.promise.then(value=>finish(()=>resolve(value)),error=>finish(()=>reject(error)));
 });
}
