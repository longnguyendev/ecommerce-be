#!/usr/bin/env node
/**
 * Scaffold a new NestJS + Prisma + GraphQL foundation from assets/templates.
 *
 * Usage:
 *   node scripts/scaffold.mjs <target-dir> [--name package-name] [--title "..."] [--force]
 *
 * - Refuses to write into a non-empty directory unless --force is given.
 * - Never deletes existing files; --force may overwrite same-named templates.
 * - Does not install dependencies, run git, or touch any database.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(here, '../assets/templates');

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const flag = (name) => {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
};
const targetArg = argv.find((arg) => !arg.startsWith('--') && arg !== flag('--name') && arg !== flag('--title'));
const target = resolve(targetArg ?? '');
const name = flag('--name') ?? target.split('/').filter(Boolean).pop() ?? '';

if (!targetArg) {
  console.error('Usage: node scripts/scaffold.mjs <target-dir> [--name package-name] [--force]');
  process.exit(2);
}
if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
  console.error(`Invalid package name "${name}". Use kebab-case: my-service`);
  process.exit(2);
}

if (!existsSync(templatesDir)) {
  console.error(`Templates not found at ${templatesDir}`);
  process.exit(2);
}

if (existsSync(target)) {
  const entries = readdirSync(target).filter((entry) => entry !== '.DS_Store');
  if (entries.length > 0 && !force) {
    console.error(`Target directory is not empty: ${target}`);
    console.error('Pass --force to write into it (existing files are overwritten, not deleted).');
    process.exit(1);
  }
}

const title = flag('--title') ?? name;
const replacements = [
  ['{{PROJECT_NAME}}', name],
  ['{{PROJECT_TITLE}}', title],
];

let fileCount = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const source = join(dir, entry.name);
    const destination = join(target, relative(templatesDir, source));

    if (entry.isDirectory()) {
      mkdirSync(destination, { recursive: true });
      walk(source);
      continue;
    }
    if (!entry.isFile()) continue;

    mkdirSync(dirname(destination), { recursive: true });

    const isText = /\.(ts|js|mjs|json|md|yml|yaml|prisma|example|gitignore|dockerignore|prettierrc|env)$/.test(
      entry.name,
    ) || ['Dockerfile', '.gitignore', '.dockerignore', '.prettierrc', '.env.example'].includes(entry.name);

    if (!isText) {
      copyFileSync(source, destination);
      fileCount += 1;
      continue;
    }

    let content = readFileSync(source, 'utf8');
    for (const [token, value] of replacements) {
      content = content.split(token).join(value);
    }
    writeFileSync(destination, content);
    fileCount += 1;
  }
}

mkdirSync(target, { recursive: true });
walk(templatesDir);

const leftovers = [];
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(path);
      continue;
    }
    if (!statSync(path).isFile()) continue;
    if (readFileSync(path, 'utf8').includes('{{PROJECT_')) {
      leftovers.push(relative(target, path));
    }
  }
}
scan(target);

if (leftovers.length > 0) {
  console.error(`Unreplaced template tokens in: ${leftovers.join(', ')}`);
  process.exit(1);
}

console.log(`Scaffolded "${name}" at ${target} (${fileCount} files).`);
console.log('');
console.log('Next:');
console.log(`  cd ${target}`);
console.log('  cp .env.example .env      # fill in the JWT secrets');
console.log('  yarn install');
console.log('  docker compose up -d postgres redis');
console.log('  yarn db:migrate --name init');
console.log('  yarn db:seed');
console.log('  yarn start:dev');
