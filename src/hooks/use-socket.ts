"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(tenantId: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    // Connect to the WebSocket server
    const socketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3001";
    const socketInstance = io(socketUrl);

    const timer = setTimeout(() => {
      setSocket(socketInstance);
    }, 0);

    const handleConnect = () => {
      setIsConnected(true);
      console.log("🔌 Connected to WebSocket server");
      // Join the tenant's room
      socketInstance.emit("join", tenantId);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      console.log("🔌 Disconnected from WebSocket server");
    };

    if (socketInstance.connected) {
      handleConnect();
    }

    socketInstance.on("connect", handleConnect);
    socketInstance.on("disconnect", handleDisconnect);

    return () => {
      clearTimeout(timer);
      socketInstance.off("connect", handleConnect);
      socketInstance.off("disconnect", handleDisconnect);
      socketInstance.disconnect();
    };
  }, [tenantId]);

  return {
    socket,
    isConnected,
  };
}
