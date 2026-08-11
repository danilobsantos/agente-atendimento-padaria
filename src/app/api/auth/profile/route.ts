import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signJWT, verifyJWT } from "@/lib/auth";

const ProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z.email().optional(),
    password: z
      .object({
        current: z.string().min(1, "Informe sua senha atual"),
        new: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres"),
      })
      .optional(),
  })
  .refine(
    (b) =>
      b.name !== undefined || b.email !== undefined || b.password !== undefined,
    { message: "Nenhum dado para atualizar" }
  );

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const data = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const update: { name?: string; email?: string; passwordHash?: string } = {};

  if (data.email !== undefined && data.email !== user.email) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Este e-mail já está sendo utilizado" },
        { status: 400 }
      );
    }
    update.email = data.email;
  }

  if (data.password) {
    const valid = await bcrypt.compare(data.password.current, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Senha atual incorreta" },
        { status: 401 }
      );
    }
    update.passwordHash = await bcrypt.hash(data.password.new, 10);
  }

  if (data.name !== undefined && data.name !== (user.name ?? "")) {
    update.name = data.name;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: update,
  });

  const newToken = await signJWT({
    userId: updated.id,
    tenantId: updated.tenantId,
    email: updated.email,
    name: updated.name,
  });

  const response = NextResponse.json({
    user: { id: updated.id, email: updated.email, name: updated.name },
  });
  response.headers.set(
    "Set-Cookie",
    `auth_token=${newToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
  );

  return response;
}