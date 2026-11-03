# Graph Report - agente-atendimento  (2026-11-03)

## Corpus Check
- 158 files · ~73,630 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 802 nodes · 1604 edges · 49 communities (39 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3f084acc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- prisma.ts
- bot-flow-e2e.test.ts
- llm-agent.ts
- Documentação da API REST
- company-settings/route.ts
- auth.ts
- package.json
- Diagnóstico — os sinais que apontam a causa, e como lê-los sem ler todas as conversas
- dependencies
- components.json
- getAuthUser
- KanbanContainer.tsx
- compilerOptions
- react
- products.service.ts
- Afinar o prompt do bot com dados
- Guia de Configuração: Impressão Silenciosa (Kiosk Printing)
- devDependencies
- import-cardapio.ts
- evolution-go.ts
- 🛠️ Lista de Ferramentas e Serviços do Sistema
- CardapioManager.tsx
- ChatContainer.tsx
- Agente de Atendimento (Sabor de Minas)
- scripts
- empresa/page.tsx
- process-bot/route.ts
- button.tsx
- AlertsList.tsx
- websocket.ts
- usuarios/page.tsx
- perfil/page.tsx
- CardapioView.tsx
- Anatomia do prompt — o que o código já garante e os anti-padrões deste projeto
- Sincronização de Mensagens Externas do WhatsApp (Outros Dispositivos)
- configuracoes/page.tsx
- KnowledgeManager
- metricas/page.tsx
- app/layout.tsx
- README.md
- next.config.ts
- eslint.config.mjs
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `unauthorized()` - 45 edges
2. `requireUser()` - 44 edges
3. `prisma` - 41 edges
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
- `call()` --calls--> `GeminiAdapter`  [EXTRACTED]
  test/gemini-thinking.test.ts → src/lib/adapters/gemini.ts
- `makeService()` --calls--> `EvolutionGoService`  [EXTRACTED]
  test/evolution-go.test.ts → src/lib/services/evolution-go.ts
- `SettingsPage()` --calls--> `getAuthUser()`  [EXTRACTED]
  src/app/admin/configuracoes/page.tsx → src/lib/utils/auth-route.ts
- `EmpresaPage()` --calls--> `getAuthUser()`  [EXTRACTED]
  src/app/admin/empresa/page.tsx → src/lib/utils/auth-route.ts

## Import Cycles
- None detected.

## Communities (49 total, 4 thin omitted)

### Community 0 - "prisma.ts"
Cohesion: 0.09
Nodes (40): DELETE(), PATCH(), RouteParams, GET(), POST(), dynamic, PATCH(), VALID (+32 more)

### Community 1 - "bot-flow-e2e.test.ts"
Cohesion: 0.08
Nodes (41): DeepSeekAdapter, DeepSeekToolCall, FormattedMessage, adapters, createLLMService(), GEMINI_3_LEVELS, GeminiAdapter, GeminiPart (+33 more)

### Community 2 - "llm-agent.ts"
Cohesion: 0.07
Nodes (33): IntentRouter, IntentRouterResponse, AgentProcessResult, AgentResponseSchema, CONSULTAR_CARDAPIO_TOOL, flattenToolHistory(), GenerateFn, LLMAgent (+25 more)

### Community 3 - "Documentação da API REST"
Cohesion: 0.06
Nodes (33): 1. `GET /api/bot-settings`, 1. `GET /api/chat`, 1. `GET /api/company-settings`, 1. `GET /api/evolution/status`, 1. `GET /api/orders`, 1. `GET /api/products`, 1. `POST /api/auth/login`, 1. `POST /api/customers/[id]/handover` (+25 more)

### Community 4 - "company-settings/route.ts"
Cohesion: 0.13
Nodes (24): dynamic, GET(), PUT(), toCompanyJson(), UPLOADS_DIR, POST(), dynamic, GET() (+16 more)

### Community 5 - "auth.ts"
Cohesion: 0.18
Nodes (12): jose, zod, POST(), GET(), PATCH(), ProfileSchema, JWTPayload, SECRET_KEY (+4 more)

### Community 6 - "package.json"
Cohesion: 0.08
Nodes (25): name, private, version, ai, @ai-sdk/openai-compatible, @base-ui/react, dotenv, eslint (+17 more)

### Community 7 - "Diagnóstico — os sinais que apontam a causa, e como lê-los sem ler todas as conversas"
Cohesion: 0.17
Nodes (11): 0. Quem é o tenant e como o bot está configurado, 1. Alertas por tipo — a origem mais barata de causa, 2. Custo, latência e erro das chamadas de IA, 3. Ler uma conversa de verdade, 4. Atendidos vs. pedidos fechados, 5. Pedido montado e não confirmado, 6. Quem está silenciado, 7. Cobertura do conhecimento (+3 more)

### Community 8 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, ai, @ai-sdk/openai-compatible, @base-ui/react, bcryptjs, class-variance-authority, clsx, ioredis (+15 more)

### Community 9 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 10 - "getAuthUser"
Cohesion: 0.12
Nodes (19): AlertasPage(), dynamic, CardapioManager(), AdminCardapioPage(), dynamic, ChatPage(), dynamic, ConhecimentoPage() (+11 more)

### Community 11 - "KanbanContainer.tsx"
Cohesion: 0.16
Nodes (15): Customer, KanbanContainer(), Order, OrderItem, Product, statusColumns, SoundContext, SoundContextValue (+7 more)

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "react"
Cohesion: 0.17
Nodes (9): lucide-react, react, KnowledgeItem, EncomendaToastData, ToastData, NotificationToast(), NotificationToastProps, OrderToast() (+1 more)

### Community 14 - "products.service.ts"
Cohesion: 0.10
Nodes (32): LLMAgentDeps, cardapioTool, DEFINITION, run(), shortIdFor(), conhecimentoTool, DEFINITION, run() (+24 more)

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
Cohesion: 0.18
Nodes (8): ADDITIONAL_GROUPS, AdditionalGroupSeed, CATEGORIES, CategorySeed, bcryptjs, ioredis, pg, @prisma/adapter-pg

### Community 19 - "evolution-go.ts"
Cohesion: 0.11
Nodes (13): dynamic, POST(), dynamic, GET(), evolutionGo, EvolutionGoConfig, EvolutionGoService, EvolutionStatusShape (+5 more)

### Community 20 - "🛠️ Lista de Ferramentas e Serviços do Sistema"
Cohesion: 0.15
Nodes (12): 1. `OrdersService.updateOrderItems` (Atualizador de Carrinho e Pedido), 2. `OrdersService.finalizeOrder` (Gerador de Pedidos no Banco e Kanban), 3. `OrdersService.cancelOrder` (Cancelamento de Pedidos), 4. `SessionService` & Extrator de Cadastro (`customerInfo`), 5. `IntentRouter` (Roteador de Regras / Bypass de Tokens), 6. `sendChunkedResponse` (Formatador de Resposta e Envio WhatsApp), 7. `EvolutionGoService` (Serviço de Comunicação WhatsApp), 🏛️ Arquitetura de IA: Saída Estruturada (+4 more)

### Community 21 - "CardapioManager.tsx"
Cohesion: 0.20
Nodes (9): AdditionalItem, AdicionaisManager(), Category, Category, Product, Tab, TABS, CategoriasManager() (+1 more)

### Community 22 - "ChatContainer.tsx"
Cohesion: 0.27
Nodes (6): ChatContainer(), Conversation, formatTime(), Message, AdminLayout(), useSocket()

### Community 23 - "Agente de Atendimento (Sabor de Minas)"
Cohesion: 0.20
Nodes (9): Agente de Atendimento (Sabor de Minas), Ambiente / Rodar, Arquitetura do atendimento WhatsApp (fluxo), Banco (Prisma), Convenções de código, Docs adicionais, Stack, This is NOT the Next.js you know (+1 more)

### Community 24 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, db:clean, db:import-cardapio, dev, lint, start, test (+2 more)

### Community 25 - "empresa/page.tsx"
Cohesion: 0.28
Nodes (6): Company, CompanyForm(), ConnectionStatus, EvolutionCard(), dynamic, EmpresaPage()

### Community 26 - "process-bot/route.ts"
Cohesion: 0.06
Nodes (46): allowedPriceCents(), BotRouteDeps, handlePreLlmGuardrails(), isEncomendaRequest(), POST(), triggerEncomendaHandover(), PATCH(), RouteParams (+38 more)

### Community 27 - "button.tsx"
Cohesion: 0.36
Nodes (6): class-variance-authority, clsx, tailwind-merge, Button(), buttonVariants, cn()

### Community 28 - "AlertsList.tsx"
Cohesion: 0.40
Nodes (3): AlertItem, AlertsList(), SEVERITY_STYLE

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

### Community 37 - "metricas/page.tsx"
Cohesion: 0.53
Nodes (5): dynamic, MetricasPage(), sevenDaysAgo(), usd(), monthlySpendCents()

### Community 38 - "app/layout.tsx"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, openSans

### Community 40 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

## Knowledge Gaps
- **331 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+326 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 383 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `CardapioView.tsx`, `bot-flow-e2e.test.ts`, `llm-agent.ts`, `configuracoes/page.tsx`, `company-settings/route.ts`, `metricas/page.tsx`, `auth.ts`, `getAuthUser`, `products.service.ts`, `evolution-go.ts`, `empresa/page.tsx`, `process-bot/route.ts`, `usuarios/page.tsx`, `perfil/page.tsx`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `getAuthUser()` connect `getAuthUser` to `CardapioView.tsx`, `prisma.ts`, `configuracoes/page.tsx`, `company-settings/route.ts`, `metricas/page.tsx`, `auth.ts`, `evolution-go.ts`, `empresa/page.tsx`, `usuarios/page.tsx`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _331 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `prisma.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08531468531468532 - nodes in this community are weakly interconnected._
- **Should `bot-flow-e2e.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07727272727272727 - nodes in this community are weakly interconnected._
- **Should `llm-agent.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06554019457245264 - nodes in this community are weakly interconnected._