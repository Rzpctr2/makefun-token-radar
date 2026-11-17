// Token radar entry for token-radar-01 (Node 22, standard library only).
//
// Takes the sealed snapshot, scores every pre-token protocol through the
// model in lib/model.ts, and lays out the ranked board plus the static
// dashboard and screenshots the judge opens. The dossier comes last and is
// rebuilt by the scorer from this same output, so it must match byte for
// byte. Run it outside the grader container with MAKEFUN_OUTPUT_DIR set:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

/** Caps the scorer enforces (reference/gate.json): text shapes the bytes, the rest refuse. */
const DOSSIER_TEXT_LIMIT = 65_536;
const SHOT_LIMITS = { max: 4, max_bytes: 524_288 };
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Value of a `--name value` or `--name=value` flag, or the fallback when absent. */
function flagValue(name: string, fallback: string): string {
  const wanted = `--${name}`;
  for (let i = 2; i < process.argv.length; i++) {
    const token = process.argv[i]!;
    if (token === wanted && i + 1 < process.argv.length) return process.argv[i + 1]!;
    if (token.startsWith(`${wanted}=`)) return token.slice(wanted.length + 1);
  }
  return fallback;
}

const src = flagValue('input', '/input');
const snapPath = src.endsWith('.json') ? src : join(src, 'snapshot.json');
if (!existsSync(snapPath)) {
  process.stderr.write(`token radar: no snapshot found at ${snapPath} — pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const dest = flagValue('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snap = parseSnapshot(readFileSync(snapPath, 'utf8'));
const { board, radar } = buildRadar(snap);
const bad = boardIssue(board, snap);
if (bad !== null) {
  process.stderr.write(`token radar: the model produced a board the gate refuses: ${bad}\n`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
const boardPayload = `${JSON.stringify({ rows: board })}\n`;
writeFileSync(join(dest, 'board.json'), boardPayload);
writeFileSync(join(dest, 'data.js'), dataScript(radar));

/** Copy a directory's regular files into `to`, skipping dotfiles, and list what landed. */
function copyDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const landed: string[] = [];
  for (const entry of readdirSync(from)) {
    if (entry.startsWith('.')) continue;
    const source = join(from, entry);
    if (!statSync(source).isFile()) continue;
    copyFileSync(source, join(to, entry));
    landed.push(entry);
  }
  return landed;
}

copyDir(join(root, 'dashboard'), join(dest, 'dashboard'));
const images = copyDir(join(root, 'screenshots'), join(dest, 'screenshots'));
if (images.length < 3) {
  process.stderr.write(`token radar: only ${images.length} screenshot${images.length === 1 ? '' : 's'} in screenshots/: hand in 3 — the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const shot of images) {
  if (!SHOT_NAME.test(shot)) {
    process.stderr.write(`token radar: screenshots/${shot}: names are 1 to 128 characters of letters, digits and . _ -\n`);
    process.exit(1);
  }
}

const dossierOpts = {
  text_max_bytes: DOSSIER_TEXT_LIMIT,
  screenshots: SHOT_LIMITS,
  dashboard: { max_files: 400, max_bytes: 4194304 },
};
writeFileSync(join(dest, 'dossier.json'), buildDossier(dest, dossierOpts));

process.stdout.write(
  `token radar: ${snap.protocols.length} protocols in the snapshot, ${snap.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: board.json, data.js, dashboard (3 files), screenshots (${images.length} images) and dossier.json written to ${dest}\n`,
);
