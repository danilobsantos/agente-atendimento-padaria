# Anatomia do prompt — o que o código já garante e os anti-padrões deste projeto

## O que o código monta a cada turno

**Sistema, nesta ordem** (`src/lib/bot/llm-agent.ts`):

1. `BotSetting.systemPrompt` — o texto do dono. **Vem primeiro.**
2. `## IDENTIDADE E REGRAS DE SAÍDA` — "assistente virtual da Sabor de Minas", JSON obrigatório.
3. `## EXEMPLOS DE INTERAÇÃO` — três few-shot.
4. `## REGRAS CRÍTICAS` 1–4 — carrinho completo, consultar cardápio antes de preço/ID, sem
   invenção, mensagem curta (máx. 400 chars).
5. `## REGRAS DE FLUXO DE PEDIDO` 5–10 — extrair `customerInfo`, quando usar
   `confirmar_pedido`, `orderType`, quantidade por valor, políticas via conhecimento, totais via
   pedido atual.
6. `## CONTEXTO ATUAL` — nome, tipo do pedido, carrinho, endereço, pagamento, aviso de pedido ativo.

**Usuário:** as últimas `messageContextLimit` mensagens da sessão + a mensagem atual.

**Ferramentas:** `consultar_cardapio`, `consultar_conhecimento`, `consultar_pedido_atual`. Até 4
rodadas; `ToolBreaker` corta o loop quando a mesma tool falha duas vezes com os mesmos argumentos.

**Saída:** `AgentResponseSchema` (zod) valida `intent`/`orderType`/`customerInfo`/`products`/
`message`; a rota junta o resumo do pedido; o guard de preço compara todo `R$` com o catálogo; o
guard de prazo remove a frase; `sendChunkedResponse` quebra acima de 800 caracteres.

## O que o código garante — não vai no prompt

| camada | o que garante | onde |
|---|---|---|
| Schema | resposta só entra se for JSON válido no formato do agente | `llm-agent.ts` + zod |
| Carrinho | `products` é o carrinho completo; item omitido sai do pedido | regra 1 |
| Cardápio | preço, nome e ID vêm da tool, nunca do modelo | `tools/cardapio.ts` + regra 2 |
| Preço | todo `R$` afirmado tem que existir no catálogo, senão a resposta é substituída | `guardrails/price-guard.ts` |
| Prazo | frase que promete entrega em N minutos/horas é removida | `stripDeliveryPromises` |
| Confirmação | só fecha com confirmação explícita; qualquer negativa bloqueia | `isExplicitConfirmation` |
| Humano | "quero falar com atendente" é detectado antes do LLM, silencia o bot e abre alerta | `guardrails/detect.ts` |
| Opt-out | "para de me mandar" silencia o bot e abre alerta | `detectOptOut` |
| Fluxo fixo | saudação, cancelamento, recomeço, link do cardápio, tipo de pedido e pagamento | `IntentRouter` |
| Política | horário, taxa, área, pagamento, prazo, cancelamento saem do conhecimento | `KnowledgeService` + `consultar_conhecimento` |
| Custo | teto mensal por tenant bloqueia o turno e alerta o dono | `runLlm` + `assertBudget` |
| Contexto | nome/endereço/pagamento já extraídos aparecem no `## CONTEXTO ATUAL` | `process-bot` |

## O que o prompt controla

Persona e contexto do negócio; tom e vocabulário; ordem e ritmo das perguntas; como reagir a
objeção de preço, "vou pensar", pedido fora do escopo, pressa; quando **não** oferecer mais nada;
o que dizer quando o conhecimento não cobre; tamanho da resposta.

## Anti-padrões (cada um tem um defeito real por trás)

| anti-padrão | o que acontece aqui | conserto |
|---|---|---|
| preço, taxa ou prazo escrito no prompt | preço antigo não existe mais no catálogo → guard substitui a resposta por "deixa eu confirmar os valores"; prazo → frase removida no meio | tire o número; aponte para cardápio/conhecimento |
| listar o cardápio no prompt | duas fontes de verdade; produto muda no `/admin/cardapio` e o prompt continua mandando o antigo; ID curto é gerado por turno e não existe no prompt | "consulte o cardápio antes de falar de item ou preço" |
| "sempre chame `consultar_cardapio`" | já é a regra 2; nome de tool no prompt vaza como "vou consultar o sistema" | descreva o efeito: "confirme no cardápio antes de responder" |
| "responda em JSON" / "não responda em JSON" | o bloco fixo exige JSON e vem **depois**; sua instrução pode ganhar e quebrar o parser | não fale de formato |
| "peça nome, endereço e pagamento" | já vêm extraídos e aparecem no `## CONTEXTO ATUAL`; repetir irrita e gasta token | "use o que já sabe; pergunte só o que falta" |
| "confirme o pedido quando o cliente concordar" | `isExplicitConfirmation` decide; pedir confirmação cedo adiciona um turno | não instrua confirmação |
| "diga que um atendente já vai responder" | o handoff é manual: abre alerta, mas quem assume é uma pessoa no painel — e pode não haver ninguém | "se pedirem uma pessoa, avise que vai chamar alguém da equipe" |
| "se não souber, estime" | vira preço/prazo inventado, vetado pelo guard | "se não encontrar, diga que vai confirmar" |
| `{{nome}}`, `{{empresa}}` | não há substituição de placeholder; o contexto é injetado como texto | escreva sem placeholder |
| instruir saudação, link do cardápio ou cancelamento | o `IntentRouter` responde antes do LLM; o texto nunca roda | corte |
| "você é a Dona Maria, uma pessoa de verdade" | contradiz o bloco de identidade ("assistente virtual") e a primeira instrução ganha | persona de assistente, com nome do negócio |
| prompt de 3 mil palavras | `input_tokens` sobe em todo turno (`llm_calls`) e a atenção dilui | cabe em uma tela |

## Checklist de revisão (marque o trecho do prompt em cada linha)

1. Identidade em uma frase: quem é, para quem fala, o que a padaria faz.
2. O que perguntar e em que ordem — sem repetir o que já está no contexto.
3. "Se X, faça Y" para os 3–5 caminhos mais comuns (só item, dúvida, reclamação, encomenda, fora do escopo).
4. Objeção de preço, "vou pensar", pressa, pedido que não existe no cardápio.
5. Nenhum preço, taxa, prazo ou horário escrito — só a instrução de consultar.
6. Nenhuma ferramenta pelo nome; nenhum fluxo que o `IntentRouter` já resolve.
7. Estilo: tamanho, uma pergunta por vez, emoji com parcimônia, vocabulário do cliente.
8. Nada que o código já garante; nada que contradiga o bloco fixo; nada com placeholder.
9. Cabe em uma tela? Se não, o que sai para o conhecimento?

## Conteúdo condicional é conhecimento, não prompt

Regra de negócio e FAQ vão em `/admin/conhecimento` (`knowledge_entries`): horário, taxa e área de
entrega, formas de pagamento, valor mínimo, prazo, cancelamento, endereço, telefone. Fica no
prompt só o comportamento.

Como escrever uma entrada:

- **Pergunta** nas palavras do cliente ("vocês entregam no centro?", "qual o horário de sábado?").
- **Resposta** curta e factual, do jeito que pode ser enviada no WhatsApp.
- **Palavras-chave** em português, sem acento (a busca normaliza), separadas por vírgula.
- **Categoria** para o dono achar depois; **prioridade** para desempatar entradas parecidas.

Não há embeddings de propósito: a busca é por palavra-chave com fuzzy. Duas entradas sobre o mesmo
assunto competem — junte em uma.
