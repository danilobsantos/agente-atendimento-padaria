"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/hooks/use-socket";
import { Send, User, Bot, Volume2, UserCheck, FileText, Phone, ExternalLink, Image as ImageIcon, Loader2, Search, X } from "lucide-react";

interface Message {
  id: string;
  sender: "USER" | "BOT" | "HUMAN";
  content: string;
  mediaKey?: string | null;
  mediaType?: string | null; // image | audio | video | document | contact
  createdAt: string;
}

interface Conversation {
  customerId: string;
  customerName: string;
  phone: string;
  isHumanAttending: boolean;
  photoUrl?: string | null;
  unreadCount?: number;
  lastMessage: Message;
}

const mediaUrl = (key: string) => (key.startsWith("http") || key.startsWith("/") ? key : `/api/media/${key}`);

const parseContactContent = (content: string) => {
  const match = content.match(/^\[Contato(?::\s*([^-\]]+)(?:\s*-\s*([^\]]+))?)?\]$/);
  if (!match) return null;
  return {
    name: match[1]?.trim() || "Contato compartilhado",
    phone: match[2]?.trim() || null,
  };
};

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

  // Pagination & Filters
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "ia">("all");
  const activeFilterRef = useRef<"all" | "unread" | "ia">(activeFilter);
  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const searchQueryRef = useRef("");
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalUnread, setTotalUnread] = useState<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket(tenantId);

  // Fetch recent conversations list with pagination & filters
  const fetchConversations = useCallback(
    async (
      targetPage = 1,
      filterOverride?: "all" | "unread" | "ia",
      searchOverride?: string,
      append = false
    ) => {
      const currentFilter = filterOverride || activeFilterRef.current;
      const currentSearch = searchOverride !== undefined ? searchOverride : searchQueryRef.current;
      if (append) {
        setIsLoadingMore(true);
      }
      try {
        const searchParam = currentSearch.trim()
          ? `&search=${encodeURIComponent(currentSearch.trim())}`
          : "";
        const res = await fetch(
          `/api/chat?page=${targetPage}&limit=30&filter=${currentFilter}${searchParam}`
        );
        if (res.ok) {
          const data = await res.json();
          const list: Conversation[] = Array.isArray(data) ? data : data.conversations || [];
          const more = Boolean(data.hasMore);
          const count = typeof data.totalCount === "number" ? data.totalCount : list.length;
          const unread = typeof data.totalUnread === "number" ? data.totalUnread : 0;

          setConversations((prev) => (append ? [...prev, ...list] : list));
          setHasMore(more);
          setPage(targetPage);
          setTotalCount(count);
          setTotalUnread(unread);

          if (!append) {
            setActiveCustomerId((prev) => {
              if (prev && list.some((c) => c.customerId === prev)) return prev;
              return list.length > 0 ? list[0].customerId : null;
            });
          }
        }
      } catch (err) {
        console.error("Error fetching conversations:", err);
      } finally {
        setIsLoadingMore(false);
      }
    },
    []
  );

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    searchQueryRef.current = val;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      fetchConversations(1, activeFilterRef.current, val, false);
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    searchQueryRef.current = "";
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    setPage(1);
    setHasMore(true);
    fetchConversations(1, activeFilterRef.current, "", false);
  };

  const handleFilterChange = (newFilter: "all" | "unread" | "ia") => {
    if (newFilter === activeFilter) return;
    setActiveFilter(newFilter);
    setConversations([]);
    setPage(1);
    setHasMore(true);
    fetchConversations(1, newFilter, searchQueryRef.current, false);
  };

  const handleSidebarScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (isLoadingMore || !hasMore) return;
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (scrollBottom < 80) {
      fetchConversations(page + 1, activeFilterRef.current, searchQueryRef.current, true);
    }
  };

  const handleSelectCustomer = (customerId: string) => {
    setActiveCustomerId(customerId);

    // Zera contador de não lidas localmente de imediato
    setConversations((prev) =>
      prev.map((c) => (c.customerId === customerId ? { ...c, unreadCount: 0 } : c))
    );

    // Notifica endpoint de leitura
    void fetch("/api/chat/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId }),
    }).catch((err) => {
      console.warn("Failed to mark conversation as read:", err);
    });
  };

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

  // Initialize on mount only
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConversations(1, "all", "", false);
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

  const activeCustomerIdRef = useRef<string | null>(activeCustomerId);
  useEffect(() => {
    activeCustomerIdRef.current = activeCustomerId;
  }, [activeCustomerId]);

  // Handle WebSocket events
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (
      msg: Message & {
        customerId: string;
        customerName?: string;
        phone?: string;
        isHumanAttending?: boolean;
      }
    ) => {
      if (!msg || !msg.customerId) return;
      console.log("💬 [LiveChat WebSocket] Message received:", msg);

      const isCurrentActive = activeCustomerIdRef.current === msg.customerId;

      if (isCurrentActive) {
        setMessages((prev) => {
          if (prev.some((m) => m && m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.sender === "USER") {
          void fetch("/api/chat/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId: msg.customerId }),
          }).catch(() => {});
        }
      }

      setConversations((prev) => {
        const index = prev.findIndex((c) => c.customerId === msg.customerId);
        const existing = index !== -1 ? prev[index] : null;

        let nextUnread = 0;
        if (msg.sender === "USER") {
          nextUnread = isCurrentActive ? 0 : (existing?.unreadCount || 0) + 1;
        } else {
          nextUnread = 0;
        }

        const updatedConv: Conversation = {
          customerId: msg.customerId,
          customerName:
            msg.customerName || existing?.customerName || msg.phone || "Cliente",
          phone: msg.phone || existing?.phone || "",
          isHumanAttending:
            typeof msg.isHumanAttending === "boolean"
              ? msg.isHumanAttending
              : existing?.isHumanAttending ?? false,
          photoUrl: existing?.photoUrl ?? null,
          unreadCount: nextUnread,
          lastMessage: msg,
        };

        if (index !== -1) {
          const filtered = prev.filter((_, i) => i !== index);
          return [updatedConv, ...filtered];
        } else {
          return [updatedConv, ...prev];
        }
      });
    };

    const handleCustomer = (status: { customerId: string; isHumanAttending?: boolean; photoUrl?: string | null }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.customerId === status.customerId
            ? {
              ...c,
              isHumanAttending:
                typeof status.isHumanAttending === "boolean"
                  ? status.isHumanAttending
                  : c.isHumanAttending,
              photoUrl: "photoUrl" in status ? status.photoUrl : c.photoUrl,
            }
            : c
        )
      );
    };

    socket.on("message", handleMessage);
    socket.on("customer", handleCustomer);

    return () => {
      socket.off("message", handleMessage);
      socket.off("customer", handleCustomer);
    };
  }, [socket]);

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

        setConversations((prev) =>
          prev.map((c) =>
            c.customerId === activeCustomerId ? { ...c, isHumanAttending: true } : c
          )
        );
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const activeCustomer = conversations.find((c) => c.customerId === activeCustomerId);

  const displayedConversations = conversations.filter((conv) => {
    if (activeFilter === "unread" && (conv.unreadCount || 0) <= 0) return false;
    if (activeFilter === "ia" && conv.isHumanAttending) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const qDigits = q.replace(/\D/g, "");
      const name = (conv.customerName || "").toLowerCase();
      const phone = (conv.phone || "").toLowerCase();
      const phoneDigits = phone.replace(/\D/g, "");

      const matchesName = name.includes(q);
      const matchesPhone = phone.includes(q) || (qDigits !== "" && phoneDigits.includes(qDigits));

      if (!matchesName && !matchesPhone) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 flex overflow-hidden bg-[#FAF7F2]">
      {/* 1. Conversations Sidebar (Left Pane) */}
      <div
        className={`w-full md:w-80 border-r border-[#EBE2D5] bg-white flex-col shrink-0 shadow-[4px_0_24px_rgba(46,37,27,0.01)] ${activeCustomerId ? "hidden md:flex" : "flex"
          }`}
      >
        <div className="p-3 sm:p-4 border-b border-[#EBE2D5] bg-white space-y-2.5 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="font-serif font-bold text-lg text-amber-950">Conversas</h2>
            <span className="text-xs bg-[#FAF7F2] border border-[#EBE2D5] px-2.5 py-0.5 rounded-full font-bold text-amber-800">
              {activeFilter === "all" && !searchQuery.trim() ? totalCount : displayedConversations.length}
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8C7A6B] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Pesquisar por nome ou número..."
              className="w-full bg-[#FAF7F2] border border-[#EBE2D5] rounded-lg pl-8 pr-7 py-1.5 text-xs text-amber-950 placeholder-[#8C7A6B] focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#8C7A6B] hover:text-amber-950 transition-colors p-1 rounded-full hover:bg-[#EBE2D5]/50 cursor-pointer"
                title="Limpar pesquisa"
                aria-label="Limpar pesquisa"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills (WhatsApp Style) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              onClick={() => handleFilterChange("all")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${activeFilter === "all"
                ? "bg-amber-900 text-white shadow-xs"
                : "bg-[#FAF7F2] border border-[#EBE2D5] text-[#6B5A4B] hover:bg-[#F5EFE6]"
                }`}
            >
              Todas
            </button>
            <button
              onClick={() => handleFilterChange("unread")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${activeFilter === "unread"
                ? "bg-amber-900 text-white shadow-xs"
                : "bg-[#FAF7F2] border border-[#EBE2D5] text-[#6B5A4B] hover:bg-[#F5EFE6]"
                }`}
            >
              <span>Não lidas</span>
              {totalUnread > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${activeFilter === "unread" ? "bg-white text-amber-950" : "bg-emerald-600 text-white"
                    }`}
                >
                  {totalUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => handleFilterChange("ia")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${activeFilter === "ia"
                ? "bg-amber-900 text-white shadow-xs"
                : "bg-[#FAF7F2] border border-[#EBE2D5] text-[#6B5A4B] hover:bg-[#F5EFE6]"
                }`}
            >
              <Bot className="h-3 w-3" />
              <span>IA</span>
            </button>
          </div>
        </div>

        <div
          onScroll={handleSidebarScroll}
          className="flex-1 overflow-y-auto divide-y divide-[#FAF7F2]"
        >
          {displayedConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8C7A6B]">
              {searchQuery.trim()
                ? `Nenhuma conversa encontrada para "${searchQuery}".`
                : activeFilter === "unread"
                  ? "Nenhuma conversa não lida."
                  : activeFilter === "ia"
                    ? "Nenhum cliente sendo atendido pela IA."
                    : "Nenhuma conversa ativa no WhatsApp."}
            </div>
          ) : (
            displayedConversations.map((conv) => {
              const unread = conv.unreadCount || 0;
              const isSelected = activeCustomerId === conv.customerId;
              return (
                <button
                  key={conv.customerId}
                  onClick={() => handleSelectCustomer(conv.customerId)}
                  className={`w-full text-left p-3 sm:p-3.5 hover:bg-[#FAF7F2] transition-colors flex flex-col gap-1 cursor-pointer ${isSelected ? "bg-[#F5EFE6]" : ""
                    }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      {conv.photoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={conv.photoUrl}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover border border-[#EBE2D5] shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#F5EFE6] border border-[#EBE2D5] flex items-center justify-center text-[#8C7A6B] shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                      <span className={`text-sm truncate max-w-[130px] ${unread > 0 ? "font-bold text-[#2E251B]" : "font-semibold text-[#2E251B]"}`}>
                        {conv.customerName}
                      </span>
                    </div>
                    {conv.isHumanAttending ? (
                      <span className="flex items-center gap-1 text-[9px] bg-amber-600/10 text-amber-800 border border-amber-600/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
                        <User className="h-3 w-3" /> Humano
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
                        <Bot className="h-3 w-3" /> IA
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center w-full gap-2 mt-0.5">
                    <span className={`text-xs truncate flex-1 ${unread > 0 ? "font-medium text-[#2E251B]" : "text-[#6B5A4B] font-light"}`}>
                      {conv.lastMessage?.content}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-light ${unread > 0 ? "text-emerald-700 font-semibold" : "text-[#8C7A6B]"}`}>
                        {formatTime(conv.lastMessage?.createdAt)}
                      </span>
                      {unread > 0 && (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold h-4.5 min-w-[18px] px-1 rounded-full flex items-center justify-center shadow-xs">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}

          {isLoadingMore && (
            <div className="py-3 flex justify-center items-center text-xs text-[#8C7A6B] gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
              <span>Carregando mais...</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Messages Board (Center Pane) */}
      <div
        className={`flex-1 flex-col bg-[#FAF7F2] ${activeCustomerId ? "flex" : "hidden md:flex"
          }`}
      >
        {activeCustomer ? (
          <>
            {/* Topbar of current chat */}
            <div className="h-16 border-b border-[#EBE2D5] bg-white px-3 sm:px-6 flex justify-between items-center shadow-sm z-10 shrink-0 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  onClick={() => setActiveCustomerId(null)}
                  className="md:hidden text-[#6B5A4B] hover:text-[#2E251B] p-1.5 rounded-lg hover:bg-[#FAF7F2] text-sm font-bold flex items-center justify-center shrink-0"
                >
                  ←
                </button>
                {activeCustomer.photoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={activeCustomer.photoUrl}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover border border-[#EBE2D5] shrink-0"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif font-bold text-amber-950 leading-tight text-xs sm:text-base truncate">
                    {activeCustomer.customerName}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-[#6B5A4B] font-light truncate">
                    WhatsApp: {activeCustomer.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  toggleHandover(activeCustomer.customerId, activeCustomer.isHumanAttending)
                }
                className={`flex items-center gap-1.5 text-[11px] sm:text-xs font-bold px-2.5 sm:px-4 py-2 rounded-xl border transition-all cursor-pointer shrink-0 ${activeCustomer.isHumanAttending
                  ? "bg-amber-600/10 text-amber-800 border-amber-600/20 hover:bg-amber-600/20"
                  : "bg-[#FAF7F2] hover:bg-[#F5EFE6] text-[#2E251B] border-[#EBE2D5]"
                  }`}
              >
                {activeCustomer.isHumanAttending ? (
                  <>
                    <Bot className="h-4 w-4 text-amber-700 shrink-0" />
                    <span className="hidden sm:inline">Devolver para IA</span>
                    <span className="sm:hidden">IA</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Assumir Atendimento</span>
                    <span className="sm:hidden">Assumir</span>
                  </>
                )}
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
              {messages && messages.filter(Boolean).map((msg) => {
                const isUser = msg.sender === "USER";
                const isBot = msg.sender === "BOT";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[88%] sm:max-w-[75%] rounded-2xl px-3.5 sm:px-4.5 py-2.5 sm:py-3 text-xs sm:text-sm flex flex-col ${isUser
                        ? "bg-white text-[#2E251B] border border-[#EBE2D5]/70 shadow-[0_2px_12px_rgba(46,37,27,0.02)]"
                        : isBot
                          ? "bg-emerald-500/10 text-emerald-900 border border-emerald-500/20"
                          : "bg-amber-600/10 text-amber-900 border border-amber-600/20"
                        }`}
                    >
                      <span className="text-[10px] font-bold text-[#8C7A6B] mb-1 block">
                        {isUser ? "Cliente" : isBot ? "Assistente IA" : "Atendente"}
                      </span>
                      {msg.mediaKey && msg.mediaType === "image" && (
                        <a
                          href={mediaUrl(msg.mediaKey)}
                          target="_blank"
                          rel="noreferrer"
                          className="block cursor-pointer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={mediaUrl(msg.mediaKey)}
                            alt="Mídia recebida"
                            className="rounded-xl mb-1.5 max-h-72 w-auto object-contain border border-black/5 hover:opacity-95 transition-opacity"
                            loading="lazy"
                          />
                        </a>
                      )}
                      {msg.mediaKey && msg.mediaType === "video" && (
                        <video
                          controls
                          preload="metadata"
                          src={mediaUrl(msg.mediaKey)}
                          className="rounded-xl mb-1.5 max-h-72 w-auto max-w-full"
                        />
                      )}
                      {msg.mediaKey && msg.mediaType === "audio" && (
                        <audio controls preload="metadata" src={mediaUrl(msg.mediaKey)} className="h-10 mb-1.5 max-w-full" />
                      )}
                      {msg.mediaKey && msg.mediaType === "document" && (
                        <a
                          href={mediaUrl(msg.mediaKey)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 font-semibold text-xs sm:text-sm text-amber-900 bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-2.5 rounded-xl border border-amber-600/20 transition-colors mb-1.5"
                        >
                          <FileText className="w-4 h-4 shrink-0 text-amber-700" />
                          <span className="truncate">Abrir documento</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70 ml-auto" />
                        </a>
                      )}
                      {(msg.mediaType === "contact" || msg.content.startsWith("[Contato")) && (() => {
                        const contactInfo = parseContactContent(msg.content);
                        if (!contactInfo) return null;
                        const cleanPhone = contactInfo.phone ? contactInfo.phone.replace(/\D/g, "") : null;
                        return (
                          <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-600/20 rounded-xl mb-1.5">
                            <div className="w-10 h-10 rounded-full bg-amber-600/20 flex items-center justify-center text-amber-800 shrink-0">
                              <User className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-xs sm:text-sm text-[#2E251B] block truncate">
                                {contactInfo.name}
                              </span>
                              {contactInfo.phone && (
                                <a
                                  href={`https://wa.me/${cleanPhone}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-amber-800 hover:underline inline-flex items-center gap-1 font-medium mt-0.5"
                                >
                                  <Phone className="w-3 h-3 shrink-0" />
                                  <span>{contactInfo.phone}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      {/* Indicador para mensagens legadas onde o arquivo de mídia não foi gravado */}
                      {!msg.mediaKey &&
                        !msg.content.startsWith("[Contato") &&
                        msg.content.startsWith("[") &&
                        msg.content.endsWith("]") &&
                        ["[Foto]", "[Vídeo]", "[Áudio]", "[Documento]", "[Figurinha]"].includes(msg.content) && (
                          <div className="flex items-center gap-2 text-xs text-[#8C7A6B] bg-[#FAF7F2] border border-[#EBE2D5] px-3 py-2 rounded-xl italic mb-1.5">
                            <ImageIcon className="w-4 h-4 text-[#A09384] shrink-0" />
                            <span>{msg.content.slice(1, -1)} recebida (arquivo indisponível)</span>
                          </div>
                        )}
                      {!(
                        msg.content.startsWith("[Contato") ||
                        (msg.content.startsWith("[") &&
                          msg.content.endsWith("]") &&
                          ["[Foto]", "[Vídeo]", "[Áudio]", "[Documento]", "[Figurinha]"].includes(msg.content))
                      ) && (
                          <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                        )}
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
            <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-white border-t border-[#EBE2D5] flex gap-2 sm:gap-3 shadow-[0_-4px_24px_rgba(0,0,0,0.01)] shrink-0">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  activeCustomer.isHumanAttending
                    ? "Digite uma mensagem..."
                    : "Escreva para assumir o chat..."
                }
                className="flex-1 bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              />
              <button
                type="submit"
                disabled={isSending || !inputText.trim()}
                className="bg-amber-700 hover:bg-amber-800 text-white rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm active:scale-95 shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#8C7A6B] gap-3 p-6 text-center">
            <Volume2 className="h-10 w-10 sm:h-12 sm:w-12 text-[#A09384] shrink-0" />
            <p className="text-xs sm:text-sm font-light">Selecione uma conversa para iniciar o atendimento.</p>
          </div>
        )}
      </div>

      {/* 3. Customer Info (Right Pane - Hidden on mobile & tablet) */}
      {activeCustomer && (
        <div className="hidden xl:flex w-55 border-l border-[#EBE2D5] bg-white p-4 flex-col gap-5 shrink-0 shadow-[-4px_0_24px_rgba(46,37,27,0.01)]">
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
            <div className="bg-[#FAF7F2] border border-[#EBE2D5] rounded-2xl p-4 space-y-2">
              {activeCustomer.isHumanAttending ? (
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <UserCheck className="h-4 w-4 text-amber-700" />
                  <span>Atendimento Humano</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                  <Bot className="h-4 w-4 text-emerald-600" />
                  <span>IA Ativa</span>
                </div>
              )}
              <p className="text-[11px] text-[#6B5A4B] leading-relaxed">
                {activeCustomer.isHumanAttending
                  ? "Você assumiu a conversa. As mensagens enviadas vão direto para o cliente via WhatsApp."
                  : "A IA está processando e respondendo automaticamente."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
