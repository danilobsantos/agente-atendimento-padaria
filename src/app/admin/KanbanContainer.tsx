"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useSearchParams } from "next/navigation";
import { Coffee, MessageSquare, Globe, ArrowRight, CheckCircle2, User, MapPin, Trash2, AlertTriangle, Printer, Bell, BellOff } from "lucide-react";
import { printReceipt80mm } from "@/lib/utils/print-receipt";
import { formatOrderNumber } from "@/lib/utils/format-order";
import { useSound } from "./sound-context";

interface Product {
  name: string;
}

interface OrderItem {
  id: string;
  price: number;
  quantity: number;
  product: Product;
  notes: string | null;
  additionalItems?: {
    id: string;
    name: string;
    price: number;
  }[];
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
  { key: "DISPATCHED", label: "Saiu para Entrega/Retirada", color: "border-t-sky-500 bg-[#F0F9FF] border-[#E0F2FE] text-sky-700" },
  { key: "DELIVERED", label: "Entregues", color: "border-t-emerald-500 bg-[#F0FDF4] border-[#DCFCE7] text-emerald-800" },
];

export default function KanbanContainer({ tenantId }: { tenantId: string }) {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<string>("CONFIRMED");
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(false);
  const autoPrintRef = React.useRef(autoPrintEnabled);
  const [whatsConnected, setWhatsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    autoPrintRef.current = autoPrintEnabled;
  }, [autoPrintEnabled]);

  useEffect(() => {
    const saved = localStorage.getItem("auto_print_orders_enabled");
    if (saved !== null) {
      const timer = setTimeout(() => {
        setAutoPrintEnabled(saved === "true");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  const toggleAutoPrint = () => {
    const newVal = !autoPrintEnabled;
    setAutoPrintEnabled(newVal);
    localStorage.setItem("auto_print_orders_enabled", String(newVal));
  };
  const { socket } = useSocket(tenantId);
  const { soundEnabled, toggleSound } = useSound();

  const fetchWhatsStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/evolution/status");
      if (res.ok) {
        const data = await res.json();
        setWhatsConnected(Boolean(data.connected));
      }
    } catch (err) {
      console.error("Error fetching WhatsApp status:", err);
    }
  }, []);

  useEffect(() => {
    const init = setTimeout(fetchWhatsStatus, 0);
    const timer = setInterval(fetchWhatsStatus, 15000);
    return () => {
      clearTimeout(init);
      clearInterval(timer);
    };
  }, [fetchWhatsStatus]);

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

    const handleOrder = async (data: { orderId: string; status: string; event: string }) => {
      console.log(`[Kanban] Real-time order event received:`, data);
      fetchOrders();

      // Trigger automatic thermal receipt print if enabled and event is ORDER_CREATED
      if (data.event === "ORDER_CREATED" && autoPrintRef.current) {
        try {
          const res = await fetch(`/api/orders/${data.orderId}`);
          if (res.ok) {
            const newOrder = await res.json();
            printReceipt80mm(newOrder);
          }
        } catch (err) {
          console.error("Error auto-printing thermal receipt:", err);
        }
      }
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
    if (status === "CONFIRMED") return "Preparar";
    if (status === "PREPARING") return "Despachar";
    if (status === "DISPATCHED") return "Finalizar";
    return "";
  };

  return (
    <div className="p-3 sm:p-4 space-y-4 sm:space-y-6 flex-1 flex flex-col overflow-hidden bg-[#FAF7F2]">
      {/* Top Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-amber-950 flex items-center gap-2">
            <Coffee className="text-amber-700 h-6 w-6 sm:h-7 sm:w-7" />
            Gestão de Pedidos
          </h1>
          <p className="text-xs text-[#6B5A4B] font-light mt-0.5 sm:mt-1">
            Painel Kanban em tempo real.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Auto-Print Toggle Button */}
          <button
            onClick={toggleAutoPrint}
            className={`flex items-center gap-1.5 text-xs border px-3 py-1.5 sm:py-2 rounded-full shadow-sm transition-all cursor-pointer shrink-0 ${
              autoPrintEnabled
                ? "bg-amber-600/10 border-amber-600/30 text-amber-900 font-bold"
                : "bg-white border-[#EBE2D5] text-[#8C7A6B] hover:text-[#2E251B]"
            }`}
            title="Impressão automática de cupom (80mm) ao receber novo pedido"
          >
            <Printer className={`h-3.5 w-3.5 ${autoPrintEnabled ? "text-amber-700" : "text-[#8C7A6B]"}`} />
            <span>Auto-Impressão: <strong>{autoPrintEnabled ? "On" : "Off"}</strong></span>
          </button>

          {/* Notification Sound Toggle */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? "Som das notificações ativado" : "Som das notificações desativado"}
            className="flex items-center gap-1.5 text-xs bg-white border border-[#EBE2D5] px-3 py-1.5 sm:py-2 rounded-full shadow-sm cursor-pointer hover:border-amber-700/30 transition-colors shrink-0"
          >
            {soundEnabled ? (
              <Bell className="h-3.5 w-3.5 text-amber-700" />
            ) : (
              <BellOff className="h-3.5 w-3.5 text-[#8C7A6B]" />
            )}
            <span className="text-[#2E251B] font-semibold hidden sm:inline">Notificações</span>
          </button>

          {/* WhatsApp Connection Status */}
          <a
            href="/admin/empresa"
            title="Status da conexão WhatsApp (Evolution Go). Clique para gerenciar."
            className={`flex items-center gap-1.5 text-xs bg-white border px-3 py-1.5 sm:py-2 rounded-full shadow-sm cursor-pointer hover:border-amber-700/30 transition-colors shrink-0 ${
              whatsConnected === null
                ? "border-[#EBE2D5]"
                : whatsConnected
                ? "border-emerald-300"
                : "border-red-300"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                whatsConnected === null
                  ? "bg-amber-400 animate-pulse"
                  : whatsConnected
                  ? "bg-emerald-500"
                  : "bg-red-500 animate-pulse"
              }`}
            />
            <span className="text-[#2E251B] font-semibold">
              {whatsConnected === null
                ? "WhatsApp..."
                : whatsConnected
                ? "WhatsApp On"
                : "WhatsApp Off"}
            </span>
          </a>
        </div>
      </div>

      {/* Mobile Column Switcher Tabs (Only visible on screens < md) */}
      <div className="flex md:hidden bg-white border border-[#EBE2D5] p-1 rounded-xl shrink-0 gap-1 overflow-x-auto">
        {statusColumns.map((col) => {
          const count = orders.filter((o) => o.status === col.key).length;
          const isActive = mobileTab === col.key;
          return (
            <button
              key={col.key}
              onClick={() => setMobileTab(col.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                isActive
                  ? "bg-[#FAF7F2] text-amber-950 border border-[#EBE2D5] shadow-xs"
                  : "text-[#8C7A6B] hover:text-[#2E251B]"
              }`}
            >
              <span>{col.label.split(" ")[0]}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  isActive ? "bg-amber-700 text-white" : "bg-[#FAF7F2] text-[#8C7A6B] border border-[#EBE2D5]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Board Grid (Responsive: Tab mode in Mobile, 4-col in MD+) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 overflow-hidden">
        {statusColumns.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.key);
          const isVisibleOnMobile = mobileTab === col.key;

          return (
            <div
              key={col.key}
              className={`rounded-2xl border flex-col overflow-hidden shadow-sm ${col.color.split(" ")[1]} ${col.color.split(" ")[2]} ${
                isVisibleOnMobile ? "flex flex-1 h-full" : "hidden md:flex"
              }`}
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
                        onClick={() => setSelectedOrderDetails(order)}
                        className={`bg-white border border-t-[3px] rounded-xl p-4 space-y-4 transition-all duration-300 shadow-[0_2px_8px_rgba(46,37,27,0.02)] cursor-pointer ${isHighlighted
                          ? "border-amber-600 ring-2 ring-amber-500/50 shadow-[0_0_25px_rgba(217,119,6,0.25)] scale-[1.02] border-t-amber-600 animate-pulse"
                          : "border-[#EBE2D5]/70 hover:border-amber-700/40 hover:shadow-md hover:scale-[1.01]"
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
                        {/* Card Header: ID e Entrega/Retirada */}
                        <div className="flex items-center justify-between border-b border-[#FAF7F2] pb-2 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono font-extrabold text-xs bg-amber-600/10 text-amber-900 border border-amber-600/20 px-2.5 py-0.5 rounded-full shrink-0">
                              {formatOrderNumber(order.id)}
                            </span>
                            {order.deliveryAddress ? (
                              <span className="flex items-center gap-1 text-[10px] bg-amber-600/10 text-amber-900 border border-amber-600/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
                                <MapPin className="h-3 w-3" /> Entrega
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] bg-violet-500/10 text-violet-800 border border-violet-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
                                <MapPin className="h-3 w-3" /> Retirada
                              </span>
                            )}
                          </div>
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

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
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
                              <span>Concluído</span>
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

      {/* Order Details Modal */}
      {selectedOrderDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedOrderDetails(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-[#EBE2D5] space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-[#FAF7F2] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-extrabold text-sm bg-amber-600/10 text-amber-900 border border-amber-600/20 px-3 py-1 rounded-full">
                    {formatOrderNumber(selectedOrderDetails.id)}
                  </span>
                  {selectedOrderDetails.deliveryAddress ? (
                    <span className="flex items-center gap-1 text-xs bg-amber-600/10 text-amber-900 border border-amber-600/20 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                      <MapPin className="h-3.5 w-3.5" /> Entrega
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-violet-500/10 text-violet-800 border border-violet-500/20 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                      <MapPin className="h-3.5 w-3.5" /> Retirada
                    </span>
                  )}
                  {selectedOrderDetails.source === "WHATSAPP" ? (
                    <span className="flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                      <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-sky-500/10 text-sky-800 border border-sky-500/20 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                      <Globe className="h-3.5 w-3.5" /> Cardápio
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#8C7A6B] mt-1.5">
                  Pedido realizado em {new Date(selectedOrderDetails.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="text-[#8C7A6B] hover:text-[#2E251B] p-1.5 rounded-lg hover:bg-[#FAF7F2] transition-colors cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Customer Details */}
            <div className="bg-[#FAF7F2] border border-[#EBE2D5] p-3.5 rounded-xl space-y-1.5 text-xs text-[#2E251B]">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                <User className="h-4 w-4 text-amber-700 shrink-0" />
                <span>{selectedOrderDetails.customer.name || "Cliente S/N"}</span>
              </div>
              <div className="text-[#8C7A6B] font-mono pl-6">
                Telefone: {selectedOrderDetails.customer.phone}
              </div>
            </div>

            {/* Items & Options List */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#8C7A6B] uppercase tracking-wider">Itens do Pedido</h3>
              <div className="bg-[#FAF7F2] border border-[#EBE2D5] p-3 rounded-xl space-y-2.5 text-xs text-[#6B5A4B]">
                {selectedOrderDetails.items.map((i) => (
                  <div key={i.id} className="space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-[#2E251B]">
                        {i.quantity}x {i.product.name}
                      </span>
                      <span className="text-[#8C7A6B] shrink-0 font-medium">
                        R$ {(i.price * i.quantity).toFixed(2)}
                      </span>
                    </div>
                    {i.additionalItems && i.additionalItems.length > 0 && (
                      <div className="pl-3 space-y-1">
                        {i.additionalItems.map((a) => (
                          <div key={a.id} className="text-[11px] text-amber-800 flex justify-between gap-2">
                            <span>+ {a.name}</span>
                            {a.price > 0 && (
                              <span className="text-[10px] text-amber-800/70">
                                +R$ {(a.price * i.quantity).toFixed(2)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="pt-2.5 border-t border-[#EBE2D5] flex justify-between items-center font-extrabold text-amber-950 text-sm">
                  <span>Valor Total</span>
                  <span className="text-base text-amber-700">R$ {selectedOrderDetails.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Delivery address */}
            {selectedOrderDetails.deliveryAddress && (
              <div className="flex gap-2.5 text-xs text-[#6B5A4B] leading-normal bg-[#FAF7F2] border border-[#EBE2D5] p-3 rounded-xl">
                <MapPin className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#2E251B]">Endereço de Entrega:</p>
                  <p className="text-[#6B5A4B] mt-0.5">
                    {selectedOrderDetails.deliveryAddress.fullAddress ||
                      `${selectedOrderDetails.deliveryAddress.street || ""}, ${selectedOrderDetails.deliveryAddress.number || ""} - ${selectedOrderDetails.deliveryAddress.neighborhood || ""}`}
                  </p>
                </div>
              </div>
            )}

            {/* Payment notes / details */}
            {selectedOrderDetails.notes && (
              <div className="text-xs text-[#6B5A4B] bg-[#F5EFE6] border border-[#EBE2D5] p-3 rounded-xl">
                <p className="font-bold text-[#2E251B] mb-0.5">Observações / Pagamento:</p>
                <p className="italic">{selectedOrderDetails.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  printReceipt80mm(selectedOrderDetails);
                }}
                className="flex-1 bg-white hover:bg-amber-50 text-amber-900 border border-[#EBE2D5] hover:border-amber-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Cupom</span>
              </button>

              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="flex-1 bg-[#FAF7F2] border border-[#EBE2D5] hover:bg-[#F5EFE6] text-[#2E251B] font-semibold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="flex-1 bg-[#FAF7F2] border border-[#EBE2D5] hover:bg-[#F5EFE6] text-[#2E251B] font-semibold py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
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
