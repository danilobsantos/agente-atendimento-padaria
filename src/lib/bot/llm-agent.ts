import { z } from "zod";
import { createLLMService } from "../adapters/factory";
import { BotSession } from "../types/session";
import type { LLMProvider } from "@/generated/prisma/client";
import type { LLMTool, LLMMessage, LLMResponse, LLMService, LLMServiceConfig } from "@/lib/types/llm";
import type { SearchProduct } from "../services/products.service";
import { runLlm, LlmBudgetExceededError } from "@/lib/llm/runner";
import { ToolBreaker } from "./tool-breaker";
import {
  TOOL_DEFINITIONS,
  executeTool as executeRegisteredTool,
  type ToolContext,
  type ToolExecutor,
} from "./tools";
import { cardapioTool } from "./tools/cardapio";

/** Mantido para compatibilidade: é a definição da tool, não uma cópia. */
export const CONSULTAR_CARDAPIO_TOOL: LLMTool = cardapioTool.definition;

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
  executeTool?: ToolExecutor;
}

export interface AgentProcessResult {
  response: AgentResponse;
  idMap: Map<string, string>;
}

type GenerateFn = (messages: LLMMessage[], config: LLMServiceConfig) => Promise<LLMResponse>;

/**
 * Converte o histórico com function-calling em texto antes do retry sem tools.
 *
 * Necessário porque o retry roda sem `tools`: um histórico com `role:"tool"`
 * órfão faz o Gemini responder 400, e o DeepSeek perde o modo JSON. Achatar
 * mantém o que a ferramenta descobriu sem exigir que a ferramenta exista.
 */
export function flattenToolHistory(messages: LLMMessage[]): LLMMessage[] {
  const out: LLMMessage[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
      const results = new Map<string, string>();
      let j = i + 1;
      while (j < messages.length && messages[j].role === "tool") {
        results.set(messages[j].tool_call_id ?? "", messages[j].content);
        j += 1;
      }
      out.push({
        role: "assistant",
        content: msg.tool_calls
          .map((tc) => `[ferramenta ${tc.name}(${tc.arguments}) → ${results.get(tc.id) ?? "sem resultado"}]`)
          .join("\n"),
      });
      i = j - 1;
      continue;
    }

    if (msg.role === "tool") continue; // órfã: o par assistant já foi achatado
    out.push(msg);
  }
  return out;
}

