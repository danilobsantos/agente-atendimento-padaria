import { LLMAgent } from "./src/lib/bot/llm-agent";
import { BotState } from "./src/lib/types/session";

async function main() {
  const session: any = {
    tenantId: "123",
    customerId: "456",
    phone: "11999999999",
    state: BotState.START,
    customer: {},
    order: {
      items: [{ id: "1", name: "Pão de Queijo", price: 5, quantity: 2 }, { id: "2", name: "Cappuccino", price: 8, quantity: 1 }],
      total: 18,
      deliveryFee: 0,
    },
    payment: undefined,
    context: [
      { role: "user", content: "oi, gostaria de fazer um pedido: 2 paes de queijo e 1 cappuccino" },
      { role: "assistant", content: "Olá! 😊 Anotei aqui: 2 Pães de Queijo e 1 Cappuccino. Para eu dar andamento, qual o seu nome e o endereço de entrega, por favor?" }
    ]
  };

  const message = "Danilo Santos\nAv. Valdomiro Cecílio Ribeiro, 820 - Jardim Aeroporto - Guaxupé/MG\nPix na entrega.";

  const config: any = {
    provider: "GEMINI",
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-3.5-flash", // We might need to use gemini-1.5-flash since 3.5 doesn't exist yet
    maxOutputTokens: 1024,
    messageContextLimit: 10,
    temperature: 0.7,
    systemPrompt: "Você é um assistente virtual."
  };

  const res = await LLMAgent.processMessage(session, message, config);
  console.log("LLM Response Turn 1:", JSON.stringify(res, null, 2));

  // Simulating route.ts
  if (res.customerInfo) {
    if (res.customerInfo.name) session.customer.name = res.customerInfo.name;
    if (res.customerInfo.address) session.customer.address = res.customerInfo.address;
    if (res.customerInfo.payment) session.payment = res.customerInfo.payment;
  }
  session.context.push({ role: "user", content: message });
  session.context.push({ role: "assistant", content: res.message });

  const message2 = "sim";
  const res2 = await LLMAgent.processMessage(session, message2, config);
  console.log("LLM Response Turn 2:", JSON.stringify(res2, null, 2));

}
main().catch(console.error);
