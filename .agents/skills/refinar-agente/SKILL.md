---
name: refinar-agente
description: 'Guia para afinar o prompt do bot de atendimento do agente-atendimento (Sabor de Minas) quando ele responde mal — como engenheiro de prompt sênior de delivery, com dados da operação, não achismo. Use SEMPRE que alguém disser "o bot respondeu errado", "está robótico", "inventa preço", "promete prazo", "não usa o cardápio", "passa tudo para atendente", "fala demais", "não fecha pedido", "melhora o prompt", "otimiza o agente", ou quiser revisar, reescrever ou comparar versões do prompt do bot.'
metadata:
  publico: dono da padaria, implantador
  regra: o prompt do bot é UMA camada; llm-agent.ts injeta o resto e os guardrails barram na saída
---

# Afinar o prompt do bot com dados

"O bot está ruim" quase nunca é o prompt inteiro. Nesta base o prompt do dono é só o primeiro
parágrafo de um texto que o código completa com identidade, schema JSON, few-shot e dez regras
críticas — e que termina em três guardrails que reescrevem a resposta antes do envio. Corrigir no
prompt o que é dado faltando, fluxo fixo ou guardrail é trocar a fechadura com a porta aberta.

## Como você age

- Trabalha com **uma conversa real e um número**, nunca com "acho que o tom está frio".
- Diagnostica na ordem: sintoma → medida → camada → conserto → antes/depois.
- Muda **uma coisa por rodada**. Sem antes/depois isolado, ninguém sabe o que funcionou.
- Trata o dono como dono: explica o que vai mudar em uma frase, sem jargão de LLM.
- Não mexe em código para o prompt "passar" — a não ser que peçam explicitamente.

## Onde o prompt mora

- `BotSetting.systemPrompt` (uma linha por tenant), editado em `/admin/configuracoes`, campo
  **Instruções de Personalidade**. Persiste por `PUT /api/bot-settings`.
- Ele é concatenado **antes** do bloco fixo de `src/lib/bot/llm-agent.ts`: `## IDENTIDADE E REGRAS
  DE SAÍDA`, few-shot, `## REGRAS CRÍTICAS` (1–10) e `## CONTEXTO ATUAL`. Duas consequências:
  1. O que o bloco fixo já manda repetir é desperdício de token em **todo** turno.
  2. O que o prompt do dono **contradiz** aparece primeiro e pode ganhar. Contradição é bug.
- **Não existe versionamento, publicar nem rollback** (backlog Fase 7). Quem versiona é você,
  em arquivo, antes de editar.

## Passo 0 — O sintoma, com uma conversa

Peça três coisas: horário aproximado, telefone ou nome do cliente, e a frase exata que incomodou.
Uma conversa real vale mais que dez opiniões.

Sem caso concreto, puxe os 20 turnos mais recentes (`references/diagnostico.md`, consulta 3),
mostre 2–3 trechos e deixe a pessoa apontar qual é o problema — "responde errado" não é sintoma
até virar exemplo.

## Passo 1 — Medir antes de opinar

Rode o diagnóstico (`references/diagnostico.md`), **sempre filtrando `tenant_id`**. Classifique o
sintoma em uma destas camadas, nesta ordem:

1. **Dado ausente ou errado** — produto sem preço, categoria vazia, política fora do conhecimento,
   horário desatualizado. Conserto em `/admin/cardapio` ou `/admin/conhecimento`. Não é prompt.
2. **Código** — fluxo fixo do `IntentRouter`, guardrail, tool, limite de orçamento. Conserto em
   `src/lib/bot/**`. Não é prompt.
3. **Comportamento** — persona, tom, o que perguntar e em que ordem, como reagir a objeção, quando
   calar a boca. Só aqui se reescreve o texto.

Diga em uma frase qual camada é e qual número sustenta a conclusão.

## Passo 2 — Ler o prompt contra o que o código já faz

```sql
select system_prompt from bot_settings where tenant_id = :tenant;
```

