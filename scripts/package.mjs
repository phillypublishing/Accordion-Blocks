import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { version } = require('../package.json');
const root = resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(join(tmpdir(), 'accordion-package-'));
const packageRoot = join(temporary, 'accordion-blocks');
const output = join(root, 'dist', `accordion-blocks-${version}.zip`);
try {
 await mkdir(packageRoot);
 for (const name of ['accordion-blocks.php', 'block.json', 'readme.txt', 'FORK.md', 'build', 'js', 'assets']) {
  await cp(join(root, name), join(packageRoot, name), { recursive: true });
 }
 await mkdir(join(root, 'dist'), { recursive: true });
 await rm(output, { force: true });
 const result = spawnSync('python3', ['-m', 'zipfile', '-c', output, 'accordion-blocks'], { cwd: temporary, stdio: 'inherit' });
 if (result.status !== 0) throw new Error('Plugin packaging failed');
 console.log(output);
} finally { await rm(temporary, { recursive: true, force: true }); }
