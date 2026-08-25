import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/utils/auth-route";
import UsersManager from "./UsersManager";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const users = await prisma.user.findMany({
    where: { tenantId: user.tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="p-8 space-y-8 flex-1 overflow-y-auto max-w-5xl bg-[#FAF7F2]">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight text-amber-950">
          Usuários e Níveis de Acesso
        </h1>
        <p className="text-sm text-[#6B5A4B] mt-2 font-light">
          Cadastre e gerencie a equipe da empresa com permissões de Administrador ou Atendente/Usuário.
        </p>
      </div>

      <UsersManager initialUsers={JSON.parse(JSON.stringify(users))} currentUserId={user.userId} />
    </div>
  );
}
