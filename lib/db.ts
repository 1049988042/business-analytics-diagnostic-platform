import {env} from 'cloudflare:workers';
export function db():D1Database{if(!env.DB)throw Error('数据服务暂不可用');return env.DB}
export function bucket():R2Bucket{if(!env.BUCKET)throw Error('文件服务暂不可用');return env.BUCKET}
export const runtime=()=>env as any;
export async function rows(sql:string,args:any[]=[]){return (await db().prepare(sql).bind(...args).all()).results as any[]}
export async function one(sql:string,args:any[]=[]){return await db().prepare(sql).bind(...args).first<any>()}
export async function setting(key:string,fallback=''){return (await one('SELECT value FROM settings WHERE key=?',[key]))?.value??fallback}
export async function putSetting(key:string,value:string){await db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,value).run()}
export async function encrypt(value:string){const raw=runtime().CONFIG_ENCRYPTION_KEY;if(!raw)throw Error('安全配置未就绪');const key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(raw),c=>c.charCodeAt(0)),'AES-GCM',false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const out=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value));return btoa(String.fromCharCode(...iv,...new Uint8Array(out)))}
export async function modelKey(){const value=await setting('model_key');if(!value)return runtime().DEEPSEEK_API_KEY||'';const raw=runtime().CONFIG_ENCRYPTION_KEY;if(!raw)throw Error('安全配置未就绪');const b=Uint8Array.from(atob(value),c=>c.charCodeAt(0));const k=await crypto.subtle.importKey('raw',Uint8Array.from(atob(raw),c=>c.charCodeAt(0)),'AES-GCM',false,['decrypt']);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},k,b.slice(12)))}

export type ReadQuery={sql:string,params?:any[]};
export async function batchRows(queries:ReadQuery[]){
 if(!queries.length)return [];
 const result=await db().batch(queries.map(q=>db().prepare(q.sql).bind(...(q.params||[]))));
 return result.map(r=>r.results as any[]);
}
