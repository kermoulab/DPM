import fs from 'node:fs';

const targets = ['dist', 'server.js'];
for (const target of targets) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch (err) {
    console.error(`Failed to remove ${target}:`, err);
  }
}
