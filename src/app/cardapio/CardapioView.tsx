"use client";

import React, { useState } from "react";
import { Coffee, ShoppingBag, Plus, Minus, X, Check, ArrowRight, MapPin, User, Phone, CreditCard } from "lucide-react";

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

interface CartItem {
  product: Product;
  quantity: number;
  notes: string;
}

interface CardapioViewProps {
  tenantId: string;
  tenantName: string;
  categories: Category[];
  products: Product[];
}

export default function CardapioView({
  tenantId,
  tenantName,
  categories,
  products,
}: CardapioViewProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [payment, setPayment] = useState("PIX");
  const [specialNotes, setSpecialNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, notes: "" }];
    });
  };

  const updateQuantity = (productId: string, amount: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + amount;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const updateNotes = (productId: string, notes: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, notes } : item
      )
    );
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !street || !number || !neighborhood) return;

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
          deliveryAddress: { street, number, neighborhood },
          notes: `Pagamento: ${payment}${specialNotes ? ` | Obs: ${specialNotes}` : ""}`,
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            notes: i.notes,
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
        <div className="flex items-center gap-2">
          <div className="bg-[#FAF7F2] p-1.5 rounded-lg border border-[#EBE2D5]">
            <Coffee className="h-5 w-5 text-amber-700" />
          </div>
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

      {/* 2. Menu Catalog Grid */}
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-12">
        {categories.map((category) => {
          const categoryProducts = products.filter((p) => p.categoryId === category.id);
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
                      onClick={() => addToCart(product)}
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

      {/* 3. Floating Bottom Cart Button */}
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
                  key={item.product.id}
                  className="bg-white border border-[#EBE2D5]/70 p-4 rounded-xl space-y-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h5 className="font-serif font-bold text-sm text-[#2E251B]">{item.product.name}</h5>
                      <span className="text-xs text-amber-700 font-bold block mt-1">
                        R$ {item.product.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 bg-[#FAF7F2] border border-[#EBE2D5]/80 rounded-lg px-2.5 py-1 shrink-0">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="text-[#6B5A4B] hover:text-[#2E251B] cursor-pointer"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-extrabold text-[#2E251B]">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="text-[#6B5A4B] hover:text-[#2E251B] cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => updateNotes(item.product.id, e.target.value)}
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

              {/* Delivery Address */}
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
              <div className="border-t border-[#EBE2D5] pt-4 flex justify-between items-center">
                <span className="font-bold text-amber-950 font-serif">Total a Pagar</span>
                <span className="font-extrabold text-amber-700 text-2xl">
                  R$ {cartTotal.toFixed(2)}
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
