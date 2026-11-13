import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trophyMeta } from '../utils/pricing.js';
import { backfillPaymentItems } from '../utils/duplicates.js';
import { defaultPolygon } from '../utils/geometry.js';
import { newLicenseNumber } from '../utils/license.js';
import { localNow } from '../utils/time.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const dataDir = path.join(root, 'database');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'vadasztarsasag.db'));
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export function initDb() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'vadasz' CHECK(role IN ('admin','vador','vadasz')),
    profile_image TEXT,
    phone TEXT,
    membership_date TEXT,
    status TEXT NOT NULL DEFAULT 'Aktív' CHECK(status IN ('Aktív','Inaktív')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS species (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    hunting_season TEXT,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS hunting_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    identifier TEXT NOT NULL,
    area_size INTEGER NOT NULL DEFAULT 0,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS area_species (
    area_id INTEGER NOT NULL,
    species_id INTEGER NOT NULL,
    PRIMARY KEY(area_id,species_id),
    FOREIGN KEY(area_id) REFERENCES hunting_areas(id) ON DELETE CASCADE,
    FOREIGN KEY(species_id) REFERENCES species(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS hunts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    area_id INTEGER NOT NULL,
    gamekeeper_id INTEGER,
    note TEXT,
    FOREIGN KEY(area_id) REFERENCES hunting_areas(id),
    FOREIGN KEY(gamekeeper_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS hunt_participants (
    hunt_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY(hunt_id,user_id),
    FOREIGN KEY(hunt_id) REFERENCES hunts(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS game_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hunter_id INTEGER NOT NULL,
    species_id INTEGER NOT NULL,
    area_id INTEGER NOT NULL,
    hunt_id INTEGER,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    gender TEXT NOT NULL,
    age_group TEXT NOT NULL,
    weight REAL NOT NULL,
    trophy_data TEXT,
    description TEXT,
    image TEXT,
    status TEXT NOT NULL DEFAULT 'Ellenőrzésre vár',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(hunter_id) REFERENCES users(id),
    FOREIGN KEY(species_id) REFERENCES species(id),
    FOREIGN KEY(area_id) REFERENCES hunting_areas(id),
    FOREIGN KEY(hunt_id) REFERENCES hunts(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS kill_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kill_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(kill_id) REFERENCES game_records(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS hunting_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hunter_id INTEGER NOT NULL,
    area_id INTEGER NOT NULL,
    start_datetime TEXT NOT NULL,
    planned_end_datetime TEXT NOT NULL,
    end_datetime TEXT,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Aktív' CHECK(status IN ('Aktív','Lezárt')),
    FOREIGN KEY(hunter_id) REFERENCES users(id),
    FOREIGN KEY(area_id) REFERENCES hunting_areas(id)
  );

  CREATE TABLE IF NOT EXISTS price_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    price_eur REAL,
    extra_eur REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    price_huf_fixed INTEGER,
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    payment_type TEXT NOT NULL,
    items_json TEXT,
    kill_id INTEGER,
    paypal_order_id TEXT,
    paypal_transaction_id TEXT,
    status TEXT NOT NULL DEFAULT 'Függőben' CHECK(status IN ('Függőben','Sikeres','Sikertelen','Visszatérítve')),
    payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(kill_id) REFERENCES game_records(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS log_participants (
    log_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY(log_id,user_id),
    FOREIGN KEY(log_id) REFERENCES hunting_log(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL UNIQUE,
    holder_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    billing_json TEXT,
    amount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Kiállítva' CHECK(status IN ('Kiállítva','Felhasználva')),
    user_id INTEGER,
    purchased_at TEXT DEFAULT CURRENT_TIMESTAMP,
    used_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS payment_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL,
    dup_key TEXT NOT NULL,
    FOREIGN KEY(payment_id) REFERENCES payments(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_payment_items_key ON payment_items(dup_key);
  `);
  migrate();
}

function addColumn(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}

function migrate() {

  addColumn('price_list', 'trophy_group', 'TEXT');
  addColumn('price_list', 'range_min', 'REAL');
  addColumn('price_list', 'range_max', 'REAL');
  addColumn('price_list', 'measure', 'TEXT');
  addColumn('price_list', 'unit_mult', 'REAL');

 
  addColumn('users', 'cover_image', 'TEXT');
  addColumn('users', 'bio', 'TEXT');
  addColumn('users', 'cover_x', 'INTEGER NOT NULL DEFAULT 50');
  addColumn('users', 'cover_y', 'INTEGER NOT NULL DEFAULT 50');
  addColumn('users', 'billing_json', 'TEXT');
  addColumn('payments', 'billing_json', 'TEXT');


  addColumn('game_records', 'trophy_value', 'REAL');
  addColumn('game_records', 'wounded', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('game_records', 'assessed_by', 'INTEGER');
  addColumn('game_records', 'assessed_at', 'TEXT');

  
  addColumn('hunting_log', 'kind', "TEXT NOT NULL DEFAULT 'Egyéni'");
  addColumn('hunting_log', 'name', 'TEXT');
  addColumn('hunting_log', 'gamekeeper_id', 'INTEGER');
  addColumn('hunting_log', 'note', 'TEXT');
  addColumn('game_records', 'log_id', 'INTEGER REFERENCES hunting_log(id) ON DELETE SET NULL');
  addColumn('hunts', 'log_id', 'INTEGER');

  
  addColumn('users', 'license_no', 'TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_license ON users(license_no) WHERE license_no IS NOT NULL');

 
  addColumn('hunting_areas', 'polygon_json', 'TEXT');
  addColumn('hunting_areas', 'color', 'TEXT');

  syncPriceMeta();
  backfillPaymentItems(db);
  placeAreasOnMap();
  mergeHuntsIntoLog();
  ensureLicenses();
}

function mergeHuntsIntoLog() {
  const hs = db.prepare('SELECT * FROM hunts WHERE log_id IS NULL').all();
  if (!hs.length) return;

  const fallback = db
    .prepare("SELECT id FROM users WHERE role IN ('vador','admin') ORDER BY role='vador' DESC,id LIMIT 1")
    .get()?.id;
  const now = localNow();

  const ins = db.prepare(
    "INSERT INTO hunting_log(hunter_id,area_id,start_datetime,planned_end_datetime,end_datetime,purpose,status,kind,name,gamekeeper_id,note) VALUES (?,?,?,?,?,?,?,'Közös',?,?,?)"
  );
  const parts = db.prepare('SELECT user_id FROM hunt_participants WHERE hunt_id=?');
  const addPart = db.prepare('INSERT OR IGNORE INTO log_participants(log_id,user_id) VALUES (?,?)');

  db.transaction(() => {
    for (const h of hs) {
      const hunter = h.gamekeeper_id || fallback;
      if (!hunter) continue;

      const start = `${h.date}T${h.start_time || '06:00'}`;
      const end = `${h.date}T${h.end_time || '12:00'}`;
      const past = end < now;

      const id = +ins.run(
        hunter,
        h.area_id,
        start,
        end,
        past ? end : null,
        h.name,
        past ? 'Lezárt' : 'Aktív',
        h.name,
        h.gamekeeper_id,
        h.note || ''
      ).lastInsertRowid;

      for (const p of parts.all(h.id)) addPart.run(id, p.user_id);

      db.prepare('UPDATE game_records SET log_id=? WHERE hunt_id=? AND log_id IS NULL').run(id, h.id);
      db.prepare('UPDATE hunts SET log_id=? WHERE id=?').run(id, h.id);
    }
  })();
}

export function ensureLicenses() {
  const users = db
    .prepare("SELECT id,name,email,phone,membership_date FROM users WHERE role='vadasz' AND license_no IS NULL")
    .all();
  const insLic = db.prepare(
    "INSERT INTO licenses(number,holder_name,email,phone,amount,status,user_id,purchased_at,used_at) VALUES (?,?,?,?,0,'Felhasználva',?,?,?)"
  );

  for (const u of users) {
    const number = newLicenseNumber(db);
    const since = `${u.membership_date || localNow().slice(0, 10)} 00:00:00`;
    insLic.run(number, u.name, u.email, u.phone || '', u.id, since, since);
    db.prepare('UPDATE users SET license_no=? WHERE id=?').run(number, u.id);
  }
}

function placeAreasOnMap() {
  const missing = db.prepare('SELECT id FROM hunting_areas WHERE polygon_json IS NULL ORDER BY id').all();
  if (!missing.length) return;

  const all = db.prepare('SELECT id FROM hunting_areas ORDER BY id').all().map(x => x.id);
  const up = db.prepare('UPDATE hunting_areas SET polygon_json=? WHERE id=?');

  for (const m of missing) up.run(JSON.stringify(defaultPolygon(all.indexOf(m.id))), m.id);
}

export function syncPriceMeta() {
  const upd = db.prepare(
    'UPDATE price_list SET trophy_group=?,range_min=?,range_max=?,measure=?,unit_mult=? WHERE id=?'
  );

  for (const p of db.prepare('SELECT id,category,name FROM price_list WHERE trophy_group IS NULL').all()) {
    const m = trophyMeta(p.category, p.name);
    if (m) upd.run(m.trophy_group, m.range_min, m.range_max, m.measure, m.unit_mult, p.id);
  }

  db.prepare(
    "UPDATE price_list SET price_huf_fixed=CAST(unit AS INTEGER),unit='db' WHERE category='Társasági díjak' AND price_huf_fixed IS NULL AND unit GLOB '[0-9]*'"
  ).run();
}