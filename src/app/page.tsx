'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { id?: string; item_name: string; quantity: number; category: string; location: string; options?: string[] };

export default function HomePage() {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('מוכן...');
  const [pendingItems, setPendingItems] = useState<Item[]>([]); // פריטים שמחכים להחלטה שלך

  const fetchData = async () => {
    const { data: inv } = await supabase.from('inventory_items').select('*');
    const { data: shop } = await supabase.from('shopping_list').select('*');
    const { data: cats } = await supabase.from('category_order').select('category_name').order('sort_order');
    setInventory(inv ?? []);
    setShoppingList(shop ?? []);
    setCategories(cats?.map(c => c.category_name) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  // פונקציית שמירה סופית למסד הנתונים
  const saveToDb = async (item: Item, action: 'add' | 'remove') => {
    const { data: existing } = await supabase.from('inventory_items').select('*').eq('item_name', item.item_name).maybeSingle();
    
    if (existing) {
      const change = action === 'add' ? item.quantity : -item.quantity;
      await supabase.from('inventory_items').update({ quantity: Math.max(0, existing.quantity + change) }).eq('id', existing.id);
    } else if (action === 'add') {
      await supabase.from('inventory_items').insert([{ 
        item_name: item.item_name, 
        quantity: item.quantity, 
        category: item.category, 
        location: item.location === 'מקרר' ? 'מקרר' : 'מזווה',
        household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' 
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

      // שומרים את הברורים
      for (const item of clearItems) {
        await saveToDb(item, data.action);
      }

      // שמים את הלא ברורים ב"המתנה"
      if (uncertainItems.length > 0) {
        setPendingItems(uncertainItems);
        setStatus('צריך עזרה בסיווג...');
      } else {
        setStatus('עודכן!');
        setInput('');
      }
    } catch { setStatus('שגיאה'); }
  };

  const resolveUncertainty = async (item: Item, selectedCategory: string) => {
    const location = (selectedCategory === 'קפואים' || selectedCategory === 'קירור' || selectedCategory === 'טרי') ? 'מקרר' : 'מזווה';
    const resolvedItem = { ...item, category: selectedCategory, location };
    
    await saveToDb(resolvedItem, 'add'); // מניחים שהוספה אם שאלנו
    setPendingItems(prev => prev.filter(i => i.item_name !== item.item_name));
    if (pendingItems.length <= 1) {
        setStatus('הכל עודכן!');
        setInput('');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 font-sans" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-black mb-8 text-indigo-900">Smart Kitchen 🍎</h1>

        {/* טקסט חופשי */}
        <form onSubmit={handleAISubmit} className="mb-6 bg-white p-6 rounded-3xl shadow-xl border border-indigo-100">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder='חזה עוף, תירס, חלב...' className="w-full rounded-2xl border-none bg-slate-100 p-5 text-lg" />
          <button type="submit" className="mt-4 w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold text-xl">עדכן</button>
        </form>

        {/* שאלות הבהרה של ה-AI */}
        {pendingItems.length > 0 && (
          <div className="mb-8 animate-pulse">
            {pendingItems.map(item => (
              <div key={item.item_name} className="bg-amber-50 border-2 border-amber-200 p-5 rounded-3xl shadow-sm">
                <p className="font-bold text-amber-900 mb-3 text-lg">איך לסווג את "{item.item_name}"?</p>
                <div className="flex flex-wrap gap-2">
                  {item.options?.map(opt => (
                    <button key={opt} onClick={() => resolveUncertainty(item, opt)} className="bg-white border border-amber-300 px-4 py-2 rounded-xl hover:bg-amber-100 font-bold transition-all">
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center mb-4 px-2">
          <span className="text-xs font-bold text-indigo-400">{status}</span>
        </div>

        {/* רשימת מלאי מחולקת למקרר ומזווה */}
        {['מקרר', 'מזווה'].map(loc => (
          <section key={loc} className="mb-10">
            <h2 className="text-2xl font-black mb-4 text-slate-700">{loc}</h2>
            <div className="grid gap-3">
              {inventory.filter(i => i.location === loc).map(item => (
                <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <span className="font-bold">{item.item_name} <span className="text-xs font-normal text-slate-400">({item.category})</span></span>
                  <span className="bg-indigo-50 text-indigo-700 px-4 py-1 rounded-full font-black">{item.quantity}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}