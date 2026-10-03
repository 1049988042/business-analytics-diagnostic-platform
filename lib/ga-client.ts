import {readGaResponse} from './ga-response';
import {gaBatches} from './ga-batch';
export async function gaRequest(path:string,body:any){const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return readGaResponse(r,path.split('?')[0])}
export async function writeGa(file:Blob,name:string,id:string,onProgress:(s:string)=>void,legacy=false,maxRows=5000,expected?:any){
 const started=performance.now(),stats:any={sessions:0,events:0,productRows:0,storedRows:0,readCalls:0,dataInsertStatements:0,insertStatements:0,batchCalls:0,transactions:0,normalizeMs:0,writeWallMs:0,engineMs:0,serverMs:0,requestMs:0,requestBytes:0,maxBatchSessions:0,mode:legacy?'legacy':'bulk',targetBatchSessions:legacy?40:maxRows};
 let n=0;
 for await(const records of gaBatches(file,name,legacy,maxRows)){
 const body={n,records,legacy},bytes=new TextEncoder().encode(JSON.stringify(body)).length,t=performance.now();
 let r:any;try{r=await gaRequest('import/chunk?id='+id,body)}catch(e){throw Error(`第 ${n+1} 批中断，已确认 ${stats.sessions.toLocaleString('zh-CN')} 条会话。${e instanceof Error?e.message:'网络连接失败'} 未确认的批次不会自动重发。`)}stats.requestMs+=performance.now()-t;stats.requestBytes+=bytes;
 if(r.duplicate)throw Error('批次已存在，请使用新的测试记录');
 for(const key of ['sessions','events','productRows','storedRows','readCalls','dataInsertStatements','insertStatements','batchCalls','transactions','normalizeMs','writeWallMs','serverMs'])stats[key]+=r.telemetry[key];
 if(r.telemetry.engineMs==null)stats.engineMs=null;else if(stats.engineMs!=null)stats.engineMs+=r.telemetry.engineMs;
 stats.readCalls++; // route's import status lookup
 stats.maxBatchSessions=Math.max(stats.maxBatchSessions,records.length);n++;
 const fmt=(v:number)=>v.toLocaleString('zh-CN');
 onProgress(`已写入 ${fmt(stats.sessions)}${expected?'/'+fmt(expected.sessions):''} 条会话 · 覆盖 ${fmt(stats.events)}${expected?'/'+fmt(expected.hits):''} 条行为 · ${n} 批`);
 }
 stats.processingMs=performance.now()-started;
 stats.storedRowsPerSecond=stats.writeWallMs?stats.storedRows*1000/stats.writeWallMs:null;
 return stats;
}
