import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInput, writeOutput } from './parse.mjs';
import { makeLogoUrl } from './utils.mjs';
import { scoreDomain } from './score.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY = process.argv.includes('--dry');
const INPUT  = path.join(__dirname, '..', 'data', 'programs_cleaned.txt');
const OUTPUT = path.join(__dirname, '..', 'out', 'logos.csv');

function chooseDomain(programDomain, merchantDomain) {
  const pd = programDomain?.trim();
  const md = merchantDomain?.trim();
  if (pd) return pd;
  if (md) return md;
  return '';
}

function computeConfidence(score) {
  if (score >= 70) return 'High';
  if (score >= 45) return 'Medium';
  return 'Low';
}

async function main() {
  const rows = readInput(INPUT);

  const outRows = rows.map(r => {
    const chosenDomain = chooseDomain(r.programDomain, r.merchantDomain);
    const logoUrl = chosenDomain ? makeLogoUrl(chosenDomain) : '';
    const score = scoreDomain({
      chosenDomain,
      programDomain: r.programDomain,
      merchantDomain: r.merchantDomain,
      program: r.program,
      merchant: r.merchant,
      inputConfidence: r.inputConfidence
    });
    const outputConfidence = computeConfidence(score);
    const status = chosenDomain ? 'ok' : 'no_domain';
    const notes = chosenDomain
      ? (r.programDomain ? 'program' : 'merchant')
      : 'missing_both';

    return {
      ...r,
      chosenDomain,
      logoUrl,
      score,
      outputConfidence,
      status,
      notes
    };
  });

  if (DRY) {
    console.log(`Processed ${outRows.length} rows. Example:`);
    console.table(outRows.slice(0, 5));
    return;
  }

  writeOutput(OUTPUT, outRows);
  console.log(`✅ Done. Wrote ${outRows.length} rows to ${OUTPUT}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
