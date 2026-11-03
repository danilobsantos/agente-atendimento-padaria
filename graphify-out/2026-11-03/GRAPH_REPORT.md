# Graph Report - agente-atendimento  (2026-10-22)

## Corpus Check
- 155 files · ~70,937 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 784 nodes · 1580 edges · 51 communities (41 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3f084acc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- prisma.ts
- llm-agent.ts
- process-bot/route.ts
- Documentação da API REST
- company-settings/route.ts
- auth.ts
- package.json
- bot-flow-e2e.test.ts
- dependencies
- components.json
- getAuthUser
- KanbanContainer.tsx
- compilerOptions
- react
- knowledge.service.ts
- Plano de robustez do agente de atendimento
- Guia de Configuração: Impressão Silenciosa (Kiosk Printing)
- devDependencies
- import-cardapio.ts
- EvolutionGoService
- 🛠️ Lista de Ferramentas e Serviços do Sistema
- CardapioManager.tsx
- ChatContainer.tsx
- Agente de Atendimento (Sabor de Minas)
- scripts
- empresa/page.tsx
- bot-flow.test.ts
- button.tsx
- alertas/page.tsx
- websocket.ts
- usuarios/page.tsx
- getEvolutionServiceForTenant
- CardapioView.tsx
- format-order-summary.ts
- Sincronização de Mensagens Externas do WhatsApp (Outros Dispositivos)
- configuracoes/page.tsx
- KnowledgeManager.tsx
- metricas/page.tsx
- app/layout.tsx
- app/cardapio/page.tsx
- README.md
- admin/cardapio/page.tsx
- next.config.ts
- eslint.config.mjs
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `unauthorized()` - 45 edges
2. `requireUser()` - 44 edges
3. `prisma` - 40 edges
4. `getAuthUser()` - 37 edges
5. `POST()` - 29 edges
6. `react` - 21 edges
7. `lucide-react` - 19 edges
8. `BotSession` - 19 edges
9. `compilerOptions` - 16 edges
10. `redisKey()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `runGoal()` --calls--> `POST()`  [EXTRACTED]
  test/bot-flow-e2e.test.ts → src/app/api/chat/process-bot/route.ts
- `runTurn()` --calls--> `POST()`  [EXTRACTED]
  test/bot-flow.test.ts → src/app/api/chat/process-bot/route.ts
- `call()` --calls--> `GeminiAdapter`  [EXTRACTED]
  test/gemini-thinking.test.ts → src/lib/adapters/gemini.ts
- `makeService()` --calls--> `EvolutionGoService`  [EXTRACTED]
  test/evolution-go.test.ts → src/lib/services/evolution-go.ts
- `AlertasPage()` --calls--> `getAuthUser()`  [EXTRACTED]
  src/app/admin/alertas/page.tsx → src/lib/utils/auth-route.ts

## Import Cycles
- None detected.

## Communities (51 total, 4 thin omitted)

### Community 0 - "prisma.ts"
Cohesion: 0.06
Nodes (62): DELETE(), PATCH(), RouteParams, GET(), POST(), dynamic, PATCH(), VALID (+54 more)

### Community 1 - "llm-agent.ts"
Cohesion: 0.06
Nodes (57): DeepSeekAdapter, DeepSeekToolCall, FormattedMessage, adapters, GEMINI_3_LEVELS, GeminiAdapter, GeminiPart, thinkingFromConfig() (+49 more)

### Community 2 - "process-bot/route.ts"
Cohesion: 0.06
Nodes (45): allowedPriceCents(), handlePreLlmGuardrails(), isEncomendaRequest(), POST(), triggerEncomendaHandover(), detectHumanRequest(), detectOptOut(), HUMAN_PATTERNS (+37 more)

### Community 3 - "Documentação da API REST"
Cohesion: 0.06
Nodes (33): 1. `GET /api/bot-settings`, 1. `GET /api/chat`, 1. `GET /api/company-settings`, 1. `GET /api/evolution/status`, 1. `GET /api/orders`, 1. `GET /api/products`, 1. `POST /api/auth/login`, 1. `POST /api/customers/[id]/handover` (+25 more)

### Community 4 - "company-settings/route.ts"
Cohesion: 0.14
Nodes (23): dynamic, GET(), PUT(), toCompanyJson(), UPLOADS_DIR, POST(), dynamic, GET() (+15 more)

### Community 5 - "auth.ts"
Cohesion: 0.11
Nodes (17): jose, zod, dynamic, PerfilPage(), PerfilForm(), PerfilFormProps, Status, POST() (+9 more)

### Community 6 - "package.json"
Cohesion: 0.08
Nodes (24): name, private, version, ai, @ai-sdk/openai-compatible, @base-ui/react, dotenv, eslint (+16 more)

### Community 7 - "bot-flow-e2e.test.ts"
Cohesion: 0.13
Nodes (13): createLLMService(), flattenToolHistory(), LLMAgent, ToolBreaker, CUSTOMER_REPLY_TOOL, customerConfig(), customerSystemPrompt(), extractCustomerMessage() (+5 more)

### Community 8 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, ai, @ai-sdk/openai-compatible, @base-ui/react, bcryptjs, class-variance-authority, clsx, ioredis (+15 more)

### Community 9 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 10 - "getAuthUser"
Cohesion: 0.16
Nodes (14): ChatPage(), dynamic, ConhecimentoPage(), dynamic, AdminDashboard(), dynamic, DELETE(), dynamic (+6 more)

### Community 11 - "KanbanContainer.tsx"
Cohesion: 0.19
Nodes (15): Customer, KanbanContainer(), Order, OrderItem, Product, statusColumns, OrderToast(), OrderToastProps (+7 more)

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "react"
Cohesion: 0.17
Nodes (9): lucide-react, react, EncomendaToastData, ToastData, SoundContext, SoundContextValue, useSound(), NotificationToast() (+1 more)

### Community 14 - "knowledge.service.ts"
Cohesion: 0.24
Nodes (9): KnowledgeHit, KnowledgeService, closestSubstringDistance(), levenshtein(), matchesProduct(), normalize(), STOP_WORDS, tokenHitRatio() (+1 more)

### Community 15 - "Plano de robustez do agente de atendimento"
Cohesion: 0.12
Nodes (15): Backlog (inalterado), Backlog (não executado nesta rodada), Contexto de execução, Desvios conscientes, Entregue, Fase 0 — Segurança *(bloqueio de go-live)*, Fase 1 — Bugs verificados, Fase 2 — Observabilidade + seam de LLM (+7 more)

### Community 16 - "Guia de Configuração: Impressão Silenciosa (Kiosk Printing)"
Cohesion: 0.14
Nodes (13): Criando um atalho `.command` de 1-clique na Área de Trabalho:, Guia de Configuração: Impressão Silenciosa (Kiosk Printing), No macOS:, No macOS (Google Chrome):, No Windows:, No Windows (Google Chrome / Microsoft Edge):, 🖨️ Passo 1: Definir a Impressora Térmica como Padrão do Sistema, 🚀 Passo 2: Configurar o Navegador para Impressão Silenciosa (`--kiosk-printing`) (+5 more)

### Community 17 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, dotenv, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx, @types/bcryptjs (+6 more)

### Community 18 - "import-cardapio.ts"
Cohesion: 0.18
Nodes (8): ADDITIONAL_GROUPS, AdditionalGroupSeed, CATEGORIES, CategorySeed, bcryptjs, ioredis, pg, @prisma/adapter-pg

### Community 19 - "EvolutionGoService"
Cohesion: 0.21
Nodes (3): EvolutionGoService, CapturedRequest, makeService()

### Community 20 - "🛠️ Lista de Ferramentas e Serviços do Sistema"
Cohesion: 0.15
Nodes (12): 1. `OrdersService.updateOrderItems` (Atualizador de Carrinho e Pedido), 2. `OrdersService.finalizeOrder` (Gerador de Pedidos no Banco e Kanban), 3. `OrdersService.cancelOrder` (Cancelamento de Pedidos), 4. `SessionService` & Extrator de Cadastro (`customerInfo`), 5. `IntentRouter` (Roteador de Regras / Bypass de Tokens), 6. `sendChunkedResponse` (Formatador de Resposta e Envio WhatsApp), 7. `EvolutionGoService` (Serviço de Comunicação WhatsApp), 🏛️ Arquitetura de IA: Saída Estruturada (+4 more)

### Community 21 - "CardapioManager.tsx"
Cohesion: 0.20
Nodes (9): AdditionalItem, AdicionaisManager(), Category, Category, Product, Tab, TABS, CategoriasManager() (+1 more)

### Community 22 - "ChatContainer.tsx"
Cohesion: 0.24
Nodes (7): socket.io-client, ChatContainer(), Conversation, formatTime(), Message, AdminLayout(), useSocket()

### Community 23 - "Agente de Atendimento (Sabor de Minas)"
Cohesion: 0.20
Nodes (9): Agente de Atendimento (Sabor de Minas), Ambiente / Rodar, Arquitetura do atendimento WhatsApp (fluxo), Banco (Prisma), Convenções de código, Docs adicionais, Stack, This is NOT the Next.js you know (+1 more)

### Community 24 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, db:clean, db:import-cardapio, dev, lint, start, test (+2 more)

### Community 25 - "empresa/page.tsx"
Cohesion: 0.28
Nodes (6): Company, CompanyForm(), ConnectionStatus, EvolutionCard(), dynamic, EmpresaPage()

### Community 26 - "bot-flow.test.ts"
Cohesion: 0.31
Nodes (5): AgentResponse, fakeLLM(), noopSend(), req(), runTurn()

### Community 27 - "button.tsx"
Cohesion: 0.36
Nodes (6): class-variance-authority, clsx, tailwind-merge, Button(), buttonVariants, cn()

### Community 28 - "alertas/page.tsx"
Cohesion: 0.29
Nodes (5): AlertItem, AlertsList(), SEVERITY_STYLE, AlertasPage(), dynamic

### Community 29 - "websocket.ts"
Cohesion: 0.29
Nodes (6): socket.io, httpServer, io, PORT, redisPrefix, redisSub

### Community 30 - "usuarios/page.tsx"
Cohesion: 0.33
Nodes (5): dynamic, UsuariosPage(), UserItem, UsersManager(), UsersManagerProps

### Community 31 - "getEvolutionServiceForTenant"
Cohesion: 0.38
Nodes (5): dynamic, POST(), dynamic, GET(), getEvolutionServiceForTenant()

### Community 32 - "CardapioView.tsx"
Cohesion: 0.29
Nodes (6): AdditionalItem, CardapioViewProps, CartExtra, CartItem, Category, Product

### Community 33 - "format-order-summary.ts"
Cohesion: 0.33
Nodes (5): formatOrderSummary(), SummarizableOrder, SummaryAddress, SummaryItem, ORDER

### Community 34 - "Sincronização de Mensagens Externas do WhatsApp (Outros Dispositivos)"
Cohesion: 0.29
Nodes (6): 1. Visão Geral do Problema, 2. É Possível Capturar?, 3. Desafio e Solução: Deduplicação, 4. Tarefas de Implementação, 5. Próximos Passos, Sincronização de Mensagens Externas do WhatsApp (Outros Dispositivos)

### Community 35 - "configuracoes/page.tsx"
Cohesion: 0.40
Nodes (4): ConfigForm(), Settings, dynamic, SettingsPage()

### Community 37 - "metricas/page.tsx"
Cohesion: 0.53
Nodes (5): dynamic, MetricasPage(), sevenDaysAgo(), usd(), monthlySpendCents()

### Community 38 - "app/layout.tsx"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, openSans

### Community 39 - "app/cardapio/page.tsx"
Cohesion: 0.40
Nodes (4): CardapioView(), CardapioPage(), CardapioPageProps, dynamic

### Community 40 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 41 - "admin/cardapio/page.tsx"
Cohesion: 0.50
Nodes (3): CardapioManager(), AdminCardapioPage(), dynamic

## Knowledge Gaps
- **318 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+313 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 367 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `llm-agent.ts`, `process-bot/route.ts`, `configuracoes/page.tsx`, `company-settings/route.ts`, `auth.ts`, `metricas/page.tsx`, `app/cardapio/page.tsx`, `bot-flow-e2e.test.ts`, `getAuthUser`, `knowledge.service.ts`, `empresa/page.tsx`, `bot-flow.test.ts`, `alertas/page.tsx`, `usuarios/page.tsx`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `getAuthUser()` connect `getAuthUser` to `prisma.ts`, `configuracoes/page.tsx`, `company-settings/route.ts`, `metricas/page.tsx`, `auth.ts`, `app/cardapio/page.tsx`, `admin/cardapio/page.tsx`, `empresa/page.tsx`, `alertas/page.tsx`, `usuarios/page.tsx`, `getEvolutionServiceForTenant`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _318 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `prisma.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.061211340206185565 - nodes in this community are weakly interconnected._
- **Should `llm-agent.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06393606393606394 - nodes in this community are weakly interconnected._
- **Should `process-bot/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05627545353572751 - nodes in this community are weakly interconnected._