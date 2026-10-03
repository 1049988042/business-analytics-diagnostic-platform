// Only fields read by normalize() cross the network. Every hit remains present;
// the unmodified uploaded file remains in R2. Normalization/validation stays server-side.
export function projectSession(s:any){
 if(!s||!Array.isArray(s.hits))return s;
 return {fullVisitorId:s.fullVisitorId,visitId:s.visitId,date:s.date,channelGrouping:s.channelGrouping,
 device:{deviceCategory:s.device?.deviceCategory},totals:{transactions:s.totals?.transactions,transactionRevenue:s.totals?.transactionRevenue},
 hits:s.hits.map((h:any)=>h==null?h:{time:h.time,hitNumber:h.hitNumber,eCommerceAction:{action_type:h.eCommerceAction?.action_type},transaction:{transactionId:h.transaction?.transactionId},
 product:!['2','3','5','6'].includes(String(h.eCommerceAction?.action_type||'0'))?undefined:Array.isArray(h.product)?h.product.map((p:any)=>p==null?p:p.isImpression===true?{isImpression:true}:{isImpression:p.isImpression,productSKU:p.productSKU,v2ProductName:p.v2ProductName,v2ProductCategory:p.v2ProductCategory,productQuantity:p.productQuantity,productRevenue:p.productRevenue}):h.product})};
}
export const GA_BATCH_ROWS=5000;
export const GA_BATCH_BYTES=4_000_000;
// Bound each JSON parameter below D1's 2 MB string limit, including UTF-8.
export function jsonBatches(data:any[],maxRows=5000,maxBytes=1_500_000){
 const result:string[]=[];let parts:string[]=[],bytes=2;const enc=new TextEncoder();
 for(const row of data){const text=JSON.stringify(row),size=enc.encode(text).length+1;
 if(size+2>maxBytes)throw Error('单条标准记录过大');
 if(parts.length&&(parts.length>=maxRows||bytes+size>maxBytes)){result.push('['+parts.join(',')+']');parts=[];bytes=2}
 parts.push(text);bytes+=size;
 }if(parts.length)result.push('['+parts.join(',')+']');return result;
}
export async function* gaBatches(file:Blob,name:string,legacy=false,maxRows=GA_BATCH_ROWS){
 let stream:any=file.stream();if(name.endsWith('.gz'))stream=stream.pipeThrough(new DecompressionStream('gzip'));
 const reader=stream.pipeThrough(new TextDecoderStream('utf-8',{fatal:true})).getReader();
 let buffer='',records:any[]=[],bytes=0;const enc=new TextEncoder();
 const cap=legacy?600000:GA_BATCH_BYTES,rows=legacy?40:maxRows;
 function parse(line:string){const raw=JSON.parse(line);const record=legacy?raw:projectSession(raw);return {record,size:legacy?line.length:enc.encode(JSON.stringify(record)).length+1}}
 try{while(true){const {done,value}=await reader.read();if(done)break;buffer+=value;let end;
 while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);if(!line)continue;if(line.length>8_000_000)throw Error('单条会话过大');const {record,size}=parse(line);
 if(records.length&&(bytes+size>cap||records.length>=rows)){yield records;records=[];bytes=0}records.push(record);bytes+=size;
 }if(buffer.length>8_000_000)throw Error('单条会话过大或不是 JSONL 格式');}
 if(buffer.trim()){const {record,size}=parse(buffer.trim());if(records.length&&(bytes+size>cap||records.length>=rows)){yield records;records=[]}records.push(record)}if(records.length)yield records;
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
