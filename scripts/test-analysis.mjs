import {createRequire} from 'node:module';
import {dirname} from 'node:path';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
mkdirSync('.sites-runtime',{recursive:true});
await build({entryPoints:['tests/analysis.test.ts'],outfile:'.sites-runtime/analysis-test.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test-database',setup(b){b.onResolve({filter:/\/db$/},()=>({path:resolve('tests/analysis-db.ts')}))}}]});
const result=spawnSync(process.execPath,['.sites-runtime/analysis-test.mjs'],{stdio:'inherit',env:process.env});if(result.status!==0)process.exit(result.status??1);
await build({entryPoints:['tests/recommendation.test.ts'],outfile:'.sites-runtime/recommendation-test.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test-database',setup(b){b.onResolve({filter:/\/db$/},()=>({path:resolve('tests/analysis-db.ts')}))}}]});
const recommended=spawnSync(process.execPath,['.sites-runtime/recommendation-test.mjs'],{stdio:'inherit'});if(recommended.status!==0)process.exit(recommended.status??1);
await build({entryPoints:['tests/dimension-render.test.tsx'],outfile:'.sites-runtime/dimension-render-test.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic'});
const dimensionRender=spawnSync(process.execPath,['.sites-runtime/dimension-render-test.mjs'],{stdio:'inherit'});if(dimensionRender.status!==0)process.exit(dimensionRender.status??1);
if(process.argv.includes('--render')){await build({entryPoints:['.sites-runtime/render-check.tsx'],outfile:'.sites-runtime/render-test.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic'});const rendered=spawnSync(process.execPath,['.sites-runtime/render-test.mjs'],{stdio:'inherit'});process.exit(rendered.status??1);}
