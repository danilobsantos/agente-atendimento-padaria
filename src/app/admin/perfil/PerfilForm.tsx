"use client";

import React, { useState } from "react";
import {
  Save,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  User as UserIcon,
  Mail,
} from "lucide-react";

type Status = { type: "success" | "error"; message: string } | null;

interface PerfilFormProps {
  initialUser: { id: string; name: string | null; email: string };
}

export default function PerfilForm({ initialUser }: PerfilFormProps) {
  const [name, setName] = useState(initialUser.name ?? "");
  const [email, setEmail] = useState(initialUser.email);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function updateProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);
    setStatus(null);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      if (res.ok) {
        setStatus({
          type: "success",
          message: "Dados do perfil atualizados com sucesso!",
        });
      } else {
        const data = await res.json();
        setStatus({
          type: "error",
          message: data.error || "Ocorreu um erro ao salvar.",
        });
      }
    } catch {
      setStatus({ type: "error", message: "Erro de conexão com o servidor." });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (newPassword !== confirmPassword) {
      setStatus({
        type: "error",
        message: "A confirmação da nova senha não confere.",
      });
      return;
    }

    setIsSavingPassword(true);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: { current: currentPassword, new: newPassword },
        }),
      });

      if (res.ok) {
        setStatus({
          type: "success",
          message: "Senha alterada com sucesso!",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        setStatus({
          type: "error",
          message: data.error || "Ocorreu um erro ao salvar.",
        });
      }
    } catch {
      setStatus({ type: "error", message: "Erro de conexão com o servidor." });
    } finally {
      setIsSavingPassword(false);
    }
  }

  const inputClass =
    "w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600";
  const labelClass =
    "text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block";

  return (
    <div className="space-y-8">
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

      {/* Dados pessoais */}
      <form
        onSubmit={updateProfile}
        className="bg-white border border-[#EBE2D5] rounded-2xl p-6 space-y-6 shadow-[0_4px_24px_rgba(46,37,27,0.02)]"
      >
        <h2 className="text-lg font-serif font-bold text-amber-950 border-b border-[#FAF7F2] pb-3">
          Dados do Perfil
        </h2>

        <div className="space-y-1.5">
          <label className={labelClass}>Nome</label>
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-[#6B5A4B]" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              required
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>E-mail</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[#6B5A4B]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@email.com"
              required
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSavingProfile}
            className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm cursor-pointer active:scale-95"
          >
            <Save className="h-4 w-4" />
            {isSavingProfile ? "Salvando..." : "Salvar Dados"}
          </button>
        </div>
      </form>

      {/* Alterar senha */}
      <form
        onSubmit={updatePassword}
        className="bg-white border border-[#EBE2D5] rounded-2xl p-6 space-y-6 shadow-[0_4px_24px_rgba(46,37,27,0.02)]"
      >
        <h2 className="text-lg font-serif font-bold text-amber-950 border-b border-[#FAF7F2] pb-3">
          Alterar Senha
        </h2>

        <div className="space-y-1.5">
          <label className={labelClass}>Senha atual</label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-[#6B5A4B]" />
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
              required
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className={labelClass}>Nova senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
              required
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Confirmar nova senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSavingPassword}
            className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm cursor-pointer active:scale-95"
          >
            <KeyRound className="h-4 w-4" />
            {isSavingPassword ? "Alterando..." : "Alterar Senha"}
          </button>
        </div>
      </form>
    </div>
  );
}