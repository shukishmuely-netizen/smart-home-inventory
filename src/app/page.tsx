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
    const channel = supabase
      .channel('db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, fetchInventory)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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

      if (!parsed.items) throw new Error('Invalid response');

      for (const item of parsed.items) {
        const { data: existingItem } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('item_name', item.name)
          .maybeSingle();
        
        if (existingItem) {
          const change = parsed.action === 'add' ? item.quantity : -item.quantity;
          const newQty = Math.max(0, existingItem.quantity + change);
          await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', existingItem.id);
        } else if (parsed.action === 'add') {
          await supabase.from('inventory_items').insert([{ 
            item_name: item.name, 
            quantity: item.quantity, 
            household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' 
          }]);
        }
      }
      setStatus('עודכן בהצלחה!');
      setInput('');
      fetchInventory();
    } catch (error) { 
      console.error(error);
      setStatus('שגיאה בעדכון'); 
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 font-sans" dir="rtl">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-6 text-center text-blue-700">המלאי החכם שלי</h1>
        
        <form onSubmit={onSubmit} className="mb-8 bg-white p-6 rounded-2xl shadow-md border border-slate-200">
          <label className="block text-slate-700 mb-2 font-medium">מה להוסיף או להוריד?</label>
          <input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder='לדוגמה: "קנינו 3 מלפפוץ"' 
            className="w-full rounded-xl border border-slate-300 p-4 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" 
          />
          <button type="submit" className="mt-4 w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-xl hover:bg-blue-700 transition-colors shadow-lg">
            עדכן עם AI
          </button>
        </form>

        <div className="flex justify-between items-center mb-4 px-2">
          <h2 className="text-xl font-bold text-slate-800">רשימת מלאי במטבח</h2>
          <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{status}</span>
        </div>

        <div className="space-y-3">
          {sortedItems.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">המלאי ריק 🍎</div>
          ) : (
            sortedItems.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <span className="font-bold text-lg text-slate-700">{item.item_name}</span>
                <span className="bg-blue-100 text-blue-800 px-4 py-1 rounded-full font-bold text-lg">{item.quantity}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}