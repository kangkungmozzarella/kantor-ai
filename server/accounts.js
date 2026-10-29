// Accounts: email + password sign-in, cookie sessions bound to one workspace, and single-use invite links.
// Passwords are hashed with scrypt; session and invite tokens are stored only as SHA-256 hashes.
const crypto = require('node:crypto');

const COOKIE = 'kk_session', SESSION_DAYS = 30, INVITE_DAYS = 7;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');
const now = () => new Date().toISOString();
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(password, salt, 32).toString('hex')}`;
}
function checkPassword(password, stored) {
  const [kind, salt, hash] = String(stored).split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'hex'), 32), expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = function accounts({store, send, readJson, openSignup, publicUrl, secureCookies, trustProxy, onFirstWorkspace}) {
  const {q, transaction} = store;
  // Sign-in and sign-up attempts per 15 minutes: 10 per email, 50 per network address (an office shares one).
  const attempts = new Map();
  function limited(ip, email) {
    const at = Date.now();
    let over = false;
    for (const [key, max] of [[`ip:${ip}`, 50], [`email:${email}`, 10]]) {
      const entry = attempts.get(key);
      if (!entry || entry.reset < at) attempts.set(key, {count: 1, reset: at + 15 * 60000});
      else if (++entry.count > max) over = true;
    }
    if (attempts.size > 10000) for (const [key, entry] of attempts) if (entry.reset < at) attempts.delete(key);
    return over;
  }
  // Behind a reverse proxy every request comes from the proxy, so its forwarded address is used, but only when trusted.
  const addressOf = req => (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
  function cookies(req) {
    return Object.fromEntries((req.headers.cookie || '').split(';').map(part => part.trim().split('=')).filter(([k, v]) => k && v).map(([k, v]) => [k, decodeURIComponent(v)]));
  }
  const secure = req => secureCookies || (trustProxy && req.headers['x-forwarded-proto'] === 'https');
  function startSession(req, res, userId, workspaceId) {
    const raw = token();
    q('insert into sessions (token_hash, user_id, workspace_id, expires_at) values (?, ?, ?, ?)').run(sha(raw), userId, workspaceId, Date.now() + SESSION_DAYS * 86400000);
    res.setHeader('set-cookie', `${COOKIE}=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure(req) ? '; Secure' : ''}`);
  }
  // The signed-in person and their workspace, or null. Membership is checked on every request,
  // so removing someone from a workspace ends their access at once.
  function session(req) {
    const raw = cookies(req)[COOKIE]; if (!raw) return null;
    const row = q(`select s.user_id, s.workspace_id, s.expires_at, u.name, u.email, m.role, w.name as workspace from sessions s
      join users u on u.id = s.user_id join members m on m.user_id = s.user_id and m.workspace_id = s.workspace_id
      join workspaces w on w.id = s.workspace_id where s.token_hash = ?`).get(sha(raw));
    if (!row || row.expires_at < Date.now()) return null;
    return {userId: row.user_id, workspaceId: row.workspace_id, name: row.name, email: row.email, role: row.role, workspace: row.workspace};
  }
  function invite(raw) {
    if (typeof raw !== 'string' || !raw) return null;
    return q('select i.token_hash, i.workspace_id, w.name from invites i join workspaces w on w.id = i.workspace_id where i.token_hash = ? and i.used_by is null and i.expires_at > ?').get(sha(raw), Date.now()) || null;
  }
  const join = (workspaceId, userId, role) => q('insert or ignore into members (workspace_id, user_id, role, created_at) values (?, ?, ?, ?)').run(workspaceId, userId, role, now());

  // Routes that work without a session: sign-up, sign-in, sign-out and checking an invite link.
  async function publicRoutes(req, res, url) {
    const ip = addressOf(req);
    const checking = url.pathname.match(/^\/api\/invites\/([A-Za-z0-9_-]{20,})$/);
    if (checking && req.method === 'GET') { const found = invite(checking[1]); return found ? send(res, 200, {workspace: found.name}) : send(res, 404, {error: 'This invite link is invalid, used or expired.'}); }
    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      const raw = cookies(req)[COOKIE]; if (raw) q('delete from sessions where token_hash = ?').run(sha(raw));
      res.setHeader('set-cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure(req) ? '; Secure' : ''}`);
      return send(res, 200, {ok: true});
    }
    if (url.pathname === '/api/auth/signup' && req.method === 'POST') {
      const input = await readJson(req), email = text(input?.email, 200).toLowerCase(), name = text(input?.name, 80), password = typeof input?.password === 'string' ? input.password : '';
      if (limited(ip, email)) return send(res, 429, {error: 'Too many attempts. Wait 15 minutes and try again.'});
      if (!EMAIL.test(email)) return send(res, 400, {error: 'Enter a valid email address.'});
      if (!name) return send(res, 400, {error: 'Enter your name.'});
      if (password.length < 8 || password.length > 200) return send(res, 400, {error: 'Use a password of at least 8 characters.'});
      if (q('select 1 from users where email = ?').get(email)) return send(res, 409, {error: 'An account with this email already exists. Sign in instead.'});
      const invited = input?.invite ? invite(input.invite) : null;
      if (input?.invite && !invited) return send(res, 404, {error: 'This invite link is invalid, used or expired.'});
      const workspaceName = text(input?.workspace, 80);
      if (!invited) {
        // Only the first workspace on a server is created freely; after that, sign-up needs an invite
        // unless OPEN_SIGNUP=1, so strangers cannot spend the server's AI budget.
        if (!openSignup && q('select count(*) as n from workspaces').get().n > 0) return send(res, 403, {error: 'Sign-up is invite-only. Ask your workspace owner for an invite link.'});
        if (!workspaceName) return send(res, 400, {error: 'Name your workspace, for example your company or team.'});
      }
      const userId = crypto.randomUUID(), at = now();
      const {workspaceId, first} = transaction(() => {
        q('insert into users (id, email, name, password, created_at) values (?, ?, ?, ?, ?)').run(userId, email, name, hashPassword(password), at);
        if (invited) { join(invited.workspace_id, userId, 'member'); q('update invites set used_by = ? where token_hash = ?').run(userId, invited.token_hash); return {workspaceId: invited.workspace_id, first: false}; }
        const id = crypto.randomUUID(), first = q('select count(*) as n from workspaces').get().n === 0;
        q('insert into workspaces (id, name, created_at) values (?, ?, ?)').run(id, workspaceName, at); join(id, userId, 'owner');
        return {workspaceId: id, first};
      });
      if (first) onFirstWorkspace(workspaceId);
      startSession(req, res, userId, workspaceId);
      return send(res, 201, {ok: true});
    }
    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      const input = await readJson(req), email = text(input?.email, 200).toLowerCase(), password = typeof input?.password === 'string' ? input.password : '';
      if (limited(ip, email)) return send(res, 429, {error: 'Too many attempts. Wait 15 minutes and try again.'});
      const user = q('select id, password from users where email = ?').get(email);
      if (!user || !checkPassword(password, user.password)) return send(res, 401, {error: 'Email or password is incorrect.'});
      // Signing in from an invite link adds an existing account to that workspace too.
      const invited = input?.invite ? invite(input.invite) : null;
      if (invited) transaction(() => { join(invited.workspace_id, user.id, 'member'); q('update invites set used_by = ? where token_hash = ?').run(user.id, invited.token_hash); });
      const workspace = invited?.workspace_id || q('select workspace_id from members where user_id = ? order by created_at desc').get(user.id)?.workspace_id;
      if (!workspace) return send(res, 403, {error: 'This account is not part of any workspace yet. Ask for an invite link.'});
      startSession(req, res, user.id, workspace);
      return send(res, 200, {ok: true});
    }
    return false;
  }

  // Routes for a signed-in person: who am I, and (owners) creating invite links.
  async function memberRoutes(req, res, url, who, usage) {
    if (url.pathname === '/api/me' && req.method === 'GET') {
      const members = q('select u.name, u.email, m.role from members m join users u on u.id = m.user_id where m.workspace_id = ? order by m.created_at').all(who.workspaceId);
      return send(res, 200, {user: {name: who.name, email: who.email}, role: who.role, workspace: {id: who.workspaceId, name: who.workspace}, members, usage: usage(who.workspaceId)});
    }
    if (url.pathname === '/api/invites' && req.method === 'POST') {
      if (who.role !== 'owner') return send(res, 403, {error: 'Only the workspace owner can invite people.'});
      const raw = token(), expires = Date.now() + INVITE_DAYS * 86400000;
      q('insert into invites (token_hash, workspace_id, created_by, expires_at) values (?, ?, ?, ?)').run(sha(raw), who.workspaceId, who.userId, expires);
      const base = publicUrl || `http://${req.headers.host}`;
      return send(res, 201, {url: `${base}/login.html?invite=${raw}`, expiresAt: new Date(expires).toISOString()});
    }
    return false;
  }
  return {session, publicRoutes, memberRoutes};
};
