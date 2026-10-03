import {db,one,rows} from './db';
import {report} from './imports';
const SESSION_COLS='sid,date,month,visitor,channel,device,transactions,revenue,buyer,views,adds,checkouts,purchases,ordered,hits,purchase_events,transaction_ids,missing_ids';
const PRODUCT_COLS='sid,sku,name,category,views,adds,checkouts,purchases,ordered,quantity,revenue';
export async function startBenchmark(sourceId:string,mode:string){
 if(!['legacy','bulk-5000','bulk-10000'].includes(mode))throw Error('测试模式无效');
 const source=await one("SELECT * FROM imports WHERE id=? AND status='committed' AND raw=1 AND sample=0",[sourceId]);if(!source)throw Error('请选择已导入的完整原文件');
 const id=crypto.randomUUID();await db().prepare('INSERT INTO imports(id,hash,name,status,sample,created,report,raw) VALUES(?,?,?,?,?,?,?,0)').bind(id,source.hash,'性能对照 '+mode+' · '+source.name,'loading',2,new Date().toISOString(),JSON.stringify({benchmark:{sourceId,mode}})).run();return {id};
}
export async function cleanBenchmark(id:string){
 const imp=await one('SELECT * FROM imports WHERE id=?',[id]);if(imp?.sample!==2)throw Error('不是性能测试记录');
 await db().batch(['sessions','products','chunks'].map(table=>db().prepare(`DELETE FROM ${table} WHERE import_id=?`).bind(id)));
 if(['loading','failed'].includes(imp.status))await db().prepare("UPDATE imports SET status='cancelled' WHERE id=?").bind(id).run();
}
export function safeStats(stats:any){
 if(!stats||typeof stats!=='object')throw Error('缺少计时记录');
 const result:any={};for(const k of ['sessions','events','productRows','storedRows','readCalls','dataInsertStatements','insertStatements','batchCalls','transactions','normalizeMs','writeWallMs','engineMs','serverMs','requestMs','requestBytes','maxBatchSessions','targetBatchSessions','processingMs','totalMs','storedRowsPerSecond']){
 const v=stats[k];if(v==null)result[k]=null;else if(typeof v==='number'&&Number.isFinite(v)&&v>=0)result[k]=v;else throw Error('计时记录无效');
 }result.mode=stats.mode==='legacy'?'legacy':'bulk';result.timingSource='server batch telemetry accumulated by authenticated browser';return result;
}
export async function finishBenchmark(id:string,stats:any){
 const imp=await one('SELECT * FROM imports WHERE id=?',[id]);if(imp?.sample!==2||imp.status!=='loading')throw Error('测试状态无效');
 const benchmark=JSON.parse(imp.report).benchmark;
 const mismatches:any={};for(const [table,cols] of [['sessions',SESSION_COLS],['products',PRODUCT_COLS]]){
 // Compare both directions, every persisted field (only import_id differs).
 const a=await one(`SELECT COUNT(*) n FROM (SELECT ${cols} FROM ${table} WHERE import_id=? EXCEPT SELECT ${cols} FROM ${table} WHERE import_id=?)`,[id,benchmark.sourceId]);
 const b=await one(`SELECT COUNT(*) n FROM (SELECT ${cols} FROM ${table} WHERE import_id=? EXCEPT SELECT ${cols} FROM ${table} WHERE import_id=?)`,[benchmark.sourceId,id]);mismatches[table]=a.n+b.n;
 }
 const r=await report(id),equal=Object.values(mismatches).every(n=>n===0),performance=safeStats(stats);
 const counts=await one('SELECT COUNT(*) n FROM products WHERE import_id=?',[id]);
 const sessions=r.months.reduce((n,m)=>n+m.sessions,0),events=r.months.reduce((n,m)=>n+m.hits,0);
 if(performance.sessions!==sessions||performance.events!==events||performance.productRows!==counts.n)throw Error('计时记录数量与实际写入不一致');
 const result={...r,benchmark:{...benchmark,equal,mismatches},performance};
 await db().prepare('UPDATE imports SET status=?,report=? WHERE id=?').bind(equal?'benchmark_done':'benchmark_mismatch',JSON.stringify(result),id).run();
 await cleanBenchmark(id);return {equal,mismatches,months:r.months};
}
