// Local only. Never calls a hosted service; produces a SQL file for local D1.
import fs from 'node:fs';
import {sql} from '../tests/storage.mjs';
import {ingest} from '../lib/imports.ts';
const data=JSON.parse(fs.readFileSync('lib/sample.json','utf8'));
if(!data.every(s=>s.fullVisitorId.startsWith('SYNTHETIC-')))throw Error('Only synthetic fixtures may be seeded');
for(const month of ['2017-02','2017-03']){
 const id='synthetic-'+month;
 sql.prepare('INSERT INTO imports(id,hash,name,status,sample,created,raw) VALUES(?,?,?,?,?,?,?)').run(id,id,'Synthetic Demo','committed',0,'2026-01-01T00:00:00Z',0);
 await ingest(id,0,data.filter(s=>s.date.startsWith(month.replace('-',''))));
 sql.prepare('INSERT INTO months(month,import_id) VALUES(?,?)').run(month,id);
}
const quote=v=>v==null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
let out=fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFileSync('drizzle/'+f,'utf8')).join('\n');
for(const table of ['imports','months','chunks','sessions','products'])for(const r of sql.prepare('SELECT * FROM '+table).all())out+='\nINSERT INTO '+table+'('+Object.keys(r).join(',')+') VALUES('+Object.values(r).map(quote).join(',')+');';
fs.mkdirSync('.sites-runtime',{recursive:true});fs.writeFileSync('.sites-runtime/synthetic-demo.sql',out);
console.log('Generated local-only synthetic seed SQL. Apply only to a new empty local D1 database.');
