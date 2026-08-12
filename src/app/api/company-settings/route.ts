import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/utils/auth-route";
import { isAllowedLogoExt, isValidCnpj, normalizePhone } from "@/lib/utils/company";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

function toCompanyJson(tenant: {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
}) {
  return {
    id: tenant.id,
    name: tenant.name,
    cnpj: tenant.cnpj,
    address: tenant.address,
    phone: tenant.phone,
    logoUrl: tenant.logoUrl,
  };
}

// GET /api/company-settings — dados da empresa do usuário autenticado
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }

  return NextResponse.json(toCompanyJson(tenant));
}

// PUT /api/company-settings — FormData: name, cnpj, address, phone, logo (arquivo opcional)
export async function PUT(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const cnpj = String(form.get("cnpj") || "").trim();
  const address = String(form.get("address") || "").trim();
  const phone = String(form.get("phone") || "").trim();
  const logo = form.get("logo");

  if (!name) {
    return NextResponse.json({ error: "O nome da empresa é obrigatório" }, { status: 400 });
  }
  if (cnpj && !isValidCnpj(cnpj)) {
    return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
  }

  let logoUrl = tenant.logoUrl;

  if (logo && typeof logo !== "string") {
    const ext = (logo.name.split(".").pop() ?? "").toLowerCase();
    if (!isAllowedLogoExt(ext)) {
      return NextResponse.json(
        { error: "Formato de logo não permitido. Use JPG, PNG, WebP ou SVG." },
        { status: 400 }
      );
    }

    const filename = `logo-${tenant.id}.${ext}`;
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOADS_DIR, filename), Buffer.from(await logo.arrayBuffer()));

    if (tenant.logoUrl && tenant.logoUrl.startsWith("/uploads/") && !tenant.logoUrl.endsWith(filename)) {
      await fs.rm(path.join(process.cwd(), "public", tenant.logoUrl), { force: true });
    }
    logoUrl = `/uploads/${filename}`;
  }

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      name,
      cnpj: cnpj || null,
      address: address || null,
      phone: phone ? normalizePhone(phone) : null,
      ...(logoUrl !== tenant.logoUrl && { logoUrl }),
    },
  });

  return NextResponse.json(toCompanyJson(updated));
}