"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Coffee, KeyRound, Mail, AlertCircle, User, Store, ArrowRight } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [password, setPassword] = useState("");
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setError(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [name, email, tenantName, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !tenantName || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, tenantName, password }),
      });

      if (res.ok) {
        // Redirect to admin panel upon success
        router.push("/admin");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Erro ao criar conta. Tente novamente.");
      }
    } catch {
      setError("Erro de rede. Verifique sua conexão.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2E251B] flex flex-col justify-center items-center p-6 antialiased">
      <div className="w-full max-w-md bg-white border border-[#EBE2D5]/80 rounded-2xl p-8 shadow-[0_8px_30px_rgba(46,37,27,0.04)] space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex bg-[#FAF7F2] p-3 rounded-full border border-[#EBE2D5] text-amber-700 mb-2">
            <Coffee className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-amber-950">Seja nosso Parceiro</h1>
          <p className="text-xs text-[#6B5A4B] font-light">
            Crie sua conta e configure o agente inteligente para sua padaria em minutos
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex gap-2.5 text-xs text-rose-700 items-start">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
              Seu nome completo
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 h-4 w-4 text-[#6B5A4B]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full bg-white border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
              E-mail comercial
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[#6B5A4B]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao@padariadojoao.com"
                className="w-full bg-white border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              />
            </div>
          </div>

          {/* Business Name (Tenant Name) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
              Nome da Padaria / Estabelecimento
            </label>
            <div className="relative">
              <Store className="absolute left-3.5 top-3.5 h-4 w-4 text-[#6B5A4B]" />
              <input
                type="text"
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="Ex: Padaria Bella Vista"
                className="w-full bg-white border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
              Sua senha de acesso
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-[#6B5A4B]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-white border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isLoading ? "Criando conta..." : "Registrar Empresa"}
            {!isLoading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <div className="border-t border-[#EBE2D5]/60 pt-4 text-center">
          <p className="text-xs text-[#6B5A4B]">
            Já possui uma conta?{" "}
            <Link
              href="/login"
              className="text-amber-700 font-bold hover:underline"
            >
              Entrar no sistema
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
