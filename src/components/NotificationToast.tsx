"use client";

import React from "react";
import { Bell, X } from "lucide-react";

interface NotificationToastProps {
  customerName: string;
  message: string;
  onClose: () => void;
  onClick: () => void;
}

export default function NotificationToast({
  customerName,
  message,
  onClose,
  onClick,
}: NotificationToastProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="relative w-80 bg-white border border-[#EBE2D5] hover:border-amber-700/40 rounded-2xl shadow-[0_10px_30px_rgba(46,37,27,0.06)] hover:shadow-[0_12px_36px_rgba(46,37,27,0.1)] transition-all duration-300 overflow-hidden cursor-pointer select-none group active:scale-[0.98] border-l-[4px] border-l-amber-600"
      onClick={onClick}
    >
      <div className="p-4 flex gap-3.5 items-start">
        <div className="bg-amber-50 border border-amber-200/50 p-2.5 rounded-xl text-amber-700 group-hover:scale-110 transition-transform duration-300">
          <Bell className="h-5 w-5 animate-[wiggle_1s_ease-in-out_infinite]" />
        </div>

        <div className="flex-1 min-w-0 pr-4 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="font-serif font-bold text-[10px] bg-amber-600/10 text-amber-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
              Encomenda
            </span>
          </div>
          <p className="text-sm font-semibold text-[#2E251B] truncate">
            {customerName || "Cliente S/N"}
          </p>
          <p className="text-xs text-[#8C7A6B] font-medium leading-snug">{message}</p>
        </div>

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
    </div>
  );
}