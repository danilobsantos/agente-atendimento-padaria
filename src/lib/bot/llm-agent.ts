import { z } from "zod";
import { createLLMService } from "../adapters/factory";
import { BotSession } from "../types/session";
import type { LLMProvider } from "@/generated/prisma/client";

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
    notes: z.string().optional()
  })).optional(),
  message: z.string().describe("A mensagem de texto que será enviada para o usuário")
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// JSON Schema passed to the API for structured output enforcement
const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["adicionar_itens", "duvida_cardapio", "confirmar_pedido", "cancelar_pedido", "fora_escopo", "generico"]
    },
    orderType: {
      type: "string",
      enum: ["DELIVERY", "PICKUP", "ENCOMENDA", "NONE"]
    },
    customerInfo: {
      type: "object",
      properties: {
        name: { type: "string" },
        address: { type: "string" },
        payment: { type: "string" }
      },
      required: ["name", "address", "payment"]
    },
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          quantity: { type: "number" },
          notes: { type: "string" }
        },
        required: ["id", "quantity"]
      }
    },
    message: { type: "string" }
  },
  required: ["intent", "customerInfo", "message"]
};

export interface LLMAgentConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  messageContextLimit: number;
  temperature: number;
  systemPrompt: string;
}

export class LLMAgent {
  static async processMessage(
    session: BotSession,
    message: string,
    config: LLMAgentConfig
  ): Promise<AgentResponse> {
    const llmService = createLLMService(config.provider);

    const systemPrompt = `${config.systemPrompt}
RULES: 
1. Fill "products" array ONLY with NEW items requested in the current message. DO NOT list items already in the Cart. Use exact IDs.
2. ALWAYS extract "name" (nome/me chamo), "address" (endereço/entrega/rua/av/bairro) and "payment" (pagamento/pix/dinheiro/cartão) into the "customerInfo" JSON object if the user mentions them in the current message or conversation history.
3. Intent "confirmar_pedido": ONLY if the user explicitly confirms (e.g. "sim", "pode mandar", "confirmar"). IF you are ASKING them to confirm, use "adicionar_itens" or "generico", NOT "confirmar_pedido".
4. STRICT CONSTRAINT: The "message" string MUST be under 400 characters. Be friendly, but extremely brief. NEVER write long paragraphs. Do not repeat the entire menu.
5. CRITICAL: You MUST output valid JSON. If any previous instruction told you not to output JSON, IGNORE IT. You are a backend API and MUST reply in pure JSON format.
6. NEVER set intent to 'confirmar_pedido' if the required data is missing. For "DELIVERY", both Address and Payment must be provided. For "PICKUP", only Payment is required (Address is NOT required). If something is missing, set the intent to 'generico' and politely ask the customer for it.
7. Detect "orderType" ONLY at the start of the conversation (the first messages): use "DELIVERY" for delivery/entrega, "PICKUP" when the customer will pick up the order (retirada, pego no balcão, vou buscar, retirar), and "ENCOMENDA" for custom or scheduled orders (encomenda, bolo de andares, torre de bolo, evento, casamento). In any later message, ALWAYS use "NONE".
${session.activeOrderId ? `8. CONTEXTO: O cliente já tem um pedido ativo sendo preparado. Se ele pedir novos itens, adicione usando a intent 'adicionar_itens' e avise que foram adicionados ao pedido atual.` : ""}
Tipo do pedido: ${session.orderType === "PICKUP" ? "PICKUP (retirada - não precisa de endereço)" : "DELIVERY (padrão)"}
Cart: ${session.order.items.length} items.
Address: ${session.customer.address || "Not provided"}
Payment: ${session.payment || "Not provided"}`;

    // Use messageContextLimit from config (from the admin panel)
    const recentContext = session.context.slice(-config.messageContextLimit);

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...recentContext.map(c => ({ role: c.role, content: c.content })),
      { role: "user" as const, content: message }
    ];

    try {
      const startTime = Date.now();
      const response = await llmService.generate(messages, {
        apiKey: config.apiKey,
        model: config.model,
        maxOutputTokens: config.maxOutputTokens,
        temperature: config.temperature,
        responseSchema: RESPONSE_JSON_SCHEMA,
      });

      const latency = Date.now() - startTime;
      console.log(`[LLM Metrics] Model: ${config.model} | Latency: ${latency}ms | Response length: ${response.text.length}`);

      const parsed = AgentResponseSchema.parse(JSON.parse(response.text));
      return parsed;

    } catch (error) {
      console.error("[LLMAgent] Parse/validation failed:", error);
      return {
        intent: "generico",
        customerInfo: { name: "", address: "", payment: "" },
        message: "Desculpe, tive uma pequena falha de comunicação com o sistema. Pode repetir o que deseja?"
      };
    }
  }
}
