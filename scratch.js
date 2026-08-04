import Redis from "ioredis";
import { io } from "socket.io-client";

async function test() {
  console.log("--- Testing Socket.IO & Redis Relay ---");
  const pub = new Redis("redis://localhost:6379");

  const socket = io("http://localhost:3001", { timeout: 3000 });

  socket.on("connect", async () => {
    console.log("1. Socket.IO connected! ID:", socket.id);
    socket.emit("join", "test-tenant");
    console.log("2. Emitted join test-tenant");

    // Wait a bit for server to process join
    await new Promise(r => setTimeout(r, 500));

    console.log("3. Publishing Redis message to tenant:test-tenant:message...");
    await pub.publish(
      "tenant:test-tenant:message",
      JSON.stringify({
        id: "msg-123",
        customerId: "cust-123",
        content: "Test live message",
        createdAt: new Date().toISOString()
      })
    );
  });

  socket.on("connect_error", (err) => {
    console.error("Socket.IO connection error:", err.message);
  });

  socket.on("message", (msg) => {
    console.log("4. SUCCESS! Socket.IO received message event on client:", msg);
  });

  await new Promise(r => setTimeout(r, 2500));

  pub.disconnect();
  socket.disconnect();
  process.exit(0);
}

test().catch(console.error);
