'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { id: string; item_name: string; quantity: number; category?: string };

export default function HomePage() {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [shoppingList, setShoppingList] = useState<Item[]>([]);
  const [categories, setCategories] = useState<{name: string, order: number}[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('מוכן...');

  const fetchData = async () => {
    const { data: inv } = await supabase.from('inventory_items').select('*').order('item_name');
    const { data: shop } = await supabase.from('shopping_list').select('*');
    const { data: cats } = await supabase.from('category_order').select('category_name, sort_order').order('sort_order');
    
    setInventory(inv ?? []);
    setShoppingList(shop ?? []);
    setCategories(cats?.map(c => ({ name: c.category_name, order: c.sort_order })) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  // --- פעולות מלאי ---
  const deleteItem = async (id: string) => {
    await supabase.from('inventory_items').delete().eq('id', id);
    fetchData();
  };

  const addToShopping = async (name: string) => {
    await supabase.from('shopping_list').insert([{ item_name: name, category: 'ירקות' }]);
    fetchData();
  };

  const updateInvQty = async (id: string, current: number, delta: number) => {
    await supabase.from('inventory_items').update({ quantity: Math.max(0, current + delta) }).eq('id', id);
    fetchData();
  };

  // --- פעולות רשימת קניות ---
  const moveCategory = async (name: string, direction: 'up' | 'down') => {
    const idx = categories.findIndex(c => c.name === name);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === categories.length - 1)) return;
    
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const currentCat = categories[idx];
    const targetCat = categories[targetIdx];

    await supabase.from('category_order').update({ sort_order: targetCat.order }).eq('category_name', currentCat.name);
    await supabase.from('category_order').update({ sort_order: currentCat.order }).eq('category_name', targetCat.name);
    fetchData();
  };

  const removeFromShopping = async (id: string) => {
    await supabase.from('shopping_list').delete().eq('id', id);
    fetchData();
  };

  // AI Submit (זהה לקוד הקודם)
  const onAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('מנתח...');
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text: input }) });
      const parsed = await res.json();
      for (const item of parsed.items) {
          const { data: existing } = await supabase.from('inventory_items').select('*').eq('item_name', item.name).maybeSingle();
          if (existing) {
            await supabase.from('inventory_items').update({ quantity: existing.quantity + (parsed.action === 'add' ? item.quantity : -item.quantity) }).eq('id', existing.id);
          } else {
            await supabase.from('inventory_items').insert([{ item_name: item.name, quantity: item.quantity, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }]);
          }
      }
      setInput(''); fetchData(); setStatus('עודכן!');
    } catch { setStatus('שגיאה'); }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-20 font-sans" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-black mb-8 text-center text-indigo-800 tracking-tight">Smart Kitchen 🍎</h1>

        {/* עדכון AI */}
        <form onSubmit={onAISubmit} className="mb-10 bg-white p-6 rounded-3xl shadow-xl border border-indigo-100">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder='לדוגמה: "קנינו 4 מלפפוץ ו-2 חלב"' className="w-full rounded-2xl border-none bg-slate-100 p-5 text-lg focus:ring-4 focus:ring-indigo-200 transition-all" />
          <button type="submit" className="mt-4 w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold text-xl hover:bg-indigo-700 shadow-lg active:scale-95 transition-all">עדכן עם AI ✨</button>
        </form>

        {/* מלאי נוכחי */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">📦 מה יש במקרר? <span className="text-sm font-normal text-slate-400">({inventory.length})</span></h2>
          <div className="grid gap-3">
            {inventory.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group">
                <div>
                  <div className="font-bold text-lg text-slate-800">{item.item_name}</div>
                  <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => deleteItem(item.id)} className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-lg">מחק</button>
                    <button onClick={() => addToShopping(item.item_name)} className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-lg">לקניות 🛒</button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateInvQty(item.id, item.quantity, -0.5)} className="w-10 h-10 rounded-xl bg-slate-100 font-bold">-</button>
                  <span className="min-w-[45px] text-center font-black text-xl text-indigo-600">{item.quantity}</span>
                  <button onClick={() => updateInvQty(item.id, item.quantity, 0.5)} className="w-10 h-10 rounded-xl bg-slate-100 font-bold">+</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* רשימת קניות */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">🛒 רשימת קניות</h2>
          {categories.map(cat => (
            <div key={cat.name} className="mb-6">
              <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-xl mb-3">
                <h3 className="font-bold text-indigo-900">{cat.name}</h3>
                <div className="flex gap-2">
                  <button onClick={() => moveCategory(cat.name, 'up')} className="p-1 hover:bg-white rounded">⬆️</button>
                  <button onClick={() => moveCategory(cat.name, 'down')} className="p-1 hover:bg-white rounded">⬇️</button>
                </div>
              </div>
              <div className="space-y-2 pr-2">
                {shoppingList.filter(s => s.category === cat.name).map(s => (
                  <div key={s.id} className="flex justify-between items-center p-2 border-b border-slate-100">
                    <span className="text-slate-700 font-medium">{s.item_name}</span>
                    <button onClick={() => removeFromShopping(s.id)} className="text-slate-300 hover:text-red-400">✕</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}