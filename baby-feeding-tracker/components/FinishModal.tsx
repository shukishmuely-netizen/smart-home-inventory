"use client";

import { useState } from "react";

interface FinishModalProps {
  type: "breast" | "bottle";
  onConfirm: (details: { side?: string; amount_ml?: number }) => void;
  onCancel: () => void;
}

export default function FinishModal({ type, onConfirm, onCancel }: FinishModalProps) {
  const [side, setSide] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-t-[2rem] p-6 pb-10 animate-slide-up">
        <h2 className="text-2xl font-bold text-center text-[#6B8CAE] mb-6">
          {type === "breast" ? "פרטי הנקה" : "פרטי בקבוק"}
        </h2>

        {type === "breast" ? (
          <div className="space-y-3">
            <p className="text-center text-gray-500 mb-2">מאיזה צד?</p>
            <div className="flex gap-3">
              {[
                { value: "right", label: "ימין" },
                { value: "left", label: "שמאל" },
                { value: "both", label: "שניהם" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSide(option.value)}
                  className={`flex-1 py-4 rounded-2xl text-lg font-semibold transition-all active:scale-95 ${
                    side === option.value
                      ? "bg-[#F4A7BB] text-white shadow-md"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-gray-500 mb-2">כמה מ״ל?</p>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="לדוגמה: 120"
              className="w-full text-center text-3xl font-bold py-4 rounded-2xl border-2 border-gray-200 focus:border-[#A7D7F4] focus:outline-none"
            />
            <div className="flex gap-2 flex-wrap justify-center">
              {[30, 60, 90, 120, 150, 180].map((ml) => (
                <button
                  key={ml}
                  onClick={() => setAmount(String(ml))}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-medium active:scale-95 transition-all"
                >
                  {ml}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-8">
          <button
            onClick={onCancel}
            className="flex-1 py-4 rounded-2xl bg-gray-100 text-gray-500 font-semibold text-lg active:scale-95 transition-all"
          >
            ביטול
          </button>
          <button
            onClick={() => {
              if (type === "breast" && side) {
                onConfirm({ side });
              } else if (type === "bottle" && amount) {
                onConfirm({ amount_ml: parseInt(amount) });
              }
            }}
            disabled={type === "breast" ? !side : !amount}
            className="flex-1 py-4 rounded-2xl bg-[#6B8CAE] text-white font-semibold text-lg active:scale-95 transition-all disabled:opacity-40"
          >
            שמור ✓
          </button>
        </div>
      </div>
    </div>
  );
}