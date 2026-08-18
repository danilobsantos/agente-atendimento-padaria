import { prisma } from "@/lib/prisma";
import CardapioView from "./CardapioView";

export const dynamic = "force-dynamic";

export default async function CardapioPage() {
  // Fetch first active tenant (SaaS ready: could read from subdomains or headers)
  const tenant = await prisma.tenant.findFirst({
    where: { active: true },
    include: {
      categories: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      products: {
        where: { isAvailable: true },
        include: { category: true },
        orderBy: { sortOrder: "asc" },
      },
      additionalItems: {
        where: { isAvailable: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!tenant) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Nenhum cardápio ativo encontrado.
      </div>
    );
  }

  return (
    <CardapioView
      tenantId={tenant.id}
      tenantName={tenant.name}
      tenantLogoUrl={tenant.logoUrl}
      categories={tenant.categories}
      products={tenant.products}
      additionalItems={tenant.additionalItems}
      deliveryFee={tenant.deliveryFee}
    />
  );
}
