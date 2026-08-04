"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useSearchParams } from "next/navigation";
import { Coffee, MessageSquare, Globe, ArrowRight, CheckCircle2, User, MapPin, Trash2, AlertTriangle, Printer } from "lucide-react";
import { printReceipt80mm } from "@/lib/utils/print-receipt";
import { formatOrderNumber } from "@/lib/utils/format-order";

interface Product {
  name: string;
}

interface OrderItem {
  id: string;
  price: number;
  quantity: number;
  product: Product;
  notes: string | null;
}

interface Customer {
  name: string | null;
  phone: string;
}

interface Order {
  id: string;
  status: "PENDING" | "CONFIRMED" | "PREPARING" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  source: "WHATSAPP" | "WEB";
  total: number;
  deliveryAddress: {
    fullAddress?: string;
    street?: string;
    number?: string;
    neighborhood?: string;
  } | null;
  notes: string | null;
  createdAt: string;
  customer: Customer;
  items: OrderItem[];
}

const statusColumns = [
  { key: "CONFIRMED", label: "Novos Pedidos", color: "border-t-rose-500 bg-[#FFF5F5] border-[#FFE3E3] text-rose-700" },
  { key: "PREPARING", label: "Em Preparo", color: "border-t-amber-500 bg-[#FFFBF2] border-[#FDF0D5] text-amber-800" },
  { key: "DISPATCHED", label: "Saiu para Entrega", color: "border-t-sky-500 bg-[#F0F9FF] border-[#E0F2FE] text-sky-700" },
  { key: "DELIVERED", label: "Entregues", color: "border-t-emerald-500 bg-[#F0FDF4] border-[#DCFCE7] text-emerald-800" },
];

