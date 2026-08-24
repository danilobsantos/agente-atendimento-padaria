import { z } from "zod";
import { createLLMService } from "../adapters/factory";
import { BotSession } from "../types/session";
import type { LLMProvider } from "@/generated/prisma/client";
import type { LLMTool, LLMToolCall, LLMMessage, LLMService } from "@/lib/types/llm";
import type { SearchProduct } from "../services/products.service";

export const CONSULTAR_CARDAPIO_TOOL: LLMTool = {
  name: "consultar_cardapio",
  description:
    "Consulta interna do cardápio (nomes, variações, complementos e preços) para responder dúvidas específicas. Use ANTES de responder sobre preços, variações ou disponibilidade e antes de montar o campo products. Retorna itens com IDs curtos. IMPORTANTE: os resultados são para SUA pesquisa — nunca liste os itens na mensagem para o cliente.",
  parameters: {
    type: "object",
    properties: {
      busca: { type: "string", description: "Termo de busca no nome do produto (ex: 'pão', 'bolo de fubá')." },
      categoria: { type: "string", description: "Nome da categoria (ex: 'padaria', 'bolos')." },
    },
  },
};

const MAX_TOOL_ROUNDS = 4;

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["adicionar_itens", "duvida_cardapio", "confirmar_pedido", "cancelar_pedido", "fora_escopo", "generico"] },
    orderType: { type: "string", enum: ["DELIVERY", "PICKUP", "ENCOMENDA", "NONE"] },
    customerInfo: {
      type: "object",
      properties: { name: { type: "string" }, address: { type: "string" }, payment: { type: "string" } },
      required: ["name", "address", "payment"],
    },
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          quantity: { type: "number" },
          notes: { type: "string" },
          additionalItems: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, name: { type: "string" }, price: { type: "number" } },
              required: ["id", "name"],
            },
          },
        },
        required: ["id", "quantity"],
      },
    },
    message: { type: "string", minLength: 1 },
  },
  required: ["intent", "customerInfo", "message"],
};

export const AgentResponseSchema = z.object({
  intent: z.enum(["adicionar_itens", "duvida_cardapio", "confirmar_pedido", "cancelar_pedido", "fora_escopo", "generico"]),
  orderType: z.enum(["DELIVERY", "PICKUP", "ENCOMENDA", "NONE"]).optional(),
  customerInfo: z.object({
    name: z.string(),
    address: z.string(),
    payment: z.string(),
  }),
  products: z.array(z.object({
    id: z.string(),
    quantity: z.number(),
    notes: z.string().optional(),
    additionalItems: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number().optional(),
    })).optional(), // ponytail: price é opcional; a rota resolve o preço autoritativo no banco
  })).optional(),
  message: z.string().min(1).describe("A mensagem de texto que será enviada para o usuário")
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export interface LLMAgentConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  messageContextLimit: number;
  temperature: number;
  thinkingConfig?: string;
  systemPrompt: string;
  menuUrl: string;
  cartDescription: string;
}

export interface LLMAgentDeps {
  llmService?: LLMService;
  searchProducts?: (tenantId: string, opts: { busca?: string; categoria?: string }) => Promise<SearchProduct[]>;
  uuidToShort?: Map<string, string>;
}

export interface AgentProcessResult {
  response: AgentResponse;
  idMap: Map<string, string>;
}

