import { prisma } from "@/lib/prisma";
import CardapioView from "./CardapioView";
import { getAuthUser } from "@/lib/utils/auth-route";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

interface CardapioPageProps {
  searchParams?: Promise<{ tenant?: string }>;
}

export default async function CardapioPage({ searchParams }: CardapioPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const headerList = await headers();
  const subdomainTenant = headerList.get("x-tenant-slug");
  const authUser = await getAuthUser();
  const tenantSlugOrId = resolvedParams?.tenant || subdomainTenant || authUser?.tenantId;

  let tenant = null;

  if (tenantSlugOrId) {
    tenant = await prisma.tenant.findFirst({
      where: {
        active: true,
        OR: [{ id: tenantSlugOrId }, { slug: tenantSlugOrId }],
      },
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
  }

  if (!tenant) {
    tenant = await prisma.tenant.findFirst({
      where: { active: true },
      orderBy: { updatedAt: "desc" },
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
  }

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
