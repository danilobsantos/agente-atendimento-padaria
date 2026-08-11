"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare,
  LayoutDashboard,
  Utensils,
  Settings,
  Coffee,
  LogOut,
  Volume2,
  VolumeX,
  User,
} from "lucide-react";
import { useSocket } from "@/hooks/use-socket";
import OrderToast from "@/components/OrderToast";

interface ToastData {
  id: string;
  customerName: string;
  total: number;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Load sound preference
  useEffect(() => {
    const saved = localStorage.getItem("sound_notifications_enabled");
    if (saved !== null) {
      const timer = setTimeout(() => {
        setSoundEnabled(saved === "true");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  // Fetch tenantId from session
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.tenantId) {
            setTenantId(data.tenantId);
          }
        }
      } catch (err) {
        console.error("Error checking auth status:", err);
      }
    }
    checkAuth();
  }, []);

  const { socket } = useSocket(tenantId || "");

  const handleCloseToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleToastClick = useCallback((id: string) => {
    router.push(`/admin?highlight=${id}`);
    handleCloseToast(id);
  }, [router, handleCloseToast]);

  // Real-time listener for order creation
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = async (data: { orderId: string; status: string; event: string }) => {
      console.log("[AdminLayout] Real-time order event received:", data);

      // We only alert on ORDER_CREATED event
      if (data.event === "ORDER_CREATED") {
        try {
          const res = await fetch(`/api/orders/${data.orderId}`);
          if (res.ok) {
            const order = await res.json();

            // Add visual toast
            setToasts((prev) => [
              ...prev,
              {
                id: order.id,
                customerName: order.customer?.name || "Cliente S/N",
                total: order.total || 0,
              },
            ]);

            // Play notification sound if enabled
            if (soundEnabled) {
              const audio = new Audio("/notification.wav");
              audio.play().catch((err) => {
                console.warn("[AdminLayout] Audio autoplay blocked or failed:", err);
              });
            }
          }
        } catch (err) {
          console.error("Error fetching order details for toast notification:", err);
        }
      }
    };

    socket.on("order", handleNewOrder);

    return () => {
      socket.off("order", handleNewOrder);
    };
  }, [socket, soundEnabled]);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const toggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    localStorage.setItem("sound_notifications_enabled", String(newVal));
  };

  const menuItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/chat", label: "Live Chat", icon: MessageSquare },
    { href: "/admin/cardapio", label: "Cardápio", icon: Utensils },
    { href: "/admin/configuracoes", label: "Configurações IA", icon: Settings },
    { href: "/admin/perfil", label: "Meu Perfil", icon: User },
  ];

  return (
    <div className="flex h-screen bg-[#FAF7F2] text-[#2E251B] font-sans antialiased">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#EBE2D5] bg-white flex flex-col shrink-0 shadow-[4px_0_24px_rgba(46,37,27,0.02)]">
        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-[#EBE2D5] shrink-0">
          <div className="bg-[#FAF7F2] p-1.5 rounded-lg border border-[#EBE2D5]">
            <Coffee className="h-5 w-5 text-amber-700 animate-pulse" />
          </div>
          <span className="font-serif font-bold text-lg tracking-wide text-amber-950">SABOR DE MINAS</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${isActive
                    ? "bg-amber-600/5 text-amber-800 border-l-2 border-amber-700 rounded-l-none"
                    : "text-[#6B5A4B] hover:text-[#2E251B] hover:bg-[#F5EFE6]/60"
                  }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-amber-700" : "text-[#8C7A6B]"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mute/Unmute Toggle in Sidebar */}
        <button
          onClick={toggleSound}
          className="flex items-center gap-3 px-4 py-3 mx-3 my-1 rounded-xl text-sm font-medium text-[#6B5A4B] hover:text-[#2E251B] hover:bg-[#F5EFE6]/60 transition-colors cursor-pointer text-left w-[calc(100%-24px)]"
        >
          {soundEnabled ? (
            <Volume2 className="h-5 w-5 text-amber-700" />
          ) : (
            <VolumeX className="h-5 w-5 text-rose-600" />
          )}
          <span>Sons: {soundEnabled ? "Ativados" : "Mutados"}</span>
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 mx-3 my-2 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-500/5 transition-colors cursor-pointer text-left w-[calc(100%-24px)]"
        >
          <LogOut className="h-5 w-5 text-rose-600" />
          <span>Sair da Conta</span>
        </button>

        {/* Footer info */}
        <div className="p-4 border-t border-[#EBE2D5] text-[10px] text-[#A09384] text-center uppercase tracking-widest font-bold">
          v1.0.0 • SaaS Ready
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#FAF7F2]">
        {children}
      </main>

      {/* Floating Toast Containers (Top Right) */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto animate-[slideIn_0.3s_cubic-bezier(0.16,1,0.3,1)]"
          >
            <OrderToast
              orderId={toast.id}
              customerName={toast.customerName}
              total={toast.total}
              onClose={() => handleCloseToast(toast.id)}
              onClick={() => handleToastClick(toast.id)}
            />
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(120%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
