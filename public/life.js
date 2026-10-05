(() => {
  const el=id=>document.getElementById(id);
  const habits=['Coffee regular','Idea board reader','Coffee regular','Lounge thinker','Team conversationalist','Idea board reader','Stretch break regular','Idea board reader','Lounge thinker','Idea board reader','Team conversationalist','Coffee regular','Plant caretaker'];
  const contributions={CEO:'Define priorities, success criteria and decisions needed',CTO:'Assess technical feasibility, dependencies and risks','Social Media Specialist':'Draft social content and a publishing plan','Digital Marketing':'Draft campaign channels, experiments and measurement','Business Development':'Identify partnership opportunities and outreach drafts','Social Media Intern':'Prepare supporting content ideas and a research checklist','Frontend Engineer':'Propose UI changes, implementation steps and verification','Backend Engineer':'Propose API and data changes, implementation steps and verification','Product Design':'Draft the user flow, interaction requirements and design decisions','Graphic Designer':'Draft visual concepts and an asset checklist','Customer Service Leader':'Plan support readiness, escalation and reply guidelines','Customer Service':'Draft customer replies and likely questions'};
  let team=[],groups={},allocation=[],revision=0;
  const feedback=message=>el('lifeFeedback').textContent=message;
  const paragraph=text=>{const p=document.createElement('p');p.textContent=text;return p;};
  const preferences={mood:'auto',celebrate:true};
  try {const saved=JSON.parse(localStorage.getItem('kantor-life.v1')||'{}');if(['auto','morning','afternoon','evening','night'].includes(saved.mood))preferences.mood=saved.mood;if(typeof saved.celebrate==='boolean')preferences.celebrate=saved.celebrate;}catch{}
  function save(){try{localStorage.setItem('kantor-life.v1',JSON.stringify(preferences));}catch{feedback('Preferences apply to this visit; browser storage is unavailable.');}}
  function coffeeAvailability(){const supported=[el('coffeeFirst').value,el('coffeeSecond').value].every(n=>window.officeTasks.agentFor(n));el('coffeeAI').disabled=!supported;if(!supported)el('coffeeAI').checked=false;el('coffeeAvailability').textContent=supported?'Both people can give AI feedback. This uses two model requests.':'A simulated coffee break is available. AI feedback needs two connected agents.';}
  window.officeLife={preferences,habits,init(people,divisions){
    team=people;groups=divisions;
    el('officeMood').value=preferences.mood;el('celebrations').checked=preferences.celebrate;
    for(const [key,group] of Object.entries(groups)){const o=new Option(group.name,key);el('briefDivision').add(o);}
    team.forEach((person,i)=>{for(const id of ['coffeeFirst','coffeeSecond'])el(id).add(new Option(`${person.initials} · ${person.role}`,person.n));const li=document.createElement('li');li.textContent=`${person.initials} · ${habits[i]}`;el('personalityList').append(li);});
    el('coffeeSecond').selectedIndex=1;
    el('bLife').onclick=()=>{coffeeAvailability();el('lifeDialog').showModal();el('closeLife').focus();};el('closeLife').onclick=()=>el('lifeDialog').close();
    el('officeMood').onchange=()=>{preferences.mood=el('officeMood').value;save();};el('celebrations').onchange=()=>{preferences.celebrate=el('celebrations').checked;save();};
    el('petCat').onclick=()=>window.officeScene.petCat();
    el('coffeeFirst').onchange=el('coffeeSecond').onchange=coffeeAvailability;
    document.addEventListener('officetasks:server',coffeeAvailability);
    el('coffeeForm').onsubmit=async event=>{
      event.preventDefault();const members=[el('coffeeFirst').value,el('coffeeSecond').value],topic=el('coffeeTopic').value.trim();
      if(members[0]===members[1]){feedback('Choose two different people.');return;}
      const useAI=el('coffeeAI').checked;if(useAI&&!topic){feedback('Enter a topic for AI feedback.');el('coffeeTopic').focus();return;}
      if(!window.officeScene.coffee(members)){feedback('The two pantry places are occupied. Try again after the current break.');return;}
      el('coffeeNotes').textContent='';el('saveCoffee').hidden=true;
      if(!useAI){feedback('Coffee invitation sent. This is a simulated break.');return;}
      const button=event.submitter;button.disabled=true;feedback('The agents are exchanging feedback…');
      try{const response=await fetch('/api/coffee',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({members,topic})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not get feedback.');el('coffeeNotes').textContent=`${result.mode==='dry-run'?'DRY RUN · Example feedback\n\n':''}${result.notes.map(n=>`${team.find(p=>p.n===n.name)?.initials||n.name}\n${n.result}`).join('\n\n')}`;el('saveCoffee').hidden=false;feedback('Feedback ready. Download the notes to keep a copy.');}catch(error){feedback(error.message);}finally{button.disabled=false;}
    };
    el('saveCoffee').onclick=()=>{const url=URL.createObjectURL(new Blob([el('coffeeNotes').textContent],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='kantor-coffee-notes.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    const invalidate=()=>{revision++;allocation=[];el('divisionPreview').replaceChildren();el('createDivision').hidden=true;};
    for(const id of ['briefDivision','divisionGoal','divisionContext'])el(id).addEventListener('input',invalidate);
    el('divisionForm').onsubmit=event=>{
      event.preventDefault();const goal=el('divisionGoal').value.trim(),context=el('divisionContext').value.trim();if(!goal||!context){feedback('Enter a goal and context.');return;}
      const members=team.filter(p=>p.group===el('briefDivision').value);
      allocation=members.map(p=>({title:`${goal} · ${p.role}`.slice(0,160),assignee:p.n,brief:`Shared goal: ${goal}\n\nConfirmed context:\n${context}\n\nYour contribution (${p.role}): ${contributions[p.role]}.\nCoordinate with: ${members.filter(m=>m!==p).map(m=>m.role).join(', ')}.\nReturn a draft for human review. Flag missing facts; do not invent them or publish anything.`}));
      el('divisionPreview').replaceChildren(...allocation.map(d=>paragraph(`${team.find(p=>p.n===d.assignee).initials}: ${contributions[team.find(p=>p.n===d.assignee).role]}${window.officeTasks.agentFor(d.assignee)?' · AI draft':' · Manual task'}`)));
      el('createDivision').hidden=false;feedback('Allocation follows each role. Review it before creating the tasks.');
    };
    el('createDivision').onclick=async()=>{const button=el('createDivision'),current=revision,count=allocation.length;if(!count)return;button.disabled=true;try{await window.officeTasks.createBatch(allocation);if(current===revision)invalidate();feedback(`${count} division tasks created.`);}catch(error){feedback(error.message);}finally{button.disabled=false;}};
    coffeeAvailability();
  }};
})();
