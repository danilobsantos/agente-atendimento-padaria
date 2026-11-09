/**
 * Mescla duas listas de conversas preservando a ordem e garantindo
 * que nenhum `customerId` seja duplicado no estado do painel.
 *
 * A primeira ocorrência de cada `customerId` é mantida.
 */
export function mergeUniqueConversations<T extends { customerId: string }>(
  prev: T[],
  next: T[]
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const conv of [...prev, ...next]) {
    if (!conv?.customerId || seen.has(conv.customerId)) continue;
    seen.add(conv.customerId);
    result.push(conv);
  }

  return result;
}

