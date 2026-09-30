import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';

const run = promisify(execFile);
const rootFlag = process.argv.indexOf('--root');
const root = resolve(rootFlag >= 0 ? process.argv[rootFlag + 1] : process.cwd());
const ignoredDirectories = new Set(['.git', 'node_modules', 'coverage', 'dist']);
const textExtensions = new Set([
  '', '.cjs', '.conf', '.config', '.css', '.csv', '.cts', '.html', '.ini', '.js',
  '.json', '.lock', '.md', '.mjs', '.mts', '.properties', '.ps1', '.py', '.rb',
  '.sh', '.sql', '.svg', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yml', '.yaml',
]);
const blockedFiles = new Set([
  '.env', '.netrc', '.npmrc', '.pypirc', 'credentials.json', 'service-account.json',
  'id_rsa', 'id_ed25519',
]);
const allowedEmails = new Set(['security@example.com']);

const privateKeyMarker = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
const githubPrefix = ['github', '_pat_'].join('');
const openAiPrefix = ['sk', '-'].join('');
const huggingFacePrefix = ['hf', '_'].join('');
const googlePrefix = ['AI', 'za'].join('');
const slackHost = ['hooks', '.slack.com/services/'].join('');
const suffixLabel = ['last', '4'].join('');

const rules = [
  ['private-key', new RegExp(privateKeyMarker, 'i')],
  ['aws-access-key', /AKIA[0-9A-Z]{16}/],
  ['github-token', new RegExp(`(?:gh[pousr]_[A-Za-z0-9_]{36,}|${githubPrefix}[A-Za-z0-9_]{22,})`)],
  ['openai-token', new RegExp(`${openAiPrefix}[A-Za-z0-9_-]{20,}`)],
  ['hugging-face-token', new RegExp(`${huggingFacePrefix}[A-Za-z0-9]{20,}`)],
  ['google-api-key', new RegExp(`${googlePrefix}[A-Za-z0-9_-]{30,}`)],
  ['stripe-secret', new RegExp(`s${'k'}_(?:live|test)_[A-Za-z0-9]{16,}`)],
  ['slack-token', new RegExp(`xox[baprs]-[A-Za-z0-9-]{16,}`)],
  ['telegram-bot-token', /\b\d{6,12}:[A-Za-z0-9_-]{25,}\b/],
  ['jwt', /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/],
  ['slack-webhook', new RegExp(`https://${slackHost}[A-Za-z0-9/_-]+`, 'i')],
  ['connection-string', /\b(?:postgres|mysql|mongodb|redis):\/\/[^\s'"<>]+/i],
  ['credential-assignment', /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password)\s*[:=]\s*['"]?[^\s'";,}]{8,}/i],
  ['windows-user-path', /[A-Za-z]:\\Users\\[^\\\s]+/],
  ['unix-user-path', /(?:\/home|\/Users)\/[^/\s]+/],
  ['private-ip', /\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3})\b/],
  ['key-suffix-label', new RegExp(`\\b${suffixLabel}\\b`, 'i')],
];

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      files.push({ path: resolve(directory, entry.name), unsafeType: 'symbolic-link' });
      continue;
    }
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await collect(resolve(directory, entry.name)));
      continue;
    }
    files.push({ path: resolve(directory, entry.name) });
  }
  return files;
}

function scanText(path, content) {
  const findings = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const emails = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    for (const email of emails) {
      if (!allowedEmails.has(email.toLowerCase()) && !email.toLowerCase().endsWith('@example.com')) {
        findings.push({ path, line: index + 1, rule: 'personal-email' });
      }
    }
    for (const [rule, pattern] of rules) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) findings.push({ path, line: index + 1, rule });
    }
  }
  return findings;
}

