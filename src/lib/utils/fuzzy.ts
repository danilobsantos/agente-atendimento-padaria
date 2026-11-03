/**
 * Matcher fuzzy compartilhado (cardápio + base de conhecimento).
 *
 * Mora aqui, e não em ProductsService, para que o serviço de conhecimento não
 * precise importar Redis/Prisma só para reusar uma função pura.
 */

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

const STOP_WORDS = new Set([
  "de", "do", "da", "dos", "das",
  "com", "sem", "e",
  "um", "uma", "uns", "umas",
  "o", "a", "os", "as",
  "em", "no", "na", "nos", "nas",
  "para", "pra", "por", "ao", "aos",
]);

export function tokenize(text: string): string[] {
  return text
    .split(/[\s\-–—_.,;:!?()\/+]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
}

/** Minúsculas e sem acento. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Substring de `text` (mesmo tamanho aproximado) com menor distância para `token`. */
export function closestSubstringDistance(text: string, token: string): number {
  if (text.length <= token.length) return levenshtein(text, token);
  let bestDist = Infinity;
  for (let i = 0; i <= text.length - token.length; i++) {
    const dist = levenshtein(text.slice(i, i + token.length), token);
    if (dist < bestDist) bestDist = dist;
    if (bestDist === 0) break;
  }
  return bestDist;
}

/** Busca por tokens significativos no nome e categoria. */
export function matchesProduct(nome: string, categoria: string, busca: string): boolean {
  if (!busca) return true;
  if (nome.includes(busca)) return true;

  const target = `${nome} ${categoria}`.trim();
  if (target.includes(busca)) return true;

  const tokens = tokenize(busca);
  if (tokens.length === 0) return true;

  const matched = tokens.filter((token) => {
    if (target.includes(token)) return true;
    if (token.length >= 5) return closestSubstringDistance(target, token) <= 2;
    return false;
  });

  if (tokens.length <= 2) return matched.length === tokens.length;
  // 3+ tokens: aceita todos ou (N-1) — "pão francês com manteiga" não deve
  // falhar por causa de uma palavra acessória.
  return matched.length >= tokens.length - 1;
}

/**
 * Fração dos tokens da consulta que aparecem (ou quase) no texto alvo.
 * Usado para decidir se uma entrada de FAQ responde à pergunta do cliente.
 */
export function tokenHitRatio(query: string, target: string): number {
  const tokens = tokenize(normalize(query));
  if (tokens.length === 0) return 0;
  const haystack = normalize(target);
  const hits = tokens.filter((token) => {
    if (haystack.includes(token)) return true;
    return token.length >= 5 && closestSubstringDistance(haystack, token) <= 2;
  }).length;
  return hits / tokens.length;
}
