const assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=4191,dir=fs.mkdtempSync(path.join(os.tmpdir(),'kantor-stuck-'));
const request=async(route,body,method=body?'POST':'GET')=>{const response=await fetch(`http://127.0.0.1:${port}${route}`,{method,headers:{'content-type':'application/json'},body:body&&JSON.stringify(body)});return {status:response.status,body:await response.json()};};
const waitFor=async(check)=>{for(let i=0;i<100;i++){const value=await check();if(value)return value;await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out');};
const hoursAgo=h=>new Date(Date.now()-h*3600000).toISOString();
// Work that has not moved for hours, plus one agent error: the stuck cases the office should surface.
const seed=[
  {id:'00000000-0000-4000-8000-000000000001',title:'Pricing page copy',assignee:'Kak Dewi',brief:'Update the pricing page.',status:'active',result:'',createdAt:hoursAgo(6),updatedAt:hoursAgo(5)},
  {id:'00000000-0000-4000-8000-000000000002',title:'Reply to refund question',assignee:'Kak Sinta',brief:'Customer asks about refunds for a late order.',status:'queued',result:'',error:'Claude took too long to answer.',createdAt:hoursAgo(1),updatedAt:hoursAgo(.1)},
  {id:'00000000-0000-4000-8000-000000000003',title:'Weekend caption',assignee:'Kak Rani',brief:'Caption for the weekend promo.',status:'review',result:'Draft caption',by:'dry-run',version:2,createdAt:hoursAgo(4),updatedAt:hoursAgo(3)},
  {id:'00000000-0000-4000-8000-000000000004',title:'Fresh task',assignee:'Mira',brief:'Just added.',status:'queued',result:'',createdAt:hoursAgo(.2)}
];
fs.writeFileSync(path.join(dir,'tasks.json'),JSON.stringify(seed));
(async()=>{
  const server=spawn(process.execPath,[path.join(__dirname,'../server/server.js')],{env:{...process.env,LOCAL_MODE:'1',PORT:String(port),DATA_DIR:dir,ENV_FILE:'/nonexistent',ANTHROPIC_API_KEY:'',DRY_RUN_DELAY_MS:'100'},stdio:['ignore','pipe','inherit']});let browser;
  try{
    await new Promise((resolve,reject)=>{server.stdout.on('data',d=>String(d).includes('Kantor Kita:')&&resolve());server.on('error',reject);server.on('exit',code=>reject(new Error('Server exited '+code)));});
    // Agent handoff suggestion: the dry-run customer service draft names the social media agent, and the line is stripped from the draft.
    const created=(await request('/api/tasks',{title:'Answer delivery question',assignee:'Kak Sinta',brief:'Customer asks when the new menu ships to Bandung.'})).body;
    const draft=await waitFor(async()=>{const task=(await request('/api/tasks')).body.find(t=>t.id===created.id);return task?.status==='review'&&task;});
    assert.deepEqual(draft.handoff,{assignee:'Kak Rani',title:'DRY RUN: social post answering this customer question'});
    assert.doesNotMatch(draft.result,/HANDOFF:/);
    assert.equal((await request(`/api/tasks/${draft.id}/handoff`,{assignee:'Kak Rani',title:'Post',version:draft.version})).status,409,'a draft must be approved before handoff');
    const approved=(await request(`/api/tasks/${draft.id}`,{action:'approve',version:draft.version},'PATCH')).body;
    assert.equal((await request(`/api/tasks/${draft.id}/handoff`,{assignee:'Kak Sinta',title:'Post',version:approved.version})).status,400,'no handoff to yourself');
    assert.equal((await request(`/api/tasks/${draft.id}/handoff`,{assignee:'Kak Rani',title:'Post',version:0})).status,409,'stale version');
    assert.equal((await request(`/api/tasks/${draft.id}/handoff`,{assignee:'Nobody',title:'Post',version:approved.version})).status,400);

    browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}`);await page.waitForFunction(()=>window.officeScene&&window.officeTasks.agentFor('Kak Sinta'));await page.click('#bRoutine');
    const work=await page.evaluate(()=>officeScene.workSnapshot());
    const byName=Object.fromEntries(work.stuck.map(s=>[s.name,s]));
    assert.equal(byName['Kak Dewi'].kind,'member');assert.equal(byName['Kak Sinta'].kind,'member');assert.equal(byName['Kak Rani'].kind,'you');assert.equal(byName.Mira,undefined,'new work is not stuck');
    assert.ok(byName['Kak Dewi'].halo);assert.match(byName['Kak Dewi'].label,/stuck/);assert.match(byName['Kak Rani'].label,/waiting/);
    assert.match(work.monitors.find(m=>m.member==='Kak Dewi').stuck,/Stuck · 5 h/);
    assert.match(await page.locator('#stuckWork').innerText(),/2 stuck · KD, KS/);
    // The log shortcut opens the stuck filter, which also lists work waiting on you.
    await page.click('#stuckWork');assert.equal(await page.locator('#taskFilter').inputValue(),'stuck');
    const listed=await page.locator('#taskList h3').allInnerTexts();assert.deepEqual(listed.sort(),['Pricing page copy','Reply to refund question','Weekend caption']);
    const dewi=page.locator('article',{hasText:'Pricing page copy'});assert.match(await dewi.innerText(),/No update for 5 h/);
    assert.match(await dewi.locator('.takeover-choice').first().innerText(),/Marketing|Social Media|Business/);
    // Takeover: the agent error goes to another customer service member, who is suggested first.
    const sinta=page.locator('article',{hasText:'Reply to refund question'});
    assert.equal(await sinta.locator('.takeover-choice button').first().innerText(),'Move to KL');
    await sinta.locator('.takeover-choice button').first().click();
    const moved=await waitFor(async()=>{const task=(await request('/api/tasks')).body.find(t=>t.id==='00000000-0000-4000-8000-000000000002');return task.assignee==='Kak Laras'&&task;});
    assert.equal(moved.status,'queued');assert.equal(moved.error,undefined);
    assert.deepEqual((await page.evaluate(()=>officeScene.workSnapshot())).handoffs.map(h=>[h.from,h.to,h.kind]),[['Kak Sinta','Kak Laras','takeover']]);
    // Raising the limit to a day clears the time-based flags; the error is gone after the takeover.
    await page.selectOption('#stallHours','24');assert.equal(await page.locator('#taskList .task-item').count(),0);
    await page.selectOption('#stallHours','2');
    // Handoff from the approved draft: the suggested person and title are prefilled.
    await page.selectOption('#taskFilter','done');
    const done=page.locator('article',{hasText:'Answer delivery question'});
    await waitFor(async()=>await done.locator('.task-handoff').count());
    assert.match(await done.locator('.task-handoff summary').innerText(),/Hand off to KR \(suggested\)/);
    assert.equal(await done.locator('input[id$="-title"]').inputValue(),'DRY RUN: social post answering this customer question');
    await done.locator('textarea').fill('Keep it short and friendly.');
    await done.getByRole('button',{name:'Hand off',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('taskFeedback').textContent.startsWith('Handed to KR'));
    const follow=(await request('/api/tasks')).body.find(t=>t.handoffFrom?.id===draft.id);
    assert.equal(follow.assignee,'Kak Rani');assert.match(follow.brief,/Handed over by Kak Sinta/);assert.match(follow.brief,/Keep it short and friendly/);assert.match(follow.brief,/Result to build on/);
    const source=(await request('/api/tasks')).body.find(t=>t.id===draft.id);assert.equal(source.handedTo[0].assignee,'Kak Rani');assert.equal(source.handoff,undefined);
    // In the office: Kak Sinta walks the folder over to Kak Rani, and the follow-up is drafted by the social media agent.
    await page.click('#closeTasks');
    await page.waitForFunction(()=>officeScene.workSnapshot().carrying.includes('Kak Sinta'));
    assert.ok((await page.evaluate(()=>officeScene.workSnapshot())).handoffs.some(h=>h.from==='Kak Sinta'&&h.to==='Kak Rani'));
    await page.evaluate(()=>officeScene.setCamera({target:[5.5,10,1],theta:Math.PI-.3,phi:.75,radius:22}));
    await page.waitForFunction(()=>officeScene.workSnapshot().handoffs.some(h=>h.to==='Kak Rani'&&h.delivered),null,{timeout:30000});
    await page.screenshot({path:path.join(os.tmpdir(),'kantor-handoff.png')});
    await waitFor(async()=>(await request('/api/tasks')).body.find(t=>t.id===follow.id).status==='review');
    assert.match(await page.locator('#logList').innerText(),/KS hands "DRY RUN: social post answering this customer question" to KR/);
    for(const width of [375,768]){await page.setViewportSize({width,height:820});await page.click('#bTasks');await page.selectOption('#taskFilter','stuck');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.click('#closeTasks');}
    assert.deepEqual(errors,[]);
    console.log('stuck and handoff checks passed');
  }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
