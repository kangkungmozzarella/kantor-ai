// SQLite storage (built into Node 22): accounts, workspaces, sessions, invites, daily AI usage,
// and each workspace's task list. Tasks keep their JSON shape; each one is a row in its workspace.
const {DatabaseSync} = require('node:sqlite');

const SCHEMA = `
pragma journal_mode = wal;
pragma foreign_keys = on;
create table if not exists users (id text primary key, email text unique not null, name text not null, password text not null, created_at text not null);
create table if not exists workspaces (id text primary key, name text not null, created_at text not null);
create table if not exists members (workspace_id text not null references workspaces(id) on delete cascade, user_id text not null references users(id) on delete cascade, role text not null, created_at text not null, primary key (workspace_id, user_id));
create table if not exists sessions (token_hash text primary key, user_id text not null references users(id) on delete cascade, workspace_id text not null references workspaces(id) on delete cascade, expires_at integer not null);
create table if not exists invites (token_hash text primary key, workspace_id text not null references workspaces(id) on delete cascade, created_by text not null, expires_at integer not null, used_by text);
create table if not exists tasks (id text primary key, workspace_id text not null references workspaces(id) on delete cascade, position integer not null, data text not null);
create index if not exists tasks_by_workspace on tasks (workspace_id, position);
create table if not exists usage (workspace_id text not null references workspaces(id) on delete cascade, day text not null, requests integer not null, primary key (workspace_id, day));
`;

function open(file) {
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  const q = sql => db.prepare(sql);
  const clear = q('delete from tasks where workspace_id = ?'), insert = q('insert into tasks (id, workspace_id, position, data) values (?, ?, ?, ?)');
  const spaces = new Map();
  // One in-memory task list per workspace, loaded on first use. save() writes the whole list in one
  // transaction; if that fails the list goes back to what was last saved, so memory never runs ahead of disk.
  function space(id) {
    if (spaces.has(id)) return spaces.get(id);
    const tasks = q('select data from tasks where workspace_id = ? order by position').all(id).map(row => JSON.parse(row.data));
    const s = {id, tasks, durable: JSON.stringify(tasks), busy: new Set()};
    s.save = () => {
      try {
        db.exec('begin');
        clear.run(id); s.tasks.forEach((task, i) => insert.run(task.id, id, i, JSON.stringify(task)));
        db.exec('commit'); s.durable = JSON.stringify(s.tasks);
      } catch (error) {
        try { db.exec('rollback'); } catch { /* the transaction never started */ }
        s.tasks.splice(0, s.tasks.length, ...JSON.parse(s.durable)); throw error;
      }
    };
    spaces.set(id, s); return s;
  }
  const transaction = fn => { db.exec('begin'); try { const value = fn(); db.exec('commit'); return value; } catch (error) { db.exec('rollback'); throw error; } };
  return {db, q, space, transaction, workspaceIds: () => q('select id from workspaces').all().map(row => row.id)};
}

module.exports = {open};
