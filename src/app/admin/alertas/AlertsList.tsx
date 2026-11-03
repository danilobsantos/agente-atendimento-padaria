"use client";

import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";

export interface AlertItem {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string | null;
  status: string;
  createdAt: string;
}

const SEVERITY_STYLE: Record<string, string> = {
  info: "bg-sky-50 text-sky-800 border-sky-200",
  warn: "bg-amber-50 text-amber-900 border-amber-200",
  critical: "bg-rose-50 text-rose-900 border-rose-200",
};

export default function AlertsList({ initialAlerts }: { initialAlerts: AlertItem[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);

  async function setStatus(id: string, status: "ack" | "resolved" | "open") {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-white border border-[#EBE2D5] rounded-2xl p-8 text-center text-sm text-[#8C7A6B]">
        Nada aberto. O bot está sem erros e ninguém está esperando atendimento.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`bg-white border rounded-2xl p-5 shadow-sm ${SEVERITY_STYLE[alert.severity] ?? "border-[#EBE2D5]"}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-1">
                <Bell className="h-3.5 w-3.5" />
                {alert.kind.replace(/_/g, " ")} · {alert.severity}
                {alert.status !== "open" && <span>· {alert.status}</span>}
              </div>
              <p className="font-semibold text-amber-950">{alert.title}</p>
              {alert.body && (
                <p className="text-xs text-[#4A3D31] mt-2 whitespace-pre-wrap break-words">{alert.body}</p>
              )}
              <p className="text-[11px] text-[#A69684] mt-2">
                {new Date(alert.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {alert.status === "open" && (
                <button
                  onClick={() => setStatus(alert.id, "ack")}
                  title="Marcar como visto"
                  className="p-2 rounded-lg text-[#8C7A6B] hover:bg-[#FAF7F2] hover:text-amber-800"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
              {alert.status !== "resolved" && (
                <button
                  onClick={() => setStatus(alert.id, "resolved")}
                  title="Resolver"
                  className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
