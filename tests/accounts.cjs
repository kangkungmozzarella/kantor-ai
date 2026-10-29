const assert=require('node:assert/strict'),http=require('node:http'),{spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const waitFor=async(check)=>{for(let i=0;i<100;i++){const value=await check();if(value)return value;await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out');};
function start(port,env){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kantor-accounts-'));if(env.seed)fs.writeFileSync(path.join(dir,'tasks.json'),JSON.stringify(env.seed));delete env.seed;
  const proc=spawn(process.execPath,[path.join(__dirname,'../server/server.js')],{env:{...process.env,LOCAL_MODE:'',OPEN_SIGNUP:'',PORT:String(port),DATA_DIR:dir,ENV_FILE:'/nonexistent',ANTHROPIC_API_KEY:'',DRY_RUN_DELAY_MS:'100',...env},stdio:['ignore','pipe','inherit']});
  const ready=new Promise((resolve,reject)=>{proc.stdout.on('data',d=>String(d).includes('Kantor Kita:')&&resolve());proc.on('exit',code=>reject(new Error('Server exited '+code)));});
  // Node's fetch keeps no cookies, so each client carries its own session cookie.
  const client=()=>{let cookie='';return async(route,body,{method=body?'POST':'GET',headers={}}={})=>{
    const response=await fetch(`http://127.0.0.1:${port}${route}`,{method,redirect:'manual',headers:{'content-type':'application/json',...(cookie&&{cookie}),...headers},body:body&&JSON.stringify(body)});
    const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
    return {status:response.status,set,location:response.headers.get('location'),body:await response.json().catch(()=>null)};};};
  return {proc,dir,ready,client};
}
(async()=>{
  // A stand-in for the Claude API: every request returns a short draft.
  const mock=http.createServer((req,res)=>{req.resume();res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({content:[{type:'text',text:'Mock draft'}]}));});
  await new Promise(r=>mock.listen(0,'127.0.0.1',r));
  const open=start(4192,{OPEN_SIGNUP:'1',ANTHROPIC_API_KEY:'test-only',ANTHROPIC_BASE_URL:`http://127.0.0.1:${mock.address().port}`,AI_DAILY_LIMIT:'1'});
  const gated=start(4193,{seed:[{id:'00000000-0000-4000-8000-0000000000aa',title:'Old single-team task',assignee:'Mira',brief:'',status:'queued',result:'',createdAt:new Date().toISOString()}]});
  let browser;
  try{
    await open.ready;await gated.ready;
    const anon=open.client();
    // Without a session the office redirects to sign-in and the API refuses.
    const home=await anon('/');assert.equal(home.status,302);assert.equal(home.location,'/login.html');
    assert.equal((await anon('/login.html')).status,200);
    assert.equal((await anon('/api/tasks')).status,401);
    assert.equal((await anon('/api/auth/signup',{name:'A',email:'not-an-email',password:'longenough',workspace:'Alpha'})).status,400);
    assert.equal((await anon('/api/auth/signup',{name:'A',email:'a@example.com',password:'short',workspace:'Alpha'})).status,400);
    assert.equal((await anon('/api/auth/signup',{name:'A',email:'a@example.com',password:'longenough'})).status,400,'a new workspace needs a name');
    const alice=open.client(),signed=await alice('/api/auth/signup',{name:'Alice',email:'Alice@Example.com',password:'correct horse',workspace:'Alpha'});
    assert.equal(signed.status,201);assert.match(signed.set,/HttpOnly/);assert.match(signed.set,/SameSite=Lax/);
    assert.equal((await anon('/api/auth/signup',{name:'Dup',email:'alice@example.com',password:'correct horse',workspace:'X'})).status,409,'emails are unique, case-insensitive');
    const me=(await alice('/api/me')).body;assert.equal(me.workspace.name,'Alpha');assert.equal(me.role,'owner');assert.equal(me.members.length,1);
    // Writes from another site, or not sent as JSON, are refused even with a valid session.
    assert.equal((await alice('/api/tasks',{title:'x',assignee:'Mira'},{headers:{origin:'http://evil.example'}})).status,403);
    assert.equal((await alice('/api/tasks',{title:'x',assignee:'Mira'},{headers:{'content-type':'text/plain'}})).status,403);
    const task=(await alice('/api/tasks',{title:'Alpha plan',assignee:'Mira'})).body;
    // Invites: single use, owners only; the invited person joins the same workspace and sees its tasks.
    const invite=(await alice('/api/invites',{})).body,token=new URL(invite.url).searchParams.get('invite');
    assert.match(invite.url,/\/login\.html\?invite=/);
    assert.equal((await anon(`/api/invites/${token}`)).body.workspace,'Alpha');
    const bob=open.client();assert.equal((await bob('/api/auth/signup',{name:'Bob',email:'bob@example.com',password:'another pass',invite:token})).status,201);
    assert.equal((await bob('/api/me')).body.role,'member');assert.ok((await bob('/api/tasks')).body.some(t=>t.id===task.id));
    assert.equal((await bob('/api/invites',{})).status,403);
    assert.equal((await open.client()('/api/auth/signup',{name:'Eve',email:'eve@example.com',password:'another pass',invite:token})).status,404,'an invite works once');
    // Another workspace sees none of Alpha's work and cannot change it.
    const carol=open.client();assert.equal((await carol('/api/auth/signup',{name:'Carol',email:'carol@example.com',password:'third pass',workspace:'Beta'})).status,201);
    assert.deepEqual((await carol('/api/tasks')).body,[]);
    assert.equal((await carol(`/api/tasks/${task.id}`,{status:'active'},{method:'PATCH'})).status,404);
    // Sign-in, sign-out and the attempt limit.
    assert.equal((await anon('/api/auth/login',{email:'alice@example.com',password:'wrong'})).status,401);
    const again=open.client();assert.equal((await again('/api/auth/login',{email:'ALICE@example.com',password:'correct horse'})).status,200);assert.equal((await again('/api/me')).body.workspace.name,'Alpha');
    assert.equal((await again('/api/auth/logout',{})).status,200);assert.equal((await again('/api/me')).status,401);
    const attacker=open.client();let last;for(let i=0;i<11;i++)last=await attacker('/api/auth/login',{email:'carol@example.com',password:`guess ${i}`});assert.equal(last.status,429,'10 tries per email');assert.equal((await open.client()('/api/auth/login',{email:'carol@example.com',password:'third pass'})).status,429,'even the right password waits');
    // Daily AI limit: the first agent draft uses the one allowed request; the next waits with a clear error.
    const first=(await alice('/api/tasks',{title:'Caption one',assignee:'Kak Rani',brief:'Caption for the launch post.'})).body;
    await waitFor(async()=>(await alice('/api/tasks')).body.find(t=>t.id===first.id).status==='review');
    const second=(await alice('/api/tasks',{title:'Caption two',assignee:'Kak Rani',brief:'Caption for the follow-up.'})).body;
    const limited=await waitFor(async()=>(await alice('/api/tasks')).body.find(t=>t.id===second.id&&t.error));
    assert.match(limited.error,/daily limit of 1 AI requests/);assert.equal(limited.status,'queued');
    assert.equal((await alice('/api/me')).body.usage.today,1);assert.equal((await carol('/api/me')).body.usage.today,0,'usage is per workspace');
    // Default sign-up: the first workspace is free and receives the old single-team tasks; later sign-ups need an invite.
    const owner=gated.client();assert.equal((await owner('/api/auth/signup',{name:'Owner',email:'owner@example.com',password:'owner pass',workspace:'First'})).status,201);
    assert.deepEqual((await owner('/api/tasks')).body.map(t=>t.title),['Old single-team task']);
    assert.ok(fs.existsSync(path.join(gated.dir,'tasks.json.imported'))&&!fs.existsSync(path.join(gated.dir,'tasks.json')));
    assert.equal((await gated.client()('/api/auth/signup',{name:'Stranger',email:'s@example.com',password:'stranger pass',workspace:'Second'})).status,403);
    // In the browser: sign in, see the workspace, create an invite, sign out.
    browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4192/');await page.waitForURL(/login\.html/);
    await page.fill('#loginEmail','alice@example.com');await page.fill('#loginPassword','wrong password');await page.click('#loginForm button[type=submit]');
    await page.waitForFunction(()=>document.getElementById('authFeedback').textContent.includes('incorrect'));
    await page.fill('#loginPassword','correct horse');await page.click('#loginForm button[type=submit]');
    await page.waitForFunction(()=>window.officeScene&&!document.getElementById('bAccount').hidden);
    assert.equal(await page.locator('#bAccount').innerText(),'Alpha');
    await page.click('#bAccount');assert.match(await page.locator('#accountMembers').innerText(),/Bob/);assert.match(await page.locator('#accountUsage').innerText(),/1 of 1 AI requests/);
    await page.click('#createInvite');await page.waitForFunction(()=>document.getElementById('inviteLink').value.includes('invite='));
    const link=await page.locator('#inviteLink').inputValue();
    await page.click('#signOut');await page.waitForURL(/login\.html/);
    await page.goto(link);await page.waitForFunction(()=>!document.getElementById('inviteNote').hidden);
    assert.match(await page.locator('#inviteNote').innerText(),/join Alpha/);assert.equal(await page.locator('#workspaceField').isHidden(),true);
    await page.setViewportSize({width:375,height:760});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: sign-up/sign-in/sign-out, sessions, cross-site guard, invites, workspace isolation, attempt limit, daily AI limit, invite-only default, legacy import, browser sign-in and account panel');
  }finally{await browser?.close();open.proc.kill();gated.proc.kill();await new Promise(r=>mock.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
