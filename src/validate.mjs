// src/validate.mjs
// Перевіряє, що LogoURL повертає реальне зображення (image/*),
// відсіює SVG-монограми (є лише <text>, без path/g/rect/...),
// і за потреби пробує fallback-домен.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInput } from './parse.mjs';
import { makeLogoUrl } from './utils.mjs';
import { priorityOrder } from './overrides.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_TXT  = path.join(__dirname, '..', 'data', 'programs_cleaned.txt');
const OUTPUT_CSV = path.join(__dirname, '..', 'out', 'logos_validated.csv');

const TIMEOUT_MS = 8000;

function timeoutSignal(ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(id) };
}

async function headOrGet(url) {
  // HEAD може бути вимкнений; тоді пробуємо GET з невеликим body
  const { signal, cancel } = timeoutSignal(TIMEOUT_MS);
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal });
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) {
      cancel();
      const { signal: s2, cancel: c2 } = timeoutSignal(TIMEOUT_MS);
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: s2 });
      const ctype = res.headers.get('content-type') || '';
      const clen  = Number(res.headers.get('content-length') || '0');

      let bodySample = '';
      if (ctype.includes('svg')) {
        // читаємо як текст для евристики "монограма"
        bodySample = await res.text();
      } else {
        // не тягнемо повністю великі PNG; достатньо статус/заголовків
        // читаємо chunk до 4KB (але fetch у Node віддає все — це ок для 256x256)
        await res.arrayBuffer(); // прогріли буфер, але не використовуємо
      }

      return {
        ok: res.ok && ctype.startsWith('image/'),
        status: res.status,
        contentType: ctype,
        contentLength: clen,
        body: bodySample
      };
    } else {
      const ctype = res.headers.get('content-type') || '';
      const clen  = Number(res.headers.get('content-length') || '0');
      return { ok: true, status: res.status, contentType: ctype, contentLength: clen, body: '' };
    }
  } catch (e) {
    return { ok: false, status: 0, contentType: '', contentLength: 0, body: '', error: String(e) };
  } finally {
    cancel();
  }
}

function isMonogramSvg(svgText) {
  if (!svgText) return false;
  const textCount = (svgText.match(/<text\b/gi) || []).length;
  const hasGeom = /<(path|g|rect|circle|ellipse|polygon|polyline|image)\b/i.test(svgText);
  // Евристика: 1-2 <text> і відсутні геометричні елементи → ймовірно "буква"
  return textCount >= 1 && !hasGeom;
}

function decideCheckLabel(info) {
  if (!info.ok) return 'not_image_or_error';
  if (info.contentType.includes('svg') && isMonogramSvg(info.body)) return 'monogram_svg';
  if (info.contentLength > 0 && info.contentLength < 1200 && !info.contentType.includes('svg')) return 'too_small_png';
  return 'image_ok';
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function validateRow(row) {
  // Визначаємо порядок спроб (program → merchant або merchant → program для Avios)
  const order = priorityOrder({
    programDomain: row.programDomain,
    merchantDomain: row.merchantDomain,
    program: row.program,
    merchant: row.merchant
  });

  for (let i = 0; i < order.length; i++) {
    const domain = order[i];
    const url = makeLogoUrl(domain);
    const info = await headOrGet(url);
    const check = decideCheckLabel(info);

    if (check === 'image_ok') {
      const source = (i === 0 ? 'primary' : 'fallback');
      const status = source === 'primary'
        ? (domain === row.programDomain ? 'ok_program' : 'ok_merchant')
        : (domain === row.programDomain ? 'ok_program_fallback' : 'ok_merchant_fallback');

      return {
        chosenDomain: domain,
        logoUrl: url,
        httpStatus: info.status,
        contentType: info.contentType,
        bytes: info.contentLength,
        check,
        status,
        notes: (domain === row.programDomain ? 'program' : 'merchant')
      };
    }

    // Якщо монограма — пробуємо наступний домен
    // Якщо це остання спроба — позначимо як missing/invalid
    if (i === order.length - 1) {
      const status = check === 'monogram_svg' ? 'invalid_monogram' : 'missing_or_invalid';
      return {
        chosenDomain: '',
        logoUrl: '',
        httpStatus: info.status,
        contentType: info.contentType,
        bytes: info.contentLength,
        check,
        status,
        notes: check
      };
    }
  }

  // safety
  return {
    chosenDomain: '',
    logoUrl: '',
    httpStatus: 0,
    contentType: '',
    bytes: 0,
    check: 'unknown',
    status: 'missing_or_invalid',
    notes: 'no_attempts'
  };
}

async function main() {
  // Читаємо оригінальні рядки з доменами (а не logos.csv), бо нам потрібні обидва домени
  const rows = readInput(INPUT_TXT);

  // Валідовуємо кожен
  const results = [];
  for (const r of rows) {
    const res = await validateRow(r);
    results.push({
      Original: r.original,
      Program: r.program,
      Merchant: r.merchant,
      ProgramDomain: r.programDomain,
      MerchantDomain: r.merchantDomain,
      ChosenDomain: res.chosenDomain,
      LogoURL: res.logoUrl,
      HTTPStatus: res.httpStatus,
      ContentType: res.contentType,
      Bytes: res.bytes,
      Check: res.check,
      Status: res.status,
      Notes: res.notes
    });
  }

  // Пишемо CSV з новими полями
  const header = [
    'Original','Program','Merchant',
    'ProgramDomain','MerchantDomain',
    'ChosenDomain','LogoURL',
    'HTTPStatus','ContentType','Bytes','Check','Status','Notes'
  ].join(',');

  const body = results.map(r => [
    r.Original, r.Program, r.Merchant,
    r.ProgramDomain, r.MerchantDomain,
    r.ChosenDomain, r.LogoURL,
    r.HTTPStatus, r.ContentType, r.Bytes, r.Check, r.Status, r.Notes
  ].map(csvEscape).join(','));

  const out = [header, ...body].join('\n');
  const dir = path.dirname(OUTPUT_CSV);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_CSV, out, 'utf8');

  console.log(`🔎 Validated ${results.length} rows → ${OUTPUT_CSV}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
