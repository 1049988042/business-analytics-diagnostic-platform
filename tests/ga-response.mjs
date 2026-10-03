import assert from 'node:assert/strict';
import {readGaResponse} from '../lib/ga-response.ts';
assert.deepEqual(await readGaResponse(Response.json({ok:true}),'chunk'),{ok:true});
await assert.rejects(()=>readGaResponse(new Response('<!DOCTYPE html><html>gateway</html>',{status:502,headers:{'content-type':'text/html','cf-ray':'test-ray'}}),'chunk'),/HTTP 502.*test-ray/);
await assert.rejects(()=>readGaResponse(new Response('<html>login</html>',{status:403}),'chunk'),/访问验证/);
await assert.rejects(()=>readGaResponse(Response.json({error:'校验不通过'},{status:400}),'chunk'),/校验不通过/);
console.log('4 response handling checks passed');