Marque linha por linha:

- **(a) já garantido pelo código** → cortar (`references/anatomia-e-antipadroes.md` lista tudo).
- **(b) contradiz o bloco fixo** → corrigir. Ex.: "responda em texto livre" vs. JSON obrigatório.
- **(c) regra de negócio consultável** (horário, taxa, prazo, área) → mover para o conhecimento,
  que é editável sem deploy. Fica no prompt só o que é comportamento.

## Passo 3 — A versão nova, testada antes/depois

- Escreva o rascunho. Alvo: **cabe em uma tela**. Tom e decisão, não catálogo.
- Teste com 5–10 mensagens reais do mesmo período, usando `test-llm.ts` como molde (ele chama o
  provider de verdade e custa centavos). Rode a mesma sessão e o mesmo config com o prompt antigo
  e com o novo; compare `intent`, `products` e `message`.
- Monte a tabela e mostre para a pessoa antes de aplicar:

  | mensagem do cliente | resposta antiga | resposta nova | veredito |
  |---|---|---|---|

- Se o teste precisar de produto ou preço, use os IDs do tenant real. Nunca invente ID.

## Passo 4 — Aplicar, versionar à mão, vigiar

1. **Snapshot antes:** salve o prompt atual em `docs/prompts/<slug-do-tenant>-YYYY-MM-DD-antes.md`.
   É o seu rollback. Crie a pasta se não existir.
2. **Aplique** pelo `/admin/configuracoes` (ou `PUT /api/bot-settings` com o cookie de sessão). Um
   campo por vez — não mexa em `temperature` junto; ela está em 0.2 de propósito.
3. **Vigie 2–3 dias, ~50 turnos.** Recompare `preco_incoerente`, `prazo_inventado`, `handoff`,
   custo médio por turno e pedidos fechados.
4. **Se piorou, cole o snapshot de volta.** Rollback é manual; não há botão.
5. **Snapshot depois:** registre em `...-depois.md` o que mudou e qual número motivou.

## O que você nunca faz

- **Não escreve preço, taxa ou prazo de entrega no prompt.** Preço no prompt é segunda fonte de
  verdade: quando o cardápio muda, o guard de preço veta a resposta e o cliente recebe "deixa eu
  confirmar os valores". Prazo no prompt é removido pelo `stripDeliveryPromises` e o cliente
  recebe a frase mutilada.
- **Não lista o cardápio.** Item, variação, adicional e preço vêm de `consultar_cardapio`.
- **Não duplica o bloco fixo** (JSON, carrinho completo, "não invente", "mensagem curta", "use o
  cardápio"): custa token todo turno e, se divergir, ganha por vir antes.
- **Não manda pedir nome, endereço ou pagamento** que já estão no `## CONTEXTO ATUAL`.
- **Não manda confirmar pedido.** `isExplicitConfirmation` decide, e ele bloqueia qualquer negativa.
- **Não promete "um atendente já vai te responder".** O handoff é manual: o alerta abre, mas quem
  assume é uma pessoa no painel. Prometer sem alguém assumindo é pior que não prometer.
- **Não usa `{{placeholder}}`.** Não há substituição — o contexto é injetado por conta própria.
- **Não nomeia ferramenta** (`consultar_cardapio`, `consultar_conhecimento`): descreva o que ela
  faz. Nome de tool no prompt vaza na conversa.
- **Não conserta dado faltando com texto.** "Se perguntarem o horário, diga que abre às 7h" é uma
  mentira esperando desatualizar.
- **Não mexe em `src/lib/bot/**`** para fazer o prompt funcionar, sem pedido explícito.
- **Não muda mais de uma coisa por rodada.**

## Referências

- `references/diagnostico.md` — SQL dos sinais e a tabela sintoma → causa → onde consertar.
- `references/anatomia-e-antipadroes.md` — o que o código já garante (e não vai no prompt) e os
  anti-padrões medidos neste projeto.
