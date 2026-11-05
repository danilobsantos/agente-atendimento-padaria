import { getAuthUser } from "@/lib/utils/auth-route";
import KanbanContainer from "./KanbanContainer";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBotScheduleStatus } from "@/lib/utils/bot-schedule";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const botSetting = await prisma.botSetting.findUnique({
    where: { tenantId: user.tenantId },
    select: {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: true,
      timezone: true,
    },
  });

  const initialScheduleStatus = botSetting ? getBotScheduleStatus(botSetting) : null;

  return (
    <KanbanContainer
      tenantId={user.tenantId}
      initialBotActive={botSetting?.isActive ?? null}
      initialScheduleStatus={initialScheduleStatus}
    />
  );
}
