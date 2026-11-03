import { redirect } from "next/navigation";
import { KnowledgeService } from "@/lib/services/knowledge.service";
import { getAuthUser } from "@/lib/utils/auth-route";
import KnowledgeManager from "./KnowledgeManager";

export const dynamic = "force-dynamic";

export default async function ConhecimentoPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const entries = await KnowledgeService.list(user.tenantId);

  return (
    <div className="p-8 space-y-8 flex-1 overflow-y-auto max-w-5xl bg-[#FAF7F2]">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight text-amber-950">Base de conhecimento</h1>
        <p className="text-sm text-[#6B5A4B] mt-2 font-light">
          Regras do negócio e FAQ que o bot consulta antes de responder. Se não estiver aqui, ele diz que vai
          confirmar com a equipe — nunca inventa prazo, taxa ou política.
        </p>
      </div>

      <KnowledgeManager initialEntries={JSON.parse(JSON.stringify(entries))} />
    </div>
  );
}
