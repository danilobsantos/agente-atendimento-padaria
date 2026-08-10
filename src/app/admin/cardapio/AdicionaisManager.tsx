"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, Loader2, X, Check, AlertCircle, Sparkles } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface AdditionalItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean;
  categoryId: string | null;
  category: Category | null;
}

export default function AdicionaisManager({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<AdditionalItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdditionalItem | null>(null);

  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formIsAvailable, setFormIsAvailable] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/additional-items?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      setError("Erro ao carregar os itens adicionais.");
    }
  }, [tenantId]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/categories?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch {
      setError("Erro ao carregar categorias.");
    }
  }, [tenantId]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([fetchItems(), fetchCategories()]);
      setIsLoading(false);
    };
    load();
  }, [fetchItems, fetchCategories]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormName("");
    setFormPrice("");
    setFormDescription("");
    setFormCategoryId(categories[0]?.id || "");
    setFormIsAvailable(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: AdditionalItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormPrice(item.price.toString());
    setFormDescription(item.description || "");
    setFormCategoryId(item.categoryId || "");
    setFormIsAvailable(item.isAvailable);
    setIsModalOpen(true);
  };

  const handleToggleAvailable = async (item: AdditionalItem) => {
    const updatedStatus = !item.isAvailable;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isAvailable: updatedStatus } : i))
    );
    try {
      const res = await fetch(`/api/additional-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: updatedStatus }),
      });
      if (!res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, isAvailable: !updatedStatus } : i))
        );
      }
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isAvailable: !updatedStatus } : i))
      );
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("Tem certeza que deseja excluir este item adicional?")) return;
    try {
      const res = await fetch(`/api/additional-items/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      }
    } catch {
      alert("Erro ao excluir item adicional.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPrice) return;

    setIsSubmitLoading(true);
    setError(null);

    const payload = {
      tenantId,
      name: formName,
      price: parseFloat(formPrice),
      description: formDescription || null,
      categoryId: formCategoryId || null,
      isAvailable: formIsAvailable,
    };

    try {
      let res;
      if (editingItem) {
        res = await fetch(`/api/additional-items/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/additional-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        await fetchItems();
        setIsModalOpen(false);
      } else {
        const errData = await res.json();
        setError(errData.error || "Ocorreu um erro ao salvar o item adicional.");
      }
    } catch {
      setError("Erro ao se conectar com o servidor.");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-xs text-[#6B5A4B] font-light mt-1">
          Itens extras que podem ser adicionados a um produto com valor extra (ex: bacon, borda de
          Nutella, chantilly).
        </p>
        <button
          onClick={handleOpenCreate}
          className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-4.5 py-3 rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-sm text-sm active:scale-95"
        >
          <Plus className="h-4.5 w-4.5" />
          Novo Adicional
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-sm text-[#8C7A6B]">
          <Loader2 className="h-5 w-5 animate-spin text-amber-700" />
          <span>Carregando adicionais...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-[#EBE2D5] rounded-2xl p-12 text-center text-sm text-[#8C7A6B]">
          Nenhum item adicional cadastrado ainda.
        </div>
      ) : (
        <div className="bg-white border border-[#EBE2D5] rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF7F2] border-b border-[#EBE2D5] text-[10px] font-bold text-[#6B5A4B] uppercase tracking-wider">
                <th className="p-4 pl-6">Item</th>
                <th className="p-4">Categoria</th>
                <th className="p-4">Valor Extra</th>
                <th className="p-4 text-center">Disponível</th>
                <th className="p-4 pr-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FAF7F2] text-sm text-[#2E251B]">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[#FAF7F2]/40 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#FAF7F2] border border-[#EBE2D5] flex items-center justify-center text-amber-800">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#2E251B]">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-[#8C7A6B] line-clamp-1 max-w-sm mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-medium text-[#6B5A4B]">
                    {item.category?.name || "Geral"}
                  </td>
                  <td className="p-4 font-mono font-bold text-amber-700">
                    R$ {item.price.toFixed(2)}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggleAvailable(item)}
                      className="inline-flex cursor-pointer transition-transform active:scale-90"
                    >
                      {item.isAvailable ? (
                        <span className="flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold">
                          <Check className="h-3 w-3" /> Sim
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs bg-rose-500/10 text-rose-800 border border-rose-500/20 px-2.5 py-0.5 rounded-full font-bold">
                          <X className="h-3 w-3" /> Não
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="p-4 pr-6 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-2 hover:bg-[#F5EFE6] text-amber-800 hover:text-amber-950 rounded-lg transition-colors cursor-pointer inline-flex"
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 hover:bg-rose-500/10 text-rose-600 hover:text-rose-800 rounded-lg transition-colors cursor-pointer inline-flex"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#2E251B]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-[#EBE2D5] w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[#FAF7F2] flex justify-between items-center bg-white shrink-0">
              <h3 className="text-lg font-serif font-bold text-amber-950">
                {editingItem ? "Editar Item Adicional" : "Novo Item Adicional"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#8C7A6B] hover:text-[#2E251B] p-1.5 rounded-lg hover:bg-[#FAF7F2] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex gap-2.5 text-xs text-rose-700">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
                  Nome do Item
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Bacon"
                  className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
                    Valor Extra (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="Ex: 3.00"
                    className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
                    Categoria
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 cursor-pointer"
                  >
                    <option value="">Geral (todas)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
                  Descrição / Detalhes
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detalhes opcionais do adicional..."
                  rows={2}
                  className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl p-4 text-sm focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="flex items-center justify-between bg-[#FAF7F2] border border-[#EBE2D5] p-4 rounded-xl shadow-inner mt-2">
                <div>
                  <h4 className="text-xs font-bold text-amber-950">Disponível</h4>
                  <p className="text-[10px] text-[#6B5A4B] mt-0.5 font-light">
                    Se desativado, o adicional não é oferecido aos clientes.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formIsAvailable}
                  onChange={(e) => setFormIsAvailable(e.target.checked)}
                  className="h-5 w-5 accent-amber-700 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#FAF7F2]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#6B5A4B] hover:text-[#2E251B] rounded-xl hover:bg-[#FAF7F2] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitLoading}
                  className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 text-xs shadow-sm cursor-pointer"
                >
                  {isSubmitLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editingItem ? "Salvar Alterações" : "Criar Adicional"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
