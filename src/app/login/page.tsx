"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Coffee, KeyRound, Mail, AlertCircle, ArrowRight } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Clear auth error dynamically if inputs change
  useEffect(() => {
    const timer = setTimeout(() => {
      setError(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [email, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Erro ao fazer login. Tente novamente.");
      }
    } catch {
      setError("Erro de rede. Verifique sua conexão.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-[#EBE2D5]/80 rounded-2xl p-8 shadow-[0_8px_30px_rgba(46,37,27,0.04)] space-y-6">
      {/* Brand/Logo */}
      <div className="text-center space-y-2">
        <div className="inline-flex bg-[#FAF7F2] p-3 rounded-full border border-[#EBE2D5] text-amber-700 mb-2">
          <Coffee className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-amber-950">Acessar Painel</h1>
        <p className="text-xs text-[#6B5A4B] font-light">
          Entre com suas credenciais de operador para gerenciar o delivery
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex gap-2.5 text-xs text-rose-700 items-start">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
            E-mail corporativo
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[#6B5A4B]" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@email.com"
              className="w-full bg-white border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
            />
          </div>
        </div>

        {/* Password input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
            Sua senha
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-[#6B5A4B]" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className="w-full bg-white border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          {isLoading ? "Entrando..." : "Entrar no Painel"}
          {!isLoading && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      <div className="border-t border-[#EBE2D5]/60 pt-4 text-center">
        <p className="text-xs text-[#6B5A4B]">
          Ainda não tem conta?{" "}
          <Link
            href="/signup"
            className="text-amber-700 font-bold hover:underline"
          >
            Criar conta de parceiro
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2E251B] flex flex-col justify-center items-center p-6 antialiased">
      <Suspense fallback={
        <div className="w-full max-w-md bg-white border border-[#EBE2D5]/80 rounded-2xl p-8 shadow-[0_8px_30px_rgba(46,37,27,0.04)] text-center text-sm py-12">
          Carregando formulário...
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