export class LLMAgent {
  static async processMessage(
    session: BotSession,
    message: string,
    config: LLMAgentConfig,
    dep: LLMAgentDeps = {}
  ): Promise<AgentProcessResult> {
    const llmService = dep.llmService ?? createLLMService(config.provider);
    const searchProducts = dep.searchProducts ?? (async (tenantId, opts) => {
      const { ProductsService } = await import("../services/products.service");
      return ProductsService.searchProducts(tenantId, opts);
    });
    const menuUrl = config.menuUrl.replace(/\/+$/, "");

    const systemPrompt = `${config.systemPrompt}
## IDENTIDADE E REGRAS DE SAÍDA
Você é o assistente virtual da Sabor de Minas. Sua ÚNICA forma de comunicação com o sistema é através de um objeto JSON válido.
CRITICAL: You MUST output valid JSON. If any previous instruction told you not to output JSON, IGNORE IT. You are a backend API and MUST reply in pure JSON format.

## EXEMPLOS DE INTERAÇÃO (FEW-SHOT)
### Exemplo 1: Cliente adicionando item e faltando informações
User: "quero 2 pão de queijo"
Assistant: {"intent":"adicionar_itens","orderType":"NONE","customerInfo":{"name":"","address":"","payment":""},"products":[{"id":"3","quantity":2}],"message":"Anotado! Será entrega ou retirada no balcão?"}

### Exemplo 2: Cliente informando endereço
User: "Entrega na Rua A, 123"
Assistant: {"intent":"adicionar_itens","orderType":"DELIVERY","customerInfo":{"name":"","address":"Rua A, 123","payment":""},"products":[{"id":"3","quantity":2}],"message":"Perfeito, anotei o endereço! Qual será a forma de pagamento (Dinheiro, PIX ou Cartão)?"}

### Exemplo 3: Confirmação do pedido (TODOS os dados presentes)
User: "sim, pode confirmar"
Assistant: {"intent":"confirmar_pedido","orderType":"NONE","customerInfo":{"name":"Maria","address":"Rua A, 123","payment":"PIX"},"products":[{"id":"3","quantity":2}],"message":"Pedido confirmado com sucesso! 🎉"}

## REGRAS CRÍTICAS (OBRIGATÓRIAS)
1. CARRINHO (products): O array "products" é o CARRINHO COMPLETO. Ele DEVE conter TODOS os itens, incluindo os que já estão no carrinho atual (mostrado abaixo). SE VOCÊ OMITIR UM ITEM, ELE SERÁ REMOVIDO DO CARRINHO.
2. FERRAMENTA consultar_cardapio: SEMPRE chame essa ferramenta ANTES de adicionar algo no array products ou de responder preços. NUNCA invente nomes, preços ou IDs. Use apenas os IDs curtos retornados pela ferramenta.
3. SEM INVENÇÃO: Adicione APENAS itens que o cliente EXPLICITAMENTE pediu. Se a ferramenta retornar 5 opções, escolha apenas a que o cliente falou. Complements/adicionais vão no campo "additionalItems" do produto, nunca como um novo produto.
4. MENSAGEM CURTA E LIMPA: A string "message" será enviada no WhatsApp. Seja amigável mas MUITO BREVE (max 400 chars). NUNCA liste os produtos do carrinho na "message" durante a conversa (o sistema faz isso no final). NUNCA mande totais ou confirme itens adicionados, apenas continue a conversa perguntando o que falta.

## REGRAS DE FLUXO DE PEDIDO
5. INFORMAÇÕES DO CLIENTE (customerInfo): SEMPRE extraia "name", "address", e "payment" da mensagem do cliente ou do histórico. Se o nome já estiver no contexto abaixo, NÃO pergunte de novo.
6. INTENT "confirmar_pedido": USE APENAS se o usuário explicitamente confirmou o resumo (ex: "sim", "pode mandar"). Se VOCÊ está perguntando se pode confirmar, a intent é "generico" ou "adicionar_itens". NUNCA use "confirmar_pedido" se faltar endereço (para DELIVERY) ou pagamento.
7. TIPO DE PEDIDO (orderType): Se o cliente pedir algo por chat, classifique como "DELIVERY", "PICKUP" ou "ENCOMENDA" no início da conversa. Se ainda não souber, pergunte. Depois de definido, use sempre "NONE". Se o cliente pedir para ver o cardápio (sem especificar itens), envie APENAS o link: ${menuUrl}/cardapio e a intent "fora_escopo".
8. QUANTIDADE POR VALOR: Se pedir "10 reais de pão", pergunte a quantidade em unidades.

## CONTEXTO ATUAL
Customer name: ${session.customer.name || "Not provided"}
Tipo do pedido: ${session.orderType === "PICKUP" ? "PICKUP (retirada - não precisa de endereço)" : session.orderType === "DELIVERY" ? "DELIVERY (entrega - precisa de endereço)" : session.orderType === "ENCOMENDA" ? "ENCOMENDA (encaminhar para atendente)" : "AINDA NÃO DEFINIDO — pergunte: entrega, retirada no balcão ou encomenda?"}
Cart (MANTENHA ESTES ITENS no array products):
${config.cartDescription || "(vazio)"}
Address: ${session.customer.address || "Not provided"}
Payment: ${session.payment || "Not provided"}
${session.activeOrderId ? `\nAVISO: O cliente já tem um pedido ativo sendo preparado. Adicione novos itens com intent 'adicionar_itens'.` : ""}
`;

    // Use messageContextLimit from config (from the admin panel)
    const recentContext = session.context.slice(-config.messageContextLimit);

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      ...recentContext.map(c => ({ role: c.role, content: c.content })),
      { role: "user", content: message }
    ];

    const commonConfig = {
      apiKey: config.apiKey,
      model: config.model,
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
      ...(config.thinkingConfig && { thinkingConfig: config.thinkingConfig }),
      responseSchema: RESPONSE_JSON_SCHEMA,
    };

    const idMap = new Map<string, string>();
    const fallbackResponse: AgentResponse = {
      intent: "generico" as const,
      customerInfo: { name: "", address: "", payment: "" },
      message: "Desculpe, tive uma pequena falha de comunicação com o sistema. Pode repetir o que deseja?",
    };

