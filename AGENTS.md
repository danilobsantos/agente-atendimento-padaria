<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agente de Atendimento (Sabor de Minas)

Sistema de delivery/atendimento via WhatsApp com IA. Pedidos feitos pelo WhatsApp (bot com LLM) ou pela página pública `/cardapio`, gerenciados em um painel admin multi-tenant.

## Stack

- **Next.js 16.2.9** (App Router, Turbopack), React 19, TypeScript 6, Tailwind CSS 4
- **Prisma 7** + PostgreSQL (client gerado em `src/generated/prisma`, no `@prisma/client` padrão) via `@prisma/adapter-pg`
- **Redis** (ioredis): sessões do bot, buffer/debounce de mensagens e pub/sub para o WebSocket
- **Socket.io** (porta 3001, script `npm run websocket`): notificações em tempo real no painel
- **Evolution API**: integração WhatsApp (webhook + envio de texto/presence/botões)
- **LLM**: adapters DeepSeek e Gemini (`src/lib/adapters/`), configuráveis por tenant em `/admin/configuracoes`
- **Auth**: JWT (`jose`) em cookie HttpOnly `auth_token`; bcryptjs para senhas; zod para validação

## Ambiente / Rodar

Dependências de infraestrutura rodam em Docker (`docker-compose.yml`, Postgres na porta 5433, Redis na 6379):

```bash
docker compose up -d postgres redis   # banco + cache (obrigatório)
npm install
npx prisma migrate deploy             # schema do banco
npx prisma db seed                    # tenant padrão + admin@padaria.com / admin123 + cardápio
npm run dev                           # front/API na porta 3000
npm run websocket                     # socket.io na porta 3001 (painel em tempo real)
```

> Se o Docker estiver parado, toda query Prisma falha com `PrismaClientKnownRequestError`. Suba os containers antes.

`.env`: veja `.env.example`. `DATABASE_URL`, `EVOLUTION_API_URL/KEY/INSTANCE_NAME`, `NEXT_PUBLIC_APP_URL`. `REDIS_URL` e `JWT_SECRET` têm defaults no código (Redis local, secret fallback).

## Arquitetura do atendimento WhatsApp (fluxo)

1. **Webhook** `POST /api/webhooks/evolution` ← Evolution API (`messages.upsert`). Salva a mensagem do cliente no banco, publica `tenant:{id}:message` no Redis (broadcast ao painel) e dispara `POST /api/chat/process-bot`.
2. **process-bot** (`/api/chat/process-bot`): debounce via `MessageBuffer` (lock `setnx` de 3s no Redis) → carrega/reutiliza sessão em `SessionService` (Redis, TTL configurável) → `IntentRouter` resolve fluxos fixos (menu, endereço, pagamento, confirmar/cancelar) → se não resolveu, `LLMAgent` gera resposta em JSON estruturado (intento, customerInfo, products) → `OrdersService` monta/atualiza/finaliza pedido → `sendChunkedResponse` envia pelo WhatsApp (mensagens >800 chars quebradas em blocos com presence "composing").
3. Pedidos persistem em `Order`/`OrderItem` no banco, publicam eventos `tenant:{id}:order` no Redis; o servidor socket.io escuta `tenant:*:*` e entrega na sala `tenant:{id}` do painel.

## Banco (Prisma)

- Modelos: `Tenant`, `BotSetting`, `Customer`, `ChatMessage`, `Category`, `Product`, `AdditionalItem`, `Order`, `OrderItem`, `User`.
- Multi-tenant: tudo filho de `Tenant`. **Atenção**: alguns fluxos ainda assumem single-tenant e usam `tenant.findFirst({ where: { active: true } })` (ex.: webhook, página de configurações) — ao mexer nisso, considere resolver o tenant correto.
- `User.email` é único; `name` é nullable. Mudança de senha/hash → bcrypt (cost 10). JWT é re-assinado quando e-mail/nome mudam.
- Migrações em `prisma/migrations`; scripts auxiliares: `db:clean` e `db:import-cardapio` (importa XLSX).

## Convenções de código

- Alias `@/*` → `src/`. Prisma e Redis são singletons em `src/lib/prisma.ts` / `src/lib/redis.ts`.
- Páginas com acesso a DB ou cookies usam `export const dynamic = "force-dynamic"` e buscam dados no servidor (padrão de `configuracoes/page.tsx`, `perfil/page.tsx`).
- Mutations via Route Handlers em `src/app/api/**/route.ts`; formulários clientes são `"use client"` e seguem o padrão de `ConfigForm.tsx` (estilo Sabor de Minas: amarelo/âmbar sobre `#FAF7F2`, todos os inputs/buttons com classes Tailwind explícitas).
- Auth: sessão via middleware (`src/middleware.ts`) protegendo `/admin/:path*`; payload JWT em `src/lib/auth.ts` (`userId`, `tenantId`, `email`, `name`); endpoints em `src/app/api/auth/` (login, signup, me, logout, profile).
- Números de pedido amigáveis: `formatOrderNumber(id)` → `#E625` (últimos 4 do UUID em maiúsculo). Sempre use esse formatador, nunca o UUID bruto para exibir.
- Impressão de recibo 80mm: `printReceipt80mm()` no `src/lib/utils/print-receipt.ts` (iframe invisível + `print()`); disparada ao confirmar/criar pedido. Setup em `docs/impressao-silenciosa.md`.
- Ícones: `lucide-react`.

## Verificação

- `npx tsc --noEmit` — typecheck (exigido sempre)
- `npm run build` — build completo (exigido)
- `npm run lint` — **tem ~27 erros pré-existentes** (no-explicit-any, no-require-imports, etc.) em arquivos antigos; corrija apenas o que os seus arquivos novos introduzem, não os legados
- Não há suíte de testes no projeto

## Docs adicionais

- `docs/api.md` — referência de endpoints
- `docs/tools.md`, `docs/impressao-silenciosa.md` — guias de setup (Evolution, impressão)