export class LLMAgent {
  static async processMessage(
    session: BotSession,
    message: string,
    config: LLMAgentConfig,
    dep: LLMAgentDeps = {}
  ): Promise<AgentProcessResult> {
    const llmService = dep.llmService ?? createLLMService(config.provider);

    // Em produção toda chamada passa pelo runner (timeout, retry, telemetria e
    // gate de orçamento). Em teste, o serviço injetado é chamado direto — unit
    // test não deve precisar de banco para validar o loop de tools.
    const generate: GenerateFn = dep.llmService
      ? (messages, cfg) => dep.llmService!.generate(messages, cfg)
      : (messages, cfg) =>
          runLlm({
            tenantId: session.tenantId,
            customerId: session.customerId,
            service: llmService,
            messages,
            config: cfg,
            provider: String(config.provider),
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
3. SEM INVENÇÃO: Adicione APENAS itens que o cliente EXPLICITAMENTE pediu. Se a ferramenta retornar 5 opções, escolha apenas a que o cliente falou. Complements/adicionais vão no campo "additionalItems" do produto, nunca como um novo produto. Em "additionalItems", use APENAS adicionais do campo "extras" do próprio produto retornado pela ferramenta, copiando id e name EXATAMENTE. Se o adicional não estiver nos extras desse produto, não o envie.
4. MENSAGEM CURTA E LIMPA: A string "message" será enviada no WhatsApp. Seja amigável mas MUITO BREVE (max 400 chars). NUNCA liste os produtos do carrinho na "message" durante a conversa (o sistema faz isso no final). NUNCA mande totais ou confirme itens adicionados, apenas continue a conversa perguntando o que falta.

## REGRAS DE FLUXO DE PEDIDO
5. INFORMAÇÕES DO CLIENTE (customerInfo): SEMPRE extraia "name", "address", e "payment" da mensagem do cliente ou do histórico. Se o nome já estiver no contexto abaixo, NÃO pergunte de novo.
6. INTENT "confirmar_pedido": USE APENAS se o usuário explicitamente confirmou o resumo (ex: "sim", "pode mandar"). Se VOCÊ está perguntando se pode confirmar, a intent é "generico" ou "adicionar_itens". NUNCA use "confirmar_pedido" se faltar endereço (para DELIVERY) ou pagamento.
7. TIPO DE PEDIDO (orderType): Se o cliente pedir algo por chat, classifique como "DELIVERY", "PICKUP" ou "ENCOMENDA" no início da conversa. Se ainda não souber, pergunte. Depois de definido, use sempre "NONE". Se o cliente pedir para ver o cardápio (sem especificar itens), envie APENAS o link: ${menuUrl}/cardapio e a intent "fora_escopo".
8. QUANTIDADE POR VALOR: Se pedir "10 reais de pão", pergunte a quantidade em unidades.
9. POLÍTICAS DA LOJA: para horário, taxa/área de entrega, pagamento, valor mínimo, prazo ou cancelamento, chame "consultar_conhecimento" ANTES de responder. Se a ferramenta não encontrar, diga que vai confirmar com a equipe — NUNCA invente prazo, taxa ou política.
10. TOTAIS: para responder "quanto deu", chame "consultar_pedido_atual". Não calcule preços de cabeça.

## CONTEXTO ATUAL
Customer name: ${session.customer.name || "Not provided"}
Tipo do pedido: ${session.orderType === "PICKUP" ? "PICKUP (retirada - não precisa de endereço)" : session.orderType === "DELIVERY" ? "DELIVERY (entrega - precisa de endereço)" : session.orderType === "ENCOMENDA" ? "ENCOMENDA (encaminhar para atendente)" : "AINDA NÃO DEFINIDO — pergunte: entrega, retirada no balcão ou encomenda?"}
Cart (MANTENHA ESTES ITENS no array products):
${config.cartDescription || "(vazio)"}
Address: ${session.customer.address || "Not provided"}
Payment: ${session.payment || "Not provided"}
${session.activeOrderId ? `\nAVISO: O cliente já tem um pedido ativo sendo preparado. Adicione novos itens com intent 'adicionar_itens'.` : ""}
`;

    const recentContext = session.context.slice(-config.messageContextLimit);

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      ...recentContext.map(c => ({ role: c.role, content: c.content })),
      { role: "user", content: message }
    ];

    const commonConfig: LLMServiceConfig = {
      apiKey: config.apiKey,
      model: config.model,
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
      ...(config.thinkingConfig && { thinkingConfig: config.thinkingConfig }),
      responseSchema: RESPONSE_JSON_SCHEMA,
    };

    const toolCtx: ToolContext = {
      tenantId: session.tenantId,
      customerId: session.customerId,
      session,
      ...(dep.uuidToShort ? { uuidToShort: dep.uuidToShort } : {}),
      ...(dep.searchProducts ? { searchProducts: dep.searchProducts } : {}),
    };
    const runTool = dep.executeTool ?? executeRegisteredTool;
    const breaker = new ToolBreaker();

    const idMap = new Map<string, string>();
    const fallbackResponse: AgentResponse = {
      intent: "generico" as const,
      customerInfo: { name: "", address: "", payment: "" },
      message: "Desculpe, tive uma pequena falha de comunicação com o sistema. Pode repetir o que deseja?",
    };

    try {
      let response = await generate(messages, { ...commonConfig, tools: TOOL_DEFINITIONS });

      let rounds = 0;
      let breakerTripped = false;
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
          if (breaker.isBlocked(tc.name, tc.arguments)) {
            breakerTripped = true;
            continue;
          }
          const result = await runTool(toolCtx, tc.name, tc.arguments);
          breaker.record(tc.name, tc.arguments, result.ok);
          for (const [shortId, uuid] of result.ids ?? []) idMap.set(shortId, uuid);
          toolMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.name,
            content: result.content,
          });
        }

        messages.push(...toolMessages);
        rounds += 1;

        // Tool quebrada: mais uma rodada só gastaria token para chegar à mesma
        // conclusão. Vai direto para o parse/resposta.
        if (breakerTripped) break;

        response = await generate(messages, { ...commonConfig, tools: TOOL_DEFINITIONS });
      }

      console.log(`[LLMAgent] tool rounds=${rounds} breaker=${breakerTripped} response_len=${response.text.length}`);

      const parsed = LLMAgent.tryParse(response.text);
      if (parsed) return { response: parsed, idMap };

      // Retry sem tools: os adapters reativam o modo JSON nesse caminho, e o
      // histórico é achatado para não sobrar role:"tool" órfão.
      const retryMessages: LLMMessage[] = [
        ...flattenToolHistory(messages),
        { role: "user", content: "Responda APENAS com o objeto JSON no formato do schema. Nada além do JSON. Sem texto, sem marcação, sem explicação." },
      ];
      const retry = await generate(retryMessages, commonConfig);
      const retryParsed = LLMAgent.tryParse(retry.text);
      if (retryParsed) return { response: retryParsed, idMap };

      throw new Error(`Agent returned unparseable output after retry. Raw: ${retry.text.substring(0, 200)}`);
    } catch (error) {
      // Orçamento estourado precisa chegar na rota para virar alerta do dono;
      // engolir aqui faria o bot responder "falha de comunicação" para sempre.
      if (error instanceof LlmBudgetExceededError) throw error;
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
}
