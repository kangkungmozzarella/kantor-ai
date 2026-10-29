(() => {
  const $ = id => document.getElementById(id), invite = new URLSearchParams(location.search).get('invite') || '';
  const feedback = message => { $('authFeedback').textContent = message; };
  function show(tab) {
    for (const [id, form] of [['tabLogin', 'loginForm'], ['tabSignup', 'signupForm']]) { const on = id === tab; $(id).setAttribute('aria-selected', String(on)); $(form).hidden = !on; }
    feedback(''); (tab === 'tabLogin' ? $('loginEmail') : $('signupName')).focus();
  }
  $('tabLogin').onclick = () => show('tabLogin'); $('tabSignup').onclick = () => show('tabSignup');
  async function submit(form, path, body) {
    const button = form.querySelector('[type=submit]'); button.disabled = true; feedback('');
    try {
      const response = await fetch(path, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Server error ${response.status}`);
      location.href = '/';
    } catch (error) { feedback(error.message); button.disabled = false; }
  }
  $('loginForm').onsubmit = event => { event.preventDefault(); submit(event.target, '/api/auth/login', {email: $('loginEmail').value, password: $('loginPassword').value, invite}); };
  $('signupForm').onsubmit = event => { event.preventDefault(); submit(event.target, '/api/auth/signup', {name: $('signupName').value, email: $('signupEmail').value, password: $('signupPassword').value, workspace: $('signupWorkspace').value, invite}); };
  // An invite link joins an existing workspace, so there is no workspace to name.
  if (invite) {
    fetch(`/api/invites/${encodeURIComponent(invite)}`).then(r => r.json().then(data => ({ok: r.ok, data}))).then(({ok, data}) => {
      if (!ok) { feedback(data.error || 'This invite link cannot be used.'); return; }
      $('inviteNote').textContent = `You're invited to join ${data.workspace}.`; $('inviteNote').hidden = false;
      $('workspaceField').hidden = true; show('tabSignup');
    }).catch(() => feedback('Could not check the invite link.'));
  } else $('signupWorkspace').required = true;
})();
