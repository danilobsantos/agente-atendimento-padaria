import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/utils/auth-route";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/users/[id] - Update user
export async function PATCH(request: Request, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;

  // Verify target user belongs to same tenant
  const targetUser = await prisma.user.findFirst({
    where: { id, tenantId: authUser.tenantId },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  try {
    const { name, email, password, role } = await request.json();

    const dataToUpdate: {
      name?: string | null;
      email?: string;
      passwordHash?: string;
      role?: "ADMIN" | "USER";
    } = {};

    if (name !== undefined) {
      dataToUpdate.name = name?.trim() || null;
    }

    if (email && email.trim().toLowerCase() !== targetUser.email) {
      const emailLower = email.trim().toLowerCase();
      const existing = await prisma.user.findUnique({
        where: { email: emailLower },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Este e-mail já está sendo utilizado" },
          { status: 400 }
        );
      }
      dataToUpdate.email = emailLower;
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "A senha deve ter no mínimo 6 caracteres" },
          { status: 400 }
        );
      }
      dataToUpdate.passwordHash = await bcrypt.hash(password, 10);
    }

    if (role && (role === "ADMIN" || role === "USER")) {
      // Prevent removing the last admin
      if (targetUser.role === "ADMIN" && role === "USER") {
        const adminCount = await prisma.user.count({
          where: { tenantId: authUser.tenantId, role: "ADMIN" },
        });
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: "Não é possível alterar o único administrador da empresa" },
            { status: 400 }
          );
        }
      }
      dataToUpdate.role = role;
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("[Users API] Error updating user:", error);
    return NextResponse.json(
      { error: "Erro interno ao atualizar usuário" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(request: Request, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent user from deleting own account via this endpoint
  if (id === authUser.userId) {
    return NextResponse.json(
      { error: "Você não pode excluir sua própria conta de usuário" },
      { status: 400 }
    );
  }

  // Verify target user belongs to same tenant
  const targetUser = await prisma.user.findFirst({
    where: { id, tenantId: authUser.tenantId },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  // Prevent deleting the last admin
  if (targetUser.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { tenantId: authUser.tenantId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Não é possível excluir o único administrador da empresa" },
        { status: 400 }
      );
    }
  }

  await prisma.user.delete({
    where: { id: targetUser.id },
  });

  return NextResponse.json({ success: true });
}
