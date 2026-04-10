#!/usr/bin/env bun
/**
 * update-changelog.ts
 *
 * Prepends a new CHANGELOG.md entry for the current package.json version.
 * Reads git commits since the last tag, groups them into Added / Fixed / Changed,
 * and inserts the entry after the CHANGELOG header.
 *
 * Usage (standalone):  bun run scripts/update-changelog.ts
 * Usage (via version script): called automatically before git commit
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// ── Helpers ─────────────────────────────────────────────────────────────────

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Read current version ─────────────────────────────────────────────────────

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const version: string = pkg.version;
const today = new Date().toISOString().split('T')[0];

// ── Determine commit range ────────────────────────────────────────────────────

// The last tag is the previous release — commits after it are the new ones.
const lastTag = run('git describe --abbrev=0 --tags 2>/dev/null');
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';

const rawLog = run(`git log --oneline "${range}"`);

if (!rawLog) {
  console.log(`ℹ️  No commits found since ${lastTag || 'beginning'}. CHANGELOG.md unchanged.`);
  process.exit(0);
}

// ── Parse commits into categories ────────────────────────────────────────────

// Conventional commit pattern: <type>(<scope>?): <message>
const commitPattern = /^[a-f0-9]+\s+(feat|fix|docs|refactor|perf|style|test)(?:\([^)]+\))?:\s+(.+)$/;

const added: string[] = [];
const fixed: string[] = [];
const changed: string[] = [];

for (const line of rawLog.split('\n')) {
  const match = line.match(commitPattern);
  if (!match) continue;

  const [, type, message] = match;
  const entry = `- ${capitalize(message)}`;

  switch (type) {
    case 'feat':
      added.push(entry);
      break;
    case 'fix':
      fixed.push(entry);
      break;
    case 'docs':
    case 'refactor':
    case 'perf':
    case 'style':
      changed.push(entry);
      break;
    // 'test' intentionally omitted from user-facing changelog
  }
}

if (added.length === 0 && fixed.length === 0 && changed.length === 0) {
  console.log(`ℹ️  No notable changes found since ${lastTag || 'beginning'}. CHANGELOG.md unchanged.`);
  process.exit(0);
}

// ── Build new entry ───────────────────────────────────────────────────────────

let newEntry = `## [${version}] - ${today}\n\n`;
if (added.length)   newEntry += `### Added\n${added.join('\n')}\n\n`;
if (fixed.length)   newEntry += `### Fixed\n${fixed.join('\n')}\n\n`;
if (changed.length) newEntry += `### Changed\n${changed.join('\n')}\n\n`;
newEntry = newEntry.trimEnd();

// ── Splice into CHANGELOG.md ──────────────────────────────────────────────────

const changelogPath = 'CHANGELOG.md';
let existing: string;

try {
  existing = readFileSync(changelogPath, 'utf-8');
} catch {
  existing = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n';
}

// Insert after the header block (before the first ## version entry)
const firstVersionIndex = existing.indexOf('\n## [');
if (firstVersionIndex === -1) {
  writeFileSync(changelogPath, existing.trimEnd() + '\n\n' + newEntry + '\n');
} else {
  const before = existing.slice(0, firstVersionIndex);
  const after = existing.slice(firstVersionIndex);
  writeFileSync(changelogPath, before + '\n\n' + newEntry + '\n' + after);
}

console.log(`✅  CHANGELOG.md updated — added entry for v${version}`);
