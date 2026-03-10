import Database from 'better-sqlite3';

const db = new Database('store/messages.db');

db.prepare(`
  INSERT OR REPLACE INTO registered_groups
  (jid, name, folder, trigger_pattern, added_at, requires_trigger)
  VALUES (?, ?, ?, ?, ?, ?)
`).run('tg:6096574866', 'Alex', 'main', '@Andy', new Date().toISOString(), 0);

const rows = db.prepare('SELECT * FROM registered_groups').all();
console.log('Registered groups:', JSON.stringify(rows, null, 2));

db.close();
console.log('Done! Group registered successfully.');
