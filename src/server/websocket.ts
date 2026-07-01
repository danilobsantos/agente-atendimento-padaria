import { createServer } from "http";
import { Server } from "socket.io";
import Redis from "ioredis";
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const PORT = parseInt(process.env.PORT || "3001");
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const nextAppUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as unknown as InstanceType<typeof PrismaClient>;

const httpServer = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket Server is running\n");
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const redisSub = new Redis(redisUrl);

// Debounce timers in memory: customerId -> Timeout
const debounceTimers: Record<string, NodeJS.Timeout> = {};

// Subscribe to all tenant-related channels
redisSub.psubscribe("tenant:*:*").then(() => {
  console.log("🔊 WebSockets subscribed to Redis channels matching 'tenant:*:*'");
}).catch((err) => {
  console.error("❌ Redis subscription error:", err);
});

redisSub.on("pmessage", async (pattern, channel, message) => {
  try {
    const parts = channel.split(":");
    if (parts.length < 3) return;

    const tenantId = parts[1];
    const eventType = parts[2];
    const data = JSON.parse(message);

    console.log(`[Redis Event] Tenant: ${tenantId} | Event: ${eventType}`);

    // Broadcast the event to the Socket.io room
    io.to(`tenant:${tenantId}`).emit(eventType, data);

    // Debounce/Orchestration logic for new user messages on WhatsApp
    if (eventType === "message" && data.sender === "USER") {
      const customerId = data.customerId;
      
      // If customer is being manually attended by human, ignore bot trigger
      if (data.isHumanAttending) {
        console.log(`[Debounce] Skipping customer ${customerId} (Human attending)`);
        return;
      }

      // Fetch debounce time from BotSetting or fallback to 5 seconds
      const botSetting = await prisma.botSetting.findUnique({
        where: { tenantId },
      });

      if (!botSetting || !botSetting.isActive) {
        console.log(`[Debounce] Skipping customer ${customerId} (Bot settings disabled/not found)`);
        return;
      }

      const debounceMs = (botSetting.debounceSeconds || 5) * 1000;

      // Clear existing timer if user sends another message
      if (debounceTimers[customerId]) {
        console.log(`[Debounce] Resetting timer for customer ${customerId}`);
        clearTimeout(debounceTimers[customerId]);
      }

      console.log(`[Debounce] Scheduling bot response for customer ${customerId} in ${debounceMs}ms`);

      // Set new timer
      debounceTimers[customerId] = setTimeout(async () => {
        delete debounceTimers[customerId];
        console.log(`[Debounce] Timer expired. Triggering bot processing for customer ${customerId}`);

        try {
          const res = await fetch(`${nextAppUrl}/api/chat/process-bot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId }),
          });

          if (!res.ok) {
            console.error(`❌ Bot processing failed: HTTP ${res.status}`);
          } else {
            console.log(`✅ Bot processed successfully for customer ${customerId}`);
          }
        } catch (fetchErr) {
          console.error(`❌ Error calling bot API for customer ${customerId}:`, fetchErr);
        }
      }, debounceMs);
    }
  } catch (error) {
    console.error("Error processing Redis message:", error);
  }
});

io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on("join", (tenantId: string) => {
    if (!tenantId) return;
    const room = `tenant:${tenantId}`;
    socket.join(room);
    console.log(`👤 Client ${socket.id} joined room ${room}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 WebSocket server listening on port ${PORT}`);
});
