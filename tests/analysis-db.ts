import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE months(month TEXT PRIMARY KEY,import_id TEXT); INSERT INTO months VALUES('2017-02','feb'),('2017-03','mar');
CREATE TABLE sessions(import_id TEXT,sid TEXT,date TEXT,month TEXT,visitor TEXT,channel TEXT,device TEXT,transactions INTEGER,revenue REAL,buyer INTEGER,views INTEGER,adds INTEGER,checkouts INTEGER,purchases INTEGER,ordered INTEGER);
CREATE TABLE products(import_id TEXT,sid TEXT,sku TEXT,name TEXT,quantity REAL,revenue REAL);`);
const insert=db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
for(const [month,id] of [['2017-02','feb'],['2017-03','mar']]){
 for(let day=1;day<=(month==='2017-02'?28:31);day++)for(let i=0;i<6;i++){
  const tx=i===0?(id==='mar'?2:1):0;
  insert.run(id,`${day}-${i}`,month+'-'+String(day).padStart(2,'0'),month,'visitor-'+(i%3),i%2?'Direct':'Organic Search',i%3?'desktop':'mobile',tx,tx*(id==='mar'?80:100),tx?1:0,1,i<3?1:0,i<2?1:0,tx?1:0,tx?1:0);
 }
}
// Replaced import must never leak into the active dataset.
insert.run('old','old','2017-03-01','2017-03','old','Direct','mobile',999,99999,1,1,1,1,1,1);
export const queryLog:any[]=[];
export async function rows(sql:string,args:any[]=[]){queryLog.push({sql,params:args});return db.prepare(sql).all(...args) as any[]}
export async function batchRows(queries:any[]){return Promise.all(queries.map(q=>rows(q.sql,q.params||[])))}

export function execute(sql:string){db.exec(sql)}
