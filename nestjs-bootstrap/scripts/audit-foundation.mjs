#!/usr/bin/env node
/**
 * Foundation audit for the yung-chang-erp-be NestJS repo (read-only).
 *
 * Usage:
 *   node scripts/audit-foundation.mjs [path] [--json]
 *
 * Exit code: 0 = no HIGH findings, 1 = at least one HIGH, 2 = bad path.
 * Findings are heuristics — verify each one against references/audit.md
 * before reporting it to the user.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const target = argv.find((arg) => !arg.startsWith('--')) ?? '.';
const root = resolve(target);

if (!existsSync(join(root, 'package.json'))) {
  console.error(`Not a Node project: ${root}`);
  process.exit(2);
}

const at = (p) => join(root, p);
const exists = (p) => existsSync(at(p));
const read = (p) => (exists(p) ? readFileSync(at(p), 'utf8') : '');
const rel = (p) => relative(root, p);

function safeJson(p) {
  try {
    return JSON.parse(read(p));
  } catch {
    return {};
  }
}

const pkg = safeJson('package.json');
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

const findings = [];
const add = (severity, id, file, message, fix) =>
  findings.push({ severity, id, file, message, fix });

function walk(dir, acc = []) {
  const abs = at(dir);
  if (!existsSync(abs)) return acc;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'coverage'].includes(entry.name)) continue;
    const child = join(dir, entry.name);
    if (entry.isDirectory()) walk(child, acc);
    else if (entry.isFile()) acc.push(child);
  }
  return acc;
}

const srcFiles = walk('src');
const moduleFiles = srcFiles.filter((p) => p.endsWith('.module.ts'));
const readSrc = (p) => read(p);

// ---------------------------------------------------------------- 1. Prisma
const prismaProviderModules = moduleFiles.filter((file) => {
  if (/prisma\.module\.ts$/.test(file)) return false;
  const block = readSrc(file).match(/providers\s*:\s*\[([\s\S]*?)\]/);
  return Boolean(block && /\bPrismaService\b/.test(block[1]));
});
if (prismaProviderModules.length > 1) {
  add(
    'HIGH',
    'PRISMA_MULTI_INSTANCE',
    rel(prismaProviderModules[0]),
    `PrismaService is provided by ${prismaProviderModules.length} modules → ${prismaProviderModules.length} PrismaClient/pg.Pool instances`,
    'references/recipes.md R1',
  );
}

const prismaServiceFile =
  srcFiles.find((p) => /prisma\.service\.ts$/.test(p)) ?? null;
if (prismaServiceFile) {
  const service = readSrc(prismaServiceFile);
  if (!/\$connect/.test(service) || !/\$disconnect/.test(service)) {
    add(
      'MEDIUM',
      'PRISMA_LIFECYCLE',
      rel(prismaServiceFile),
      'PrismaService has no $connect/$disconnect lifecycle hooks',
      'references/recipes.md R1',
    );
  }
} else {
  add('HIGH', 'PRISMA_MISSING', 'src', 'No PrismaService file found', 'references/prisma.md');
}

// ------------------------------------------------------- 2. Build layout
const buildConfig = safeJson('tsconfig.build.json');
const excludes = Array.isArray(buildConfig.exclude) ? buildConfig.exclude : [];
if (exists('tsconfig.build.json') && !excludes.some((e) => /^\.?\/?prisma\/?$/.test(e))) {
  add(
    'HIGH',
    'BUILD_LAYOUT',
    'tsconfig.build.json',
    'prisma/ is not excluded → tsc rootDir becomes the project root and emits dist/src/main.js',
    'references/recipes.md R2',
  );
}
if (exists('dist') && !exists('dist/main.js')) {
  add(
    'HIGH',
    'BUILD_LAYOUT_DIST',
    'dist',
    exists('dist/src/main.js')
      ? 'dist/src/main.js exists, dist/main.js does not → `yarn start:prod` fails'
      : 'dist exists but dist/main.js is missing',
    'references/recipes.md R2',
  );
}

// --------------------------------------------------------- 3. Git hygiene
function gitLsFiles() {
  try {
    return execFileSync('git', ['ls-files'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\n')
      .filter(Boolean);
  } catch {
    return null;
  }
}
const tracked = gitLsFiles();
if (tracked) {
  const generated = tracked.filter((p) => p.startsWith('src/generated/'));
  if (generated.length > 0) {
    add(
      'HIGH',
      'GENERATED_TRACKED',
      'src/generated',
      `${generated.length} generated Prisma files are tracked by git → noisy diffs, manual edits risk`,
      'references/audit.md ARTIFACT_TRACKED',
    );
  }
  for (const artifact of ['src.zip', 'src/schema.gql']) {
    if (tracked.includes(artifact)) {
      add(
        'LOW',
        'ARTIFACT_TRACKED',
        artifact,
        'Build/editor artifact is committed',
        'references/audit.md ARTIFACT_TRACKED',
      );
    }
  }
  if (tracked.some((p) => p.startsWith('dist/'))) {
    add('MEDIUM', 'ARTIFACT_TRACKED', 'dist', 'Compiled output is tracked by git', 'references/audit.md');
  }
}

const gitignore = read('.gitignore');
if (/^\/generated\/prisma/m.test(gitignore) && exists('src/generated/prisma')) {
  add(
    'HIGH',
    'GITIGNORE_MISMATCH',
    '.gitignore',
    'Rule `/generated/prisma` does not match `src/generated/prisma`',
    'references/audit.md GITIGNORE_MISMATCH',
  );
}

// -------------------------------------------------------- 4. Error shape
const filterFile = srcFiles.find((p) => /all-exception\.filter\.ts$/.test(p));
if (filterFile) {
  const filter = readSrc(filterFile);
  if (/catch\s*\([\s\S]*?throw\s+new\b/.test(filter)) {
    add(
      'HIGH',
      'FILTER_THROWS',
      rel(filterFile),
      'Exception filter throws inside catch instead of responding/logging',
      'assets/snippets/all-exception.filter.ts',
    );
  }
}

const gqlConfigFile = srcFiles.find((p) => /gql-config\.service\.ts$/.test(p));
if (gqlConfigFile) {
  const gql = readSrc(gqlConfigFile);
  if (/\.\.\.error\.extensions/.test(gql) || /\.\.\.extensions/.test(gql)) {
    add(
      'HIGH',
      'ERROR_LEAK',
      rel(gqlConfigFile),
      'formatError spreads all extensions → stack/originalError can reach clients',
      'assets/snippets/gql-error-format.ts',
    );
  }
  if (!/includeStacktraceInErrorResponses/.test(gql)) {
    add(
      'MEDIUM',
      'ERROR_LEAK_STACK',
      rel(gqlConfigFile),
      'includeStacktraceInErrorResponses is not set to false',
      'references/errors.md',
    );
  }
}

// ------------------------------------------------------------- 5. Config
const configFiles = srcFiles.filter(
  (p) => /common\/config\/.+\.config\.ts$/.test(p) && !/app\.config\.ts$/.test(p),
);
const appModule = read('src/app.module.ts');
const loadBlock = appModule.match(/load\s*:\s*\[([\s\S]*?)\]/);
const importedConfigs = new Map();
for (const match of appModule.matchAll(
  /import\s+(\w+)\s+from\s+['"][^'"]*\/([\w-]+)\.config(?:\.ts)?['"]/g,
)) {
  importedConfigs.set(match[2], match[1]);
}

const namespaces = [];
for (const file of configFiles) {
  const source = readSrc(file);
  const ns = source.match(/registerAs(?:<[^>]*>)?\(\s*['"]([\w-]+)['"]/)?.[1];
  const base = file.split('/').pop().replace(/\.config\.ts$/, '');
  const identifier = importedConfigs.get(base);
  const loaded = Boolean(loadBlock && identifier && loadBlock[1].includes(identifier));
  namespaces.push({ file, base, ns, identifier, loaded });
}
for (const ns of namespaces) {
  if (!ns.loaded) {
    add(
      'HIGH',
      'CONFIG_NOT_LOADED',
      rel(ns.file),
      ns.identifier
        ? `Config "${ns.ns ?? ns.base}" is imported but missing from AppModule.load → get() returns undefined`
        : `Config "${ns.ns ?? ns.base}" is never imported by AppModule.load`,
      'references/config.md',
    );
  }
}

const envTemplate = exists('.env.example')
  ? read('.env.example')
  : exists('.env.exaple')
    ? read('.env.exaple')
    : '';
if (!envTemplate) {
  add('HIGH', 'ENV_TEMPLATE', '.env.example', 'No env template found', 'assets/snippets/env.example');
} else {
  const used = new Set(['DATABASE_URL']);
  for (const file of [...configFiles, ...srcFiles.filter((p) => /src\/core\//.test(p))]) {
    for (const match of readSrc(file).matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) {
      used.add(match[1]);
    }
    for (const match of readSrc(file).matchAll(/^\s{2}([A-Z][A-Z0-9_]+)!:/gm)) {
      used.add(match[1]);
    }
  }
  const declared = new Set(
    [...envTemplate.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]+)\s*=/gm)].map((m) => m[1]),
  );
  const missing = [...used].filter((key) => !declared.has(key));
  if (missing.length > 0) {
    add(
      'HIGH',
      'ENV_TEMPLATE',
      exists('.env.example') ? '.env.example' : '.env.exaple',
      `Missing keys in template: ${missing.join(', ')}`,
      'references/config.md',
    );
  }
}

// ------------------------------------------------------------- 6. Runtime
const main = read('src/main.ts');
if (/process\.env\.PORT/.test(main)) {
  add(
    'MEDIUM',
    'PORT_MISMATCH',
    'src/main.ts',
    'Uses process.env.PORT while config exposes server.port (APP_PORT)',
    'assets/snippets/main.ts',
  );
}
if (!/enableShutdownHooks/.test(main)) {
  add(
    'MEDIUM',
    'NO_SHUTDOWN_HOOKS',
    'src/main.ts',
    'enableShutdownHooks() is missing → Prisma/Redis sockets leak on restart',
    'assets/snippets/main.ts',
  );
}

const serverConfig = srcFiles.find((p) => /server\.config\.ts$|sever\.config\.ts$/.test(p));
if (serverConfig) {
  const source = readSrc(serverConfig);
  if (/NODE_ENV/.test(source) && !/@IsEnum/.test(source)) {
    add(
      'MEDIUM',
      'NODE_ENV_NOT_ENUM',
      rel(serverConfig),
      'NODE_ENV is validated as a plain string → a typo silently disables hardening',
      'references/config.md',
    );
  }
}

const jwtConfig = srcFiles.find((p) => /jwt\.config\.ts$/.test(p));
if (jwtConfig && !/@MinLength/.test(readSrc(jwtConfig))) {
  add(
    'MEDIUM',
    'SECRET_WEAK',
    rel(jwtConfig),
    'JWT secrets have no minimum length validation',
    'references/config.md',
  );
}

const healthFile = srcFiles.find((p) => /\.controller\.ts$/.test(p) && /health/.test(read(p)));
if (!healthFile) {
  add(
    'MEDIUM',
    'NO_HEALTH',
    'src',
    'No health controller (GET /health) → orchestrators cannot probe the app',
    'assets/snippets/health.controller.ts',
  );
}

const paginationFile = srcFiles.find((p) => /pagination\.args\.ts$/.test(p));
if (paginationFile) {
  const source = readSrc(paginationFile);
  if (/take\??:\s*number/.test(source) && !/@Max\(/.test(source)) {
    add(
      'MEDIUM',
      'PAGINATION_UNBOUNDED',
      rel(paginationFile),
      'take has no @Max → a client can request the whole table',
      'references/audit.md',
    );
  }
}

const redisService = srcFiles.find((p) => /redis\.service\.ts$/.test(p));
if (redisService && !/onModuleDestroy|\bquit\(|disconnect\(/.test(readSrc(redisService))) {
  add(
    'MEDIUM',
    'REDIS_NO_QUIT',
    rel(redisService),
    'Redis connection is never closed on shutdown',
    'references/core.md',
  );
}

// ------------------------------------------------------------- 7. Docker
const dockerfile = read('Dockerfile');
if (dockerfile) {
  const copyIndex = dockerfile.search(/^COPY\s+\.\s+\.\s*$/m);
  const installIndex = dockerfile.search(/^RUN\s+.*(npm|yarn|pnpm)\s+install/m);
  if (copyIndex !== -1 && installIndex !== -1 && copyIndex < installIndex) {
    add(
      'MEDIUM',
      'DOCKER_COPY_ORDER',
      'Dockerfile',
      'COPY . . before dependency install → the dependency layer is rebuilt on every code change',
      'assets/snippets/Dockerfile',
    );
  }
  if (/npm\s+install/.test(dockerfile) && exists('yarn.lock')) {
    add(
      'MEDIUM',
      'DOCKER_PM_MISMATCH',
      'Dockerfile',
      'npm install is used while the repo locks dependencies with yarn.lock',
      'assets/snippets/Dockerfile',
    );
  }
  if (!/^USER\s+/m.test(dockerfile)) {
    add('LOW', 'DOCKER_ROOT', 'Dockerfile', 'Final image runs as root', 'assets/snippets/Dockerfile');
  }
}

const compose = read('docker-compose.yml');
if (compose) {
  if (/\n\s*-\s*\.\/:[^\n]*/.test(compose)) {
    add(
      'MEDIUM',
      'COMPOSE_MOUNT',
      'docker-compose.yml',
      'Source bind mount hides the image node_modules (fresh clone breaks)',
      'assets/snippets/docker-compose.yml',
    );
  }
  if (/:latest\b/.test(compose)) {
    add('LOW', 'DOCKER_LATEST_TAG', 'docker-compose.yml', 'Image tag `latest` is not reproducible', 'assets/snippets/docker-compose.yml');
  }
}

