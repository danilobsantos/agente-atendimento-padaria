"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, Search, Coffee, Check, X, ToggleLeft, ToggleRight, Loader2, AlertCircle, Utensils, Tag, Sparkles } from "lucide-react";
import CategoriasManager from "./CategoriasManager";
import AdicionaisManager from "./AdicionaisManager";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string;
  category: Category;
}

type Tab = "produtos" | "categorias" | "adicionais";

const TABS: { id: Tab; label: string; icon: typeof Utensils }[] = [
  { id: "produtos", label: "Produtos", icon: Utensils },
  { id: "categorias", label: "Categorias", icon: Tag },
  { id: "adicionais", label: "Itens Adicionais", icon: Sparkles },
];

export default function CardapioManager({ tenantId }: { tenantId: string }) {
  const [tab, setTab] = useState<Tab>("produtos");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Loading & State flags
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formIsAvailable, setFormIsAvailable] = useState(true);

  // Load products
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/products?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch {
      setError("Erro ao carregar os produtos.");
    }
  }, [tenantId]);

  // Load categories
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

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([fetchProducts(), fetchCategories()]);
      setIsLoading(false);
    };
    loadAll();
  }, [fetchProducts, fetchCategories]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormName("");
    setFormPrice("");
    setFormDescription("");
    setFormImageUrl("");
    setFormCategoryId(categories[0]?.id || "");
    setFormIsAvailable(true);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormPrice(product.price.toString());
    setFormDescription(product.description || "");
    setFormImageUrl(product.imageUrl || "");
    setFormCategoryId(product.categoryId);
    setFormIsAvailable(product.isAvailable);
    setIsModalOpen(true);
  };

  // Toggle availability (fast switch)
  const handleToggleAvailable = async (product: Product) => {
    const updatedStatus = !product.isAvailable;
    
    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isAvailable: updatedStatus } : p))
    );

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: updatedStatus }),
      });
      if (!res.ok) {
        // Revert on error
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, isAvailable: !updatedStatus } : p))
        );
      }
    } catch {
      // Revert on error
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isAvailable: !updatedStatus } : p))
      );
    }
  };

  // Delete product
  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto do cardápio?")) return;

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      }
    } catch {
      alert("Erro ao excluir produto.");
    }
  };

  // Form Submit (Create / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPrice || !formCategoryId) return;

    setIsSubmitLoading(true);
    setError(null);

    const payload = {
      tenantId,
      name: formName,
      price: parseFloat(formPrice),
      description: formDescription || null,
      imageUrl: formImageUrl || null,
      categoryId: formCategoryId,
      isAvailable: formIsAvailable,
    };

    try {
      let res;
      if (editingProduct) {
        // Edit Mode
        res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Create Mode
        res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        await fetchProducts();
        setIsModalOpen(false);
      } else {
        const errData = await res.json();
        setError(errData.error || "Ocorreu um erro ao salvar o produto.");
      }
    } catch {
      setError("Erro ao se conectar com o servidor.");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Filter products by search term
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 flex-1 overflow-y-auto bg-[#FAF7F2]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-amber-950 flex items-center gap-2">
            <Coffee className="text-amber-700 h-6 w-6 sm:h-7 sm:w-7" />
            Gestão do Cardápio
          </h1>
          <p className="text-xs text-[#6B5A4B] font-light mt-0.5 sm:mt-1">
            Cadastre novos itens, edite preços ou ative/desative produtos em tempo real.
          </p>
        </div>
        {tab === "produtos" && (
          <button
            onClick={handleOpenCreate}
            className="w-full sm:w-auto bg-amber-700 hover:bg-amber-800 text-white font-bold px-4 py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm text-sm active:scale-95 shrink-0"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Novo Produto</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-white border border-[#EBE2D5] rounded-xl p-1.5 w-full sm:w-fit shadow-sm overflow-x-auto scrollbar-none">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
                isActive
                  ? "bg-amber-700 text-white shadow-sm"
                  : "text-[#6B5A4B] hover:text-[#2E251B] hover:bg-[#FAF7F2]"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-[#8C7A6B]"}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "categorias" && <CategoriasManager tenantId={tenantId} />}
      {tab === "adicionais" && <AdicionaisManager tenantId={tenantId} />}

      {tab === "produtos" && (
        <>
      {/* Filter and Search Bar */}
      <div className="flex gap-3 max-w-md bg-white border border-[#EBE2D5] rounded-xl px-3.5 py-2.5 items-center shadow-sm w-full">
        <Search className="h-4 w-4 text-[#8C7A6B] shrink-0" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar produto por nome ou descrição..."
          className="bg-transparent border-none outline-none text-xs sm:text-sm text-[#2E251B] placeholder-[#A09384] w-full"
        />
      </div>

      {/* Main product display */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-sm text-[#8C7A6B]">
          <Loader2 className="h-5 w-5 animate-spin text-amber-700" />
          <span>Carregando catálogo...</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white border border-[#EBE2D5] rounded-2xl p-8 sm:p-12 text-center text-xs sm:text-sm text-[#8C7A6B]">
          Nenhum produto cadastrado com os critérios de busca.
        </div>
      ) : (
        <div className="bg-white border border-[#EBE2D5] rounded-2xl overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-[#FAF7F2] border-b border-[#EBE2D5] text-[10px] font-bold text-[#6B5A4B] uppercase tracking-wider">
                <th className="p-4 pl-6">Item</th>
                <th className="p-4">Categoria</th>
                <th className="p-4">Preço</th>
                <th className="p-4 text-center">Disponível</th>
                <th className="p-4 pr-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FAF7F2] text-sm text-[#2E251B]">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-[#FAF7F2]/40 transition-colors">
                  {/* Item Image and Name info */}
                  <td className="p-4 pl-6 flex items-center gap-3">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-10 h-10 rounded-lg object-cover border border-[#EBE2D5]"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=100&q=80";
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#FAF7F2] border border-[#EBE2D5] flex items-center justify-center text-amber-800">
                        <Coffee className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-[#2E251B]">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-[#8C7A6B] line-clamp-1 max-w-sm mt-0.5">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Category */}
                  <td className="p-4 font-medium text-[#6B5A4B]">
                    {product.category?.name || "Sem Categoria"}
                  </td>

                  {/* Price */}
                  <td className="p-4 font-mono font-bold text-amber-700">
                    R$ {product.price.toFixed(2)}
                  </td>

                  {/* Toggle availability */}
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggleAvailable(product)}
                      className="inline-flex cursor-pointer transition-transform active:scale-90"
                    >
                      {product.isAvailable ? (
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

                  {/* Actions buttons */}
                  <td className="p-4 pr-6 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEdit(product)}
                      className="p-2 hover:bg-[#F5EFE6] text-amber-800 hover:text-amber-950 rounded-lg transition-colors cursor-pointer inline-flex"
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
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
        </>
      )}

      {/* Modal Dialog for Edit / Create */}
      {tab === "produtos" && isModalOpen && (
        <div className="fixed inset-0 bg-[#2E251B]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-[#EBE2D5] w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#FAF7F2] flex justify-between items-center bg-white shrink-0">
              <h3 className="text-lg font-serif font-bold text-amber-950">
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#8C7A6B] hover:text-[#2E251B] p-1.5 rounded-lg hover:bg-[#FAF7F2] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex gap-2.5 text-xs text-rose-700">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
                  Nome do Item
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Pão de Sal Artesanal"
                  className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                />
              </div>

              {/* Price and Category */}
              <div className="grid grid-cols-2 gap-4">
                {/* Price */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="Ex: 5.50"
                    className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                </div>

                {/* Category Selection */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
                    Categoria
                  </label>
                  <select
                    required
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
                  Descrição / Detalhes
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Escreva ingredientes ou detalhes especiais do produto..."
                  rows={3}
                  className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl p-4 text-sm focus:outline-none focus:border-amber-600"
                />
              </div>

              {/* Image URL */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
                  Link da Imagem (URL)
                </label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600"
                />
              </div>

              {/* Toggle availability switch */}
              <div className="flex items-center justify-between bg-[#FAF7F2] border border-[#EBE2D5] p-4 rounded-xl shadow-inner mt-2">
                <div>
                  <h4 className="text-xs font-bold text-amber-950">Habilitado no Cardápio</h4>
                  <p className="text-[10px] text-[#6B5A4B] mt-0.5 font-light">
                    Se desativado, o produto é ocultado do cardápio digital do cliente na hora.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormIsAvailable(!formIsAvailable)}
                  className="inline-flex cursor-pointer transition-transform active:scale-95 text-amber-700"
                >
                  {formIsAvailable ? (
                    <ToggleRight className="h-8 w-8" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-[#A09384]" />
                  )}
                </button>
              </div>

              {/* Modal Actions Footer */}
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
                  {editingProduct ? "Salvar Alterações" : "Criar Produto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
