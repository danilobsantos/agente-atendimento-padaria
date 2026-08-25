import { getAuthUser } from "@/lib/utils/auth-route";
import KanbanContainer from "./KanbanContainer";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return <KanbanContainer tenantId={user.tenantId} />;
}
