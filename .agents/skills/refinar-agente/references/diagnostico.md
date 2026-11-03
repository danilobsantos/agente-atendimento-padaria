# Diagnóstico — os sinais que apontam a causa, e como lê-los sem ler todas as conversas

Acesso: o Postgres do projeto roda em Docker (`padaria-postgres`, porta 5433).

```bash
psql "postgresql://padaria:padaria123@localhost:5433/padaria_delivery"
```

Sempre filtre `tenant_id`. `:tenant` é o UUID do tenant; `:telefone` é o telefone do cliente.
As tabelas são snake_case e **as colunas sem `@map` no schema ficam em camelCase** — por isso
`kind` e `status` são minúsculos, mas `tenant_id` e `created_at` não.

## 0. Quem é o tenant e como o bot está configurado

```sql
select id, name, slug from tenants where active = true;

select b.tenant_id, b.llm_provider, b.llm_model, b.temperature,
       b.message_context_limit, b.max_output_tokens, b.monthly_budget_cents,
       length(b.system_prompt) as tamanho_prompt
  from bot_settings b
 where b.tenant_id = :tenant;
```

`tamanho_prompt` acima de ~3.000 caracteres já pesa em todo turno. Acima de ~6.000, corte antes
de qualquer outra coisa.

## 1. Alertas por tipo — a origem mais barata de causa

```sql
select a.kind, a.severity, count(*) as total,
       count(*) filter (where a.status = 'open') as abertos,
       max(a.created_at) as ultimo
  from alerts a
 where a.tenant_id = :tenant
   and a.created_at >= now() - interval '7 days'
 group by 1, 2
 order by total desc;
```

O `body` de `preco_incoerente` traz os valores órfãos e a mensagem vetada; o de `prazo_inventado`
traz a frase removida. Leia os últimos 5 de cada tipo — eles mostram exatamente o que o modelo
tentou dizer e o guard apagou.

```sql
select a.kind, a.title, a.body, a.created_at
  from alerts a
 where a.tenant_id = :tenant and a.kind in ('preco_incoerente', 'prazo_inventado')
 order by a.created_at desc
 limit 10;
```

## 2. Custo, latência e erro das chamadas de IA

`cost_cents` é **centavos de dólar** (float: um turno custa fração de centavo).

```sql
select date_trunc('day', c.created_at)::date as dia,
       count(*) as chamadas,
       count(*) filter (where c.status = 'error') as erros,
       round(avg(c.latency_ms)) as latencia_media_ms,
       sum(c.input_tokens) as tokens_entrada,
       round(sum(c.cost_cents)::numeric, 2) as custo_centavos_usd
  from llm_calls c
 where c.tenant_id = :tenant
   and c.created_at >= now() - interval '7 days'
 group by 1
 order by 1 desc;
```

Prompt grande aparece em `tokens_entrada`, não em `tokens_saída`. Erro recorrente aparece em
`status = 'error'` com `error_code` — provedor e timeout se consertam em código, não em prompt.

```sql
select c.status, c.error_code, count(*)
  from llm_calls c
 where c.tenant_id = :tenant and c.created_at >= now() - interval '7 days'
 group by 1, 2 order by 3 desc;
```

## 3. Ler uma conversa de verdade

```sql
select m.created_at, m.sender, m.content
  from chat_messages m
  join customers c on c.id = m.customer_id
 where c.tenant_id = :tenant and c.phone = :telefone
 order by m.created_at
 limit 100;
```

Amostra dos últimos turnos, se você não tem um caso:

```sql
select m.created_at, c.phone, m.sender, left(m.content, 300) as texto
  from chat_messages m
  join customers c on c.id = m.customer_id
 where c.tenant_id = :tenant and m.created_at >= now() - interval '7 days'
 order by m.created_at desc
 limit 60;
```

`sender` é `USER`, `BOT` ou `HUMAN`. Se não existe `HUMAN` depois de um `handoff`, ninguém assumiu:
o bot prometeu (ou o guard prometeu) e a pessoa ficou esperando.

## 4. Atendidos vs. pedidos fechados

