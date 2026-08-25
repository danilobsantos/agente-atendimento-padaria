import React from "react";
import Link from "next/link";
import { Coffee, Lock, ArrowLeft } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2E251B] flex flex-col justify-center items-center p-6 antialiased">
      <div className="w-full max-w-md bg-white border border-[#EBE2D5]/80 rounded-2xl p-8 shadow-[0_8px_30px_rgba(46,37,27,0.04)] space-y-6 text-center">
        {/* Icon Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex bg-[#FAF7F2] p-3 rounded-full border border-[#EBE2D5] text-amber-700">
            <Coffee className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-amber-950">
            Cadastro de Parceiros
          </h1>
        </div>

        {/* Notice Card */}
        <div className="bg-[#FAF7F2] border border-[#EBE2D5] rounded-xl p-5 space-y-2">
          <div className="flex justify-center text-amber-800 mb-1">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-sm font-bold text-amber-950">
            Cadastros Temporariamente Fechados
          </h2>
          <p className="text-xs text-[#6B5A4B] leading-relaxed">
            No momento, novas adesões ao sistema estão suspensas para manutenção e ajustes de infraestrutura. Entre em contato com a administração para mais informações.
          </p>
        </div>

        {/* Back to Login Action */}
        <div className="pt-2">
          <Link
            href="/login"
            className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o Login
          </Link>
        </div>
      </div>
    </div>
  );
}
