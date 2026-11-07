import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";

interface DbRow {
  customerId: string | null;
  customerName: string | null;
  phone: string | null;
  isHumanAttending: boolean | null;
  photoUrl: string | null;
  lastReadAt: Date | null;
  lastMessageId: string | null;
  lastMessageSender: "USER" | "BOT" | "HUMAN" | null;
  lastMessageContent: string | null;
  lastMessageMediaKey: string | null;
  lastMessageMediaType: string | null;
  lastMessageCreatedAt: Date | null;
  unreadCount: number | null;
  filteredTotalMatching: number | null;
  tenantTotalConversations: number | null;
  tenantTotalUnread: number | null;
}

// GET /api/chat?customerId=xxx — Get chat history for a customer
export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");

  // Com customerId, valida que o cliente é do tenant do JWT antes de ler.
  if (customerId) {
    const messagesLimit = parseInt(searchParams.get("limit") || "50", 10);
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: messagesLimit,
    });
    return NextResponse.json(messages.reverse());
  }

  // Sem customerId: conversas paginadas sob demanda do PRÓPRIO tenant.
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "30", 10)));
  const offset = (page - 1) * pageSize;
  const filter = (searchParams.get("filter") || "all").toLowerCase(); // "all" | "unread" | "ia"
  const search = (searchParams.get("search") || "").trim();

  try {
    // Garante com segurança que a coluna last_read_at exista
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "last_read_at" TIMESTAMP(3);`
    ).catch(() => {});

    const rows = await prisma.$queryRawUnsafe<DbRow[]>(
      `
      WITH customer_stats AS (
        SELECT 
          c.id AS "customerId",
          COALESCE(c.name, c.phone) AS "customerName",
          c.phone,
          c.is_human_attending AS "isHumanAttending",
          c.photo_url AS "photoUrl",
          c.last_read_at AS "lastReadAt",
          m.id AS "lastMessageId",
          m.sender AS "lastMessageSender",
          m.content AS "lastMessageContent",
          m.media_key AS "lastMessageMediaKey",
          m.media_type AS "lastMessageMediaType",
          m.created_at AS "lastMessageCreatedAt",
          (
            SELECT COUNT(*)::int
            FROM chat_messages cm
            WHERE cm.customer_id = c.id
              AND cm.sender = 'USER'
              AND cm.created_at > COALESCE(c.last_read_at, '1970-01-01'::timestamp)
              AND cm.created_at > COALESCE((
                SELECT MAX(cm2.created_at)
                FROM chat_messages cm2
                WHERE cm2.customer_id = c.id AND cm2.sender IN ('BOT', 'HUMAN')
              ), '1970-01-01'::timestamp)
          ) AS "unreadCount"
        FROM customers c
        CROSS JOIN LATERAL (
          SELECT id, sender, content, media_key, media_type, created_at
          FROM chat_messages
          WHERE customer_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
        ) m
        WHERE c.tenant_id = $1
      ),
      counts AS (
        SELECT 
          COUNT(*)::int AS "tenantTotalConversations",
          COUNT(*) FILTER (WHERE "unreadCount" > 0)::int AS "tenantTotalUnread"
        FROM customer_stats
      ),
      filtered AS (
        SELECT 
          cs.*,
          COUNT(*) OVER()::int AS "filteredTotalMatching"
        FROM customer_stats cs
        WHERE 
          (($2 = 'unread' AND COALESCE(cs."unreadCount", 0) > 0) OR
           ($2 = 'ia' AND COALESCE(cs."isHumanAttending", false) = false) OR
           ($2 NOT IN ('unread', 'ia')))
          AND (
            $5 = '' OR
            cs."customerName" ILIKE '%' || $5 || '%' OR
            cs."phone" ILIKE '%' || $5 || '%' OR
            (
              REGEXP_REPLACE($5, '\D', '', 'g') <> '' AND 
              REGEXP_REPLACE(cs."phone", '\D', '', 'g') ILIKE '%' || REGEXP_REPLACE($5, '\D', '', 'g') || '%'
            )
          )
        ORDER BY cs."lastMessageCreatedAt" DESC
        LIMIT $3 OFFSET $4
      )
      SELECT 
        f.*,
        c."tenantTotalConversations",
        c."tenantTotalUnread"
      FROM counts c
      LEFT JOIN filtered f ON true
      `,
      user.tenantId,
      filter,
      pageSize,
      offset,
      search
    );

    const firstRow = rows[0];
    const totalUnread = firstRow?.tenantTotalUnread ?? 0;
    const totalMatching = firstRow?.filteredTotalMatching ?? 0;

    // Se filtered for vazio, o LEFT JOIN retorna row com customerId null
    const validRows = rows.filter((r) => r.customerId !== null);

    const conversations = validRows.map((r) => ({
      customerId: r.customerId!,
      customerName: r.customerName || r.phone || "Cliente",
      phone: r.phone || "",
      isHumanAttending: Boolean(r.isHumanAttending),
      photoUrl: r.photoUrl,
      unreadCount: Number(r.unreadCount || 0),
      lastMessage: {
        id: r.lastMessageId!,
        sender: r.lastMessageSender || "USER",
        content: r.lastMessageContent || "",
        mediaKey: r.lastMessageMediaKey,
        mediaType: r.lastMessageMediaType,
        createdAt: r.lastMessageCreatedAt?.toISOString() || new Date().toISOString(),
      },
    }));

    return NextResponse.json({
      conversations,
      page,
      limit: pageSize,
      hasMore: offset + conversations.length < totalMatching,
      totalCount: totalMatching,
      totalUnread,
    });
  } catch (error) {
    console.error("[Chat] Error querying conversations:", error);
    // Fallback defensivo com Prisma findMany se raw query falhar
    const customers = await prisma.customer.findMany({
      where: {
        tenantId: user.tenantId,
        chatMessages: { some: {} },
        ...(filter === "ia" ? { isHumanAttending: false } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        chatMessages: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      take: pageSize * 2,
      skip: offset,
    });

    const conversations = customers
      .filter((c) => {
        if (c.chatMessages.length === 0) return false;
        if (filter === "ia" && c.isHumanAttending) return false;
        if (filter === "unread") {
          const lastMsg = c.chatMessages[0];
          if (!lastMsg || lastMsg.sender !== "USER") return false;
          if (c.lastReadAt && c.lastReadAt >= lastMsg.createdAt) return false;
        }
        if (search) {
          const s = search.toLowerCase();
          const sDigits = s.replace(/\D/g, "");
          const nameMatch = (c.name || "").toLowerCase().includes(s);
          const phone = c.phone || "";
          const phoneMatch =
            phone.toLowerCase().includes(s) ||
            (sDigits !== "" && phone.replace(/\D/g, "").includes(sDigits));
          if (!nameMatch && !phoneMatch) return false;
        }
        return true;
      })
      .slice(0, pageSize)
      .map((c) => {
        const lastMsg = c.chatMessages[0];
        const unread =
          lastMsg && lastMsg.sender === "USER" && (!c.lastReadAt || c.lastReadAt < lastMsg.createdAt) ? 1 : 0;
        return {
          customerId: c.id,
          customerName: c.name || c.phone,
          phone: c.phone,
          isHumanAttending: c.isHumanAttending,
          photoUrl: c.photoUrl,
          unreadCount: unread,
          lastMessage: lastMsg,
        };
      });

    return NextResponse.json({
      conversations,
      page,
      limit: pageSize,
      hasMore: conversations.length === pageSize,
      totalCount: conversations.length,
      totalUnread: conversations.filter((c) => c.unreadCount > 0).length,
    });
  }
}

// POST /api/chat — Send a message (from human operator)
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { customerId, content } = body;

    if (!customerId || !content) {
      return NextResponse.json({ error: "customerId and content are required" }, { status: 400 });
    }

    const target = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const message = await prisma.chatMessage.create({
      data: {
        customerId,
        sender: "HUMAN",
        content,
      },
    });

    // Human replied from the panel: take over the conversation.
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: { isHumanAttending: true, botSilencedUntil: null },
    });

    // Libera qualquer buffer pendente para o cliente
    try {
      const { MessageBuffer } = await import("@/lib/bot/message-buffer");
      await MessageBuffer.releaseLock(customer.tenantId, customer.id).catch(() => {});
      await MessageBuffer.consumeMessages(customer.tenantId, customer.id).catch(() => {});
    } catch (err) {
      console.warn("[Chat] Failed to clear message buffer:", err);
    }

    {
      const { redisChannel, redisPub } = await import("@/lib/redis");
      await redisPub.publish(
        redisChannel("tenant", customer.tenantId, "message"),
        JSON.stringify({
          ...message,
          customerName: customer.name || customer.phone,
          phone: customer.phone,
          isHumanAttending: customer.isHumanAttending,
        })
      );

      await redisPub.publish(
        redisChannel("tenant", customer.tenantId, "customer"),
        JSON.stringify({
          customerId: customer.id,
          isHumanAttending: customer.isHumanAttending,
        })
      );

      const { getEvolutionServiceForTenant } = await import("@/lib/services/evolution-go");
      const evolutionService = await getEvolutionServiceForTenant(customer.tenantId);
      try {
        await evolutionService.sendText({
          number: customer.phone,
          text: content,
        });
      } catch (sendErr: unknown) {
        const errorMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        console.warn(`[Chat] Failed to send WhatsApp message to ${customer.phone}:`, errorMsg);
      }
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("[Chat] Error sending message:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
