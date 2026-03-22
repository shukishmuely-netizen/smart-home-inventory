'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type InventoryItem = { id: string; item_name: string; quantity: number };

export default function HomePage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('מוכן לעדכון חכם...');

  const sortedItems = useMemo(() => 
    [...items].sort((a, b) => a.item_name.localeCompare(b.item_name)), 
    [items]
  );

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory_items').select('*');
    setItems(data ?? []);
  };

  useEffect(() => {
    fetchInventory();
    const channel = supabase.channel('db_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, fetchInventory).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateQuantity = async (id: string, currentQty: number, change: number) => {
    const newQty = Math.max(0, currentQty + change);
    await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', id);
    fetchInventory();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setStatus('ה-AI מנתח...');

    try {
      const res = await fetch('/api/parse', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }) 
      });
      const parsed = await res.json();

      for (const item of parsed.items) {
        const { data: existingItem } = await supabase.from('inventory_items').select('*').eq('item_name', item.name).maybeSingle();
        
        const change = parsed.action === 'add' ? item.quantity : -item.quantity;
        if (existingItem) {
          await updateQuantity(existingItem.id, existingItem.quantity, change);
        } else if (parsed.action === 'add') {
          await supabase.from('inventory_items').insert([{ 
            item_name: item.name, 
            quantity: Math.max(0, item.quantity), 
            household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' 
          }]);
        }
      }
      setStatus('עודכן!');
      setInput('');
      fetchInventory();
    } catch (error) { setStatus('שגיאה'); }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 font-sans" dir="rtl">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-black mb-6 text-center text-indigo-700">המלאי החכם</h1>
        
        <form onSubmit={onSubmit} className="mb-8 bg-white p-6 rounded-3xl shadow-xl border border-indigo-100">
          <input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder='לדוגמה: "נשאר חצי תירס"' 
            className="w-full rounded-2xl border border-slate-200 p-4 text-lg focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all" 
          />
          <button type="submit" className="mt-4 w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold text-xl hover:bg-indigo-700 shadow-lg active:scale-95 transition-all">
            עדכן עם AI
          </button>
        </form>

        <div className="space-y-3">
          {sortedItems.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <span className="font-bold text-lg text-slate-700">{item.item_name}</span>
              
              <div className="flex items-center gap-3">
                <button onClick={() => updateQuantity(item.id, item.quantity, -0.5)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors">-</button>
                
                <span className="min-w-[50px] text-center bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl font-black text-lg">
                  {item.quantity}
                </span>

                <button onClick={() => updateQuantity(item.id, item.quantity, 0.5)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-green-50 hover:text-green-600 transition-colors">+</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}