```sql
select (select count(distinct m.customer_id)
          from chat_messages m join customers c on c.id = m.customer_id
         where c.tenant_id = :tenant and m.created_at >= now() - interval '7 days') as clientes,
       (select count(*) from orders o
         where o.tenant_id = :tenant and o.created_at >= now() - interval '7 days') as pedidos,
       (select count(*) from orders o
         where o.tenant_id = :tenant and o.created_at >= now() - interval '7 days'
           and o.status in ('CONFIRMED', 'PREPARING', 'DISPATCHED', 'DELIVERED')) as confirmados;
```

## 5. Pedido montado e não confirmado

```sql
select o.id, c.phone, o.status, o.total, o.created_at,
       max(m.created_at) as ultima_mensagem
  from orders o
  join customers c on c.id = o.customer_id
  left join chat_messages m on m.customer_id = c.id
 where o.tenant_id = :tenant
   and o.status = 'PENDING'
   and o.created_at < now() - interval '1 hour'
 group by o.id, c.phone
 order by o.created_at desc
 limit 20;
```

O tipo de alerta `pedido_abandonado` existe em `AlertKind` mas **ainda não tem produtor** — esse
sinal só sai por SQL.

## 6. Quem está silenciado

```sql
select count(*) filter (where bot_silenced_until > now()) as silenciados_agora,
       count(*) filter (where is_human_attending) as marcados_humanos
  from customers
 where tenant_id = :tenant;
```

Silenciado é consequência de handoff e de opt-out, não de prompt. Volume alto aqui costuma ser
`detectHumanRequest` casando cedo demais (`src/lib/bot/guardrails/detect.ts`), não texto do bot.

## 7. Cobertura do conhecimento

```sql
select coalesce(category, 'sem categoria') as categoria,
       count(*) filter (where is_active) as ativas,
       count(*) as total
  from knowledge_entries
 where tenant_id = :tenant
 group by 1
 order by 3 desc;
```

Pergunta de política que o cliente repetiu e o bot não respondeu = entrada faltando. É conserto
no `/admin/conhecimento`, não no prompt.

## Sintoma → causa → onde consertar

| sintoma | sinal | causa provável | camada |
|---|---|---|---|
| inventa preço | `alerts.kind = 'preco_incoerente'` | preço escrito no prompt, ou item sem preço no catálogo | prompt se ele afirma valor; catálogo se o dado falta |
| promete prazo | `alerts.kind = 'prazo_inventado'` | prazo no prompt, ou prazo ausente do conhecimento | prompt; conhecimento |
| "passa tudo pra atendente" | `alerts.kind = 'handoff'`, `body` = fala do cliente | regex casando cedo demais, **ou** o cliente pediu mesmo | `guardrails/detect.ts` se falso positivo; operação se verdadeiro |
| responde robótico / genérico | sem alerta; ler `chat_messages` | prompt sem persona, sem o nome da padaria, sem o que fazer em cada situação | prompt |
| fala demais / custo alto | `llm_calls.input_tokens` alto; mensagens longas | prompt enorme, ou pedindo lista | prompt |
| não usa o cardápio | bot cita item inexistente; pedido com item errado | prompt mandando responder de cabeça, ou tool falhando (não há telemetria por tool) | prompt se ele não consulta; código se a tool falha |
| demora | `llm_calls.latency_ms` | provedor/modelo, timeout, retry | configuração/código |
| erra e desiste | `llm_calls.status = 'error'` + `error_code`; alertas `bot_erro`, `provedor_fora_do_ar` | provider fora, timeout, resposta fora do schema | código/configuração |
| parou de responder | `alerts.kind = 'orcamento_estourado'`; gasto vs `monthly_budget_cents` | teto mensal atingido | `/admin/metricas` → subir teto |
| não fecha pedido | `orders` PENDING antigos + conversa com resumo sem "sim" | prompt pedindo confirmação cedo, ou pergunta errada no fim | prompt |
| não sabe horário/taxa | `knowledge_entries` vazio na categoria | dado faltando | `/admin/conhecimento` |
| cliente reclamou de mensagem estranha | corpo de `preco_incoerente` / `prazo_inventado` | guard reescreveu a resposta | prompt (tirar a afirmação) |

## Superfícies prontas

- `/admin/metricas` — chamadas, latência, taxa de erro, tokens, custo e barra de orçamento (7 dias).
- `/admin/alertas` — alertas abertos por tipo, com o corpo que mostra a mensagem vetada.
- `bot-error.log` na raiz do repo — stack do último erro do `process-bot`.
