// Workspace panel: who is signed in, today's AI usage, people with access, invite links (owners) and sign-out.
// Hidden without the server; in local mode it only shows usage.
(() => {
  const $ = id => document.getElementById(id), node = (tag, text) => { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; return item; };
  let me = null;
  async function load() {
    const response = await fetch('/api/me', {cache: 'no-store'}).catch(() => null);
    if (!response || !response.headers.get('content-type')?.includes('application/json')) return;
    if (response.status === 401) { location.href = '/login.html'; return; }
    if (!response.ok) return;
    me = await response.json();
    $('bAccount').hidden = false; $('bAccount').textContent = me.workspace.name;
    render();
  }
  function render() {
    $('accountHeading').textContent = me.workspace.name;
    $('accountWho').textContent = me.local ? 'Local mode: no sign-in, one workspace on this computer.' : `Signed in as ${me.user.name} (${me.user.email}) · ${me.role}`;
    const {today, limit, mode} = me.usage;
    $('accountUsage').textContent = mode === 'dry-run' ? 'Dry run: no API key is set, so no AI requests are made or counted.' : `${today} of ${limit} AI requests used. The limit resets at 00:00 UTC.`;
    $('accountPeople').hidden = !!me.local; $('signOut').hidden = !!me.local;
    $('accountMembers').replaceChildren(...me.members.map(m => { const item = node('li'); item.append(node('strong', m.name), node('span', `${m.email} · ${m.role}`)); return item; }));
    $('accountInvite').hidden = me.role !== 'owner';
    $('accountTeam').hidden = me.role !== 'owner';
  }
  $('bAccount').onclick = async () => { await load(); $('accountFeedback').textContent = ''; $('accountDialog').showModal(); $('closeAccount').focus(); };
  $('closeAccount').onclick = () => $('accountDialog').close();
  $('editTeam').onclick = () => { $('accountDialog').close(); window.officeTeam.open(); };
  $('createInvite').onclick = async () => {
    try {
      const response = await fetch('/api/invites', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'}), data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create an invite link.');
      $('inviteLink').value = data.url; $('inviteLink').hidden = $('copyInvite').hidden = false; $('inviteLink').select();
      $('accountFeedback').textContent = `Invite link ready. It expires on ${new Date(data.expiresAt).toLocaleDateString()}.`;
    } catch (error) { $('accountFeedback').textContent = error.message; }
  };
  $('copyInvite').onclick = async () => { try { await navigator.clipboard.writeText($('inviteLink').value); $('accountFeedback').textContent = 'Invite link copied.'; } catch { $('inviteLink').select(); $('accountFeedback').textContent = 'Select the link and copy it.'; } };
  $('signOut').onclick = async () => { await fetch('/api/auth/logout', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'}).catch(() => {}); location.href = '/login.html'; };
  load();
})();
