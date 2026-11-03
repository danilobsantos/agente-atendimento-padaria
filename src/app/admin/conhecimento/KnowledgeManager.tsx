"use client";

import { useState } from "react";
import { BookOpen, Plus, Trash2, Save, Loader2, Eye, EyeOff } from "lucide-react";

export interface KnowledgeItem {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string | null;
  priority: number;
  isActive: boolean;
}

const inputClass =
  "w-full rounded-xl border border-[#EBE2D5] bg-[#FAF7F2] px-4 py-2.5 text-sm text-[#2E251B] placeholder:text-[#A69684] focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-[#8C7A6B] mb-1.5";

export default function KnowledgeManager({ initialEntries }: { initialEntries: KnowledgeItem[] }) {
  const [entries, setEntries] = useState<KnowledgeItem[]>(initialEntries);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [keywords, setKeywords] = useState("");
  const [category, setCategory] = useState("Geral");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!question.trim() || !answer.trim()) {
      setError("Pergunta e resposta são obrigatórias.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          answer,
          category,
          keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      setEntries((prev) => [data, ...prev]);
      setQuestion("");
      setAnswer("");
      setKeywords("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(entry: KnowledgeItem) {
    const next = !entry.isActive;
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, isActive: next } : e)));
    await fetch(`/api/knowledge/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
  }

  async function remove(id: string) {
    if (!confirm("Remover esta entrada da base de conhecimento?")) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#EBE2D5] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-amber-900 font-semibold">
          <Plus className="h-4 w-4" />
          Nova entrada
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Pergunta do cliente</label>
            <input
              className={inputClass}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Qual o horário de funcionamento?"
            />
          </div>
          <div>
            <label className={labelClass}>Categoria</label>
            <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Resposta que o bot pode dar</label>
          <textarea
            className={`${inputClass} min-h-[90px]`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Abrimos de segunda a sábado, das 6h às 19h."
          />
        </div>

        <div>
          <label className={labelClass}>Palavras-chave (separadas por vírgula)</label>
          <input
            className={inputClass}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="horário, abre, fecha, domingo"
          />
        </div>

        {error && <p className="text-sm text-rose-700">{error}</p>}

        <button
          onClick={create}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </button>
      </div>

      <div className="space-y-3">
        {entries.length === 0 && (
          <p className="text-sm text-[#8C7A6B]">Nenhuma entrada ainda. Sem isso o bot responde “vou confirmar” a toda política.</p>
        )}

        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`bg-white border rounded-2xl p-5 shadow-sm ${entry.isActive ? "border-[#EBE2D5]" : "border-dashed border-[#D9CDBC] opacity-60"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-[#8C7A6B] mb-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{entry.category || "Geral"}</span>
                  {entry.keywords.length > 0 && <span>· {entry.keywords.join(", ")}</span>}
                </div>
                <p className="font-semibold text-amber-950">{entry.question}</p>
                <p className="text-sm text-[#4A3D31] mt-1 whitespace-pre-wrap">{entry.answer}</p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleActive(entry)}
                  title={entry.isActive ? "Desativar" : "Ativar"}
                  className="p-2 rounded-lg text-[#8C7A6B] hover:bg-[#FAF7F2] hover:text-amber-800"
                >
                  {entry.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => remove(entry.id)}
                  title="Remover"
                  className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