const dockerignore = read('.dockerignore');
if (!/node_modules/.test(dockerignore)) {
  add('LOW', 'DOCKERIGNORE_MODULES', '.dockerignore', 'node_modules is not ignored in the build context', 'references/recipes.md R6');
}

// --------------------------------------------------------------- 8. CI
if (!exists('.github/workflows')) {
  add(
    'MEDIUM',
    'NO_CI',
    '.github/workflows',
    'No CI pipeline (lint, typecheck, test, prisma migrate diff)',
    'references/recipes.md R6',
  );
}

// ------------------------------------------------------- 9. Dead code
for (const ns of namespaces) {
  if (!ns.ns) continue;
  const consumed = srcFiles.some((file) => {
    if (file.endsWith(`/${ns.base}.config.ts`)) return false;
    if (/common\/config\/.+\.config\.ts$/.test(file)) return false;
    const source = readSrc(file);
    return (
      source.includes(`'${ns.ns}.`) ||
      source.includes(`"${ns.ns}.`) ||
      source.includes(`'${ns.ns}'`) ||
      source.includes(`"${ns.ns}"`) ||
      source.includes(`'${ns.ns}',`) ||
      source.includes(`"${ns.ns}",`)
    );
  });
  if (!consumed && ns.loaded) {
    add(
      'LOW',
      'DEAD_NAMESPACE',
      rel(ns.file),
      `Config namespace "${ns.ns}" is loaded but never read`,
      'references/config.md',
    );
  }
}

