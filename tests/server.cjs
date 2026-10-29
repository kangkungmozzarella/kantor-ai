// Task server: dry-run agent end to end, manual tasks, API guards, persistence and the agent error path.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
function start(port,env){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kantor-'));
  const child=spawn(process.execPath,[path.join(__dirname,'../server/server.js')],{env:{...process.env,LOCAL_MODE:'1',PORT:String(port),DATA_DIR:dir,ENV_FILE:'/nonexistent',ANTHROPIC_API_KEY:'',DRY_RUN_DELAY_MS:'1500',...env},stdio:['ignore','pipe','pipe']});
  return new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(String(d).includes('Kantor Kita:'))resolve({child,dir});});child.on('exit',code=>reject(new Error('server exited '+code)));});
}
const api=(port,p,opts={})=>fetch(`http://127.0.0.1:${port}${p}`,{...opts,headers:{'content-type':'application/json'}}).then(async r=>({status:r.status,body:await r.json().catch(()=>null)}));
const waitFor=async(check,ms=20000)=>{const end=Date.now()+ms;while(Date.now()<end){const v=await check();if(v)return v;await new Promise(r=>setTimeout(r,250));}throw new Error('timed out');};
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const one=await start(4181);
 try{
  assert.equal((await api(4181,'/api/agents')).body.mode,'dry-run');
  assert.ok([403,404].includes((await fetch('http://127.0.0.1:4181/..%2fserver%2fserver.js')).status),'no files outside public/');
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4181');await page.waitForFunction(()=>window.officeScene);
  await page.waitForFunction(()=>document.getElementById('taskNote').textContent.includes('dry-run'));
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.name-label.ai')].map(l=>l.textContent).join()),'KR,KS');
  // A task for KR is picked up and finished by the dry-run agent.
  await page.click('#bTasks');await page.fill('#taskTitle','Caption for the new menu');await page.selectOption('#taskAssignee','Kak Rani');await page.fill('#taskBrief','Friendly, Indonesian');await page.click('.task-primary');
  await page.waitForFunction(()=>document.getElementById('taskList').innerText.includes('Dry run result'),null,{timeout:20000});
  assert.match(await page.locator('.task-item > .task-result').first().innerText(),/DRY RUN/);
  assert.match(await page.locator('#taskList').innerText(),/Needs review/);
  const firstDraft=(await api(4181,'/api/tasks')).body.find(t=>t.status==='review');
  await page.locator('textarea[id^="review-"]').fill('Make it shorter and more friendly');
  await page.getByRole('button',{name:'Request revision',exact:true}).click();
  await page.waitForFunction(()=>officeTasks.list().some(t=>t.status==='review'&&t.history?.length===2),null,{timeout:20000});
  assert.match(await page.locator('.task-item > .task-result').last().innerText(),/Make it shorter/);
  assert.equal((await api(4181,`/api/tasks/${firstDraft.id}`,{method:'PATCH',body:JSON.stringify({action:'approve',version:firstDraft.version})})).status,409,'an older draft cannot approve the revision');
  await page.getByRole('button',{name:'Approve & finish',exact:true}).click();
  await page.waitForFunction(()=>officeTasks.list().some(t=>t.status==='done'));
  await page.click('#closeTasks');
  assert.match(await page.locator('#logStats').innerText(),/1\s*Done today/);
  await page.click('#bTasks');
  assert.match(await page.locator('#logList').innerText(),/KR started task: Caption for the new menu/);
  assert.match(await page.locator('#logList').innerText(),/KR finished task: Caption for the new menu/);
  const kn=(await api(4181,'/api/tasks')).body.find(t=>t.assignee==='Kak Rani');
  assert.equal(kn.by,'dry-run');
  assert.equal((await api(4181,`/api/tasks/${kn.id}`,{method:'PATCH',body:JSON.stringify({status:'done',result:'x'})})).status,409,'AI tasks are not finished by hand');
  // Members without an agent keep the manual flow.
  await page.fill('#taskTitle','Plan the quarter');await page.selectOption('#taskAssignee','Koh Arman');await page.click('.task-primary');
  await page.locator('.task-item',{hasText:'Plan the quarter'}).getByRole('button',{name:'Start task'}).click();
  await waitFor(async()=>(await api(4181,'/api/tasks')).body.find(t=>t.title==='Plan the quarter').status==='active');
  await page.locator('.task-item textarea').fill('Unsaved result stays here');
  await page.locator('#taskTitle').focus();
  await api(4181,'/api/tasks',{method:'POST',body:JSON.stringify({title:'Another update',assignee:'Koh Wira'})});
  await page.waitForFunction(()=>officeTasks.list().some(t=>t.title==='Another update'));
  assert.equal(await page.locator('.task-item textarea').inputValue(),'Unsaved result stays here');
  await page.reload();await page.waitForFunction(()=>window.officeTasks?.list().some(t=>t.title==='Plan the quarter'));
  await page.click('#bTasks');
  assert.equal(await page.locator('.task-item textarea').inputValue(),'Unsaved result stays here');
  assert.deepEqual(errors,[]);
  console.log('PASS: dry-run agent end to end, log entries, manual tasks, API guard, path guard, persistence across reload');
 }finally{one.child.kill();}
 // With a key but an unreachable API, the task returns to the queue with the error and can be retried.
 const two=await start(4182,{ANTHROPIC_API_KEY:'test-key',ANTHROPIC_BASE_URL:'http://127.0.0.1:9'});
 try{
  assert.equal((await api(4182,'/api/agents')).body.mode,'claude');
  const made=(await api(4182,'/api/tasks',{method:'POST',body:JSON.stringify({title:'Will fail',assignee:'Kak Rani'})})).body;
  const failed=await waitFor(async()=>{const t=(await api(4182,'/api/tasks')).body.find(t=>t.id===made.id);return t.error&&t;});
  assert.equal(failed.status,'queued');
  const page=await browser.newPage();await page.goto('http://127.0.0.1:4182');await page.waitForFunction(()=>window.officeScene);
  await page.waitForFunction(()=>document.getElementById('taskNote').textContent.includes('Claude'));
  await page.click('#bTasks');await page.getByRole('button',{name:'Try again'}).waitFor();
  console.log('PASS: agent error is shown with Try again, task stays queued');
 }finally{two.child.kill();}
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
