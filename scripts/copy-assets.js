import fs from 'node:fs';
import path from 'node:path';

const migrationsSrc = path.join(process.cwd(), 'server', 'db', 'migrations');
const migrationsDest = path.join(process.cwd(), 'dist', 'migrations');

if (fs.existsSync(migrationsSrc)) {
  fs.mkdirSync(migrationsDest, { recursive: true });
  fs.cpSync(migrationsSrc, migrationsDest, { recursive: true });
  console.log(`[Build] Copied migrations to ${migrationsDest}`);
}
