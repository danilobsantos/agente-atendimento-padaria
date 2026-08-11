# Documentação da API REST

Este documento descreve todos os endpoints da API REST do sistema de atendimento de padaria.

---

## 🔐 Autenticação (`/api/auth`)

### 1. `POST /api/auth/login`
Autentica o usuário (atendente/administrador).
* **Request Body**:
  ```json
  {
    "email": "atendente@padaria.com",
    "password": "senha"
  }
  ```
* **Resposta (200 OK)**:
  - Define o cookie de sessão HTTP-Only JWT.
  ```json
  {
    "message": "Autenticado com sucesso",
    "user": {
      "id": "usr_123",
      "email": "atendente@padaria.com",
      "tenantId": "cm7xyz123"
    }
  }
  ```

### 2. `POST /api/auth/signup`
Cria uma nova conta de usuário e cadastra uma tenant (padaria).
* **Request Body**:
  ```json
  {
    "name": "João Silva",
    "email": "joao@padaria.com",
    "password": "senha",
    "bakeryName": "Padaria Sabor de Minas"
  }
  ```
* **Resposta (201 Created)**:
  ```json
  {
    "message": "Usuário e Tenant criados com sucesso",
    "userId": "usr_123",
    "tenantId": "cm7xyz123"
  }
  ```

### 3. `GET /api/auth/me`
Retorna as informações do usuário autenticado no cookie da sessão.
* **Resposta (200 OK)**:
  ```json
  {
    "id": "usr_123",
    "email": "joao@padaria.com",
    "tenantId": "cm7xyz123"
  }
  ```

### 4. `POST /api/auth/logout`
Remove o cookie da sessão do usuário.
* **Resposta (200 OK)**:
  ```json
  { "message": "Sessão encerrada com sucesso" }
  ```

---

## 💬 Chat e Atendimento (`/api/chat`)

### 1. `GET /api/chat`
Lista conversas ativas ou o histórico de mensagens de um cliente.
* **Query Parameters**:
  - `tenantId` (string, opcional): Retorna a lista de conversas recentes agrupadas por cliente.
  - `customerId` (string, opcional): Retorna as últimas 50 mensagens em ordem cronológica de um cliente específico.
* **Exemplo de Resposta (`?tenantId=xxx`)**:
  ```json
  [
    {
      "customerId": "cust_123",
      "customerName": "Maria Oliveira",
      "phone": "5531999999999",
      "isHumanAttending": false,
      "lastMessage": {
        "id": "msg_001",
        "sender": "USER",
        "content": "Gostaria de ver o cardápio",
        "createdAt": "2026-08-04T18:00:00.000Z"
      }
    }
  ]
  ```

### 2. `POST /api/chat`
Envia uma mensagem manual do atendente humano para o WhatsApp do cliente.
* **Request Body**:
  ```json
  {
    "customerId": "cust_123",
    "content": "Olá Maria! Como posso ajudar?"
  }
  ```
* **Comportamento**:
  - Salva a mensagem como `sender: "HUMAN"`.
  - Ativa automaticamente o atendimento humano (`isHumanAttending: true`).
  - Envia a mensagem via Evolution API.
  - Notifica o Livechat via Redis/WebSocket.

### 3. `POST /api/chat/process-bot`
Endpoint assíncrono interno executado após o recebimento de mensagens para acionar o pipeline do robô/LLM.
* **Request Body**:
  ```json
  {
    "customerId": "cust_123",
    "message": "Quero 2 pães franceses"
  }
  ```
* **Resposta (200 OK)**:
  ```json
  {
    "status": "success",
    "response": "Adicionei 2x Pão Francês ao seu carrinho."
  }
  ```

---

## 👤 Transbordo Humano (`/api/customers/[id]/handover`)

### 1. `POST /api/customers/[id]/handover`
Alterna o status de atendimento de um cliente entre Robô (IA) e Atendente Humano.
* **URL Param**: `id` (ID do cliente).
* **Request Body**:
  ```json
  {
    "isHumanAttending": true
  }
  ```
* **Resposta (200 OK)**:
  ```json
  {
    "customerId": "cust_123",
    "isHumanAttending": true
  }
  ```

---

## 🛍️ Pedidos (`/api/orders`)

### 1. `GET /api/orders`
Retorna todos os pedidos da tenant para exibição no Kanban.
* **Query Params**: `tenantId` (obrigatório).
* **Resposta (200 OK)**: Lista de pedidos contendo cliente, itens, total, endereço de entrega e notas.

### 2. `POST /api/orders`
Cria um pedido manualmente ou via cardápio web.
* **Request Body**:
  ```json
  {
    "tenantId": "cm7xyz123",
    "customerId": "cust_123",
    "source": "WEB",
    "items": [
      { "productId": "prod_01", "quantity": 2, "price": 1.50 }
    ],
    "deliveryAddress": { "fullAddress": "Rua A, 123" },
    "notes": "Pix"
  }
  ```

