import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Load .env.test explicitly ─────────────────────────────────────────────────
// Bun (and Node) never override an env var that is already set in the shell
// environment. Since DATABASE_URL is exported in the shell, we must forcibly
// apply every key from .env.test here — before any module that consumes
// process.env.DATABASE_URL is first imported by a test file.
const envTestPath = resolve(import.meta.dir, '../.env.test');
const envTestContent = readFileSync(envTestPath, 'utf-8');

for (const line of envTestContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex).trim();
  const value = trimmed.slice(eqIndex + 1).trim();
  process.env[key] = value;
}

// ── Run migrations against the test database ──────────────────────────────────
try {
  execSync('bunx --bun prisma migrate deploy', {
    env: process.env, // carries the overridden DATABASE_URL from .env.test
    stdio: 'pipe',
  });
} catch (e) {
  console.error('Migration failed:', e);
  process.exit(1);
}
