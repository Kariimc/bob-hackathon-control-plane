import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const run = promisify(execFile);
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const scanner = join(projectRoot, 'tools', 'privacy-scan.mjs');

async function git(cwd, args, identity = {}) {
  return run('git', [
    '-c', `user.name=${identity.name ?? 'Test User'}`,
    '-c', `user.email=${identity.email ?? 'test@example.com'}`,
    ...args,
  ], { cwd });
}

test('privacy scan finds a private path removed from the working tree but retained in Git history', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'bob-privacy-scan-'));
  try {
    await git(fixture, ['init', '-q']);
    await writeFile(join(fixture, 'config.txt'), 'workspace=C:\\Users\\NamedPerson\\PrivateProject\n');
    await git(fixture, ['add', 'config.txt']);
    await git(fixture, ['commit', '-qm', 'seed unsafe history']);
    await writeFile(join(fixture, 'config.txt'), 'token=example-only\n');
    await git(fixture, ['add', 'config.txt']);
    await git(fixture, ['commit', '-qm', 'remove working-tree secret']);

    await assert.rejects(
      run(process.execPath, [scanner, '--root', fixture], { cwd: fixture }),
      (error) => error.code === 1
        && /PRIVACY SCAN FAILED/.test(error.stderr)
        && /history:.*windows-user-path/.test(error.stderr),
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('privacy scan checks commit identity and message metadata', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'bob-privacy-metadata-'));
  try {
    await git(fixture, ['init', '-q']);
    await writeFile(join(fixture, 'safe.txt'), 'generic fixture\n');
    await git(fixture, ['add', 'safe.txt']);
    await git(fixture, ['commit', '-qm', 'safe file'], {
      name: 'Private Person',
      email: ['private.person', 'example.org'].join('@'),
    });

    await assert.rejects(
      run(process.execPath, [scanner, '--root', fixture], { cwd: fixture }),
      (error) => error.code === 1
        && /history-metadata:.*personal-email/.test(error.stderr),
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('privacy scan checks unreachable Git objects', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'bob-privacy-object-'));
  try {
    await git(fixture, ['init', '-q']);
    await writeFile(join(fixture, 'safe.txt'), 'generic fixture\n');
    await git(fixture, ['add', 'safe.txt']);
    await git(fixture, ['commit', '-qm', 'safe baseline']);
    const orphan = join(fixture, 'orphan.txt');
    await writeFile(orphan, 'workspace=C:\\Users\\NamedPerson\\Unreachable\n');
    await git(fixture, ['hash-object', '-w', 'orphan.txt']);
    await rm(orphan);

    await assert.rejects(
      run(process.execPath, [scanner, '--root', fixture], { cwd: fixture }),
      (error) => error.code === 1
        && /git-object:blob:.*windows-user-path/.test(error.stderr),
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('privacy scan reads common source-code extensions', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'bob-privacy-extension-'));
  try {
    await git(fixture, ['init', '-q']);
    await writeFile(join(fixture, 'safe.txt'), 'generic fixture\n');
    await git(fixture, ['add', 'safe.txt']);
    await git(fixture, ['commit', '-qm', 'safe baseline']);
    await writeFile(join(fixture, 'sample.ts'), 'const path = "C:\\Users\\NamedPerson\\Project";\n');

    await assert.rejects(
      run(process.execPath, [scanner, '--root', fixture], { cwd: fixture }),
      (error) => error.code === 1
        && /sample\.ts:1 windows-user-path/.test(error.stderr),
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
