const assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=4189,dir=fs.mkdtempSync(path.join(os.tmpdir(),'kantor-team-'));
const waitFor=async(check)=>{for(let i=0;i<100;i++){const value=await check();if(value)return value;await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out');};
const client=()=>{let cookie='';return async(route,body,method=body?'POST':'GET')=>{const r=await fetch(`http://127.0.0.1:${port}${route}`,{method,headers:{'content-type':'application/json',...(cookie&&{cookie})},body:body&&JSON.stringify(body)});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return {status:r.status,body:await r.json().catch(()=>null)};};};
(async()=>{
  const server=spawn(process.execPath,[path.join(__dirname,'../server/server.js')],{env:{...process.env,LOCAL_MODE:'',OPEN_SIGNUP:'1',PORT:String(port),DATA_DIR:dir,ENV_FILE:'/nonexistent',ANTHROPIC_API_KEY:'',DRY_RUN_DELAY_MS:'100'},stdio:['ignore','pipe','inherit']});let browser;
  try{
    await new Promise((resolve,reject)=>{server.stdout.on('data',d=>String(d).includes('Kantor Kita:')&&resolve());server.on('exit',code=>reject(new Error('Server exited '+code)));});
    const owner=client();await owner('/api/auth/signup',{name:'Owner',email:'owner@example.com',password:'owner pass',workspace:'Alpha'});
    const start=(await owner('/api/team')).body;
    assert.equal(start.team.length,13);assert.equal(start.canEdit,true);assert.deepEqual(start.limits,{members:14,perDivision:4});
    const base=start.team.map(p=>({...p,previous:p.name}));
    const put=team=>owner('/api/team',{team},'PUT');
    // Guards: room for 14, four desks per division, unique initials, custom agents need instructions, known models only.
    const extra=i=>({name:`Extra ${i}`,initials:`X${i}`,role:'Helper',division:'leadership',look:'short',agent:null});
    assert.equal((await put([...base,extra(1),extra(2)])).status,400);
    assert.match((await put([...base,extra(1),extra(2)].slice(0,14).map((p,i)=>i<5?{...p,division:'leadership'}:p))).body.error,/4 desks/);
    assert.match((await put(base.map((p,i)=>i===1?{...p,initials:'KA'}:p))).body.error,/KA are used twice/);
    assert.match((await put([...base,{...extra(1),division:'leadership',agent:{preset:'custom',model:'claude-sonnet-5-5',instructions:''}}])).body.error,/custom agent/);
    assert.match((await put(base.map(p=>p.name==='Kak Rani'?{...p,agent:{...p.agent,model:'gpt-5'}}:p))).body.error,/Claude model/);
    // Work assigned before the change follows a renamed person.
    const draft=(await owner('/api/tasks',{title:'Launch caption',assignee:'Kak Rani',brief:'Caption for the new menu.'})).body;
    await waitFor(async()=>(await owner('/api/tasks')).body.find(t=>t.id===draft.id).status==='review');
    const next=base.filter(p=>p.name!=='Kak Laras').map(p=>p.name==='Kak Rani'?{...p,name:'Rani',initials:'R'}:p);
    next.push({name:'Nadia Putri',initials:'NP',role:'Content Writer',division:'service',look:'long',agent:{preset:'custom',model:'claude-haiku-5-5',instructions:'Write blog outlines with three sections.'}},{...extra(1),division:'leadership'});
    const saved=await put(next);assert.equal(saved.status,200);assert.equal(saved.body.team.length,14);
    assert.equal((await owner('/api/tasks')).body.find(t=>t.id===draft.id).assignee,'Rani');
    const agents=(await owner('/api/agents')).body.members;assert.deepEqual(Object.keys(agents).sort(),['Kak Sinta','Nadia Putri','Rani']);assert.equal(agents['Nadia Putri'].preset,'custom');assert.equal(agents['Nadia Putri'].model,'claude-haiku-5-5');
    // The new AI member drafts; people no longer on the team cannot get new work.
    const outline=(await owner('/api/tasks',{title:'Blog outline',assignee:'Nadia Putri',brief:'Outline a post about our new menu.'})).body;
    assert.match((await waitFor(async()=>{const t=(await owner('/api/tasks')).body.find(t=>t.id===outline.id);return t.status==='review'&&t;})).result,/Content Writer would draft/);
    assert.equal((await owner('/api/tasks',{title:'x',assignee:'Kak Laras'})).status,400);
    // Members can read the team but only the owner changes it; other workspaces keep their own team.
    const invite=(await owner('/api/invites',{})).body.url,token=new URL(invite).searchParams.get('invite');
    const member=client();await member('/api/auth/signup',{name:'Member',email:'member@example.com',password:'member pass',invite:token});
    assert.equal((await member('/api/team')).body.canEdit,false);assert.equal((await member('/api/team',{team:next},'PUT')).status,403);
    const other=client();await other('/api/auth/signup',{name:'Other',email:'other@example.com',password:'other pass',workspace:'Beta'});
    assert.ok((await other('/api/team')).body.team.some(p=>p.name==='Kak Rani'));
    // In the office: the saved team is seated, and the editor removes someone and reloads.
    browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/login.html`);await page.fill('#loginEmail','owner@example.com');await page.fill('#loginPassword','owner pass');await page.click('#loginForm button[type=submit]');
    await page.waitForFunction(()=>window.officeScene&&!document.getElementById('bAccount').hidden);
    assert.equal(await page.locator('.brand-meta').innerText(),'14 people · 4 floors');
    const names=await page.evaluate(()=>officeScene.snapshot().team.map(a=>a.name));assert.ok(names.includes('Nadia Putri')&&names.includes('Rani')&&!names.includes('Kak Laras'));
    await page.click('#bAccount');await page.click('#editTeam');await page.waitForFunction(()=>document.getElementById('teamSummary').textContent.startsWith('14 of 14'));
    assert.equal(await page.locator('#addMember').isDisabled(),true);assert.match(await page.locator('#teamSummary').innerText(),/3 with an AI agent/);
    await page.setViewportSize({width:375,height:760});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:1440,height:900});
    await page.getByRole('button',{name:'Remove person 14'}).click();
    await page.click('#teamForm button[type=submit]');await page.waitForFunction(()=>window.officeScene&&document.querySelector('.brand-meta').textContent.startsWith('13 people'),null,{timeout:30000});
    assert.equal((await owner('/api/team')).body.team.length,13);
    assert.deepEqual(errors,[]);
    console.log('PASS: per-workspace team, limits and guards, rename keeps tasks, custom AI agent drafts, removed people get no new work, owner-only edits, team editor and reload');
  }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