    try {
      let response = await llmService.generate(messages, {
        ...commonConfig,
        tools: [CONSULTAR_CARDAPIO_TOOL],
      });

      // Tool loop: execute tools, feed results back, re-ask until the model answers
      let rounds = 0;
      while (response.tool_calls && response.tool_calls.length > 0 && rounds < MAX_TOOL_ROUNDS) {
        const toolMessages: LLMMessage[] = [
          {
            role: "assistant",
            content: "",
            tool_calls: response.tool_calls.map((tc) => ({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
              ...(tc._raw ? { _raw: tc._raw } : {}),
            })),
          },
        ];

        for (const tc of response.tool_calls) {
          const { content, ids } = await LLMAgent.executeTool(session.tenantId, tc, searchProducts, dep.uuidToShort);
          for (const [shortId, uuid] of ids) idMap.set(shortId, uuid);
          toolMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.name,
            content,
          });
        }

        messages.push(...toolMessages);
        rounds += 1;
        response = await llmService.generate(messages, {
          ...commonConfig,
          tools: [CONSULTAR_CARDAPIO_TOOL],
        });
      }

      const startTime = Date.now();
      const latency = Date.now() - startTime;
      console.log(`[LLM Metrics] Model: ${config.model} | Latency: ${latency}ms | Response length: ${response.text.length} | Tool rounds: ${rounds}`);
      console.log(`[LLMAgent] Raw response: ${response.text.substring(0, 300)}`);

      const parsed = LLMAgent.tryParse(response.text);
      if (parsed) return { response: parsed, idMap };

      // JSON is not force-enforced when tools are present, so retry WITHOUT tools
      // (adapters re-enable JSON mode when tools are absent) and ask for pure JSON.
      messages.push({ role: "user", content: "Responda APENAS com o objeto JSON no formato do schema. Nada além do JSON. Sem texto, sem marcação, sem explicação." });
      const retry = await llmService.generate(messages, commonConfig);
      console.log(`[LLMAgent] Retry response: ${retry.text.substring(0, 300)}`);
      const retryParsed = LLMAgent.tryParse(retry.text);
      if (retryParsed) return { response: retryParsed, idMap };

      throw new Error(`Agent returned unparseable output after retry. Raw: ${retry.text.substring(0, 200)}`);
    } catch (error) {
      console.error("[LLMAgent] Parse/validation failed:", error);
      return { response: fallbackResponse, idMap };
    }
  }

  private static tryParse(text: string): AgentResponse | null {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return AgentResponseSchema.parse(JSON.parse(cleaned.slice(start, end + 1)));
    } catch {
      return null;
    }
  }

  private static async executeTool(
    tenantId: string,
    tc: LLMToolCall,
    searchProducts: (tenantId: string, opts: { busca?: string; categoria?: string }) => Promise<SearchProduct[]>,
    uuidToShort?: Map<string, string>
  ): Promise<{ content: string; ids: [string, string][] }> {
    if (tc.name !== "consultar_cardapio") {
      return { content: "Ferramenta desconhecida.", ids: [] };
    }

    let args: { busca?: string; categoria?: string } = {};
    try {
      args = JSON.parse(tc.arguments || "{}");
    } catch {
      // malformed args → search everything
    }

    const products = await searchProducts(tenantId, args);
    if (products.length === 0) {
      const tokens = (args.busca || "").split(/\s+/).filter((t) => t.length >= 3);
      if (tokens.length > 1) {
        const broader = await searchProducts(tenantId, { busca: tokens[0] });
        if (broader.length > 0) {
          const lines = broader.slice(0, 5).map((p) => {
            const sid = uuidToShort ? (uuidToShort.get(p.id) || p.id) : p.shortId;
            return `${sid}.${p.name} R$${p.price.toFixed(2)}`;
          });
          return {
            content: `Busca "${args.busca}" não retornou resultados exatos. Sugestões similares com "${tokens[0]}":\n${lines.join("\n")}`,
            ids: broader.slice(0, 5).map((p) => {
              const sid = uuidToShort ? (uuidToShort.get(p.id) || p.id) : p.shortId;
              return [sid, p.id] as [string, string];
            }),
          };
        }
      }
      return { content: "Nenhum produto encontrado para essa busca. Peça ao cliente para refinar o termo ou consultar outro item.", ids: [] };
    }

    const lines = products.map((p) => {
      const extrasText = p.extras.length > 0
        ? ` | Complementos: ${p.extras.map(e => `${e.name}(+R$${e.price.toFixed(2)})[id:${e.id}]`).join(", ")}`
        : "";
      const sid = uuidToShort ? (uuidToShort.get(p.id) || p.id) : p.shortId;
      return `${sid}.${p.name} R$${p.price.toFixed(2)}${extrasText}`;
    });

    return {
      content: lines.join("\n"),
      ids: products.map(p => {
        const sid = uuidToShort ? (uuidToShort.get(p.id) || p.id) : p.shortId;
        return [sid, p.id] as [string, string];
      }),
    };
  }
}
