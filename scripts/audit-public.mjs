import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const skip=new Set(['.git','node_modules','.sites-runtime','.wrangler','dist','.next','.vinext']);
const rules={credential:/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,credentialURL:/https?:\/\/[^\s/@:'"]+:[^\s/@'"{}]+@/,siteIdentity:/appgprj_[a-zA-Z0-9]{16,}/,literalSecret:/(?:api[_-]?key|token|secret|password)\s*[:=]\s*['"][A-Za-z0-9_+/=-]{24,}['"]/i,email:/\b[A-Z0-9._%+-]+@(?!example\.(?:invalid|com|org)\b|sites\.test\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i,rawVisitor:/"fullVisitorId"\s*:\s*"(?!SYNTHETIC-)[^"]+"/};
const findings=[];let count=0;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(skip.has(e.name)||e.isSymbolicLink())continue;const f=path.join(dir,e.name),rel=path.relative(root,f).replaceAll('\\','/');if(e.isDirectory()){walk(f);continue}count++;
 if(/(?:^|\/)(?:\.env|\.dev.vars)(?:\.|$)/.test(rel)&&!rel.endsWith('.example')||/\.(sqlite3?|db|log|pem|pfx|p12|jsonl|gz|zip)$/.test(rel))findings.push({file:rel,rule:'privateFile'});
 if(fs.statSync(f).size>5e6){findings.push({file:rel,rule:'largeFileNeedsReview'});continue}
 const text=fs.readFileSync(f,'utf8');for(const [rule,regex] of Object.entries(rules))if(regex.test(text))findings.push({file:rel,rule});
}}
walk(root);console.log(JSON.stringify({filesScanned:count,findings,limitations:'Pattern scan plus manual review; not proof of absence of all secrets. Existing Git histories not scanned or copied.'},null,2));
process.exitCode=findings.length?1:0;
