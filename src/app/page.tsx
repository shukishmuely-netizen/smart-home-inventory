'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { id?: string; item_name: string; quantity: number; category: string; location: string; uncertain?: boolean; options?: string[] };

export default function HomePage() {
  const [activeView, setActiveView] = useState<'HOME' | 'INVENTORY' | 'SHOPPING'>('HOME');
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
    setStatus('מעבד רשימה ארוכה...');
    
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
    <main className="min-h-screen bg-slate-50 font-sans pb-10" dir="rtl">
      <header className="bg-indigo-700 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-black cursor-pointer" onClick={() => setActiveView('HOME')}>Smart Kitchen 🍎</h1>
          <nav className="flex gap-4">
            <button onClick={() => setActiveView('INVENTORY')} className="px-3 py-1 rounded-lg font-bold hover:bg-indigo-600">מלאי</button>
            <button onClick={() => setActiveView('SHOPPING')} className="px-3 py-1 rounded-lg font-bold hover:bg-indigo-600">קניות</button>
          </nav>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4">
        {/* אזור עדכון - תמיד זמין */}
        <div className="mb-6 bg-white p-4 rounded-3xl shadow-md border border-indigo-100">
          <form onSubmit={handleUpdate} className="flex flex-col gap-2">
            <textarea 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder="הדבק כאן את הרשימה הארוכה שלך..." 
              className="w-full rounded-xl border-none bg-slate-100 p-4 text-md focus:ring-2 focus:ring-indigo-300 min-h-[100px]"
            />
            <button type="submit" className="bg-indigo-600 text-white p-4 rounded-xl font-bold text-xl hover:bg-indigo-700 transition-all">עדכן</button>
          </form>
          <p className="text-xs text-center mt-2 text-slate-400 font-bold">{status}</p>
        </div>

        {/* שאלות על פריטים לא ברורים */}
        {pendingItems.length > 0 && (
          <div className="mb-10 space-y-4">
            <h3 className="font-bold text-lg text-indigo-900">יש לנו כמה שאלות:</h3>
            {pendingItems.map((item, idx) => (
              <div key={idx} className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                <p className="font-bold mb-2">לאן לשייך את "{item.item_name}"?</p>
                <div className="flex flex-wrap gap-2">
                  {item.options?.map(opt => (
                    <button key={opt} onClick={async () => {
                      await saveItem({...item, category: opt, location: (opt === 'קפואים' || opt === 'קירור') ? 'מקרר' : 'מזווה'});
                      setPendingItems(prev => prev.filter(p => p.item_name !== item.item_name));
                      fetchData();
                    }} className="bg-white px-3 py-1 rounded-lg border border-amber-300 text-sm font-bold">
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* תצוגת דשבורד / מלאי / קניות (כפי שהיה קודם) */}
        {activeView === 'HOME' && (
          <div className="grid grid-cols-1 gap-6 mt-4">
            <button onClick={() => setActiveView('INVENTORY')} className="p-10 bg-white rounded-3xl shadow-lg border-b-8 border-indigo-500 text-2xl font-black">📦 נהל מלאי</button>
            <button onClick={() => setActiveView('SHOPPING')} className="p-10 bg-white rounded-3xl shadow-lg border-b-8 border-green-500 text-2xl font-black">🛒 רשימת קניות</button>
          </div>
        )}

        {activeView === 'INVENTORY' && (
          <div className="space-y-6">
            {['מקרר', 'מזווה'].map(loc => (
              <div key={loc}>
                <h2 className="text-xl font-black mb-3 text-slate-700 underline decoration-indigo-300">{loc}</h2>
                <div className="grid gap-2">
                  {inventory.filter(i => i.location === loc).map(item => (
                    <div key={item.id} className="flex justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                      <span className="font-bold">{item.item_name} <span className="text-[10px] text-slate-300">({item.category})</span></span>
                      <span className={`font-black ${item.quantity <= 2 ? 'text-red-500' : 'text-indigo-600'}`}>{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}