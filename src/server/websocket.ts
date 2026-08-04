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