### 3. `GET /api/orders/[id]`
Busca os detalhes completos de um pedido pelo ID.

### 4. `PATCH /api/orders/[id]`
Atualiza o status de um pedido no Kanban (`CONFIRMED`, `PREPARING`, `DISPATCHED`, `DELIVERED`, `CANCELLED`).
* **Request Body**:
  ```json
  {
    "status": "PREPARING"
  }
  ```

---

## 🥐 Produtos e Categorias (`/api/products` & `/api/categories`)

### 1. `GET /api/products`
Retorna o cardápio de produtos da tenant.

### 2. `POST /api/products`
Cadastra um novo produto (Nome, Descrição, Preço, Categoria).

### 3. `PATCH /api/products/[id]` & `DELETE /api/products/[id]`
Atualiza ou remove um produto do cardápio.

### 4. `GET /api/categories` & `POST /api/categories`
Lista ou cria categorias de produtos.

---

## ⚙️ Configurações da IA (`/api/bot-settings`)

### 1. `GET /api/bot-settings`
Busca as configurações do robô de IA da tenant (Provider, Modelo, Prompts, Limites e Temperatura).

### 2. `PUT /api/bot-settings`
Atualiza as configurações do robô de IA.
* **Request Body**:
  ```json
  {
    "tenantId": "cm7xyz123",
    "llmProvider": "DEEPSEEK",
    "llmApiKey": "sk-...",
    "llmModel": "deepseek-chat",
    "systemPrompt": "Você é um assistente virtual...",
    "sessionTimeout": 1800,
    "messageContextLimit": 15,
    "maxOutputTokens": 4096,
    "temperature": 0.7,
    "isActive": true
  }
  ```

---

## 🏢 Dados da Empresa (`/api/company-settings`)

Autenticadas pelo cookie de sessão (`auth_token`); o `tenantId` é resolvido no servidor, não precisa ser enviado.

### 1. `GET /api/company-settings`
Retorna os dados cadastrais da empresa do usuário autenticado.
* **Resposta (200 OK)**:
  ```json
  {
    "id": "cm7xyz123",
    "name": "Padaria Sabor de Minas",
    "cnpj": "11.222.333/0001-81",
    "address": "Rua A, 123 - Centro, Belo Horizonte - MG",
    "phone": "31999990000",
    "logoUrl": "/uploads/logo-cm7xyz123.png"
  }
  ```

### 2. `PUT /api/company-settings`
Atualiza nome, CNPJ, endereço, telefone e (opcionalmente) faz upload da logo.
* **Content-Type**: `multipart/form-data` (FormData)
* **Campos**: `name` (obrigatório), `cnpj`, `address`, `phone`, `logo` (arquivo: JPG, PNG, WebP ou SVG).
* **Comportamento**:
  - Valida CNPJ (dígito verificador) e extensão da logo.
  - Normaliza o telefone (apenas dígitos, mínimo 10).
  - Salva a logo em `public/uploads/logo-{tenantId}.{ext}` e remove a anterior.
* **Resposta (200 OK)**: mesmo formato do GET.

---

## 📱 Conexão WhatsApp — Evolution Go (`/api/evolution`)

Usa as variáveis `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE_NAME`. Resolve o `tenantId` pelo cookie de sessão.

### 1. `GET /api/evolution/status`
Consulta o estado da instância (`GET /instance/{name}/status` na Evolution Go).
* **Resposta (200 OK)**:
  ```json
  { "connected": true, "loggedIn": false }
  ```
* **Resposta (502)**: Evolution Go fora do ar ou chave inválida — `{ "error": "...", "connected": false }`.

### 2. `POST /api/evolution/connect`
Garante que a instância existe (webhook apontando para `{APP_URL}/api/webhooks/evolution`) e retorna o QR code para pareamento.
* **Resposta (200 OK)**:
  ```json
  {
    "base64": "data:image/png;base64,iVBORw0KGgo...",
    "code": "ABCD-WXYZ"
  }
  ```
* **Resposta (502)**: `{ "error": "..." }` quando o QR não está disponível (Evolution Go parada ou instância sem webhook).

---

## 📡 Webhooks (`/api/webhooks`)

### 1. `POST /api/webhooks/evolution`
Recebe notificações HTTP em tempo real vindas da Evolution API / Evolution Go ao receber mensagens do WhatsApp.
* **Eventos Processados**: `messages.upsert`
* **Comportamento**: Salva mensagem no banco, transmite para o Livechat via WebSocket e aciona o pipeline do robô em `/api/chat/process-bot`.
