"use client";

import React, { useEffect, useState } from "react";
import { ShoppingBag, X } from "lucide-react";

interface OrderToastProps {
  orderId: string;
  customerName: string;
  total: number;
  duration?: number; // duration in ms, default 8000
  onClose: () => void;
  onClick: () => void;
}

export default function OrderToast({
  orderId,
  customerName,
  total,
  duration = 8000,
  onClose,
  onClick,
}: OrderToastProps) {
  const [progress, setProgress] = useState(100);
  const shortId = orderId.slice(-6).toUpperCase();

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      
      if (elapsed >= duration) {
        clearInterval(interval);
        onClose();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, onClose]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="relative w-80 bg-white border border-[#EBE2D5] hover:border-amber-700/40 rounded-2xl shadow-[0_10px_30px_rgba(46,37,27,0.06)] hover:shadow-[0_12px_36px_rgba(46,37,27,0.1)] transition-all duration-300 overflow-hidden cursor-pointer select-none group active:scale-[0.98] border-l-[4px] border-l-amber-600"
      onClick={onClick}
    >
      <div className="p-4 flex gap-3.5 items-start">
        {/* Left Icon with subtle bounce/wiggle animation on hover */}
        <div className="bg-amber-50 border border-amber-200/50 p-2.5 rounded-xl text-amber-700 group-hover:scale-110 transition-transform duration-300">
          <ShoppingBag className="h-5 w-5 animate-[wiggle_1s_ease-in-out_infinite]" />
        </div>

        {/* Content details */}
        <div className="flex-1 min-w-0 pr-4 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="font-serif font-bold text-[10px] bg-amber-600/10 text-amber-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
              Novo Pedido #{shortId}
            </span>
          </div>
          <p className="text-sm font-semibold text-[#2E251B] truncate">
            {customerName || "Cliente S/N"}
          </p>
          <p className="text-xs text-[#8C7A6B] font-medium">
            Valor: <span className="text-amber-700 font-extrabold">R$ {total.toFixed(2)}</span>
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-3 right-3 text-[#A09384] hover:text-[#2E251B] hover:bg-[#FAF7F2] p-1 rounded-lg transition-colors cursor-pointer"
          aria-label="Fechar notificação"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress Bar Timer */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#FAF7F2]">
        <div
          className="h-full bg-amber-600/80 transition-all ease-linear"
          style={{ width: `${progress}%`, transitionDuration: "50ms" }}
        />
      </div>

      {/* CSS Animation for custom wiggle */}
      <style jsx global>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-8deg); }
          75% { transform: rotate(8deg); }
        }
      `}</style>
    </div>
  );
}
