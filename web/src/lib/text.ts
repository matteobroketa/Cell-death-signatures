const BOM_PREFIX = /^\uFEFF/;
const FORMULA_PREFIX = /^[\t\r ]*[=+\-@]/;

export function stripBomPrefix(value: string): string {
  return value.replace(BOM_PREFIX, '');
}

export function normalizeTrimmedText(value: string): string {
  return stripBomPrefix(value).trim();
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function sanitizeCsvTextCell(value: string): string {
  if (FORMULA_PREFIX.test(value)) {
    return `'${value}`;
  }

  return value;
}
