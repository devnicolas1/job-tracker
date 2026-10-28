// Copies the agent skills from .claude/skills (Claude Code) to .agents/skills (Codex). Copies,
// not symlinks, so they also work on Windows checkouts without symlink support.
// `--check` only reports drift and exits 1, for `npm run check`.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, '.claude', 'skills');
const target = path.join(root, '.agents', 'skills');
const check = process.argv.includes('--check');

const listFiles = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
        .sort()
    : [];

const sourceFiles = listFiles(source);
const targetFiles = new Set(listFiles(target));
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8').replaceAll('\r\n', '\n');

const stale = sourceFiles.filter(
  (file) => !targetFiles.has(file) || read(source, file) !== read(target, file),
);
const extra = [...targetFiles].filter((file) => !sourceFiles.includes(file));

if (check) {
  if (stale.length + extra.length > 0) {
    console.error(
      `.agents/skills is out of date (${[...stale, ...extra].join(', ')}). Run: npm run skills:sync`,
    );
    process.exit(1);
  }
} else {
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
  console.log(`Copied ${sourceFiles.length} skill file(s) to .agents/skills`);
}
