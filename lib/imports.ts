import {db,one,rows} from './db';import {normalize} from './normalize';
import {jsonBatches} from './ga-batch';
export async function ingest(id:string,n:number,records:any[],mode:'bulk'|'legacy'='bulk'){
 const started=performance.now();
 if(!Number.isInteger(n)||n<0||!Array.isArray(records)||records.length>(mode==='legacy'?100:10000)||!records.length)throw Error('批次无效');
 if(await one('SELECT n FROM chunks WHERE import_id=? AND n=?',[id,n]))return {duplicate:true};
 const ss:any[]=[],pp:any[]=[];let events=0;
 const normalizeStart=performance.now();
 for(const raw of records){const {session:s,products}=normalize(raw);ss.push({import_id:id,...s});events+=s.hits;for(const p of products)pp.push({import_id:id,sid:s.sid,...p})}
 const normalizeMs=performance.now()-normalizeStart,statements:any[]=[];
 for(const [table,data] of [['sessions',ss],['products',pp]] as const){
 if(!data.length)continue;const cols=Object.keys(data[0]);
 if(mode==='legacy'){
 const size=Math.floor(95/cols.length);
 for(let i=0;i<data.length;i+=size){const slice=data.slice(i,i+size);statements.push(db().prepare(`INSERT INTO ${table}(${cols.join(',')}) VALUES ${slice.map(()=>`(${cols.map(()=>'?').join(',')})`).join(',')}`).bind(...slice.flatMap(r=>cols.map(c=>r[c]))))}
 }else{
 // Column names come exclusively from normalize(), never from uploaded field names.
 for(const json of jsonBatches(data))statements.push(db().prepare(`INSERT INTO ${table}(${cols.join(',')}) SELECT ${cols.map(c=>`json_extract(value,'$.${c}')`).join(',')} FROM json_each(?)`).bind(json));
 }}
 if(statements.length>850)throw Error('单批商品记录过多');
 const dataInsertStatements=statements.length;
 statements.push(db().prepare('INSERT INTO chunks(import_id,n) VALUES(?,?)').bind(id,n));
 const writeStart=performance.now(),results=await db().batch(statements),writeWallMs=performance.now()-writeStart;
 const durations=results.map((r:any)=>r.meta?.duration);
 return {count:records.length,events,productRows:pp.length,telemetry:{mode,sessions:ss.length,events,productRows:pp.length,storedRows:ss.length+pp.length,
 readCalls:1,dataInsertStatements,insertStatements:statements.length,batchCalls:1,transactions:1,normalizeMs,writeWallMs,
 engineMs:durations.every((x:any)=>typeof x==='number')?durations.reduce((a:number,b:number)=>a+b,0):null,serverMs:performance.now()-started}};
}
export async function report(id:string){const data=await rows('SELECT month,COUNT(*) sessions,COUNT(DISTINCT date) days,MIN(date) first_date,MAX(date) last_date,COUNT(DISTINCT visitor) visitors,COUNT(DISTINCT CASE WHEN buyer=1 THEN visitor END) buyers,SUM(transactions) transactions,SUM(revenue) revenue,SUM(hits) hits,SUM(purchase_events) purchase_events,SUM(transaction_ids) transaction_ids,SUM(missing_ids) missing_ids FROM sessions WHERE import_id=? GROUP BY month',[id]);const existing=await rows('SELECT month,import_id FROM months');return {months:data.map(d=>({...d,replaces:existing.find(m=>m.month===d.month)?.import_id||null,fullMonth:d.days===new Date(Number(d.month.slice(0,4)),Number(d.month.slice(5)),0).getDate()})),rules:['访客编号按字符串保存，金额从百万分之一美元换算为 USD','交易数使用 totals.transactions；购买人数由该字段大于零的访客去重','商品购买按会话＋交易编号＋商品编号合并，重复事件不重复累加','缺少交易编号的商品购买事件保留行为标记，不纳入商品收入和销量','商品列表曝光不算商品详情浏览；加购后购买要求同会话同商品的时间顺序'],januaryBaseline:{sessions:64694,visitors:53041,buyers:662,transactions:713,hits:300074}}}
