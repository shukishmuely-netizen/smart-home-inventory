'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { id?: string; item_name: string; quantity: number; category: string; location: string; options?: string[] };
type View = 'HOME' | 'INVENTORY' | 'SHOPPING';
type InvFilter = 'מקרר' | 'מזווה' | 'הכל';

export default function HomePage() {
  const [activeView, setActiveView] = useState<View>('HOME');
  const [invFilter, setInvFilter] = useState<InvFilter>('הכל');
  
  const [inventory, setInventory] = useState<Item[]>([]);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('מוכן...');
  const [pendingItems, setPendingItems] = useState<Item[]>([]);

  const fetchData = async () => {
    const { data: inv } = await supabase.from('inventory_items').select('*');
    const { data: shop } = await supabase.from('shopping_list').select('*');
    const { data: cats } = await supabase.from('category_order').select('category_name').order('sort_order');
    setInventory(inv ?? []);
    setShoppingList(shop ?? []);
    setCategories(cats?.map(c => c.category_name) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const saveToDb = async (item: Item, action: 'add' | 'remove') => {
    const { data: existing } = await supabase.from('inventory_items').select('*').eq('item_name', item.item_name).maybeSingle();
    if (existing) {
      const change = action === 'add' ? item.quantity : -item.quantity;
      await supabase.from('inventory_items').update({ quantity: Math.max(0, existing.quantity + change) }).eq('id', existing.id);
    } else if (action === 'add') {
      await supabase.from('inventory_items').insert([{ 
        item_name: item.item_name, quantity: item.quantity, category: item.category, 
        location: item.location, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' 
      }]);
    }
    fetchData();
  };

  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setStatus('מנתח...');
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text: input }) });
      const data = await res.json();
      const uncertainItems = data.items.filter((i: any) => i.uncertain);
      const clearItems = data.items.filter((i: any) => !i.uncertain);

      for (const item of clearItems) { await saveToDb(item, data.action); }

      if (uncertainItems.length > 0) {
        setPendingItems(uncertainItems);
        setStatus('צריך עזרה בסיווג...');
      } else {
        setStatus('עודכן!');
        setInput('');
      }
    } catch { setStatus('שגיאה'); }
  };

  const markAsBought = async (shopItem: any) => {
    await saveToDb({ item_name: shopItem.item_name, quantity: 1, category: shopItem.category, location: 'מקרר' }, 'add');
    await supabase.from('shopping_list').delete().eq('id', shopItem.id);
    fetchData();
  };

  return (
    <main className="min-h-screen bg-slate-50 font-sans pb-10" dir="rtl">
      {/* Header & Navigation */}
      <header className="bg-indigo-700 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-black cursor-pointer" onClick={() => setActiveView('HOME')}>Smart Kitchen 🍎</h1>
          <nav className="flex gap-4">
            <button onClick={() => setActiveView('INVENTORY')} className={`px-3 py-1 rounded-lg font-bold transition ${activeView === 'INVENTORY' ? 'bg-white text-indigo-700' : 'hover:bg-indigo-600'}`}>מלאי</button>
            <button onClick={() => setActiveView('SHOPPING')} className={`px-3 py-1 rounded-lg font-bold transition ${activeView === 'SHOPPING' ? 'bg-white text-indigo-700' : 'hover:bg-indigo-600'}`}>קניות</button>
          </nav>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4">
        
        {/* AI Input - Always available except on Home screen if you prefer */}
        {activeView !== 'HOME' && (
          <form onSubmit={handleAISubmit} className="mb-6 bg-white p-4 rounded-3xl shadow-md border border-indigo-100">
            <div className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder='עדכן את המטבח...' className="flex-1 rounded-xl border-none bg-slate-100 p-3 text-md focus:ring-2 focus:ring-indigo-300" />
              <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">עדכן</button>
            </div>
            {pendingItems.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm font-bold mb-2">איך לסווג את {pendingItems[0].item_name}?</p>
                <div className="flex gap-2">
                  {pendingItems[0].options?.map(opt => (
                    <button key={opt} onClick={() => {saveToDb({...pendingItems[0], category: opt, location: 'מקרר'}, 'add'); setPendingItems([]); setInput('');}} className="text-xs bg-white border border-amber-300 px-3 py-1 rounded-lg font-bold">{opt}</button>
                  ))}
                </div>
              </div>
            )}
          </header>
        )}

        {/* --- VIEW: HOME (DASHBOARD) --- */}
        {activeView === 'HOME' && (
          <div className="grid grid-cols-1 gap-6 mt-10">
            <button onClick={() => setActiveView('INVENTORY')} className="aspect-video bg-white rounded-3xl shadow-xl flex flex-col items-center justify-center border-b-8 border-indigo-500 active:scale-95 transition">
              <span className="text-5xl mb-2">📦</span>
              <span className="text-2xl font-black text-slate-800">ניהול מלאי</span>
              <span className="text-slate-400">מקרר / מזווה / הכל</span>
            </button>
            <button onClick={() => setActiveView('SHOPPING')} className="aspect-video bg-white rounded-3xl shadow-xl flex flex-col items-center justify-center border-b-8 border-green-500 active:scale-95 transition">
              <span className="text-5xl mb-2">🛒</span>
              <span className="text-2xl font-black text-slate-800">רשימת קניות</span>
              <span className="text-slate-400">{shoppingList.length} פריטים מחכים</span>
            </button>
          </div>
        )}

        {/* --- VIEW: INVENTORY --- */}
        {activeView === 'INVENTORY' && (
          <section>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {['הכל', 'מקרר', 'מזווה'].map(f => (
                <button key={f} onClick={() => setInvFilter(f as InvFilter)} className={`px-6 py-2 rounded-full font-bold whitespace-nowrap transition ${invFilter === f ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border'}`}>
                  {f}
                </button>
              ))}
            </div>

            <div className="grid gap-3">
              {inventory
                .filter(i => invFilter === 'הכל' || i.location === invFilter)
                .map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <span className="font-bold">{item.item_name} <span className="text-xs font-normal text-slate-400 block">{item.category}</span></span>
                    <span className="bg-indigo-50 text-indigo-700 px-4 py-1 rounded-full font-black">{item.quantity}</span>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* --- VIEW: SHOPPING --- */}
        {activeView === 'SHOPPING' && (
          <section>
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2">🛒 רשימת קניות</h2>
            {categories.map(cat => (
              <div key={cat} className="mb-6">
                <h3 className="font-bold text-indigo-900 mb-3 bg-indigo-50 p-2 rounded-lg">{cat}</h3>
                <div className="space-y-2">
                  {shoppingList.filter(s => s.category === cat).map(s => (
                    <div key={s.id} className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-50">
                      <input type="checkbox" onChange={() => markAsBought(s)} className="w-6 h-6 rounded-full border-indigo-300 text-indigo-600" />
                      <span className="font-medium text-slate-700">{s.item_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

      </div>
    </main>
  );
}