const baseService = srcFiles.find((p) => /base\.service\.ts$/.test(p));
if (baseService) {
  const used = srcFiles.some(
    (file) => file !== baseService && readSrc(file).includes('BaseService'),
  );
  if (!used) {
    add('LOW', 'BASE_SERVICE_UNUSED', rel(baseService), 'Abstract BaseService is not extended by any service', 'references/audit.md');
  }
}

if (exists('.env.exaple') && !exists('.env.example')) {
  add('LOW', 'ENV_EXAMPLE_TYPO', '.env.exaple', 'Env template filename is misspelled', 'references/config.md');
}

// ------------------------------------------------------------- 10. Report
const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity]);

const stack = {
  nest: deps['@nestjs/core'] ?? '?',
  prisma: deps.prisma ?? '?',
  nestGraphql: deps['@nestjs/graphql'] ?? '?',
  apollo: deps['@apollo/server'] ?? '?',
};

if (asJson) {
  console.log(
    JSON.stringify(
      {
        root,
        stack,
        summary: {
          high: findings.filter((x) => x.severity === 'HIGH').length,
          medium: findings.filter((x) => x.severity === 'MEDIUM').length,
          low: findings.filter((x) => x.severity === 'LOW').length,
        },
        findings,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`\nFoundation audit — ${root}`);
  console.log(
    `Stack: nest ${stack.nest} · prisma ${stack.prisma} · nest-graphql ${stack.nestGraphql} · apollo ${stack.apollo}\n`,
  );

  for (const severity of ['HIGH', 'MEDIUM', 'LOW']) {
    const group = findings.filter((x) => x.severity === severity);
    if (group.length === 0) continue;
    console.log(`${severity} (${group.length})`);
    for (const f of group) {
      console.log(`  [${f.id}] ${f.file}`);
      console.log(`    ${f.message}`);
      console.log(`    fix: ${f.fix}`);
    }
    console.log('');
  }

  const count = (severity) =>
    findings.filter((x) => x.severity === severity).length;
  console.log(
    `Summary: HIGH ${count('HIGH')} · MEDIUM ${count('MEDIUM')} · LOW ${count('LOW')}`,
  );
  console.log(
    'Heuristics only — verify each finding against references/audit.md before reporting.\n',
  );
}

process.exit(findings.some((x) => x.severity === 'HIGH') ? 1 : 0);
