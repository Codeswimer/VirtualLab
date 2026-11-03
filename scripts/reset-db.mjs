import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetDatabaseFile } from '../server/db.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databasePath =
  process.env.DB_PATH ??
  path.join(process.env.DATA_DIR ?? path.join(root, 'server', 'data'), 'vlab.db');

resetDatabaseFile(databasePath);
console.log(`[vlab] Removed ${databasePath}. Restart the server to reseed the demo school network.`);
