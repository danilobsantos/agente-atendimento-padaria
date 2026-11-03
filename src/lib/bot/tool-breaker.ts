/**
 * Tool-breaker: corta o loop quando a MESMA tool falha com os MESMOS argumentos
 * repetidamente.
 *
 * Sem isso, um erro determinístico (produto que não existe, argumento malformado)
 * custa todas as rodadas do loop de tools — 4 chamadas de LLM para chegar à mesma
 * conclusão. Com isso, a segunda falha idêntica encerra e o modelo é obrigado a
 * responder com o que já tem.
 *
 * Só tools de leitura registram no breaker (`no_progress`): uma tool com efeito
 * colateral pode legitimamente falhar e ser repetida.
 */
export class ToolBreaker {
  private readonly failures = new Map<string, number>();

  constructor(private readonly limit = 2) {}

  private key(name: string, args: string): string {
    return `${name}::${args}`;
  }

  /** true = bloqueado. Após N falhas idênticas, a tool não roda de novo no turno. */
  isBlocked(name: string, args: string): boolean {
    return (this.failures.get(this.key(name, args)) ?? 0) >= this.limit;
  }

  record(name: string, args: string, ok: boolean): void {
    if (ok) return;
    const key = this.key(name, args);
    this.failures.set(key, (this.failures.get(key) ?? 0) + 1);
  }
}
