"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Smartphone,
  RefreshCw,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  ScanLine,
} from "lucide-react";

type ConnectionStatus = "checking" | "connected" | "disconnected" | "error";

export default function EvolutionCard() {
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrPairingCode, setQrPairingCode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/evolution/status");
      const data = await res.json();
      if (data.error && res.status === 502) {
        setStatusError(data.error);
        setStatus("error");
        return;
      }
      setStatusError(null);
      setStatus(data.connected ? "connected" : "disconnected");
    } catch {
      setStatus("error");
      setStatusError("Não foi possível consultar o status da Evolution Go.");
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await checkStatus();
    };
    run();
  }, [checkStatus]);

  const handleRefresh = () => {
    setStatus("checking");
    checkStatus();
  };

  const handleConnect = async () => {
    setConnecting(true);
    setModalOpen(true);
    setQrBase64(null);
    setQrPairingCode(null);
    setStatusError(null);
    try {
      const res = await fetch("/api/evolution/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok || (!data.base64 && !data.code)) {
        throw new Error(data.error || "Erro ao gerar o QR code.");
      }
      setQrBase64(data.base64 || null);
      setQrPairingCode(data.code || null);
    } catch (error: unknown) {
      setStatusError(error instanceof Error ? error.message : "Erro ao conectar.");
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (!modalOpen) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/evolution/status");
        const data = await res.json();
        if (data.connected) {
          setStatus("connected");
          setModalOpen(false);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [modalOpen]);

  const closeModal = () => {
    setModalOpen(false);
    setQrBase64(null);
    setQrPairingCode(null);
  };

  return (
    <div className="bg-white border border-[#EBE2D5] rounded-2xl p-6 space-y-6 shadow-[0_4px_24px_rgba(46,37,27,0.02)] max-w-4xl">
      <div className="flex items-center justify-between border-b border-[#FAF7F2] pb-3">
        <div className="flex items-center gap-3">
          <div className="bg-[#FAF7F2] p-2.5 rounded-xl border border-[#EBE2D5]">
            <Smartphone className="h-5 w-5 text-amber-700" />
          </div>
          <h2 className="text-lg font-serif font-bold text-amber-950">
            Conexão WhatsApp (Evolution Go)
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {status === "connected" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5">
              <CheckCircle2 className="h-4 w-4" /> Conectado
            </span>
          )}
          {status === "disconnected" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-500/10 border border-rose-500/20 rounded-full px-3 py-1.5">
              <WifiOff className="h-4 w-4" /> Desconectado
            </span>
          )}
          {status === "checking" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8C7A6B] bg-[#FAF7F2] border border-[#EBE2D5] rounded-full px-3 py-1.5">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
            </span>
          )}
          {status === "error" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
              <AlertCircle className="h-4 w-4" /> Erro
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            title="Verificar status"
            className="p-2 rounded-xl border border-[#EBE2D5] bg-[#FAF7F2] hover:border-amber-600 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 text-[#6B5A4B]" />
          </button>
        </div>
      </div>

      {statusError && (
        <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-800 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{statusError}</span>
        </div>
      )}

      <div className="text-sm text-[#6B5A4B] space-y-3">
        <p className="font-light">
          Conecte o número de WhatsApp que o robô usa para atender os clientes. Uma única
          instância (<code className="text-[#2E251B] font-mono">EVOLUTION_INSTANCE_NAME</code>)
          é compartilhada por todas as conexões da Evolution Go.
        </p>

        <ol className="space-y-1.5 text-xs text-[#8C7A6B]">
          <li>
            <strong className="text-[#6B5A4B]">1.</strong> Tenha a Evolution Go rodando
            (Docker) e confira as variáveis <code className="font-mono">EVOLUTION_API_URL</code>,{" "}
            <code className="font-mono">EVOLUTION_API_KEY</code> e{" "}
            <code className="font-mono">EVOLUTION_INSTANCE_NAME</code> no arquivo{" "}
            <code className="font-mono">.env</code>.
          </li>
          <li>
            <strong className="text-[#6B5A4B]">2.</strong> Clique em{" "}
            <strong>Conectar Dispositivo</strong> para gerar o QR code.
          </li>
          <li>
            <strong className="text-[#6B5A4B]">3.</strong> No WhatsApp do celular, abra{" "}
            <strong>Ajustes &gt; Aparelhos conectados &gt; Conectar um aparelho</strong> e
            escaneie o QR code exibido.
          </li>
          <li>
            <strong className="text-[#6B5A4B]">4.</strong> Assim que o aparelho for lido, o
            status muda automaticamente para <strong>Conectado</strong>.
          </li>
        </ol>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting}
          className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm cursor-pointer active:scale-95"
        >
          <ScanLine className="h-5 w-5" />
          {connecting ? "Gerando QR..." : "Conectar Dispositivo"}
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={closeModal}>
          <div
            className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[#FAF7F2] transition-colors cursor-pointer"
            >
              <X className="h-5 w-5 text-[#6B5A4B]" />
            </button>

            <h3 className="text-lg font-serif font-bold text-amber-950 mb-1">
              Conectar WhatsApp
            </h3>

            {statusError ? (
              <div className="space-y-4">
                <p className="text-sm text-rose-800 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                  {statusError}
                </p>
                <button
                  type="button"
                  onClick={handleConnect}
                  className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold py-3 rounded-xl transition-colors cursor-pointer"
                >
                  Tentar Novamente
                </button>
              </div>
            ) : !qrBase64 && !qrPairingCode ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 text-amber-700 animate-spin" />
                <p className="text-sm text-[#8C7A6B]">Gerando QR code...</p>
              </div>
            ) : (
              <>
                {qrBase64 ? (
                  <img
                    src={qrBase64}
                    alt="QR code do WhatsApp"
                    className="w-full aspect-square rounded-xl border border-[#EBE2D5] bg-white p-2"
                  />
                ) : (
                  <div className="bg-[#FAF7F2] border border-[#EBE2D5] rounded-xl p-4 text-center space-y-3">
                    <p className="text-sm text-[#6B5A4B]">
                      QR não disponível como imagem. Toque no link abaixo com o celular em{" "}
                      <strong>WhatsApp &gt; Aparelhos conectados</strong> para parear:
                    </p>
                    <a
                      href={qrPairingCode ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
                    >
                      Abrir WhatsApp e parear
                    </a>
                  </div>
                )}
                {qrPairingCode && qrBase64 && (
                  <p className="mt-3 text-center text-sm text-[#6B5A4B]">
                    Ou toque neste link no celular:{" "}
                    <a
                      href={qrPairingCode ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-700 underline break-all"
                    >
                      parear dispositivo
                    </a>
                  </p>
                )}
                <p className="mt-4 text-xs text-[#8C7A6B] text-center">
                  Escaneie com o WhatsApp: <strong>Ajustes &gt; Aparelhos conectados</strong>.
                  O status é atualizado automaticamente.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}