export default function KanbanContainer({ tenantId }: { tenantId: string }) {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const { socket } = useSocket(tenantId);

  // Manage highlight fade and URL cleanup
  useEffect(() => {
    if (!highlightId) return;
    
    const highlightTimer = setTimeout(() => {
      setActiveHighlightId(highlightId);
    }, 0);

    const timer = setTimeout(() => {
      setActiveHighlightId(null);
      // Remove query param from URL without refreshing the page
      const url = new URL(window.location.href);
      url.searchParams.delete("highlight");
      window.history.replaceState({}, "", url.toString());
    }, 5000);

    return () => {
      clearTimeout(highlightTimer);
      clearTimeout(timer);
    };
  }, [highlightId]);

  // Scroll highlighted card into view once orders are loaded
  useEffect(() => {
    if (!activeHighlightId || orders.length === 0) return;

    const element = document.getElementById(`order-card-${activeHighlightId}`);
    if (element) {
      const scrollTimer = setTimeout(() => {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
      return () => clearTimeout(scrollTimer);
    }
  }, [activeHighlightId, orders]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  }, [tenantId]);

  useEffect(() => {
    const fetchTimer = setTimeout(() => {
      fetchOrders();
    }, 0);
    return () => clearTimeout(fetchTimer);
  }, [fetchOrders]);

  // Real-time updates via WebSockets
  useEffect(() => {
    if (!socket) return;

    const handleOrder = (data: { orderId: string; status: string; event: string }) => {
      console.log(`[Kanban] Real-time order event received:`, data);
      fetchOrders();
    };

    socket.on("order", handleOrder);

    return () => {
      socket.off("order", handleOrder);
    };
  }, [socket, fetchOrders]);

  const handleCancelOrder = async () => {
    if (!orderToDelete) return;
    try {
      const res = await fetch(`/api/orders/${orderToDelete}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderToDelete));
      }
    } catch (err) {
      console.error("Error cancelling order:", err);
    } finally {
      setOrderToDelete(null);
    }
  };

  // Move order status forward
  const handleNextStatus = async (orderId: string, currentStatus: string) => {
    let nextStatus = "";
    if (currentStatus === "CONFIRMED") nextStatus = "PREPARING";
    else if (currentStatus === "PREPARING") nextStatus = "DISPATCHED";
    else if (currentStatus === "DISPATCHED") nextStatus = "DELIVERED";

    if (!nextStatus) return;

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        const updatedOrder = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
      }
    } catch (err) {
      console.error("Error updating order status:", err);
    }
  };

  const getNextButtonLabel = (status: string) => {
    if (status === "CONFIRMED") return "Iniciar Preparo";
    if (status === "PREPARING") return "Despachar";
    if (status === "DISPATCHED") return "Finalizar";
    return "";
  };

  return (
    <div className="p-8 space-y-6 flex-1 flex flex-col overflow-hidden bg-[#FAF7F2]">
      {/* Top Title & Stats */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-serif font-bold text-amber-950 flex items-center gap-2">
            <Coffee className="text-amber-700 h-7 w-7" />
            Gestão de Pedidos
          </h1>
          <p className="text-xs text-[#6B5A4B] font-light mt-1">
            Painel Kanban integrado em tempo real. Veja e separe os pedidos recebidos.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-white border border-[#EBE2D5] px-3.5 py-2 rounded-full shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[#2E251B] font-semibold">Real-time Ativo</span>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 overflow-hidden">
        {statusColumns.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.key);

          return (
            <div
              key={col.key}
              className={`rounded-2xl border flex flex-col overflow-hidden shadow-sm ${col.color.split(" ")[1]} ${col.color.split(" ")[2]}`}
            >
              {/* Header column */}
              <div className="p-4 bg-white border-b border-[#EBE2D5] flex justify-between items-center shrink-0 shadow-sm">
                <span className="font-serif font-bold text-sm text-amber-950">{col.label}</span>
                <span className="bg-[#FAF7F2] border border-[#EBE2D5] text-xs font-extrabold px-2.5 py-0.5 rounded-full text-amber-800">
                  {colOrders.length}
                </span>
              </div>

              {/* Cards List container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {colOrders.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-xs text-[#8C7A6B] py-10">
                    Nenhum pedido aqui
                  </div>
                ) : (
                  colOrders.map((order) => {
                    const isHighlighted = order.id === activeHighlightId;
                    return (
                      <div
                        key={order.id}
                        id={`order-card-${order.id}`}
                        className={`bg-white border border-t-[3px] rounded-xl p-4 space-y-4 transition-all duration-300 shadow-[0_2px_8px_rgba(46,37,27,0.02)] ${
                          isHighlighted
                            ? "border-amber-600 ring-2 ring-amber-500/50 shadow-[0_0_25px_rgba(217,119,6,0.25)] scale-[1.02] border-t-amber-600 animate-pulse"
                            : "border-[#EBE2D5]/70 hover:border-amber-700/30 hover:scale-[1.01]"
                        }`}
                        style={{
                          borderTopColor: isHighlighted
                            ? undefined
                            : col.key === "CONFIRMED"
                            ? "#ef4444"
                            : col.key === "PREPARING"
                            ? "#f59e0b"
                            : col.key === "DISPATCHED"
                            ? "#0ea5e9"
                            : "#10b981",
                        }}
                      >
                        {/* Card Header: Source, Total, Date */}
                        <div className="flex justify-between items-center border-b border-[#FAF7F2] pb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-extrabold text-xs bg-amber-600/10 text-amber-900 border border-amber-600/20 px-2 py-0.5 rounded-md">
                              {formatOrderNumber(order.id)}
                            </span>
                            {order.source === "WHATSAPP" ? (
                              <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                <MessageSquare className="h-3 w-3" /> WhatsApp
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] bg-sky-500/10 text-sky-800 border border-sky-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                <Globe className="h-3 w-3" /> Cardápio
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-extrabold text-amber-700">
                            R$ {order.total.toFixed(2)}
                          </span>
                        </div>

                        {/* Customer info */}
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 text-[#2E251B]">
                            <User className="h-3.5 w-3.5 text-[#8C7A6B] shrink-0" />
                            <span className="font-semibold truncate">
                              {order.customer.name || "Cliente S/N"}
                            </span>
                          </div>
                          <div className="text-[#8C7A6B] font-mono ml-5">
                            {order.customer.phone}
                          </div>
                        </div>

                        {/* Items list */}
                        <div className="bg-[#FAF7F2] border border-[#EBE2D5] p-2.5 rounded-lg space-y-1.5 text-xs text-[#6B5A4B]">
                          {order.items.map((i) => (
                            <div key={i.id} className="flex justify-between gap-2">
                              <span className="font-medium text-[#2E251B] line-clamp-1">
                                {i.quantity}x {i.product.name}
                              </span>
                              <span className="text-[#8C7A6B] shrink-0 font-light">
                                R$ {(i.price * i.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Delivery address */}
                        {order.deliveryAddress && (
                          <div className="flex gap-2 text-xs text-[#6B5A4B] leading-normal border-t border-[#FAF7F2] pt-2">
                            <MapPin className="h-4 w-4 text-[#8C7A6B] shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-[#2E251B]">Entrega em:</p>
                              <p className="text-[#6B5A4B] mt-0.5">
                                {order.deliveryAddress.fullAddress || 
                                 `${order.deliveryAddress.street || ""}, ${order.deliveryAddress.number || ""} - ${order.deliveryAddress.neighborhood || ""}`}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Payment notes / details */}
                        {order.notes && (
                          <div className="text-[10px] text-[#8C7A6B] italic bg-[#F5EFE6] border border-[#EBE2D5]/40 p-2 rounded-lg">
                            {order.notes}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          {col.key !== "DELIVERED" ? (
                            <button
                              onClick={() => handleNextStatus(order.id, order.status)}
                              className="flex-1 bg-[#FAF7F2] hover:bg-[#F5EFE6] text-amber-800 border border-[#EBE2D5] font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                            >
                              <span>{getNextButtonLabel(order.status)}</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          ) : (
                            <div className="flex-1 text-[11px] font-bold text-emerald-600 flex items-center gap-1.5 justify-center py-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <span>Pedido Concluído</span>
                            </div>
                          )}

                          <button
                            onClick={() => printReceipt80mm(order)}
                            className="bg-white hover:bg-amber-50 text-amber-800 border border-[#EBE2D5] hover:border-amber-300 px-3 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
                            title="Imprimir cupom (80mm)"
                          >
                            <Printer className="h-4 w-4" />
                          </button>

                          {col.key !== "DELIVERED" && col.key !== "DISPATCHED" && (
                            <button
                              onClick={() => setOrderToDelete(order.id)}
                              className="bg-white hover:bg-rose-50 text-rose-600 border border-[#EBE2D5] hover:border-rose-200 px-3 py-2 rounded-lg transition-all cursor-pointer"
                              title="Cancelar pedido"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancel Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#EBE2D5]">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <AlertTriangle className="h-6 w-6" />
              <h2 className="text-lg font-bold font-serif">Cancelar Pedido</h2>
            </div>
            <p className="text-sm text-[#6B5A4B] mb-6">
              Tem certeza que deseja cancelar este pedido? Ele será removido do painel, mas continuará registrado no histórico.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 bg-white border border-[#EBE2D5] hover:bg-[#F5EFE6] text-[#2E251B] font-semibold py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelOrder}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors cursor-pointer shadow-sm shadow-rose-600/20"
              >
                Sim, Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
