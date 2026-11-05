# Graph Report - agente-atendimento  (2026-11-05)

## Corpus Check
- 167 files · ~84,061 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 837 nodes · 1675 edges · 56 communities (47 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1c1f227a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- prisma.ts
- llm-agent.ts
- process-bot/route.ts
- Documentação da API REST
- company-settings/route.ts
- auth-route.ts
- package.json
- Diagnóstico — os sinais que apontam a causa, e como lê-los sem ler todas as conversas
- dependencies
- components.json
- getAuthUser
- KanbanContainer.tsx
- compilerOptions
- react
- normalize
- Afinar o prompt do bot com dados
- Guia de Configuração: Impressão Silenciosa (Kiosk Printing)
- devDependencies
- import-cardapio.ts
- EvolutionGoService
- 🛠️ Lista de Ferramentas e Serviços do Sistema
- CardapioManager.tsx
- ChatContainer.tsx
- Agente de Atendimento (Sabor de Minas)
- scripts
- bot-flow-e2e.test.ts
- redis.ts
- button.tsx
- alertas/page.tsx
- websocket.ts
- usuarios/page.tsx
- perfil/page.tsx
- CardapioView.tsx
- Anatomia do prompt — o que o código já garante e os anti-padrões deste projeto
- Sincronização de Mensagens Externas do WhatsApp (Outros Dispositivos)
- configuracoes/page.tsx
- media.service.ts
- metricas/page.tsx
- app/layout.tsx
- formatOrderNumber
- README.md
- evolution-go.ts
- next.config.ts
- eslint.config.mjs
- postcss.config.mjs
- message-sender.ts
- bot-flow.test.ts
- storage.ts
- admin/layout.tsx
- format-order-summary.ts

## God Nodes (most connected - your core abstractions)
1. `unauthorized()` - 47 edges
2. `requireUser()` - 46 edges
3. `prisma` - 42 edges
4. `getAuthUser()` - 37 edges
5. `POST()` - 29 edges
6. `react` - 21 edges
7. `lucide-react` - 19 edges
8. `BotSession` - 19 edges
9. `compilerOptions` - 16 edges
10. `EvolutionGoService` - 15 edges

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

## Communities (56 total, 3 thin omitted)

### Community 0 - "prisma.ts"
Cohesion: 0.09
Nodes (42): DELETE(), PATCH(), RouteParams, GET(), POST(), dynamic, PATCH(), VALID (+34 more)

### Community 1 - "llm-agent.ts"
Cohesion: 0.06
Nodes (59): DeepSeekAdapter, DeepSeekToolCall, FormattedMessage, adapters, GEMINI_3_LEVELS, GeminiAdapter, GeminiPart, thinkingFromConfig() (+51 more)

### Community 2 - "process-bot/route.ts"
Cohesion: 0.05
Nodes (47): allowedPriceCents(), handlePreLlmGuardrails(), isEncomendaRequest(), POST(), triggerEncomendaHandover(), detectHumanRequest(), detectOptOut(), HUMAN_PATTERNS (+39 more)

### Community 3 - "Documentação da API REST"
Cohesion: 0.06
Nodes (33): 1. `GET /api/bot-settings`, 1. `GET /api/chat`, 1. `GET /api/company-settings`, 1. `GET /api/evolution/status`, 1. `GET /api/orders`, 1. `GET /api/products`, 1. `POST /api/auth/login`, 1. `POST /api/customers/[id]/handover` (+25 more)

### Community 4 - "company-settings/route.ts"
Cohesion: 0.15
Nodes (21): dynamic, GET(), PUT(), toCompanyJson(), UPLOADS_DIR, dynamic, GET(), MIME_TYPES (+13 more)

### Community 5 - "auth-route.ts"
Cohesion: 0.18
Nodes (12): jose, zod, POST(), GET(), PATCH(), ProfileSchema, JWTPayload, SECRET_KEY (+4 more)

### Community 6 - "package.json"
Cohesion: 0.08
Nodes (25): name, private, version, ai, @ai-sdk/openai-compatible, @base-ui/react, dotenv, eslint (+17 more)

### Community 7 - "Diagnóstico — os sinais que apontam a causa, e como lê-los sem ler todas as conversas"
Cohesion: 0.17
Nodes (11): 0. Quem é o tenant e como o bot está configurado, 1. Alertas por tipo — a origem mais barata de causa, 2. Custo, latência e erro das chamadas de IA, 3. Ler uma conversa de verdade, 4. Atendidos vs. pedidos fechados, 5. Pedido montado e não confirmado, 6. Quem está silenciado, 7. Cobertura do conhecimento (+3 more)

### Community 8 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, ai, @ai-sdk/openai-compatible, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, @base-ui/react, bcryptjs, class-variance-authority (+17 more)

### Community 9 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 10 - "getAuthUser"
Cohesion: 0.20
Nodes (11): ChatPage(), dynamic, AdminDashboard(), DELETE(), dynamic, PATCH(), RouteParams, dynamic (+3 more)

### Community 11 - "KanbanContainer.tsx"
Cohesion: 0.18
Nodes (9): Customer, Order, OrderItem, Product, statusColumns, dynamic, SoundContext, SoundContextValue (+1 more)

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "react"
Cohesion: 0.16
Nodes (9): lucide-react, react, KnowledgeItem, Company, CompanyForm(), ConnectionStatus, EvolutionCard(), dynamic (+1 more)

### Community 14 - "normalize"
Cohesion: 0.15
Nodes (12): KnowledgeManager(), ConhecimentoPage(), dynamic, KnowledgeHit, KnowledgeService, closestSubstringDistance(), levenshtein(), matchesProduct() (+4 more)

### Community 15 - "Afinar o prompt do bot com dados"
Cohesion: 0.18
Nodes (10): Afinar o prompt do bot com dados, Como você age, O que você nunca faz, Onde o prompt mora, Passo 0 — O sintoma, com uma conversa, Passo 1 — Medir antes de opinar, Passo 2 — Ler o prompt contra o que o código já faz, Passo 3 — A versão nova, testada antes/depois (+2 more)

### Community 16 - "Guia de Configuração: Impressão Silenciosa (Kiosk Printing)"
Cohesion: 0.14
Nodes (13): Criando um atalho `.command` de 1-clique na Área de Trabalho:, Guia de Configuração: Impressão Silenciosa (Kiosk Printing), No macOS:, No macOS (Google Chrome):, No Windows:, No Windows (Google Chrome / Microsoft Edge):, 🖨️ Passo 1: Definir a Impressora Térmica como Padrão do Sistema, 🚀 Passo 2: Configurar o Navegador para Impressão Silenciosa (`--kiosk-printing`) (+5 more)

### Community 17 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, dotenv, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx, @types/bcryptjs (+6 more)

### Community 18 - "import-cardapio.ts"
Cohesion: 0.13
Nodes (11): ADDITIONAL_GROUPS, AdditionalGroupSeed, CATEGORIES, CategorySeed, CATEGORIES, CategorySeed, ProductSeed, bcryptjs (+3 more)

### Community 19 - "EvolutionGoService"
Cohesion: 0.17
Nodes (3): EvolutionGoService, CapturedRequest, makeService()

### Community 20 - "🛠️ Lista de Ferramentas e Serviços do Sistema"
Cohesion: 0.15
Nodes (12): 1. `OrdersService.updateOrderItems` (Atualizador de Carrinho e Pedido), 2. `OrdersService.finalizeOrder` (Gerador de Pedidos no Banco e Kanban), 3. `OrdersService.cancelOrder` (Cancelamento de Pedidos), 4. `SessionService` & Extrator de Cadastro (`customerInfo`), 5. `IntentRouter` (Roteador de Regras / Bypass de Tokens), 6. `sendChunkedResponse` (Formatador de Resposta e Envio WhatsApp), 7. `EvolutionGoService` (Serviço de Comunicação WhatsApp), 🏛️ Arquitetura de IA: Saída Estruturada (+4 more)

### Community 21 - "CardapioManager.tsx"
Cohesion: 0.15
Nodes (12): AdditionalItem, AdicionaisManager(), Category, CardapioManager(), Category, Product, Tab, TABS (+4 more)

### Community 22 - "ChatContainer.tsx"
Cohesion: 0.39
Nodes (6): ChatContainer(), Conversation, formatTime(), mediaUrl(), Message, useSocket()

### Community 23 - "Agente de Atendimento (Sabor de Minas)"
Cohesion: 0.20
Nodes (9): Agente de Atendimento (Sabor de Minas), Ambiente / Rodar, Arquitetura do atendimento WhatsApp (fluxo), Banco (Prisma), Convenções de código, Docs adicionais, Stack, This is NOT the Next.js you know (+1 more)

### Community 24 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, db:clean, db:import-cardapio, db:import-sag, dev, lint, start (+3 more)

### Community 25 - "bot-flow-e2e.test.ts"
Cohesion: 0.20
Nodes (11): createLLMService(), ProductsService, CUSTOMER_REPLY_TOOL, customerConfig(), customerSystemPrompt(), extractCustomerMessage(), Goal, noopSend() (+3 more)

### Community 26 - "redis.ts"
Cohesion: 0.31
Nodes (6): MessageBuffer, globalForRedis, redisKey(), redisPrefix, redisPub, redisSub

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

### Community 31 - "perfil/page.tsx"
Cohesion: 0.25
Nodes (5): dynamic, PerfilPage(), PerfilForm(), PerfilFormProps, Status

### Community 32 - "CardapioView.tsx"
Cohesion: 0.18
Nodes (10): AdditionalItem, CardapioView(), CardapioViewProps, CartExtra, CartItem, Category, Product, CardapioPage() (+2 more)

### Community 33 - "Anatomia do prompt — o que o código já garante e os anti-padrões deste projeto"
Cohesion: 0.25
Nodes (7): Anatomia do prompt — o que o código já garante e os anti-padrões deste projeto, Anti-padrões (cada um tem um defeito real por trás), Checklist de revisão (marque o trecho do prompt em cada linha), Conteúdo condicional é conhecimento, não prompt, O que o código garante — não vai no prompt, O que o código monta a cada turno, O que o prompt controla

### Community 34 - "Sincronização de Mensagens Externas do WhatsApp (Outros Dispositivos)"
Cohesion: 0.29
Nodes (6): 1. Visão Geral do Problema, 2. É Possível Capturar?, 3. Desafio e Solução: Deduplicação, 4. Tarefas de Implementação, 5. Próximos Passos, Sincronização de Mensagens Externas do WhatsApp (Outros Dispositivos)

### Community 35 - "configuracoes/page.tsx"
Cohesion: 0.40
Nodes (4): ConfigForm(), Settings, dynamic, SettingsPage()

### Community 36 - "media.service.ts"
Cohesion: 0.23
Nodes (11): POST(), BotMediaType, detectMedia(), extFromMimetype(), IngestedMedia, ingestInboundMedia(), MediaDetection, refreshCustomerAvatar() (+3 more)

### Community 37 - "metricas/page.tsx"
Cohesion: 0.53
Nodes (5): dynamic, MetricasPage(), sevenDaysAgo(), usd(), monthlySpendCents()

### Community 38 - "app/layout.tsx"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, openSans

### Community 39 - "formatOrderNumber"
Cohesion: 0.27
Nodes (10): KanbanContainer(), OrderToast(), OrderToastProps, formatOrderNumber(), parseOrderNotes(), Customer, formatDate(), OrderItem (+2 more)

### Community 40 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 41 - "evolution-go.ts"
Cohesion: 0.21
Nodes (10): dynamic, POST(), dynamic, GET(), evolutionGo, EvolutionGoConfig, EvolutionStatusShape, getEvolutionServiceForTenant() (+2 more)

### Community 51 - "message-sender.ts"
Cohesion: 0.24
Nodes (9): POST(), delay(), SendChunkedParams, sendChunkedResponse(), splitMessage(), redisChannel(), AlertKind, AlertSeverity (+1 more)

### Community 52 - "bot-flow.test.ts"
Cohesion: 0.27
Nodes (6): BotRouteDeps, AgentResponse, fakeLLM(), noopSend(), req(), runTurn()

### Community 53 - "storage.ts"
Cohesion: 0.31
Nodes (6): @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, GET(), ensureBucket(), presignedGet(), s3

### Community 54 - "admin/layout.tsx"
Cohesion: 0.25
Nodes (5): AdminLayout(), EncomendaToastData, ToastData, NotificationToast(), NotificationToastProps

### Community 55 - "format-order-summary.ts"
Cohesion: 0.33
Nodes (5): formatOrderSummary(), SummarizableOrder, SummaryAddress, SummaryItem, ORDER

## Knowledge Gaps
- **342 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+337 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 398 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `llm-agent.ts`, `process-bot/route.ts`, `company-settings/route.ts`, `auth-route.ts`, `getAuthUser`, `react`, `normalize`, `bot-flow-e2e.test.ts`, `redis.ts`, `alertas/page.tsx`, `usuarios/page.tsx`, `perfil/page.tsx`, `CardapioView.tsx`, `configuracoes/page.tsx`, `media.service.ts`, `metricas/page.tsx`, `evolution-go.ts`, `message-sender.ts`, `bot-flow.test.ts`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `getAuthUser()` connect `getAuthUser` to `CardapioView.tsx`, `prisma.ts`, `configuracoes/page.tsx`, `company-settings/route.ts`, `metricas/page.tsx`, `auth-route.ts`, `evolution-go.ts`, `KanbanContainer.tsx`, `react`, `normalize`, `CardapioManager.tsx`, `alertas/page.tsx`, `usuarios/page.tsx`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _342 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `prisma.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08798076923076924 - nodes in this community are weakly interconnected._
- **Should `llm-agent.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.062037037037037036 - nodes in this community are weakly interconnected._
- **Should `process-bot/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.053069420539300055 - nodes in this community are weakly interconnected._