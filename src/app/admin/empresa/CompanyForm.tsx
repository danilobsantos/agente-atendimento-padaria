"use client";

import React, { useState } from "react";
import { Save, CheckCircle2, AlertCircle, Upload, Trash2 } from "lucide-react";

export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
}

export default function CompanyForm({ company }: { company: Company }) {
  const [name, setName] = useState(company.name);
  const [cnpj, setCnpj] = useState(company.cnpj || "");
  const [address, setAddress] = useState(company.address || "");
  const [phone, setPhone] = useState(company.phone || "");
  const [logoUrl, setLogoUrl] = useState<string | null>(company.logoUrl);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("cnpj", cnpj);
      formData.set("address", address);
      formData.set("phone", phone);
      if (logoFile) formData.set("logo", logoFile);

      const res = await fetch("/api/company-settings", {
        method: "PUT",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", message: "Dados da empresa salvos com sucesso!" });
        setLogoFile(null);
        setLogoPreview(null);
        setLogoUrl(data.logoUrl);
      } else {
        setStatus({ type: "error", message: data.error || "Ocorreu um erro ao salvar." });
      }
    } catch {
      setStatus({ type: "error", message: "Erro de conexão com o servidor." });
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    "w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600";

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

      <div className="bg-white border border-[#EBE2D5] rounded-2xl p-6 space-y-6 shadow-[0_4px_24px_rgba(46,37,27,0.02)]">
        <h2 className="text-lg font-serif font-bold text-amber-950 border-b border-[#FAF7F2] pb-3">
          Dados da Empresa
        </h2>

        <div className="flex items-center gap-5">
          <div className="h-20 w-20 rounded-2xl border border-[#EBE2D5] bg-[#FAF7F2] overflow-hidden flex items-center justify-center shrink-0">
            {logoPreview ? (
              <img src={logoPreview} alt="Nova logo" className="h-full w-full object-contain" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo da empresa" className="h-full w-full object-contain" />
            ) : (
              <span className="text-2xl font-serif font-bold text-[#A09384]">
                {(name.charAt(0) || "?").toUpperCase()}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] rounded-xl px-4 py-2.5 text-sm font-bold cursor-pointer hover:border-amber-600 transition-colors">
              <Upload className="h-4 w-4 text-amber-700" />
              Enviar Logo
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.svg"
                onChange={handleLogoChange}
                className="hidden"
              />
            </label>
            {(logoPreview || logoUrl) && (
              <button
                type="button"
                onClick={removeLogo}
                className="inline-flex items-center gap-1.5 text-xs text-rose-700 hover:text-rose-800"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remover seleção
              </button>
            )}
            <p className="text-xs text-[#8C7A6B]">JPG, PNG, WebP ou SVG.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
            Nome da Empresa *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Padaria Sabor de Minas"
            required
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
              CNPJ
            </label>
            <input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
              Telefone
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(31) 99999-0000"
              inputMode="tel"
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
            Endereço
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Rua, número, bairro, cidade - UF"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-6 py-3.5 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm cursor-pointer active:scale-95"
        >
          <Save className="h-5 w-5" />
          {isSaving ? "Salvando..." : "Salvar Dados"}
        </button>
      </div>
    </form>
  );
}