export async function readGaResponse(r:Response,stage:string){
 const type=r.headers.get('content-type')||'',requestId=r.headers.get('cf-ray')||r.headers.get('x-request-id');
 const detail=`${stage} · HTTP ${r.status}${requestId?' · 请求 '+requestId:''}`;
 if(r.redirected||r.status===401||r.status===403)throw Error(`请求未通过访问验证，请在新标签页打开网站确认登录后再试（${detail}）。`);
 const text=await r.text();let body:any;
 try{body=JSON.parse(text)}catch{
 const html=/^\s*(<!doctype|<html)/i.test(text)||type.includes('text/html');
 throw Error(`${html?'服务器返回了网页，未收到接口数据':'服务器返回的数据无法解析'}（${detail}）。可能是访问验证或网关响应，当前信息不足以确定原因。`);
 }
 if(!r.ok)throw Error(`${body?.error||'请求失败'}（${detail}）`);
 return body;
}
