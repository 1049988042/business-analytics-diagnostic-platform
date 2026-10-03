// Visitors can only read aggregate public GA demo data. All other API paths
// (including model calls, personal saved plans, imports and semantic datasets)
// are disabled even for the owner, before payload/DB/model access.
export function publicDemoRead(path:string,method:string){
 return method==='GET'&&['meta','dashboard','analysis','discover'].includes(path)
  ||method==='POST'&&['analysis','query'].includes(path);
}
