"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(tenantId: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    // Determina URL do WebSocket de forma segura para HTTPS e acessos por tunnel / IP externo
    let socketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    
    if (!socketUrl) {
      if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        // Se acessado remotamente (ex: tunnel cloudflare ou IP local no celular), ignora localhost para não travar com Mixed Content
        socketUrl = undefined;
      } else {
        socketUrl = "http://localhost:3001";
      }
    }

    if (!socketUrl) {
      console.warn("⚠️ WebSocket desativado para conexão remota sem NEXT_PUBLIC_WEBSOCKET_URL.");
      return;
    }

    try {
      const socketInstance = io(socketUrl, {
        transports: ["websocket", "polling"],
        timeout: 5000,
      });

      const timer = setTimeout(() => {
        setSocket(socketInstance);
      }, 0);

      const handleConnect = () => {
        setIsConnected(true);
        console.log("🔌 Connected to WebSocket server");
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
      socketInstance.on("connect_error", (err) => {
        console.warn("⚠️ WebSocket connection error:", err.message);
      });

      return () => {
        clearTimeout(timer);
        socketInstance.off("connect", handleConnect);
        socketInstance.off("disconnect", handleDisconnect);
        socketInstance.disconnect();
      };
    } catch (err) {
      console.error("Failed to initialize Socket.io:", err);
    }
  }, [tenantId]);

  return {
    socket,
    isConnected,
  };
}
