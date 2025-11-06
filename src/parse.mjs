import fs from 'node:fs';
import path from 'node:path';
import { normalizeDomain, safeString } from './utils.mjs';

export function readInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = [];

  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 6) continue;

    const [Original, Program, Merchant, ProgramDomain, MerchantDomain, Confidence] = parts;

    rows.push({
      original: safeString(Original),
      program: safeString(Program),
      merchant: safeString(Merchant),
      programDomain: normalizeDomain(ProgramDomain),
      merchantDomain: normalizeDomain(MerchantDomain),
      inputConfidence: safeString(Confidence)
    });
  }
  return rows;
}

export function writeOutput(filePath, rows) {
  const header = [
    'Original','Program','Merchant',
    'ProgramDomain','MerchantDomain',
    'ChosenDomain','LogoURL','Status','Confidence','Score','Notes'
  ].join(',');

  const body = rows.map(r => [
    r.original, r.program, r.merchant,
    r.programDomain, r.merchantDomain,
    r.chosenDomain, r.logoUrl, r.status,
    r.outputConfidence, r.score, r.notes
  ].map(x => (x == null ? '' : String(x))).join(','));

  const out = [header, ...body].join('\n');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, out, 'utf8');
}
