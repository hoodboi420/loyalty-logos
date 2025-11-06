import stringSimilarity from 'string-similarity';
import { BLOCKLIST, safeString } from './utils.mjs';

/**
 * Обчислює скоринг домену (0–100)
 */
export function scoreDomain({
  chosenDomain,
  programDomain,
  merchantDomain,
  program,
  merchant,
  inputConfidence
}) {
  let score = 0;
  if (!chosenDomain) return -100;

  const cd = chosenDomain;
  const pd = programDomain || '';
  const md = merchantDomain || '';
  const prog = safeString(program).toLowerCase();
  const merch = safeString(merchant).toLowerCase();

  if (cd && pd && cd === pd) score += 30;
  else if (cd && md && cd === md) score += 20;

  const hints = [
    'loyalty','rewards','miles','club','honors','bonvoy',
    'avios','krisflyer','flyer','pass','privilege','prefer','suma',
    'lotusmiles','connectmiles','bonus'
  ];
  if (hints.some(k => cd.includes(k))) score += 10;

  const cdBase = cd.replace(/\.(com|net|org|co|io|ai|uk|de|fr|es|it|br|ca|au|jp|kr|cn|sg|ae|sa)$/, '');
  const nameTokens = [prog.split(' ')[0], merch.split(' ')[0]].filter(Boolean);
  const similarity = Math.max(...nameTokens.map(t => stringSimilarity.compareTwoStrings(t, cdBase)));
  if (similarity > 0.35) score += 10;

  if (String(inputConfidence).toLowerCase() === 'high') score += 10;
  if (BLOCKLIST.has(cd)) score -= 20;
  if (cd.length < 4 || similarity < 0.1) score -= 20;

  return Math.max(0, Math.min(100, score));
}
