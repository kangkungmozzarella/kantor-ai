// Per-member models and the "Needs decision" flow, on a throwaway dry-run server.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const PORT=4185,dir=fs.mkdtempSync(path.join(os.tmpdir(),'kantor-'));
const api=(p,opts={})=>fetch(`http://127.0.0.1:${PORT}${p}`,{...opts,headers:{'content-type':'application/json'}}).then(async r=>({status:r.status,body:await r.json().catch(()=>null)}));
(async()=>{
 const server=spawn(process.execPath,[path.join(__dirname,'../server/server.js')],{env:{...process.env,LOCAL_MODE:'1',PORT:String(PORT),DATA_DIR:dir,ENV_FILE:'/nonexistent',ANTHROPIC_API_KEY:'',DRY_RUN_DELAY_MS:'800'},stdio:['ignore','pipe','inherit']});
 await new Promise(r=>server.stdout.on('data',d=>String(d).includes('Kantor Kita:')&&r()));
 const browser=await chromium.launch();
 try{
  const members=(await api('/api/agents')).body.members;
  assert.equal(members['Kak Rani'].model,'claude-sonnet-5-5');assert.equal(members['Kak Sinta'].model,'claude-haiku-4-5-20251001');
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}`);await page.waitForFunction(()=>window.officeScene);
  await page.waitForFunction(()=>document.querySelectorAll('.name-label.ai').length===2);
  // An almost empty brief makes the agent ask instead of guessing.
  await page.click('#bTasks');await page.fill('#taskTitle','Caption for the launch');await page.selectOption('#taskAssignee','Kak Rani');await page.click('#taskForm .task-primary');await page.click('#closeTasks');
  await page.locator('#decisions').waitFor({state:'visible',timeout:20000});
  assert.match(await page.locator('#decisions').innerText(),/1 task needs your decision · KR/);
  assert.match(await page.locator('#logList').innerText(),/KR needs a decision before continuing/);
  await page.click('#decisions');assert.equal(await page.locator('#taskFilter').inputValue(),'blocked');
  assert.match(await page.locator('.task-questions').innerText(),/who is this for/);
  await page.fill('textarea[id^="answer-"]','For our Instagram followers: the new iced coffee menu, launch on Friday.');await page.getByRole('button',{name:'Send answer'}).click();
  await page.waitForFunction(()=>document.getElementById('decisions').hidden);
  const kn=await (async()=>{for(let i=0;i<40;i++){const t=(await api('/api/tasks')).body.find(t=>t.assignee==='Kak Rani');if(t.status==='review')return t;await new Promise(r=>setTimeout(r,250));}})();
  assert.ok(kn,'answered task is drafted');assert.match(kn.brief,/Answers:\nFor our Instagram/);
  // A second member with its own model drafts normally.
  const made=(await api('/api/tasks',{method:'POST',body:JSON.stringify({title:'Reply about a late order',assignee:'Kak Sinta',brief:'Order 1042 arrived two days late; customer is upset.'})})).body;
  for(let i=0;i<40&&(await api('/api/tasks')).body.find(t=>t.id===made.id).status!=='review';i++)await new Promise(r=>setTimeout(r,250));
  assert.equal((await api('/api/tasks')).body.find(t=>t.id===made.id).status,'review');
  assert.equal((await api(`/api/tasks/${kn.id}`,{method:'PATCH',body:JSON.stringify({action:'answer',answer:'x',version:kn.version})})).status,409,'only blocked tasks take answers');
  assert.deepEqual(errors,[]);
  console.log('PASS: per-member models, agent asks instead of guessing, Needs decision banner and filter, answer resumes the task, second AI member drafts');
 }finally{await browser.close();server.kill();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
