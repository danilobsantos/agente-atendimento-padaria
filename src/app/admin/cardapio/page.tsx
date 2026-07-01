import { prisma } from "@/lib/prisma";
import CardapioManager from "./CardapioManager";

export const dynamic = "force-dynamic";

export default async function AdminCardapioPage() {
  const tenant = await prisma.tenant.findFirst({
    where: { active: true },
  });

  if (!tenant) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#8C7A6B] bg-[#FAF7F2]">
        Nenhum Tenant (Padaria) cadastrado. Rode o seed no banco de dados.
      </div>
    );
  }

  return <CardapioManager tenantId={tenant.id} />;
}
