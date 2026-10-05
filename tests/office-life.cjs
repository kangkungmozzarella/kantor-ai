const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=4187,dir=fs.mkdtempSync(path.join(os.tmpdir(),'kantor-life-'));
const api=async(route,body)=>{const response=await fetch(`http://127.0.0.1:${port}${route}`,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body&&JSON.stringify(body)});return {status:response.status,body:await response.json()};};
(async()=>{
  const server=spawn(process.execPath,[path.join(__dirname,'../server/server.js')],{env:{...process.env,PORT:String(port),DATA_DIR:dir,ENV_FILE:'/nonexistent',ANTHROPIC_API_KEY:'',DRY_RUN_DELAY_MS:'100'},stdio:['ignore','pipe','inherit']});
  let browser;
  try{
    await new Promise((resolve,reject)=>{server.stdout.on('data',d=>String(d).includes('Kantor Kita:')&&resolve());server.on('error',reject);server.on('exit',code=>reject(new Error('Server exited '+code)));});
    const invalid=await api('/api/tasks/batch',{tasks:[{title:'Valid',assignee:'Kak Rani'},{title:'Invalid',assignee:'Unknown'}]});assert.equal(invalid.status,400);assert.equal((await api('/api/tasks')).body.length,0,'invalid batch must create nothing');
    assert.equal((await api('/api/coffee',{members:['Kak Rani','Kak Rani'],topic:'Review the launch'})).status,400);
    assert.equal((await api('/api/coffee',{members:['Kak Rani','Koh Arman'],topic:'Review the launch'})).status,400);
    browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}`);await page.waitForFunction(()=>window.officeScene&&window.officeTasks.agentFor('Kak Rani'));
    await page.click('#bRoutine');
    await page.click('#bLife');assert.equal(await page.locator('#personalityList li').count(),13);
    await page.selectOption('#officeMood','night');await page.waitForFunction(()=>officeScene.lifeSnapshot().mood==='night');
    assert.deepEqual(await page.evaluate(()=>officeScene.lifeSnapshot().litFloors),[3],'night lights belong only to the visible floor');
    await page.click('#closeLife');await page.click('[data-floor="4"]');assert.deepEqual(await page.evaluate(()=>officeScene.lifeSnapshot().litFloors),[4]);
    await page.click('[data-floor="0"]');await page.waitForFunction(()=>!officeScene.snapshot().transitioning);assert.deepEqual(await page.evaluate(()=>officeScene.lifeSnapshot().litFloors),[1,2,3,4]);
    await page.screenshot({path:path.join(os.tmpdir(),'kantor-night-building.png')});
    await page.click('[data-floor="3"]');await page.waitForFunction(()=>!officeScene.snapshot().transitioning);assert.deepEqual(await page.evaluate(()=>officeScene.lifeSnapshot().litFloors),[3]);
    await page.screenshot({path:path.join(os.tmpdir(),'kantor-night-workspace.png')});await page.click('#bLife');
    await page.selectOption('#officeMood','morning');await page.waitForFunction(()=>officeScene.lifeSnapshot().mood==='morning');
    await page.click('#petCat');assert.equal(await page.evaluate(()=>officeScene.lifeSnapshot().cat.petting),true);assert.match(await page.locator('#catStatus').innerText(),/purrs/);
    await page.selectOption('#coffeeFirst','Kak Rani');await page.selectOption('#coffeeSecond','Kak Sinta');await page.fill('#coffeeTopic','Review a launch announcement for existing customers.');await page.check('#coffeeAI');
    await page.click('#coffeeForm button[type=submit]');await page.waitForFunction(()=>document.getElementById('coffeeNotes').textContent.includes('Customer Service'));assert.match(await page.locator('#coffeeNotes').innerText(),/First colleague feedback/);assert.equal(await page.locator('#saveCoffee').isVisible(),true);
    const downloadPromise=page.waitForEvent('download');await page.click('#saveCoffee');assert.equal((await downloadPromise).suggestedFilename(),'kantor-coffee-notes.txt');
    await page.selectOption('#briefDivision','marketing');await page.fill('#divisionGoal','Prepare a launch');await page.fill('#divisionContext','Indonesian audience, verified menu facts will be supplied. Drafts only.');await page.click('#divisionForm button');assert.equal(await page.locator('#divisionPreview p').count(),4);
    await page.fill('#divisionGoal','Prepare the updated launch');assert.equal(await page.locator('#createDivision').isVisible(),false,'edited brief invalidates its preview');await page.click('#divisionForm button');await page.click('#createDivision');await page.waitForFunction(()=>officeTasks.list().length===4);assert.equal((await api('/api/tasks')).body.length,4);
    await page.click('#closeLife');await page.click('#bTasks');await page.waitForFunction(()=>officeTasks.list().some(t=>t.assignee==='Kak Rani'&&t.status==='review'));await page.getByRole('button',{name:'Approve & finish',exact:true}).click();await page.waitForFunction(()=>officeScene.lifeSnapshot().habits.some(p=>p.name==='Kak Rani'&&p.celebrating));await page.click('#closeTasks');
    await page.reload();await page.waitForFunction(()=>window.officeScene);assert.equal(await page.evaluate(()=>officeScene.lifeSnapshot().mood),'morning','mood preference survives reload');
    await page.click('#bPause');const before=await page.evaluate(()=>officeScene.lifeSnapshot().cat.position);await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>officeScene.lifeSnapshot().cat.position),before,'pause freezes the cat');await page.click('#bPause');
    for(const width of [375,768,1440]){await page.setViewportSize({width,height:900});await page.click('#bLife');assert.ok(await page.evaluate(()=>document.getElementById('lifeDialog').scrollWidth<=document.getElementById('lifeDialog').clientWidth),'dialog must not overflow');await page.screenshot({path:path.join(os.tmpdir(),`kantor-life-${width}.png`)});await page.click('#closeLife');}
    // Without a task server, allocation still saves all tasks together in the browser.
    const offline=await browser.newPage({reducedMotion:'reduce'});offline.on('pageerror',error=>errors.push(error.message));await offline.route('**/api/**',route=>route.abort());await offline.goto(`http://127.0.0.1:${port}`);await offline.waitForFunction(()=>window.officeScene);await offline.click('#bLife');await offline.selectOption('#briefDivision','engineering');await offline.fill('#divisionGoal','Improve the dashboard');await offline.fill('#divisionContext','Review navigation and draft implementation steps.');await offline.click('#divisionForm button');await offline.click('#createDivision');await offline.waitForFunction(()=>officeTasks.list().length===4);assert.equal(await offline.evaluate(()=>JSON.parse(localStorage.getItem('kantor-ai.tasks.v1')).length),4);assert.equal(await offline.locator('#coffeeAI').isDisabled(),true);
    assert.deepEqual(errors,[]);console.log('PASS: atomic allocation, coffee peer feedback and download, cat interaction/pause, habits, celebration, saved lighting, responsive dialog, offline allocation');
  }finally{if(browser)await browser.close();server.kill();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
