import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyJWT } from "@/lib/auth";
import PerfilForm from "./PerfilForm";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  const payload = token ? await verifyJWT(token) : null;

  if (!payload) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) redirect("/login");

  return (
    <div className="p-8 space-y-8 flex-1 overflow-y-auto max-w-3xl bg-[#FAF7F2]">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight text-amber-950">
          Meu Perfil
        </h1>
        <p className="text-sm text-[#6B5A4B] mt-2 font-light">
          Atualize suas informações pessoais e a senha de acesso ao painel.
        </p>
      </div>

      <PerfilForm
        initialUser={{ id: user.id, name: user.name, email: user.email }}
      />
    </div>
  );
}