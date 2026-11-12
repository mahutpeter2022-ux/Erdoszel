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