import { getAuthUser } from "@/lib/utils/auth-route";
import CardapioManager from "./CardapioManager";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminCardapioPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return <CardapioManager tenantId={user.tenantId} />;
}
