// Team editor: the people in this workspace's office, their division and hair, and which of them run an AI agent.
// Owners save it to the server; the office reloads to seat the new team.
(() => {
  const $ = id => document.getElementById(id);
  const node = (tag, text, className) => { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; if (className) item.className = className; return item; };
  let options = null, rows = [], serial = 0;
  const initialsOf = name => name.trim().split(/\s+/).filter(Boolean).map(word => word[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  function field(row, key, labelText, control) {
    const id = `team-${row.id}-${key}`, label = node('label', labelText), wrap = node('div');
    control.id = id; label.htmlFor = id; wrap.append(label, control); return wrap;
  }
  function select(entries, value) { const s = node('select'); for (const [v, t] of entries) s.add(new Option(t, v)); s.value = value; return s; }
  function rowView(row, index) {
    const box = node('fieldset', undefined, 'team-row'); box.append(node('legend', `Person ${index + 1}`));
    const name = node('input'); name.value = row.name; name.maxLength = 40; name.required = true;
    const initials = node('input'); initials.value = row.initials; initials.maxLength = 4; initials.required = true; initials.pattern = '[A-Za-z0-9]{1,4}';
    name.oninput = () => { row.name = name.value; if (row.autoInitials) { row.initials = initials.value = initialsOf(name.value); } };
    initials.oninput = () => { row.initials = initials.value.toUpperCase(); row.autoInitials = false; };
    const role = node('input'); role.value = row.role; role.maxLength = 60; role.required = true; role.oninput = () => { row.role = role.value; };
    const division = select(Object.entries(options.divisions), row.division); division.onchange = () => { row.division = division.value; summary(); };
    const look = select([['long', 'Long'], ['short', 'Short']], row.look); look.onchange = () => { row.look = look.value; };
    const agentBox = node('div', undefined, 'team-agent');
    const preset = select([['', 'Off · simulated person'], ...Object.entries(options.presets)], row.agent?.preset || '');
    const model = select(Object.entries(options.models), row.agent?.model || Object.keys(options.models)[0]);
    const instructions = node('textarea'); instructions.rows = 2; instructions.maxLength = 2000; instructions.value = row.agent?.instructions || '';
    const remove = node('button', 'Remove', 'team-remove'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove person ${index + 1}`);
    remove.onclick = () => { rows = rows.filter(r => r !== row); render(); };
    const sync = () => {
      const on = !!preset.value;
      row.agent = on ? {preset: preset.value, model: model.value, instructions: instructions.value} : null;
      modelField.hidden = noteField.hidden = !on;
      noteField.querySelector('label').textContent = preset.value === 'custom' ? 'Instructions (required)' : 'Extra instructions (optional)';
      instructions.required = preset.value === 'custom';
      summary();
    };
    preset.onchange = model.onchange = instructions.oninput = sync;
    const modelField = field(row, 'model', 'Claude model', model), noteField = field(row, 'notes', 'Extra instructions (optional)', instructions);
    agentBox.append(field(row, 'agent', 'AI agent', preset), modelField, noteField, remove);
    box.append(field(row, 'name', 'Name', name), field(row, 'initials', 'Initials', initials), field(row, 'role', 'Role', role), field(row, 'division', 'Division', division), field(row, 'look', 'Hair', look), agentBox);
    sync(); return box;
  }
  function summary() {
    const per = Object.keys(options.divisions).map(key => `${options.divisions[key]} ${rows.filter(r => r.division === key).length}/${options.limits.perDivision}`);
    const ai = rows.filter(r => r.agent).length;
    $('teamSummary').textContent = `${rows.length} of ${options.limits.members} people · ${ai} with an AI agent · ${per.join(' · ')}`;
    $('addMember').disabled = rows.length >= options.limits.members;
  }
  function render() { $('teamRows').replaceChildren(...rows.map(rowView)); summary(); }
  function feedback(message, error = false) { $('teamFeedback').textContent = message; $('teamFeedback').classList.toggle('error', error); }
  async function open() {
    feedback('');
    try {
      const response = await fetch('/api/team', {cache: 'no-store'});
      if (response.status === 401) { location.href = '/login.html'; return; }
      options = await response.json(); if (!response.ok) throw new Error(options.error || 'Could not load the team.');
    } catch (error) { feedback(error.message, true); $('teamDialog').showModal(); return; }
    rows = options.team.map(p => ({...structuredClone(p), previous: p.name, id: ++serial, autoInitials: false}));
    render(); $('teamDialog').showModal(); $('closeTeam').focus();
  }
  $('closeTeam').onclick = () => $('teamDialog').close();
  $('addMember').onclick = () => {
    // A new person goes to the first division with a free desk.
    const division = Object.keys(options.divisions).find(key => rows.filter(r => r.division === key).length < options.limits.perDivision) || 'leadership';
    rows.push({id: ++serial, name: '', initials: '', role: '', division, look: 'short', agent: null, autoInitials: true}); render();
    $(`team-${serial}-name`).focus();
  };
  $('teamForm').onsubmit = async event => {
    event.preventDefault();
    const team = rows.map(({name, initials, role, division, look, agent, previous}) => ({name, initials, role, division, look, agent, previous}));
    const button = $('teamForm').querySelector('[type=submit]'); button.disabled = true; feedback('Saving…');
    try {
      const response = await fetch('/api/team', {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({team})});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Server error ${response.status}`);
      feedback('Saved. Reloading the office…'); location.reload();
    } catch (error) { feedback(error.message, true); button.disabled = false; }
  };
  window.officeTeam = {open};
})();
