// src/utils.mjs
// Utility helpers for domain normalization and Logo.dev integration

export function normalizeDomain(d) {
  if (!d) return '';
  return String(d)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, ''); // remove path if exists
}

export function makeLogoUrl(domain) {
  // ✅ твій Logo.dev publishable key
  const pk = 'pk_U5306LU_TGOnmb2Q4AqzFg';
  const qs = new URLSearchParams({
    token: pk,
    size: '256',
    format: 'png',
    theme: 'auto'
  });
  return `https://img.logo.dev/${domain}?${qs.toString()}`;
}

export const BLOCKLIST = new Set([
  'facebook.com','linkedin.com','twitter.com','x.com','instagram.com',
  'wikipedia.org','fandom.com','thepointsguy.com','nerdwallet.com',
  'upgradedpoints.com','medium.com','blogspot.com','wordpress.com'
]);

export function safeString(x) {
  return (x ?? '').toString().replace(/\s+/g, ' ').trim();
}
