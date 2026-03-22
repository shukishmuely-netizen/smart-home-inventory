'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type InventoryItem = {
  id: string;
  item_name: string;
  quantity: number;
  updated_at?: string;
};

type ParsedResult = {
  action: 'add' | 'remove';
  items: { name: string; quantity: number }[];
};

export default function HomePage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('מוכן לעדכון חכם...');

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.item_name.localeCompare(b.item_name)),
    [items]
  );

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('item_name', { ascending: true });

    if (error) {
      console.error('Fetch inventory error', error);
      setStatus('שגיאה בטעינת המלאי');
      return;
    }
    setItems(data ?? []);
  };

  useEffect(() => {
    fetchInventory();
    const channel = supabase
      .channel('public:inventory_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => {
        fetchInventory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addOrUpdateItem = async (name: string, qty: number, action: 'add' | 'remove') => {
    if (!name || qty === 0) return;

    const normalized = name.trim().toLowerCase();
    const quantityChange = action === 'add' ? qty : -qty;
    const existing = items.find((it) => it.item_name.toLowerCase() === normalized);

    if (existing) {
      const newQty = Math.max(0, existing.quantity + quantityChange);
      await supabase
        .from('inventory_items')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else if (action === 'add') {
      await supabase.from('inventory_items').insert([
        {
          household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72',
          item_name: normalized,
          quantity: qty,
        },
      ]);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setStatus('ה-AI מעבד את הבקשה...');

    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });

      if (!response.ok) throw new Error('API error');

      const parsed: ParsedResult = await response.json();

      for (const item of parsed.items) {
        await addOrUpdateItem(item.name, item.quantity, parsed.action);
      }

      setStatus(`עודכן בהצלחה: ${parsed.action === 'add' ? 'הוספנו' : 'הורדנו'} פריטים`);
    } catch (error) {
      console.error('Submit error:', error);
      setStatus('שגיאה בתקשורת עם ה-AI');
    }

    setInput('');
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 p-4 font-sans" dir="rtl">
      <section className="max-w-xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-6 text-center text-blue-700">המלאי החכם שלי</h1>

        <form onSubmit={onSubmit} className="mb-8 bg-white p-6 rounded-2xl shadow-md">
          <label htmlFor="smartInput" className="block text-lg font-medium mb-2 text-slate-700">
            מה קנינו או סיימנו? (דבר חופשי)
          </label>
          <input
            id="smartInput"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='לדוגמה: "קנינו 3 חלב וגם שקית תפוחים"'
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-4 text-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-4 text-white text-xl font-bold hover:bg-blue-700 shadow-lg active:scale-95 transition-all"
          >
            עדכן עם AI
          </button>
        </form>

        <div className="flex justify-between items-center mb-4 px-2">
          <h2 className="text-xl font-semibold text-slate-700">רשימת מלאי במטבח</h2>
          <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{status}</span>
        </div>

        <div className="space-y-3">
          {sortedItems.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              המלאי ריק. תגיד ל-AI מה קנית! 🍎
            </div>
          ) : (
            sortedItems.map((item) => (
              <div key={item.id} className="flex justify-between items-center rounded-2xl bg-white px-6 py-4 shadow-sm border border-slate-100">
                <span className="font-bold text-lg text-slate-800">{item.item_name}</span>
                <span className="bg-blue-100 text-blue-800 px-4 py-1 rounded-full font-bold text-lg">
                  {item.quantity}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}