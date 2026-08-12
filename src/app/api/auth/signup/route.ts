import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signJWT } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password, name, tenantName } = await request.json();

    if (!email || !password || !name || !tenantName) {
      return NextResponse.json(
        { error: "Todos os campos (email, senha, nome, nome da empresa) são obrigatórios" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este e-mail já está sendo utilizado" },
        { status: 400 }
      );
    }

    // Create a slug for the tenant
    const slug = tenantName
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with dashes
      .replace(/^-+|-+$/g, ""); // trim dashes

    // Check if slug is unique, adjust if necessary
    let uniqueSlug = slug;
    let counter = 1;
    while (await prisma.tenant.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create tenant, default bot setting, and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug: uniqueSlug,
          active: true,
        },
      });

      await tx.botSetting.create({
        data: {
          tenantId: tenant.id,
          llmProvider: "DEEPSEEK",
          llmApiKey: "",
          llmModel: "deepseek-v4-flash",
          systemPrompt: `Você é o atendente virtual da ${tenant.name}. Seja educado, simpático e objetivo. Ajude os clientes a fazer pedidos do nosso cardápio. Quando o cliente pedir para adicionar mais um item no pedido, adicione o item, confirme o pedido completo com ele (listando todos os itens e o total) e atualize no sistema. Sempre confirme o pedido completo antes de finalizar.`,
          debounceSeconds: 5,
          isActive: true,
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          tenantId: tenant.id,
        },
      });

      return { user, tenant };
    });

    // Sign JWT session token
    const token = await signJWT({
      userId: result.user.id,
      tenantId: result.tenant.id,
      email: result.user.email,
      name: result.user.name,
    });

    // Set HTTP-Only session cookie
    const response = NextResponse.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
    });

    response.headers.set(
      "Set-Cookie",
      `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    );

    return response;
  } catch (error) {
    console.error("[Signup] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
