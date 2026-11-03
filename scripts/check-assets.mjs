import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');

console.log('[vlab] Verifying asset bundle in public/ ...');

const requiredFiles = [
  'favicon.svg',
  'apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

let missing = 0;
for (const rel of requiredFiles) {
  const full = path.join(publicDir, rel);
  if (!fs.existsSync(full)) {
    console.warn(`[vlab] Missing asset: public/${rel}`);
    missing += 1;
  }
}

if (missing === 0) {
  console.log('[vlab] All core assets present.');
} else {
  console.log(`[vlab] ${missing} assets missing.`);
}
