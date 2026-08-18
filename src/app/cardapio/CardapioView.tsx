"use client";

import React, { useState } from "react";
import { Coffee, ShoppingBag, Plus, Minus, X, Check, ArrowRight, MapPin, User, Phone, CreditCard, Search } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface Product {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
}

interface AdditionalItem {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: number;
}

interface CartExtra {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  key: string;
  product: Product;
  quantity: number;
  notes: string;
  extras: CartExtra[];
}

interface CardapioViewProps {
  tenantId: string;
  tenantName: string;
  tenantLogoUrl?: string | null;
  deliveryFee?: number;
  categories: Category[];
  products: Product[];
  additionalItems: AdditionalItem[];
}

export default function CardapioView({
  tenantId,
  tenantName,
  tenantLogoUrl,
  deliveryFee = 0,
  categories,
  products,
  additionalItems,
}: CardapioViewProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [search, setSearch] = useState("");

  // Extras selection modal
  const [extraModalProduct, setExtraModalProduct] = useState<Product | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<CartExtra[]>([]);

  const extrasByCategory = React.useMemo(() => {
    const map = new Map<string | null, AdditionalItem[]>();
    for (const item of additionalItems) {
      const list = map.get(item.categoryId) || [];
      list.push(item);
      map.set(item.categoryId, list);
    }
    return map;
  }, [additionalItems]);

  const extrasForProduct = (product: Product) => [
    ...(extrasByCategory.get(null) || []),
    ...(product.categoryId ? extrasByCategory.get(product.categoryId) || [] : []),
  ];

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const visibleProducts = search.trim()
    ? products.filter((p) => normalize(p.name).includes(normalize(search)))
    : products;

  // Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [payment, setPayment] = useState("PIX");
  const [orderType, setOrderType] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [specialNotes, setSpecialNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unitPrice = (item: CartItem) =>
    item.product.price + item.extras.reduce((sum, e) => sum + e.price, 0);

  const cartTotal = cart.reduce(
    (sum, item) => sum + unitPrice(item) * item.quantity,
    0
  );

  const deliveryFeeValue = orderType === "DELIVERY" ? deliveryFee : 0;
  const checkoutTotal = cartTotal + deliveryFeeValue;

  const addToCart = (product: Product, extras: CartExtra[]) => {
    const key = `${product.id}:${extras.map((e) => e.id).sort().join(",")}`;
    setCart((prev) => {
      const existing = prev.find((item) => item.key === key);
      if (existing) {
        return prev.map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { key, product, quantity: 1, notes: "", extras }];
    });
  };

  const handleAddClick = (product: Product) => {
    const extras = extrasForProduct(product);
    if (extras.length === 0) {
      addToCart(product, []);
      return;
    }
    setSelectedExtras([]);
    setExtraModalProduct(product);
  };

  const updateQuantity = (key: string, amount: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.key === key) {
            const nextQty = item.quantity + amount;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const updateNotes = (key: string, notes: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, notes } : item
      )
    );
  };

  const toggleExtra = (extra: CartExtra) => {
    setSelectedExtras((prev) =>
      prev.some((e) => e.id === extra.id)
        ? prev.filter((e) => e.id !== extra.id)
        : [...prev, extra]
    );
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || (orderType === "DELIVERY" && (!street || !number || !neighborhood))) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          customerPhone: phone,
          customerName: name,
          source: "WEB",
          deliveryAddress: orderType === "PICKUP" ? null : { street, number, neighborhood },
          notes: `Pagamento: ${payment}${specialNotes ? ` | Obs: ${specialNotes}` : ""}`,
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            notes: i.notes,
            additionalItems: i.extras.map((e) => ({
              id: e.id,
              name: e.name,
              price: e.price,
            })),
          })),
        }),
      });

      if (res.ok) {
        setCart([]);
        setIsCartOpen(false);
        setIsCheckoutOpen(false);
        setIsSuccess(true);
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2E251B] font-sans pb-24 antialiased">
      {/* 1. Header */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-[#EBE2D5] h-16 px-6 flex justify-between items-center z-30 shadow-sm">
        <div className="flex items-center gap-2.5">
          {tenantLogoUrl ? (
            <img
              src={tenantLogoUrl}
              alt={tenantName}
              className="h-10 w-10 object-contain rounded-lg border border-[#EBE2D5] bg-[#FAF7F2] p-0.5"
            />
          ) : (
            <div className="bg-[#FAF7F2] p-1.5 rounded-lg border border-[#EBE2D5]">
              <Coffee className="h-5 w-5 text-amber-700" />
            </div>
          )}
          <span className="font-serif font-bold text-lg text-amber-950 tracking-tight">{tenantName}</span>
        </div>
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative bg-[#FAF7F2] hover:bg-[#F5EFE6] border border-[#EBE2D5] p-2.5 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-95"
        >
          <ShoppingBag className="h-5 w-5 text-amber-950" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1.5 bg-amber-600 text-white text-[10px] font-extrabold h-5 w-5 rounded-full flex items-center justify-center animate-bounce shadow-sm">
              {cart.reduce((sum, i) => sum + i.quantity, 0)}
            </span>
          )}
        </button>
      </header>

      {/* 2. Search */}
      <div className="max-w-3xl mx-auto px-6 pt-6">
        <div className="relative">
          <Search className="h-4 w-4 text-[#6B5A4B] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por produto..."
            className="w-full bg-white border border-[#EBE2D5] text-[#2E251B] placeholder-slate-400 rounded-xl pl-11 pr-4 py-3 text-sm shadow-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[#FAF7F2] text-[#6B5A4B] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {search.trim() && visibleProducts.length === 0 && (
          <p className="text-center text-sm text-[#6B5A4B] mt-6">
            Nenhum produto encontrado para "{search.trim()}"
          </p>
        )}
      </div>

      {/* 3. Menu Catalog Grid */}
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-12">
        {categories.map((category) => {
          const categoryProducts = visibleProducts.filter((p) => p.categoryId === category.id);
          if (categoryProducts.length === 0) return null;

          return (
            <section key={category.id} className="space-y-6">
              <div className="border-b border-[#EBE2D5] pb-2 flex flex-col gap-1">
                <h2 className="text-2xl font-serif font-bold text-amber-950">
                  {category.name}
                </h2>
                {category.description && (
                  <p className="text-xs text-[#6B5A4B] font-light leading-relaxed">
                    {category.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {categoryProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white border border-[#EBE2D5]/70 rounded-2xl p-5 flex justify-between gap-4 items-start shadow-[0_4px_20px_rgba(46,37,27,0.03)] hover:shadow-[0_8px_30px_rgba(46,37,27,0.06)] hover:border-amber-900/10 transition-all duration-300"
                  >
                    <div className="space-y-2 flex-1">
                      <h4 className="font-serif font-bold text-[#2E251B] text-lg leading-snug">
                        {product.name}
                      </h4>
                      {product.description && (
                        <p className="text-xs text-[#6B5A4B] line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                      <span className="text-base font-extrabold text-amber-700 block pt-1">
                        R$ {product.price.toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleAddClick(product)}
                      className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-10 w-10 flex items-center justify-center transition-all shadow-sm shrink-0 active:scale-90 cursor-pointer"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* 4. Floating Bottom Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-[#EBE2D5] flex justify-center z-20">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full max-w-md bg-amber-700 hover:bg-amber-800 text-white font-semibold py-4 px-6 rounded-xl flex justify-between items-center shadow-lg transition-colors cursor-pointer active:scale-98"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              <span>Ver meu pedido</span>
            </div>
            <span className="font-bold">R$ {cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* 4. Cart Side Panel / Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 flex justify-end">
          <div className="w-full max-w-md bg-[#FAF7F2] border-l border-[#EBE2D5] h-full flex flex-col shadow-2xl">
            <div className="p-6 border-b border-[#EBE2D5] flex justify-between items-center bg-white shadow-sm">
              <h3 className="font-serif font-bold text-xl text-amber-950">Meu Pedido</h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-full hover:bg-[#FAF7F2] text-[#6B5A4B] cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.map((item) => (
                <div
                  key={item.key}
                  className="bg-white border border-[#EBE2D5]/70 p-4 rounded-xl space-y-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h5 className="font-serif font-bold text-sm text-[#2E251B]">{item.product.name}</h5>
                      <span className="text-xs text-amber-700 font-bold block mt-1">
                        R$ {unitPrice(item).toFixed(2)}
                      </span>
                      {item.extras.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {item.extras.map((e) => (
                            <li key={e.id} className="text-[11px] text-[#6B5A4B]">
                              + {e.name} <span className="font-semibold text-amber-700">(+R$ {e.price.toFixed(2)})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex items-center gap-3 bg-[#FAF7F2] border border-[#EBE2D5]/80 rounded-lg px-2.5 py-1 shrink-0">
                      <button
                        onClick={() => updateQuantity(item.key, -1)}
                        className="text-[#6B5A4B] hover:text-[#2E251B] cursor-pointer"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-extrabold text-[#2E251B]">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.key, 1)}
                        className="text-[#6B5A4B] hover:text-[#2E251B] cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => updateNotes(item.key, e.target.value)}
                    placeholder="Adicionar observação (ex: sem cebola)"
                    className="w-full bg-[#FAF7F2] border border-[#EBE2D5]/80 rounded-lg px-3 py-1.5 text-xs text-[#2E251B] placeholder-slate-400 focus:outline-none focus:border-amber-600"
                  />
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-[#EBE2D5] bg-white space-y-4">
              <div className="flex justify-between items-center text-[#6B5A4B] text-sm">
                <span>Subtotal</span>
                <span className="font-semibold">R$ {cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-amber-950 font-serif font-bold text-lg">
                <span>Total</span>
                <span className="text-amber-700">R$ {cartTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(true)}
                className="w-full bg-amber-700 hover:bg-amber-800 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Continuar</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4.5. Extras Selection Modal */}
      {extraModalProduct && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#FAF7F2] border border-[#EBE2D5] rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-[#EBE2D5] flex justify-between items-center bg-white shadow-sm shrink-0">
              <div>
                <h3 className="font-serif font-bold text-xl text-amber-950">{extraModalProduct.name}</h3>
                <p className="text-xs text-[#6B5A4B] mt-0.5">
                  R$ {extraModalProduct.price.toFixed(2)} — Escolha os opcionais
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExtraModalProduct(null)}
                className="p-2 -mr-2 rounded-full hover:bg-[#FAF7F2] active:bg-[#EBE2D5] text-[#6B5A4B] cursor-pointer touch-manipulation"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {extrasForProduct(extraModalProduct).map((extra) => {
                const selected = selectedExtras.some((e) => e.id === extra.id);
                return (
                  <button
                    type="button"
                    key={extra.id}
                    onClick={() => toggleExtra(extra)}
                    className={`w-full flex items-center justify-between gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer touch-manipulation active:scale-[0.98] ${
                      selected
                        ? "bg-amber-700/10 border-amber-700 text-amber-950"
                        : "bg-white border-[#EBE2D5]/70 hover:border-amber-900/20"
                    }`}
                  >
                    <div className="space-y-0.5 flex-1">
                      <span className={`font-semibold text-sm ${selected ? "text-amber-900" : "text-[#2E251B]"}`}>
                        {extra.name}
                      </span>
                      {extra.description && (
                        <p className="text-[11px] text-[#6B5A4B]">{extra.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-extrabold text-amber-700">+R$ {extra.price.toFixed(2)}</span>
                      <span className={`h-5 w-5 rounded-md border flex items-center justify-center ${
                        selected ? "bg-amber-700 border-amber-700 text-white" : "border-[#EBE2D5] text-transparent"
                      }`}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-6 border-t border-[#EBE2D5] bg-white space-y-3 shrink-0 rounded-b-2xl">
              <div className="flex justify-between items-center text-[#6B5A4B] text-sm">
                <span>{selectedExtras.length > 0 ? `${selectedExtras.length} opcional(is) selecionado(s)` : "Nenhum opcional"}</span>
                <span className="font-semibold text-[#2E251B]">
                  R$ {(extraModalProduct.price + selectedExtras.reduce((s, e) => s + e.price, 0)).toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  addToCart(extraModalProduct, selectedExtras);
                  setExtraModalProduct(null);
                }}
                className="w-full bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm touch-manipulation active:scale-[0.98]"
              >
                <span>Adicionar ao carrinho</span>
                <ShoppingBag className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Checkout Form Drawer */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-[#FAF7F2] border-l border-[#EBE2D5] h-full flex flex-col shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-[#EBE2D5] flex justify-between items-center bg-white shadow-sm">
              <h3 className="font-serif font-bold text-xl text-amber-950">Finalizar Pedido</h3>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded-full hover:bg-[#FAF7F2] text-[#6B5A4B] cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="p-6 space-y-6 flex-1">
              {/* Contact Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider border-b border-[#EBE2D5]/60 pb-1 flex items-center gap-1.5">
                  <User className="h-4 w-4" /> Contato
                </h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Seu nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-[#EBE2D5] text-[#2E251B] placeholder-slate-400 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="WhatsApp (ex: 11999999999)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white border border-[#EBE2D5] text-[#2E251B] placeholder-slate-400 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                </div>
              </div>

              {/* Order type: Delivery vs Pickup */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider border-b border-[#EBE2D5]/60 pb-1 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> Como você prefere receber?
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOrderType("DELIVERY")}
                    className={`py-3 px-3 border rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      orderType === "DELIVERY"
                        ? "bg-amber-700/10 text-amber-800 border-amber-700"
                        : "border-[#EBE2D5] text-[#6B5A4B] hover:border-[#6B5A4B] bg-white shadow-sm"
                    }`}
                  >
                    Entrega no endereço
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("PICKUP")}
                    className={`py-3 px-3 border rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      orderType === "PICKUP"
                        ? "bg-amber-700/10 text-amber-800 border-amber-700"
                        : "border-[#EBE2D5] text-[#6B5A4B] hover:border-[#6B5A4B] bg-white shadow-sm"
                    }`}
                  >
                    Retirada no balcão
                  </button>
                </div>
              </div>

              {/* Delivery Address (hidden for pickup) */}
              {orderType === "DELIVERY" && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider border-b border-[#EBE2D5]/60 pb-1 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> Endereço de Entrega
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Rua / Avenida"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="col-span-2 bg-white border border-[#EBE2D5] text-[#2E251B] placeholder-slate-400 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Número"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="col-span-1 bg-white border border-[#EBE2D5] text-[#2E251B] placeholder-slate-400 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Bairro"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full bg-white border border-[#EBE2D5] text-[#2E251B] placeholder-slate-400 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                />
              </div>
              )}

              {/* Payment Method */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider border-b border-[#EBE2D5]/60 pb-1 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" /> Forma de Pagamento
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {["PIX", "DINHEIRO", "CARTAO"].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPayment(method)}
                      className={`py-3 px-3 border rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        payment === method
                          ? "bg-amber-700/10 text-amber-800 border-amber-700"
                          : "border-[#EBE2D5] text-[#6B5A4B] hover:border-[#6B5A4B] bg-white shadow-sm"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Special instructions */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#6B5A4B] uppercase tracking-wider">
                  Observações adicionais
                </label>
                <textarea
                  placeholder="Ex: Troco para R$ 50, ponto do pão de queijo, etc."
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-[#EBE2D5] text-[#2E251B] placeholder-slate-400 rounded-lg p-4 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                />
              </div>

              {/* Order total info */}
              {deliveryFeeValue > 0 && (
                <div className="border-t border-[#EBE2D5] pt-4 flex justify-between items-center text-[#6B5A4B] text-sm">
                  <span>Subtotal</span>
                  <span className="font-semibold">R$ {cartTotal.toFixed(2)}</span>
                </div>
              )}
              {deliveryFeeValue > 0 && (
                <div className="flex justify-between items-center text-[#6B5A4B] text-sm">
                  <span>Taxa de entrega</span>
                  <span className="font-semibold">R$ {deliveryFeeValue.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-[#EBE2D5] pt-4 flex justify-between items-center">
                <span className="font-bold text-amber-950 font-serif">Total a Pagar</span>
                <span className="font-extrabold text-amber-700 text-2xl">
                  R$ {checkoutTotal.toFixed(2)}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold py-4 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Enviando..." : "Enviar Pedido"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. Success Modal Overlay */}
      {isSuccess && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white border border-[#EBE2D5] rounded-2xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
            <div className="mx-auto h-16 w-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-inner">
              <Check className="h-8 w-8 animate-ping absolute" />
              <Check className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-serif font-bold text-amber-950">Pedido Confirmado!</h3>
              <p className="text-sm text-[#6B5A4B] leading-relaxed">
                Seu pedido foi registrado e enviado diretamente para a cozinha da padaria.
                Em breve enviaremos atualizações.
              </p>
            </div>
            <button
              onClick={() => setIsSuccess(false)}
              className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold py-3.5 rounded-xl transition-colors cursor-pointer"
            >
              Voltar ao Cardápio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
