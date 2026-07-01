import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signJWT } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-mail e senha são obrigatórios" },
        { status: 400 }
      );
    }

    // Find user and include tenant info
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Credenciais inválidas" },
        { status: 401 }
      );
    }

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Credenciais inválidas" },
        { status: 401 }
      );
    }

    // Check if tenant is active
    if (!user.tenant.active) {
      return NextResponse.json(
        { error: "Esta empresa está temporariamente desativada" },
        { status: 403 }
      );
    }

    // Sign JWT
    const token = await signJWT({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
    });

    // Set cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
    });

    response.headers.set(
      "Set-Cookie",
      `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    );

    return response;
  } catch (error: any) {
    console.error("[Login] Error:", error);
    try {
      const fs = require("fs");
      const path = require("path");
      fs.writeFileSync(
        path.join(process.cwd(), "login-error.log"),
        `${new Date().toISOString()}\nError: ${error?.message || error}\nStack: ${error?.stack || "no-stack"}\n`
      );
    } catch (fsErr) {
      console.error("Failed to write error log:", fsErr);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
