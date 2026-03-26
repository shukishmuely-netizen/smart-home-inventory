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
  const [status, setStatus] = useState('מוכן לעדכון...');
  const [pendingItems, setPendingItems] = useState<Item[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<Item[]>([]);

  const fetchData = async () => {
    const { data: inv } = await supabase.from('inventory_items').select('*');
    const { data: shop } = await supabase.from('shopping_list').select('*');
    const { data: cats } = await supabase.from('category_order').select('category_name').order('sort_order');
    setInventory(inv ?? []);
    setShoppingList(shop ?? []);
    setCategories(cats?.map(c => c.category_name) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const saveItem = async (item: Item, action: 'add' | 'remove' = 'add') => {
    const name = item.item_name || (item as any).name;
    if (!name) return;

    const { data: existing } = await supabase.from('inventory_items').select('*').eq('item_name', name).maybeSingle();
    
    let newQty = item.quantity;
    if (existing) {
      newQty = action === 'add' ? existing.quantity + item.quantity : Math.max(0, existing.quantity - item.quantity);
      await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', existing.id);
    } else {
      await supabase.from('inventory_items').insert([{ 
        item_name: name, quantity: item.quantity, category: item.category || 'כללי', 
        location: item.location || 'מזווה', household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' 
      }]);
    }

    if (newQty <= 2 && newQty > 0) {
      setLowStockAlerts(prev => [...prev.filter(i => i.item_name !== name), { ...item, item_name: name, quantity: newQty }]);
    }
    fetchData();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setStatus('⚡ AI מעבד את הרשימה שלך...');
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text: input }) });
      const data = await res.json();
      
      const certain = data.items.filter((i: any) => !i.uncertain);
      const uncertain = data.items.filter((i: any) => i.uncertain && (i.name || i.item_name));

      for (const item of certain) { await saveItem(item, data.action); }

      if (uncertain.length > 0) {
        setPendingItems(uncertain.map((i: any) => ({ ...i, item_name: i.name || i.item_name })));
        setStatus(`נשארו פריטים לסיווג`);
      } else {
        setStatus('✅ המטבח עודכן!');
        setInput('');
      }
      fetchData();
    } catch { setStatus('❌ שגיאה בתקשורת'); }
  };

  const addToShopping = async (item: Item) => {
    await supabase.from('shopping_list').insert([{ item_name: item.item_name, category: item.category || 'פירות וירקות' }]);
    setLowStockAlerts(prev => prev.filter(i => i.item_name !== item.item_name));
    fetchData();
  };

  return (
    <main className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900" dir="rtl">
      <header className="bg-indigo-700 text-white p-4 shadow-2xl sticky top-0 z-[1000] border-b border-indigo-800">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black cursor-pointer pointer-events-auto" onClick={() => setActiveView('HOME')}>Smart Kitchen 🍎</h1>
          <nav className="flex gap-2">
            <button onClick={() => setActiveView('INVENTORY')} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all pointer-events-auto ${activeView === 'INVENTORY' ? 'bg-white text-indigo-700 shadow-lg' : 'bg-indigo-600 hover:bg-indigo-500'}`}>מלאי</button>
            <button onClick={() => setActiveView('SHOPPING')} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all pointer-events-auto ${activeView === 'SHOPPING' ? 'bg-white text-emerald-700 shadow-lg' : 'bg-indigo-600 hover:bg-indigo-500'}`}>קניות</button>
          </nav>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 relative z-10">
        
        {/* VIEW: HOME */}
        {activeView === 'HOME' && (
          <div className="grid grid-cols-1 gap-6 mt-10">
            <button onClick={() => setActiveView('INVENTORY')} className="p-10 bg-white rounded-[2.5rem] shadow-xl border-b-[12px] border-indigo-500 flex flex-col items-center group active:scale-95 transition-all pointer-events-auto">
              <span className="text-7xl mb-4 group-hover:scale-110 transition-transform">📦</span>
              <span className="text-3xl font-black text-slate-800">ניהול מלאי</span>
            </button>
            <button onClick={() => setActiveView('SHOPPING')} className="p-10 bg-white rounded-[2.5rem] shadow-xl border-b-[12px] border-emerald-500 flex flex-col items-center group active:scale-95 transition-all pointer-events-auto">
              <span className="text-7xl mb-4 group-hover:scale-110 transition-transform">🛒</span>
              <span className="text-3xl font-black text-slate-800">רשימת קניות</span>
            </button>
          </div>
        )}

        {/* AI Input Area */}
        {activeView !== 'HOME' && (
          <div className="mt-4 mb-6 bg-white p-5 rounded-[2rem] shadow-xl border border-indigo-50">
            <form onSubmit={handleUpdate} className="space-y-3">
              <textarea 
                value={input} onChange={(e) => setInput(e.target.value)} 
                placeholder="הדבק רשימה או כתוב חופשי..." 
                className="w-full rounded-2xl border-none bg-slate-100 p-4 text-md focus:ring-2 focus:ring-indigo-400 min-h-[100px] pointer-events-auto"
              />
              <button type="submit" className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-all pointer-events-auto">עדכן מטבח ✨</button>
            </form>
            <p className="text-center mt-3 text-xs font-bold text-indigo-400">{status}</p>
          </div>
        )}

        {/* Low Stock Alerts */}
        {lowStockAlerts.length > 0 && (
          <div className="mb-6 space-y-3">
            {lowStockAlerts.map(alert => (
              <div key={alert.item_name} className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl flex justify-between items-center animate-in fade-in slide-in-from-top-4">
                <span className="font-bold text-red-900 text-sm">נשארו רק {alert.quantity} של "{alert.item_name}". להוסיף לקניות?</span>
                <div className="flex gap-2">
                  <button onClick={() => addToShopping(alert)} className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs pointer-events-auto">כן, תוסיף</button>
                  <button onClick={() => setLowStockAlerts(prev => prev.filter(i => i.item_name !== alert.item_name))} className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-xl font-bold text-xs pointer-events-auto">לא עכשיו</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Classification Queue (WITH FALLBACK OPTIONS) */}
        {pendingItems.length > 0 && (
          <div className="mb-8 p-6 bg-amber-50 rounded-[2rem] border-2 border-amber-200 shadow-lg">
            <h3 className="font-black text-amber-900 mb-4 flex items-center gap-2">🤔 צריך סיווג ל:</h3>
            <div className="space-y-4">
              {pendingItems.map((item, idx) => {
                // רשת ביטחון: אם אין אופציות, תמיד נציג את אלו
                const options = (item.options && item.options.length > 0) 
                  ? item.options 
                  : ['טרי', 'קפואים', 'שימורים', 'יבשים'];

                return (
                  <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-amber-100">
                    <p className="font-bold text-lg mb-3">איך לסווג את "{item.item_name}"?</p>
                    <div className="flex flex-wrap gap-2">
                      {options.map(opt => (
                        <button key={opt} onClick={async () => {
                          // סיווג חכם של מיקום לפי הבחירה
                          const isFridge = ['קפואים', 'קירור', 'טרי'].includes(opt);
                          await saveItem({
                            ...item, 
                            category: opt, 
                            location: isFridge ? 'מקרר' : 'מזווה'
                          });
                          setPendingItems(prev => prev.filter(p => p.item_name !== item.item_name));
                          fetchData();
                        }} className="bg-slate-100 hover:bg-indigo-600 hover:text-white px-5 py-2 rounded-xl font-bold transition-all pointer-events-auto">
                          {opt}
                        </button>
                      ))}
                      <button onClick={() => setPendingItems(prev => prev.filter(p => p.item_name !== item.item_name))} className="text-slate-400 text-xs px-2 pointer-events-auto">התעלם</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW: INVENTORY */}
        {activeView === 'INVENTORY' && (
          <section className="space-y-6">
            <div className="flex gap-2 p-1 bg-slate-200 rounded-2xl">
              {['הכל', 'מקרר', 'מזווה'].map(f => (
                <button key={f} onClick={() => setInvFilter(f as any)} className={`flex-1 py-3 rounded-xl font-bold transition-all pointer-events-auto ${invFilter === f ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>{f}</button>
              ))}
            </div>
            <div className="grid gap-3">
              {inventory.filter(i => invFilter === 'הכל' || i.location === invFilter).map(item => (
                <div key={item.id} className="flex justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                  <div className="text-right">
                    <span className="block font-bold text-lg">{item.item_name}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">{item.category} • {item.location}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => saveItem({...item, quantity: 0.5}, 'remove')} className="w-10 h-10 rounded-full bg-slate-50 text-red-500 font-bold pointer-events-auto">-</button>
                    <span className={`text-2xl font-black w-10 text-center ${item.quantity <= 2 ? 'text-red-500' : 'text-indigo-600'}`}>{item.quantity}</span>
                    <button onClick={() => saveItem({...item, quantity: 0.5}, 'add')} className="w-10 h-10 rounded-full bg-slate-50 text-green-500 font-bold pointer-events-auto">+</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* VIEW: SHOPPING */}
        {activeView === 'SHOPPING' && (
          <section className="space-y-6">
            {categories.map(cat => {
              const list = shoppingList.filter(s => s.category === cat);
              if (list.length === 0) return null;
              return (
                <div key={cat} className="space-y-2">
                  <h3 className="font-black text-slate-400 text-xs uppercase pr-2">{cat}</h3>
                  {list.map(s => (
                    <div key={s.id} className="flex items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-emerald-50">
                      <input type="checkbox" onChange={() => markAsBought(s)} className="w-7 h-7 rounded-full border-2 border-emerald-200 text-emerald-600 pointer-events-auto" />
                      <span className="font-bold text-slate-700">{s.item_name}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}