async function scanHistory() {
  const historyFindings = [];
  let commits;
  try {
    const result = await run('git', ['rev-list', '--all'], { cwd: root, encoding: 'utf8' });
    commits = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  } catch {
    return [{ path: '.git', line: 0, rule: 'history-scan-unavailable' }];
  }

  for (const commit of commits) {
    const metadata = await run('git', [
      'show', '-s', '--format=%H%n%an%n%ae%n%cn%n%ce%n%B', commit,
    ], { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 });
    historyFindings.push(...scanText(`history-metadata:${commit.slice(0, 12)}`, metadata.stdout));
    const tree = await run('git', ['ls-tree', '-r', '--name-only', '-z', commit], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    for (const path of tree.stdout.split('\0').filter(Boolean)) {
      const basename = path.split('/').at(-1);
      if (blockedFiles.has(basename)
          || (basename.startsWith('.env.') && basename !== '.env.example')
          || /\.(?:jsonl|log|map|pem|key|p12|pfx)$/i.test(basename)) {
        historyFindings.push({ path: `history:${commit.slice(0, 12)}:${path}`, line: 0, rule: 'blocked-file' });
        continue;
      }
      if (!textExtensions.has(extname(path).toLowerCase())) continue;
      try {
        const blob = await run('git', ['show', `${commit}:${path}`], {
          cwd: root,
          encoding: 'utf8',
          maxBuffer: 2 * 1024 * 1024,
        });
        historyFindings.push(...scanText(`history:${commit.slice(0, 12)}:${path}`, blob.stdout));
      } catch {
        historyFindings.push({ path: `history:${commit.slice(0, 12)}:${path}`, line: 0, rule: 'unreadable-history-file' });
      }
    }

    const modes = await run('git', ['ls-tree', '-r', '-z', commit], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    for (const entry of modes.stdout.split('\0').filter(Boolean)) {
      const match = entry.match(/^(\d+)\s+\w+\s+[0-9a-f]+\t(.+)$/);
      if (match?.[1] === '120000') {
        historyFindings.push({ path: `history:${commit.slice(0, 12)}:${match[2]}`, line: 0, rule: 'symbolic-link' });
      }
    }
  }

  let unreachable = '';
  try {
    const result = await run('git', ['fsck', '--unreachable', '--no-reflogs', '--full'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    unreachable = `${result.stdout}\n${result.stderr}`;
  } catch (error) {
    unreachable = `${error.stdout ?? ''}\n${error.stderr ?? ''}`;
    if (!unreachable.trim()) {
      historyFindings.push({ path: '.git', line: 0, rule: 'unreachable-scan-unavailable' });
    }
  }
  const objects = [...unreachable.matchAll(/(?:unreachable|dangling)\s+(commit|blob|tag)\s+([0-9a-f]{40,64})/g)];
  for (const [, type, hash] of objects) {
    try {
      const size = await run('git', ['cat-file', '-s', hash], { cwd: root, encoding: 'utf8' });
      if (Number(size.stdout.trim()) > 2 * 1024 * 1024) {
        historyFindings.push({ path: `git-object:${type}:${hash.slice(0, 12)}`, line: 0, rule: 'oversized-unreachable-object' });
        continue;
      }
      const object = await run('git', ['cat-file', '-p', hash], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 2 * 1024 * 1024,
      });
      historyFindings.push(...scanText(`git-object:${type}:${hash.slice(0, 12)}`, object.stdout));
      if (type === 'commit') {
        const tree = await run('git', ['ls-tree', '-r', '-z', hash], {
          cwd: root,
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024,
        });
        for (const entry of tree.stdout.split('\0').filter(Boolean)) {
          const match = entry.match(/^(\d+)\s+\w+\s+[0-9a-f]+\t(.+)$/);
          if (match?.[1] === '120000') {
            historyFindings.push({ path: `git-object:${hash.slice(0, 12)}:${match[2]}`, line: 0, rule: 'symbolic-link' });
          }
        }
      }
    } catch {
      historyFindings.push({ path: `git-object:${type}:${hash.slice(0, 12)}`, line: 0, rule: 'unreadable-git-object' });
    }
  }
  return historyFindings;
}

const findings = [];
for (const file of await collect(root)) {
  const display = relative(root, file.path).replaceAll('\\', '/');
  const basename = display.split('/').at(-1);
  if (file.unsafeType) {
    findings.push({ path: display, line: 0, rule: file.unsafeType });
    continue;
  }
  const blockedEnvironment = basename === '.env'
    || (basename.startsWith('.env.') && basename !== '.env.example');
  if (blockedEnvironment
      || blockedFiles.has(basename)
      || /\.(?:jsonl|log|map|pem|key|p12|pfx)$/i.test(basename)) {
    findings.push({ path: display, line: 0, rule: 'blocked-file' });
    continue;
  }
  if (!textExtensions.has(extname(display).toLowerCase())) continue;
  const content = await readFile(file.path, 'utf8');
  findings.push(...scanText(display, content));
}
findings.push(...await scanHistory());

if (findings.length > 0) {
  process.stderr.write(`PRIVACY SCAN FAILED (${findings.length} finding(s))\n`);
  for (const finding of findings) {
    process.stderr.write(`${finding.path}:${finding.line} ${finding.rule}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write('PRIVACY SCAN PASS\n');
}
