import { prisma } from "@/lib/prisma";
import ConfigForm from "./ConfigForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const tenant = await prisma.tenant.findFirst({
    where: { active: true },
    include: { botSetting: true },
  });

  if (!tenant) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        Nenhum Tenant (Padaria) cadastrado. Rode o seed no banco de dados.
      </div>
    );
  }

  // Create default settings on the fly if not found
  let settings = tenant.botSetting;
  if (!settings) {
    settings = await prisma.botSetting.create({
      data: {
        tenantId: tenant.id,
        llmProvider: "DEEPSEEK",
        llmApiKey: "",
        llmModel: "deepseek-v4-flash",
        systemPrompt: "Você é o atendente virtual da padaria. Seja educado, simpático e objetivo. Ajude os clientes a fazer pedidos do nosso cardápio. Quando o cliente pedir para adicionar mais um item no pedido, adicione o item, confirme o pedido completo com ele (listando todos os itens e o total) e atualize no sistema. Sempre confirme o pedido completo antes de finalizar.",
        debounceSeconds: 5,
        sessionTimeout: 1800,
        messageContextLimit: 15,
        maxOutputTokens: 4096,
        isActive: true,
      },
    });
  }

  // Decrypt/hide key for display
  const displaySettings = {
    ...settings,
    llmApiKey: settings.llmApiKey ? "••••••••" : "",
  };

  return (
    <div className="p-8 space-y-8 flex-1 overflow-y-auto max-w-4xl bg-[#FAF7F2]">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight text-amber-950">Configurações do Agente IA</h1>
        <p className="text-sm text-[#6B5A4B] mt-2 font-light">
          Configure a personalidade do bot, o tempo de debounce e a conexão com a API da inteligência artificial.
        </p>
      </div>

      <ConfigForm initialSettings={displaySettings} />
    </div>
  );
}
