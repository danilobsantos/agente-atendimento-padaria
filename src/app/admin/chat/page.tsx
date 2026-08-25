import { getAuthUser } from "@/lib/utils/auth-route";
import ChatContainer from "./ChatContainer";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return <ChatContainer tenantId={user.tenantId} />;
}
