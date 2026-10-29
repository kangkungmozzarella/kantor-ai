const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
(async()=>{
 const mock=http.createServer((req,res)=>{req.resume();setTimeout(()=>{res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:{message:'Delayed failure'}}));},800);});
 await new Promise(r=>mock.listen(0,'127.0.0.1',r));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kantor-worker-'));
 const proc=spawn(process.execPath,['server/server.js'],{env:{...process.env,LOCAL_MODE:'1',PORT:'4185',DATA_DIR:dir,ENV_FILE:'/nonexistent',ANTHROPIC_API_KEY:'test-only',ANTHROPIC_DRY_RUN:'0',ANTHROPIC_BASE_URL:`http://127.0.0.1:${mock.address().port}`},stdio:['ignore','pipe','pipe']});
 try{
 await new Promise((resolve,reject)=>{proc.stdout.on('data',d=>{if(String(d).includes('Kantor Kita:'))resolve();});proc.on('error',reject);proc.on('exit',()=>reject(new Error('server exited')));});
 const call=async(method,url,data)=>{const r=await fetch('http://127.0.0.1:4185/api'+url,{method,headers:{'content-type':'application/json'},body:data&&JSON.stringify(data)});return {status:r.status,data:await r.json()};};
 let r=await call('POST','/tasks',{title:'First',assignee:'Koh Arman',status:'active'});assert.equal(r.status,201);
 assert.equal((await call('POST','/tasks',{title:'Second',assignee:'Koh Arman',status:'active'})).status,409);
 assert.equal((await call('POST','/tasks',{title:'Fake completion',assignee:'Kak Rani',status:'done',result:'fake'})).status,409);
 assert.equal((await call('POST','/tasks',{title:'Unknown',assignee:'Nobody'})).status,400);
 const ai=(await call('POST','/tasks',{title:'Reassigned while running',assignee:'Kak Rani'})).data;
 for(let i=0;i<30;i++){const t=(await call('GET','/tasks')).data.find(t=>t.id===ai.id);if(t.status==='active')break;await new Promise(r=>setTimeout(r,20));}
 assert.equal((await call('PATCH','/tasks/'+ai.id,{assignee:'Koh Wira',status:'active'})).status,200);
 await new Promise(r=>setTimeout(r,1100));
 const after=(await call('GET','/tasks')).data.find(t=>t.id===ai.id);
 assert.equal(after.status,'active');assert.equal(after.assignee,'Koh Wira');assert.ok(!after.error);
 assert.equal((await call('PATCH','/tasks/'+ai.id,{action:'approve',version:0})).status,409);
 console.log('PASS: creation guards, unknown assignee, stale worker failure ignored after reassignment, invalid approval rejected');
 }finally{proc.kill();await new Promise(r=>mock.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
