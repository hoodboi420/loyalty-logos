import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInput, writeOutput } from './parse.mjs';
import { makeLogoUrl } from './utils.mjs';
import { scoreDomain } from './score.mjs';
import { applyOverrides } from './overrides.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY = process.argv.includes('--dry');
const INPUT  = path.join(__dirname, '..', 'data', 'programs_cleaned.txt');
const OUTPUT_BASE = path.join(__dirname, '..', 'out', 'logos');

function computeConfidence(score) {
  if (score >= 70) return 'High';
  if (score >= 45) return 'Medium';
  return 'Low';
}

async function main() {
  const rows = readInput(INPUT);

  const outRows = rows.map(r => {
    const chosenDomain = applyOverrides({
      programDomain: r.programDomain,
      merchantDomain: r.merchantDomain,
      program: r.program,
      merchant: r.merchant
    });

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
      ? (r.programDomain && chosenDomain === r.programDomain ? 'program'
         : r.merchantDomain && chosenDomain === r.merchantDomain ? 'merchant'
         : 'override')
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

  writeOutput(OUTPUT_BASE, outRows);
  console.log(`✅ Done. Wrote ${outRows.length} rows to ${OUTPUT_BASE}.{csv,tsv}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
