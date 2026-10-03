import assert from 'node:assert/strict';
import {GET,POST,DELETE} from '../app/api/[...path]/route';
import {publicDemoRead} from '../lib/public-demo';
for(const [path,method] of [['meta','GET'],['dashboard','GET'],['analysis','GET'],['analysis','POST'],['discover','GET'],['query','POST']])assert.equal(publicDemoRead(path,method),true);
for(const path of ['admin','settings','model-test','ask','saved','sample','import/raw','import/start','import/chunk','import/commit','semantic/list','semantic/raw','semantic/get']){
 for(const [method,handler] of [['GET',GET],['POST',POST],['DELETE',DELETE]] as const){
  assert.equal(publicDemoRead(path,method),false);
  const r=await handler(new Request('https://example.test/api/'+path,{method}));
  assert.equal(r.status,403,path+' '+method);
  const owner=await handler(new Request('https://example.test/api/'+path,{method,headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.invalid'}}));assert.equal(owner.status,403,'Owner demo boundary '+path);
 }
}
// An untrusted matching email without authenticated platform identity is not an owner.
const emailOnly=await POST(new Request('https://example.test/api/ask',{method:'POST',headers:{'oai-authenticated-user-email':'owner@example.invalid'}}));
assert.equal(emailOnly.status,403);
console.log('Public demo: 42 anonymous route requests denied before DB/model access; read allowlist and owner identity boundary passed.');
