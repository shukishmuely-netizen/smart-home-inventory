'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { id?: string; item_name: string; quantity: number; category: string; location: string; uncertain?: boolean; options?: string[] };

export default function HomePage() {
  const [activeView, setActiveView] = useState<'HOME' | 'INVENTORY' | 'SHOPPING'>('HOME');
  const [invFilter, setInvFilter] = useState<'מקרר' | 'מזווה' | 'הכל'>('הכל');
  
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

  const saveItem = async (item: Item) => {
    const { data: existing } = await supabase.from('inventory_items').select('*').eq('item_name', item.item_name).maybeSingle();
    
    if (existing) {
      await supabase.from('inventory_items').update({ quantity: item.quantity }).eq('id', existing.id);
    } else {
      await supabase.from('inventory_items').insert([{ 
        item_name: item.item_name, quantity: item.quantity, category: item.category, 
        location: item.location, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' 
      }]);
    }

    if (item.quantity <= 2 && item.quantity > 0) {
        const confirmAdd = confirm(`נשארו רק ${item.quantity} של ${item.item_name}. להוסיף לקניות?`);
        if (confirmAdd) await supabase.from('shopping_list').insert([{ item_name: item.item_name, category: item.category }]);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setStatus('מעבד רשימה...');
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text: input }) });
      const data = await res.json();
      const certain = data.items.filter((i: any) => !i.uncertain);
      const uncertain = data.items.filter((i: any) => i.uncertain);
      for (const item of certain) { await saveItem(item); }
      if (uncertain.length > 0) {
        setPendingItems(uncertain);
        setStatus(`נשארו ${uncertain.length} פריטים לסיווג`);
      } else {
        setStatus('הכל עודכן!');
        setInput('');
        fetchData();
      }
    } catch { setStatus('שגיאה בעיבוד'); }
  };

  return (
    <main className="min-h-screen bg-slate-100 font-sans pb-16 text-slate-900" dir="rtl">
      {/* Header & Nav */}
      <header className="bg-indigo-700 bg-gradient-to-r from-indigo-700 to-indigo-800 text-white p-5 shadow-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black cursor-pointer" onClick={() => setActiveView('HOME')}>Smart Kitchen 🍎</h1>
          <nav className="flex gap-4">
            <button onClick={() => setActiveView('INVENTORY')} className={`px-4 py-2 rounded-xl font-bold transition-all ${activeView === 'INVENTORY' ? 'bg-white text-indigo-700 shadow-md' : 'hover:bg-indigo-600'}`}>מלאי</button>
            <button onClick={() => setActiveView('SHOPPING')} className={`px-4 py-2 rounded-xl font-bold transition-all ${activeView === 'SHOPPING' ? 'bg-white text-emerald-700 shadow-md' : 'hover:bg-indigo-600'}`}>קניות</button>
          </nav>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-5">
        
        {/* VIEW: HOME (DASHBOARD) */}
        {activeView === 'HOME' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 px-2">
            <button onClick={() => setActiveView('INVENTORY')} className="aspect-video bg-white rounded-3xl shadow-xl flex flex-col items-center justify-center border-b-[10px] border-indigo-500 active:scale-95 hover:-translate-y-2 transition-all p-10 group">
              <span className="text-7xl mb-4 group-hover:scale-110 transition-transform">📦</span>
              <span className="text-3xl font-black text-slate-800">ניהול מלאי</span>
              <span className="text-slate-500 mt-2 text-md">מה יש לנו במקרר ובמזווה?</span>
            </button>
            <button onClick={() => setActiveView('SHOPPING')} className="aspect-video bg-white rounded-3xl shadow-xl flex flex-col items-center justify-center border-b-[10px] border-emerald-500 active:scale-95 hover:-translate-y-2 transition-all p-10 group">
              <span className="text-7xl mb-4 group-hover:scale-110 transition-transform">🛒</span>
              <span className="text-3xl font-black text-slate-800">רשימת קניות</span>
              <span className="text-slate-500 mt-2 text-md">{shoppingList.length} פריטים מחכים לקנייה</span>
            </button>
          </div>
        )}

        {/* AI Update Form (available in sub-views) */}
        {activeView !== 'HOME' && (
          <div className="mb-8 bg-white p-5 rounded-3xl shadow-xl border border-indigo-100">
            <form onSubmit={handleUpdate} className="flex flex-col gap-3">
              <label className="block text-lg font-bold text-slate-700 mb-1">עדכון מלאי מהיר עם AI</label>
              <textarea 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="הדבק כאן רשימה (לדוגמה: 2 חלב, 5 תפוחים...)" 
                className="w-full rounded-2xl border-none bg-slate-100 p-5 text-md focus:ring-4 focus:ring-indigo-100 transition-all min-h-[120px]"
              />
              <button type="submit" className="bg-emerald-600 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4 rounded-2xl font-bold text-xl hover:from-emerald-700 hover:to-emerald-800 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                 <span>עדכן</span>
                 <span className="text-lg">✨</span>
              </button>
            </form>
            <p className="text-xs text-center mt-3 text-indigo-500 font-bold">{status}</p>
          </div>
        )}

        {/* Uncertainty Queue Box */}
        {pendingItems.length > 0 && activeView !== 'HOME' && (
          <div className="mb-10 bg-amber-50 p-6 rounded-3xl border-2 border-dashed border-amber-300 shadow-md">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-4xl">🤔</span>
              <h3 className="font-extrabold text-2xl text-amber-950">אנחנו צריכים רגע את עזרתך:</h3>
            </div>
            {pendingItems.map((item, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl border border-amber-100 mb-4 shadow-sm last:mb-0">
                <p className="font-bold text-lg text-amber-900 mb-3">איך לסווג את "{item.item_name}"?</p>
                <div className="flex flex-wrap gap-2">
                  {item.options?.map(opt => (
                    <button key={opt} onClick={async () => {
                      await saveItem({...item, category: opt, location: (opt === 'קפואים' || opt === 'קירור' || opt === 'טרי') ? 'מקרר' : 'מזווה'});
                      setPendingItems(prev => prev.filter(p => p.item_name !== item.item_name));
                      if (pendingItems.length === 1) setInput('');
                      fetchData();
                    }} className="bg-amber-100 hover:bg-amber-200 text-amber-950 px-4 py-2 rounded-xl border border-amber-300 text-sm font-bold transition-colors">
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VIEW: INVENTORY */}
        {activeView === 'INVENTORY' && (
          <section>
            {/* Clickable Inventory Filter Headers */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { name: 'מקרר', icon: '❄️', gradient: 'from-indigo-100 to-indigo-200', activeGrad: 'from-indigo-600 to-indigo-700', activeText: 'text-white' },
                { name: 'מזווה', icon: '🌾', gradient: 'from-emerald-100 to-emerald-200', activeGrad: 'from-emerald-600 to-emerald-700', activeText: 'text-white' }
              ].map(loc => {
                const isActive = invFilter === loc.name;
                return (
                  <button 
                    key={loc.name} 
                    onClick={() => setInvFilter(isActive ? 'הכל' : loc.name as any)}
                    className={`bg-white rounded-3xl shadow-lg border border-slate-100 p-6 flex items-center gap-4 transition-all ${isActive ? `bg-gradient-to-br ${loc.activeGrad} shadow-inner` : `hover:bg-gradient-to-br ${loc.gradient}`}`}
                  >
                    <span className="text-5xl">{loc.icon}</span>
                    <div className={`${isActive ? loc.activeText : 'text-slate-800'}`}>
                      <span className="text-3xl font-black">{loc.name}</span>
                      <p className={`text-xs mt-1 ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                        {inventory.filter(i => i.location === loc.name).length} פריטים
                        {isActive && ' (פילטר פעיל)'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            
            {/* Show 'Show All' if a filter is active */}
            {invFilter !== 'הכל' && (
              <div className="flex justify-center mb-6">
                 <button onClick={() => setInvFilter('הכל')} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-full font-bold text-sm shadow-inner hover:bg-slate-300">הצג את כל המלאי</button>
              </div>
            )}

            {/* Item List (cards) */}
            <div className="grid gap-4">
              {inventory
                .filter(i => invFilter === 'הכל' || i.location === invFilter)
                .map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg transition-shadow">
                    <div>
                      <span className="font-bold text-xl text-slate-800">{item.item_name}</span>
                      <p className="text-xs text-slate-400 mt-1">{item.category} • {item.location}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`bg-indigo-50 text-indigo-700 px-5 py-2 rounded-2xl font-black text-2xl ${item.quantity <= 2 && item.quantity > 0 ? 'text-red-600 bg-red-50 border border-red-100' : ''}`}>
                        {item.quantity}
                      </span>
                      {/* +/-buttons with icons */}
                      <div className="flex flex-col gap-1">
                         <button onClick={() => saveItem({...item, quantity: item.quantity + 0.5})} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs">+</button>
                         <button onClick={() => saveItem({...item, quantity: Math.max(0, item.quantity - 0.5)})} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">-</button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* VIEW: SHOPPING */}
        {activeView === 'SHOPPING' && (
          <section>
            <h2 className="text-3xl font-black mb-8 text-emerald-900 border-r-8 border-emerald-500 pr-4">🛒 רשימת קניות</h2>
            {categories.map(cat => (
              <div key={cat} className="mb-8">
                <h3 className="font-bold text-xl text-emerald-950 mb-4 bg-emerald-50 p-3 rounded-xl border border-emerald-100">{cat}</h3>
                <div className="space-y-3">
                  {shoppingList.filter(s => s.category === cat).map(s => (
                    <div key={s.id} className="flex items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-50">
                      <input type="checkbox" onChange={() => markAsBought(s)} className="w-8 h-8 rounded-xl border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shadow-inner" />
                      <span className="font-medium text-lg text-slate-800">{s.item_name}</span>
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