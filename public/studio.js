(() => {
  const $=id=>document.getElementById(id),node=(tag,text)=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;return item;};
  const states={queued:'Queued',active:'In progress',blocked:'Needs decision',review:'Ready for review',done:'Finished'};
  const defaults={chairs:'original',rugs:'original',plants:'original',poster:'ideas',weather:'clear',rainVolume:25};
  const settings={...defaults};
  try{const saved=JSON.parse(localStorage.getItem('kantor-studio.v1')||'{}');for(const [key,allowed] of Object.entries({chairs:['original','sage','clay'],rugs:['original','sand','slate'],plants:['original','lush','autumn'],poster:['ideas','details'],weather:['clear','rain','sunset']}))if(allowed.includes(saved[key]))settings[key]=saved[key];if(Number.isFinite(saved.rainVolume))settings.rainVolume=Math.max(0,Math.min(100,saved.rainVolume));}catch{}
  let team=[],invited=[],reviewBusy=false,noteTask=null,audio=null;
  const save=()=>{try{localStorage.setItem('kantor-studio.v1',JSON.stringify(settings));}catch{$('studioFeedback').textContent='Preferences apply to this visit; browser storage is unavailable.';}};
  const name=full=>team.find(p=>p.n===full)?.initials||full;
  function closePanels(){for(const id of ['lifeDialog','workBoardDialog','reviewDialog','taskDialog'])if($(id).open)$(id).close();}
  function openTask(task){closePanels();window.officeTasks.openTask(task.id);}
  function workBoard(){
    const filter=$('workBoardFilter').value,list=window.officeTasks.list().filter(t=>filter==='all'||t.status===filter).sort((a,b)=>(b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt));
    const container=$('workBoardItems');container.replaceChildren();
    if(!list.length){container.append(node('p',filter==='all'?'No tasks yet. Create a task from Tasks or a division brief.':'No tasks match this status.'));return;}
    for(const task of list){const article=node('article');article.className='work-entry';article.append(node('h2',task.title),node('p',`${name(task.assignee)} · ${states[task.status]}${task.by==='dry-run'?' · Dry run':''}`));if(task.result){const preview=node('pre',task.result);preview.tabIndex=0;article.append(preview);}if(task.questions)article.append(node('p',task.questions));if(task.error)article.append(node('p',`Agent error: ${task.error}`));const button=node('button','Open task');button.type='button';button.onclick=()=>openTask(task);article.append(button);if(task.result){const review=node('button','Discuss this draft');review.type='button';review.onclick=()=>window.officeStudio.openReview(task.id);article.append(review);}container.append(article);}
  }
  function selectedMembers(){return [...$('reviewPeople').querySelectorAll('input:checked')].map(input=>input.value);}
  function clearReviewNotes(){noteTask=null;$('reviewNotes').textContent='';$('downloadReview').hidden=true;$('reviewFeedback').textContent='';}
  function availability(){const names=selectedMembers(),connected=names.filter(n=>window.officeTasks.agentFor(n));$('reviewUseAI').disabled=!connected.length||reviewBusy;if(!connected.length)$('reviewUseAI').checked=false;$('reviewAvailability').textContent=connected.length?`${connected.map(name).join(', ')} can give AI feedback. One model request per connected invitee. Other invitees attend as a simulation.`:'Invite at least one connected agent for AI feedback. A simulated meeting is available for everyone.';}
  function updateReviewTasks(){
    if(reviewBusy)return;
    const current=$('reviewTask').value,drafts=window.officeTasks.list().filter(t=>t.result?.trim());
    $('reviewTask').replaceChildren(...drafts.map(t=>new Option(`${t.title} · ${name(t.assignee)} · ${states[t.status]}`,t.id)));
    if(drafts.some(t=>t.id===current))$('reviewTask').value=current;
    else if(current)clearReviewNotes();
    $('reviewMeetingForm').querySelector('[type=submit]').disabled=!drafts.length;
    source();
  }
  function source(){const task=window.officeTasks.list().find(t=>t.id===$('reviewTask').value);$('reviewSource').textContent=task?`${task.by==='dry-run'?'DRY RUN · ':''}Draft version ${task.version||0}\n\n${task.result}`:'';if(noteTask){const latest=window.officeTasks.list().find(t=>t.id===noteTask.id);if(latest&&(latest.version||0)!==noteTask.version)$('reviewFeedback').textContent='The task changed since these notes were generated. Review the latest draft in Tasks.';}}
  function download(text,filename){const url=URL.createObjectURL(new Blob([text],{type:'text/plain'}));const a=node('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function rainSound(){
    const button=$('rainSound');
    try{
      if(audio?.playing){await audio.context.suspend();audio.playing=false;}
      else{if(!audio){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw new Error('This browser cannot play generated rain audio.');const context=new Context(),buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.45;const sound=context.createBufferSource();sound.buffer=buffer;sound.loop=true;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1600;const gain=context.createGain();gain.gain.value=settings.rainVolume/100;sound.connect(filter).connect(gain).connect(context.destination);sound.start();audio={context,gain,playing:false};}await audio.context.resume();audio.playing=true;}
      button.textContent=audio.playing?'Stop rain sound':'Play rain sound';button.setAttribute('aria-pressed',String(audio.playing));
    }catch(error){$('studioFeedback').textContent=error.message;}
  }
  window.officeStudio={settings,openBoard(){closePanels();workBoard();$('workBoardDialog').showModal();$('closeWorkBoard').focus();},openReview(id){closePanels();updateReviewTasks();if(id){if(id!==$('reviewTask').value)clearReviewNotes();$('reviewTask').value=id;}source();availability();$('reviewDialog').showModal();$('closeReview').focus();},audioSnapshot:()=>({playing:!!audio?.playing,volume:settings.rainVolume}),init(people){
    team=people;
    $('reviewSource').tabIndex=0;
    for(const [id,key] of [['chairStyle','chairs'],['rugStyle','rugs'],['plantStyle','plants'],['posterStyle','poster'],['officeWeather','weather']]){$(id).value=settings[key];$(id).onchange=()=>{settings[key]=$(id).value;save();window.officeScene.applyAppearance(settings);$('studioFeedback').textContent='Office appearance updated.';};}
    $('rainVolume').value=settings.rainVolume;$('rainVolume').oninput=()=>{settings.rainVolume=Number($('rainVolume').value);if(audio)audio.gain.gain.setTargetAtTime(settings.rainVolume/100,audio.context.currentTime,.05);save();};$('rainSound').onclick=rainSound;
    $('openResults').onclick=()=>window.officeStudio.openBoard();$('closeWorkBoard').onclick=()=>$('workBoardDialog').close();$('workBoardFilter').onchange=workBoard;
    $('openReview').onclick=()=>window.officeStudio.openReview();$('closeReview').onclick=()=>$('reviewDialog').close();$('reviewTask').onchange=()=>{clearReviewNotes();source();};
    team.forEach(person=>{const label=node('label'),input=node('input');input.type='checkbox';input.value=person.n;label.append(input,`${person.initials} · ${person.role}`);$('reviewPeople').append(label);input.onchange=availability;});
    $('reviewMeetingForm').onsubmit=async event=>{
      event.preventDefault();if(reviewBusy)return;const members=selectedMembers(),task=window.officeTasks.list().find(t=>t.id===$('reviewTask').value),useAI=$('reviewUseAI').checked,focus=$('reviewFocus').value.trim();
      if(!task?.result||!members.length||members.length>6){$('reviewFeedback').textContent='Choose a draft and 1–6 invitees.';return;}
      if(!window.officeScene.reviewMeeting(members)){$('reviewFeedback').textContent='The meeting room does not have enough free seats. Send the current invitees back to work or choose fewer people.';return;}
      invited=members;$('reviewNotes').textContent='';$('downloadReview').hidden=true;noteTask=null;
      if(!useAI){$('reviewFeedback').textContent='Invitees are heading to the meeting room. This is a simulated review; no AI feedback was requested.';return;}
      reviewBusy=true;const controls=[...$('reviewMeetingForm').querySelectorAll('input,select,textarea,button')];controls.forEach(c=>c.disabled=true);$('reviewFeedback').textContent='Connected agents are reviewing the draft…';
      try{const response=await fetch('/api/reviews',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({taskId:task.id,version:task.version||0,members,focus})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Review could not be generated.');noteTask={id:task.id,version:result.sourceVersion};$('reviewNotes').textContent=`${result.mode==='dry-run'?'DRY RUN · Example review\n':''}${task.title}\nSource draft version ${result.sourceVersion}\n\n${result.notes.map(n=>`${name(n.name)}\n${n.result}`).join('\n\n')}`;$('downloadReview').hidden=false;$('reviewFeedback').textContent=result.stale?'The draft changed while the review ran. These notes refer to the earlier draft.':'Review notes ready. Read them before approving anything in Tasks.';}catch(error){$('reviewFeedback').textContent=error.message;}finally{reviewBusy=false;controls.forEach(c=>c.disabled=false);updateReviewTasks();availability();}
    };
    $('endReview').onclick=()=>{window.officeScene.endReview(invited);invited=[];$('reviewFeedback').textContent='Invitees are heading back to their desks.';};$('downloadReview').onclick=()=>download($('reviewNotes').textContent,'kantor-review-notes.txt');
    $('startTour').onclick=()=>{const route=$('tourChoice').value;closePanels();window.officeScene.startTour(route);};$('stopTour').onclick=()=>window.officeScene.stopTour();
    document.addEventListener('officetasks:change',()=>{if($('workBoardDialog').open)workBoard();updateReviewTasks();});document.addEventListener('officetasks:server',availability);
    window.officeScene.applyAppearance(settings);updateReviewTasks();availability();
  }};
})();
