// src/overrides.mjs
// Правила заміни/пріоритету доменів

export function applyOverrides({ programDomain, merchantDomain, program, merchant }) {
  const pd = programDomain?.trim().toLowerCase() || '';
  const md = merchantDomain?.trim().toLowerCase() || '';

  // Правило: Avios — використовуємо домен мерчанта (авіакомпанії/банку),
  // бо avios.com дає не той логотип, який нам потрібен як "бренд програми" у контексті мерчанта.
  if (pd && /(^|\.)avios\.com$/.test(pd)) {
    return md || pd; // якщо у мерчанта немає домену — тоді вже pd
  }

  // За замовчуванням — program → merchant
  return pd || md || '';
}

// Вертаємо порядок спроб, щоб validator міг спробувати обидва
export function priorityOrder({ programDomain, merchantDomain, program, merchant }) {
  const pd = programDomain?.trim().toLowerCase() || '';
  const md = merchantDomain?.trim().toLowerCase() || '';

  // Для Avios: спочатку merchant, потім (за потреби) program
  if (pd && /(^|\.)avios\.com$/.test(pd)) {
    return [md, pd].filter(Boolean);
  }
  // Звичайний випадок: спочатку program, потім merchant
  return [pd, md].filter(Boolean);
}
