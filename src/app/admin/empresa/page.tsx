import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/utils/auth-route";
import CompanyForm from "./CompanyForm";
import EvolutionCard from "./EvolutionCard";

export const dynamic = "force-dynamic";

export default async function EmpresaPage() {
  const user = await getAuthUser();

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        Não autorizado.
      </div>
    );
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });

  if (!tenant) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        Nenhuma empresa cadastrada. Rode o seed no banco de dados.
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 flex-1 overflow-y-auto max-w-4xl bg-[#FAF7F2]">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight text-amber-950">
          Configurações da Empresa
        </h1>
        <p className="text-sm text-[#6B5A4B] mt-2 font-light">
          Dados cadastrais da empresa, logo e conexão do dispositivo WhatsApp (Evolution Go).
        </p>
      </div>

      <CompanyForm
        company={{
          id: tenant.id,
          name: tenant.name,
          cnpj: tenant.cnpj,
          address: tenant.address,
          phone: tenant.phone,
          logoUrl: tenant.logoUrl,
        }}
      />

      <EvolutionCard />
    </div>
  );
}