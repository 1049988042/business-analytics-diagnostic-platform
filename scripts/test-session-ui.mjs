import {createRequire} from 'node:module';import {dirname,resolve} from 'node:path';import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);const {build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['tests/session-ui.test.tsx'],outfile:'.sites-runtime/session-ui-test.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',plugins:[{name:'test-database',setup(b){b.onResolve({filter:/\/db$/},()=>({path:resolve('tests/analysis-db.ts')}))}}]});
const result=spawnSync(process.execPath,['.sites-runtime/session-ui-test.mjs'],{stdio:'inherit'});process.exit(result.status??1);
