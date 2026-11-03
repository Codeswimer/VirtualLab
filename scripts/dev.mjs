import { spawn } from 'node:child_process';

const apiPort = process.env.API_PORT ?? '4000';
const children = [];
let shuttingDown = false;

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  children.push(child);
  return child;
}

function stop(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}

const api = start(process.execPath, ['server/index.mjs'], { PORT: apiPort });
const web = start(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite']);

for (const child of [api, web]) {
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[vlab] A dev process exited with code ${code}.`);
      stop(code ?? 1);
    }
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
