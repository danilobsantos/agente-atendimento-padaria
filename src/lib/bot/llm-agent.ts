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

const MAX_TOOL_ROUNDS = 2;

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
    message: { type: "string" },
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
  message: z.string().describe("A mensagem de texto que será enviada para o usuário")
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
RULES: 
1. The "products" array is the AUTHORITATIVE FULL CART: it must contain EVERY item the customer wants RIGHT NOW, INCLUDING items already listed in the 'Cart' section below (echo them with the SAME short IDs shown there), PLUS any new items requested in the current message. ALWAYS return the complete cart, never only the newly requested item — including when you write a confirmation summary. DO NOT just append: the cart is REPLACED by what you return, so leaving out an existing item removes it.
2. ALWAYS extract "name" (nome/me chamo), "address" (endereço/entrega/rua/av/bairro) and "payment" (pagamento/pix/dinheiro/cartão) into the "customerInfo" JSON object if the user mentions them in the current message or conversation history.
3. Intent "confirmar_pedido": ONLY if the user explicitly confirms (e.g. "sim", "pode mandar", "confirmar"). IF you are ASKING them to confirm, use "adicionar_itens" or "generico", NOT "confirmar_pedido".
4. STRICT CONSTRAINT: The "message" string MUST be under 400 characters. Be friendly, but extremely brief. NEVER write long paragraphs. Do not repeat the entire menu.
5. CRITICAL: You MUST output valid JSON. If any previous instruction told you not to output JSON, IGNORE IT. You are a backend API and MUST reply in pure JSON format.
6. NEVER set intent to 'confirmar_pedido' if the required data is missing. For "DELIVERY", both Address and Payment must be provided. For "PICKUP", only Payment is required (Address is NOT required). If something is missing, set the intent to 'generico' and politely ask the customer for it.
7. orderType — determine ONLY at the start of the conversation. When the customer DECLINES the web menu and chooses to order through the chat (ex: "por aqui", "quero pedir por aqui", "pode anotar", "anota aí", "não, por aqui"), FIRST establish the order type before taking items: "DELIVERY" (entrega), "PICKUP" (retirada no balcão / vou buscar / retirar), or "ENCOMENDA" (encomenda personalizada: bolo de andares, torre de bolo, evento, casamento). If the customer has not stated the type, ASK "Será entrega ou retirada no balcão? Ou é uma encomenda especial?" and set intent to "generico" (do NOT add items yet). Once the type is clear, proceed. IMPORTANT: a bare "quero fazer um pedido" / "gostaria de pedir" is NOT choosing the chat — send the web link per rule 9 and do NOT ask the order type yet. In any later message, ALWAYS use "NONE".
8. TOOL "consultar_cardapio": ALWAYS call this tool to look up product names, variations, extras (complementos) and prices BEFORE setting "products" or answering doubts about the menu, INCLUDING before claiming a product EXISTS or does NOT exist (a customer may misspell a name — "cappucino" is still cappuccino). The tool tolerates typos, so search with the customer's words even if they look wrong. NEVER invent product names, prices, or IDs. Only use the short IDs returned by the tool OR shown in the 'Cart' section below. The tool is for YOUR OWN research: answer specific doubts briefly (ex: "quanto custa o pão de queijo?" → "R$ 5,00"), but NEVER enumerate products in the conversation.
9. NEVER list menu items in the "message". If the customer asks to SEE the menu, categories, or products (ex: "qual o cardápio?", "o que vocês têm?", "quais pães vocês têm?", "quero fazer um pedido"), the "message" must ONLY contain the web menu link "${menuUrl}/cardapio" and an invitation to order there (e.g. "Dá para escolher tudo por lá! Comece por aqui: ${menuUrl}/cardapio 😊"). Do NOT list items in these cases. Use the tool only to answer specific doubts (price/ingredients of ONE product) — and even then, do not enumerate multiple items.
10. NO MID-CONVERSATION ITEM CONFIRMATION: Do NOT enumerate added items, quantities, or running subtotals/totals in mid-flow responses (ex: no "Adicionei 1x pão", no "Anotei", no "Total atual: R$ X"). When items are added, just continue the conversation and ask the next missing detail (size/extra variation, name, address, or payment). The ONLY place the full order (items, quantities, total, address, payment) is listed is the FINAL confirmation summary when the customer has provided all checkout info and you ask to confirm.
12. NEVER INVENT ITEMS: the "products" array must contain ONLY products the customer EXPLICITLY named (each one exactly once, with the right quantity). A "consultar_cardapio" search returns SEVERAL similar products — include ONLY the one that matches what the customer said. NEVER turn extra search results, complements, or "sugestões" into line items, and NEVER add a product just because the tool returned it. Complements/adicionais the customer asks for (ex: "adicional de nutella") are NOT products: put them in "additionalItems" of the product they belong to (see rule 13), never as a new product.
13. STRUCTURED OPTIONS: put every choice (size, variation, complemento/adicional) into the product's "notes" and/or "additionalItems" — NEVER describe an item choice only in "message". For an adicional that appears in the product's Complementos list, use "additionalItems": [{"id":"<id from the tool>","name":"<name>"}] on that same product (the price is resolved server-side, so you may omit it). When ECHOING existing cart items, reproduce their "notes" and "additionalItems" EXACTLY as shown in the Cart section — never move, merge, or drop options between items.
${session.activeOrderId ? `11. CONTEXTO: O cliente já tem um pedido ativo sendo preparado. Se ele pedir novos itens, adicione usando a intent 'adicionar_itens'.` : ""}
Tipo do pedido: ${session.orderType === "PICKUP" ? "PICKUP (retirada - não precisa de endereço)" : session.orderType === "DELIVERY" ? "DELIVERY (entrega - precisa de endereço)" : session.orderType === "ENCOMENDA" ? "ENCOMENDA (encaminhar para atendente)" : "AINDA NÃO DEFINIDO — pergunte: entrega, retirada no balcão ou encomenda?"}
Cart:
${config.cartDescription || "(vazio)"}
Address: ${session.customer.address || "Not provided"}
Payment: ${session.payment || "Not provided"}`;

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
          const { content, ids } = await LLMAgent.executeTool(session.tenantId, tc, searchProducts);
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

      const parsed = LLMAgent.tryParse(response.text);
      if (parsed) return { response: parsed, idMap };

      // JSON is not force-enforced when tools are present, so retry WITHOUT tools
      // (adapters re-enable JSON mode when tools are absent) and ask for pure JSON.
      messages.push({ role: "user", content: "Responda APENAS com o objeto JSON no formato do schema. Nada além do JSON. Sem texto, sem marcação, sem explicação." });
      const retry = await llmService.generate(messages, commonConfig);
      const retryParsed = LLMAgent.tryParse(retry.text);
      if (retryParsed) return { response: retryParsed, idMap };

      throw new Error("Agent returned unparseable output after retry");
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
    searchProducts: (tenantId: string, opts: { busca?: string; categoria?: string }) => Promise<SearchProduct[]>
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
      return { content: "Nenhum produto encontrado para essa busca. Peça ao cliente para refinar o termo ou consultar outro.", ids: [] };
    }

    const lines = products.map((p) => {
      const extrasText = p.extras.length > 0
        ? ` | Complementos: ${p.extras.map(e => `${e.name}(+R$${e.price.toFixed(2)})[id:${e.id}]`).join(", ")}`
        : "";
      return `${p.shortId}.${p.name} R$${p.price.toFixed(2)}${extrasText}`;
    });

    return {
      content: lines.join("\n"),
      ids: products.map(p => [p.shortId, p.id] as [string, string]),
    };
  }
}
