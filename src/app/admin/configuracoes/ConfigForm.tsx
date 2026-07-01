"use client";

import React, { useState } from "react";
import { Save, CheckCircle2, AlertCircle } from "lucide-react";

interface Settings {
  tenantId: string;
  llmProvider: "DEEPSEEK" | "GEMINI" | "OPENAI";
  llmApiKey: string;
  llmModel: string;
  systemPrompt: string;
  debounceSeconds: number;
  sessionTimeout: number;
  messageContextLimit: number;
  isActive: boolean;
}

export default function ConfigForm({ initialSettings }: { initialSettings: Settings }) {
  const [provider, setProvider] = useState(initialSettings.llmProvider);
  const [apiKey, setApiKey] = useState(initialSettings.llmApiKey);
  const [model, setModel] = useState(initialSettings.llmModel);
  const [prompt, setPrompt] = useState(initialSettings.systemPrompt);
  const [debounce, setDebounce] = useState(initialSettings.debounceSeconds);
  const [sessionTimeout, setSessionTimeout] = useState(initialSettings.sessionTimeout || 1800);
  const [contextLimit, setContextLimit] = useState(initialSettings.messageContextLimit || 15);
  const [isActive, setIsActive] = useState(initialSettings.isActive);

  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as "DEEPSEEK" | "GEMINI";
    setProvider(val);
    if (val === "DEEPSEEK") {
      setModel("deepseek-chat");
    } else if (val === "GEMINI") {
      setModel("gemini-2.0-flash");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatus(null);

    try {
      const res = await fetch("/api/bot-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: initialSettings.tenantId,
          llmProvider: provider,
          ...(apiKey && apiKey !== "••••••••" && { llmApiKey: apiKey }),
          llmModel: model,
          systemPrompt: prompt,
          debounceSeconds: debounce,
          sessionTimeout,
          messageContextLimit: contextLimit,
          isActive,
        }),
      });

      if (res.ok) {
        setStatus({ type: "success", message: "Configurações salvas com sucesso!" });
      } else {
        const data = await res.json();
        setStatus({ type: "error", message: data.error || "Ocorreu um erro ao salvar." });
      }
    } catch {
      setStatus({ type: "error", message: "Erro de conexão com o servidor." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      {status && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
            status.type === "success"
              ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/20"
              : "bg-rose-500/10 text-rose-800 border-rose-500/20"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-700" />
          )}
          <span>{status.message}</span>
        </div>
      )}

      {/* Main Configurations Card */}
      <div className="bg-white border border-[#EBE2D5] rounded-2xl p-6 space-y-6 shadow-[0_4px_24px_rgba(46,37,27,0.02)]">
        <h2 className="text-lg font-serif font-bold text-amber-950 border-b border-[#FAF7F2] pb-3">
          Configurações da LLM (Modelo)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
              Provedor de IA
            </label>
            <select
              value={provider}
              onChange={handleProviderChange}
              className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 cursor-pointer"
            >
              <option value="DEEPSEEK">DeepSeek</option>
              <option value="GEMINI">Google Gemini</option>
            </select>
          </div>

          {/* Model Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
              Modelo
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 cursor-pointer"
            >
              {provider === "DEEPSEEK" ? (
                <>
                  <option value="deepseek-chat">DeepSeek V3 (Rápido)</option>
                  <option value="deepseek-reasoner">DeepSeek R1 (Raciocínio)</option>
                </>
              ) : (
                <>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Ultrarrápido)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Avançado)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
            Chave de API
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Insira sua API Key"
            className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
          />
        </div>
      </div>

      {/* Debounce & Chat Settings */}
      <div className="bg-white border border-[#EBE2D5] rounded-2xl p-6 space-y-6 shadow-[0_4px_24px_rgba(46,37,27,0.02)]">
        <h2 className="text-lg font-serif font-bold text-amber-950 border-b border-[#FAF7F2] pb-3">
          Regras de Atendimento
        </h2>

        {/* Debounce Window */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
              Janela de Agrupamento (Debounce)
            </label>
            <span className="text-sm font-extrabold text-amber-700">{debounce} segundos</span>
          </div>
          <input
            type="range"
            min="2"
            max="30"
            value={debounce}
            onChange={(e) => setDebounce(parseInt(e.target.value))}
            className="w-full accent-amber-700 bg-[#FAF7F2] h-2 rounded-lg cursor-pointer border border-[#EBE2D5]"
          />
          <p className="text-xs text-[#8C7A6B] leading-relaxed">
            Tempo que o robô aguarda novas mensagens do mesmo cliente antes de processar e responder.
            Evita o envio de respostas sucessivas e fragmentadas no WhatsApp.
          </p>
        </div>

        <hr className="border-[#EBE2D5]/50" />

        {/* Message Context Window */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
              Janela de Contexto de Mensagens (Histórico)
            </label>
            <span className="text-sm font-extrabold text-amber-700">{contextLimit} mensagens</span>
          </div>
          <input
            type="range"
            min="5"
            max="50"
            value={contextLimit}
            onChange={(e) => setContextLimit(parseInt(e.target.value))}
            className="w-full accent-amber-700 bg-[#FAF7F2] h-2 rounded-lg cursor-pointer border border-[#EBE2D5]"
          />
          <p className="text-xs text-[#8C7A6B] leading-relaxed">
            Número de mensagens anteriores da conversa enviadas para o cérebro da IA para dar contexto à resposta atual. Valores maiores dão mais memória ao robô, mas utilizam mais tokens.
          </p>
        </div>

        <hr className="border-[#EBE2D5]/50" />

        {/* Session Timeout (Redis TTL) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
            Tempo de Permanência das Mensagens na Sessão (Segundos)
          </label>
          <input
            type="number"
            min="60"
            max="86400"
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 1800)}
            className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
          />
          <p className="text-xs text-[#8C7A6B] leading-relaxed mt-1">
            Tempo máximo de inatividade em segundos (ex: 1800s = 30min) antes que o histórico de mensagens temporárias e carrinho do cliente no Redis expirem e sejam resetados.
          </p>
        </div>

        <hr className="border-[#EBE2D5]/50" />

        {/* System Toggle Status */}
        <div className="flex items-center justify-between bg-[#FAF7F2] border border-[#EBE2D5] p-4 rounded-xl shadow-inner">
          <div>
            <h3 className="text-sm font-bold text-amber-950">Robô Ativo</h3>
            <p className="text-xs text-[#6B5A4B] mt-0.5 font-light">
              Habilita ou desabilita as respostas automáticas da IA no WhatsApp globalmente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isActive ? "bg-amber-600" : "bg-[#EBE2D5]"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isActive ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Bot Prompt Settings */}
      <div className="bg-white border border-[#EBE2D5] rounded-2xl p-6 space-y-6 shadow-[0_4px_24px_rgba(46,37,27,0.02)]">
        <h2 className="text-lg font-serif font-bold text-amber-950 border-b border-[#FAF7F2] pb-3">
          Instruções de Personalidade (System Prompt)
        </h2>

        <div className="space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] rounded-xl p-4 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 font-mono leading-relaxed"
            placeholder="Descreva a personalidade do atendente virtual..."
          />
          <p className="text-xs text-[#8C7A6B] leading-relaxed">
            Instruções gerais passadas para o cérebro da IA. O catálogo de produtos disponíveis cadastrado no sistema
            será anexado automaticamente a este prompt para que a IA sempre conheça o cardápio e preços atuais.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-6 py-3.5 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm cursor-pointer active:scale-95"
        >
          <Save className="h-5 w-5" />
          {isSaving ? "Salvando..." : "Salvar Configurações"}
        </button>
      </div>
    </form>
  );
}
