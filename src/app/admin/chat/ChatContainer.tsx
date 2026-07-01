"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/hooks/use-socket";
import { Send, User, Bot, Volume2, UserCheck, ShieldAlert } from "lucide-react";

interface Message {
  id: string;
  sender: "USER" | "BOT" | "HUMAN";
  content: string;
  createdAt: string;
}

interface Conversation {
  customerId: string;
  customerName: string;
  phone: string;
  isHumanAttending: boolean;
  lastMessage: Message;
}

const formatTime = (dateInput: string | Date | null | undefined) => {
  if (!dateInput) return "";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

export default function ChatContainer({ tenantId }: { tenantId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket(tenantId);

  // Fetch recent conversations list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  }, [tenantId]);

  // Fetch messages for active customer
  const fetchMessages = useCallback(async (customerId: string) => {
    try {
      const res = await fetch(`/api/chat?customerId=${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }, []);

  // Initialize
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConversations();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchConversations]);

  // Handle active customer change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeCustomerId) {
        fetchMessages(activeCustomerId);
      } else {
        setMessages([]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeCustomerId, fetchMessages]);

  // Auto-scroll messages list to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle WebSocket events
  useEffect(() => {
    if (!socket) return;

    socket.on("message", (msg: Message & { customerId: string; customerName: string; phone: string; isHumanAttending: boolean }) => {
      if (!msg || !msg.customerId) return;
      if (activeCustomerId === msg.customerId) {
        setMessages((prev) => {
          if (prev.some((m) => m && m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }

      setConversations((prev) => {
        const index = prev.findIndex((c) => c.customerId === msg.customerId);
        const updatedConv: Conversation = {
          customerId: msg.customerId,
          customerName: msg.customerName,
          phone: msg.phone,
          isHumanAttending: msg.isHumanAttending,
          lastMessage: msg,
        };

        if (index !== -1) {
          const filtered = prev.filter((_, i) => i !== index);
          return [updatedConv, ...filtered];
        } else {
          return [updatedConv, ...prev];
        }
      });
    });

    socket.on("customer", (status: { customerId: string; isHumanAttending: boolean }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.customerId === status.customerId
            ? { ...c, isHumanAttending: status.isHumanAttending }
            : c
        )
      );
    });

    return () => {
      socket.off("message");
      socket.off("customer");
    };
  }, [socket, activeCustomerId]);

  // Toggle Handover
  const toggleHandover = async (customerId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/customers/${customerId}/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHumanAttending: !currentStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversations((prev) =>
          prev.map((c) =>
            c.customerId === customerId
              ? { ...c, isHumanAttending: data.isHumanAttending }
              : c
          )
        );
      }
    } catch (err) {
      console.error("Error toggling handover:", err);
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeCustomerId || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: activeCustomerId,
          content: inputText.trim(),
        }),
      });

      if (res.ok) {
        const newMessage = await res.json();
        if (newMessage && newMessage.id) {
          setMessages((prev) => {
            if (prev.some((m) => m && m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
        setInputText("");

        const activeCustomer = conversations.find((c) => c.customerId === activeCustomerId);
        if (activeCustomer && !activeCustomer.isHumanAttending) {
          await toggleHandover(activeCustomerId, false);
        }
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const activeCustomer = conversations.find((c) => c.customerId === activeCustomerId);

  return (
    <div className="flex-1 flex overflow-hidden bg-[#FAF7F2]">
      {/* 1. Conversations Sidebar (Left Pane) */}
      <div className="w-80 border-r border-[#EBE2D5] bg-white flex flex-col shrink-0 shadow-[4px_0_24px_rgba(46,37,27,0.01)]">
        <div className="p-4 border-b border-[#EBE2D5] bg-white">
          <h2 className="font-serif font-bold text-lg text-amber-950">Conversas</h2>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-[#FAF7F2]">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8C7A6B]">
              Nenhuma conversa ativa no WhatsApp.
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.customerId}
                onClick={() => setActiveCustomerId(conv.customerId)}
                className={`w-full text-left p-4 hover:bg-[#FAF7F2] transition-colors flex flex-col gap-1 cursor-pointer ${
                  activeCustomerId === conv.customerId ? "bg-[#F5EFE6]" : ""
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-semibold text-sm text-[#2E251B] truncate max-w-[140px]">
                    {conv.customerName}
                  </span>
                  {conv.isHumanAttending ? (
                    <span className="flex items-center gap-1 text-[9px] bg-amber-600/10 text-amber-800 border border-amber-600/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      <User className="h-3 w-3" /> Humano
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      <Bot className="h-3 w-3" /> Robô
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#6B5A4B] truncate w-full">
                  {conv.lastMessage?.content}
                </span>
                <span className="text-[9px] text-[#8C7A6B] align-self-end mt-1 font-light">
                  {formatTime(conv.lastMessage?.createdAt)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. Messages Board (Center Pane) */}
      <div className="flex-1 flex flex-col bg-[#FAF7F2]">
        {activeCustomer ? (
          <>
            {/* Topbar of current chat */}
            <div className="h-16 border-b border-[#EBE2D5] bg-white px-6 flex justify-between items-center shadow-sm z-10 shrink-0">
              <div>
                <h3 className="font-serif font-bold text-amber-950 leading-tight">{activeCustomer.customerName}</h3>
                <p className="text-[11px] text-[#6B5A4B] mt-0.5 font-light">WhatsApp: {activeCustomer.phone}</p>
              </div>
              <button
                onClick={() =>
                  toggleHandover(activeCustomer.customerId, activeCustomer.isHumanAttending)
                }
                className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border transition-all cursor-pointer ${
                  activeCustomer.isHumanAttending
                    ? "bg-amber-600/10 text-amber-800 border-amber-600/20 hover:bg-amber-600/20"
                    : "bg-[#FAF7F2] hover:bg-[#F5EFE6] text-[#2E251B] border-[#EBE2D5]"
                }`}
              >
                {activeCustomer.isHumanAttending ? (
                  <>
                    <Bot className="h-4 w-4 text-amber-700" /> Devolver para Robô
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4" /> Assumir Atendimento
                  </>
                )}
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages && messages.filter(Boolean).map((msg) => {
                const isUser = msg.sender === "USER";
                const isBot = msg.sender === "BOT";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4.5 py-3 text-sm flex flex-col ${
                        isUser
                          ? "bg-white text-[#2E251B] border border-[#EBE2D5]/70 shadow-[0_2px_12px_rgba(46,37,27,0.02)]"
                          : isBot
                          ? "bg-emerald-500/10 text-emerald-900 border border-emerald-500/20"
                          : "bg-amber-600/10 text-amber-900 border border-amber-600/20"
                      }`}
                    >
                      <span className="text-[10px] font-bold text-[#8C7A6B] mb-1">
                        {isUser ? "Cliente" : isBot ? "Assistente IA" : "Atendente"}
                      </span>
                      <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                      <span className="text-[9px] text-[#8C7A6B] mt-1.5 self-end font-light">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-[#EBE2D5] flex gap-3 shadow-[0_-4px_24px_rgba(0,0,0,0.01)] shrink-0">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  activeCustomer.isHumanAttending
                    ? "Digite uma mensagem..."
                    : "IA está respondendo. Escreva e envie para assumir o chat..."
                }
                className="flex-1 bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              />
              <button
                type="submit"
                disabled={isSending || !inputText.trim()}
                className="bg-amber-700 hover:bg-amber-800 text-white rounded-xl px-5 py-3 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm active:scale-95"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#8C7A6B] gap-3">
            <Volume2 className="h-12 w-12 text-[#A09384] shrink-0" />
            <p className="text-sm font-light">Selecione uma conversa para iniciar o atendimento.</p>
          </div>
        )}
      </div>

      {/* 3. Customer Info (Right Pane) */}
      {activeCustomer && (
        <div className="w-80 border-l border-[#EBE2D5] bg-white p-6 flex flex-col gap-6 shrink-0 shadow-[-4px_0_24px_rgba(46,37,27,0.01)]">
          <div>
            <h4 className="font-bold text-xs text-amber-900 uppercase tracking-wider mb-3">
              Informações do Cliente
            </h4>
            <div className="bg-[#FAF7F2] border border-[#EBE2D5] rounded-2xl p-4 space-y-3 shadow-inner">
              <div>
                <span className="text-[10px] text-[#8C7A6B] uppercase font-bold tracking-wide">Nome</span>
                <span className="text-sm font-semibold text-[#2E251B] block mt-0.5">
                  {activeCustomer.customerName}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#8C7A6B] uppercase font-bold tracking-wide">WhatsApp</span>
                <span className="text-sm font-semibold text-[#2E251B] block mt-0.5">{activeCustomer.phone}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-xs text-amber-900 uppercase tracking-wider mb-3">
              Canal de Atendimento
            </h4>
            {activeCustomer.isHumanAttending ? (
              <div className="bg-amber-600/10 border border-amber-600/20 rounded-2xl p-4 flex gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0" />
                <div className="text-xs text-amber-900 leading-normal font-medium">
                  <strong>Atendimento Humano Ativo.</strong> A inteligência artificial está
                  temporariamente pausada para este cliente.
                </div>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex gap-3">
                <Bot className="h-5 w-5 text-emerald-700 shrink-0" />
                <div className="text-xs text-emerald-900 leading-normal font-medium">
                  <strong>Robô de IA Ativo.</strong> O robô está processando pedidos e respondendo às
                  mensagens automaticamente.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
