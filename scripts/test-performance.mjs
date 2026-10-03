import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['tests/performance.test.ts'],outfile:'.sites-runtime/performance-test.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test-database',setup(b){b.onResolve({filter:/\/db$/},()=>({path:resolve('tests/analysis-db.ts')}))}}]});
const result=spawnSync(process.execPath,['.sites-runtime/performance-test.mjs'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
await build({entryPoints:['tests/client-cache.test.ts'],outfile:'.sites-runtime/client-cache-test.mjs',bundle:true,platform:'node',format:'esm'});
const client=spawnSync(process.execPath,['.sites-runtime/client-cache-test.mjs'],{stdio:'inherit'});process.exit(client.status??1);
