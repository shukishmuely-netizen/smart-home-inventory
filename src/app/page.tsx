'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { id?: string; item_name: string; quantity: number; category: string; location: string; uncertain?: boolean; options?: string[] };

export default function HomePage() {
  const [activeView, setActiveView] = useState<'HOME' | 'INVENTORY' | 'SHOPPING'>('HOME');
  const [invFilter, setInvFilter] = useState<'מקרר' | 'מזווה' | 'הכל'>('הכל');
  const [sortBy, setSortBy] = useState<'name' | 'category'>('category');
  
  const [inventory, setInventory] = useState<Item[]>([]);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('');
  const [pendingItems, setPendingItems] = useState<Item[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<Item[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  const fetchData = async () => {
    const { data: inv } = await supabase.from('inventory_items').select('*');
    const { data: shop } = await supabase.from('shopping_list').select('*');
    const { data: cats } = await supabase.from('category_order').select('category_name').order('sort_order');
    setInventory(inv ?? []);
    setShoppingList(shop ?? []);
    setCategories(cats?.map(c => c.category_name) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const saveEditedName = async (id: string, table: 'inventory_items' | 'shopping_list') => {
    if (editNameValue.trim()) {
      await supabase.from(table).update({ item_name: editNameValue.trim() }).eq('id', id);
    }
    setEditingId(null);
    fetchData();
  };

  // עדכון כמות מדויקת מכפתורי ה-UI
  const updateExactQuantity = async (item: Item, newQty: number) => {
    await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', item.id);
    if (newQty <= 2 && newQty < item.quantity) {
      setLowStockAlerts(prev => [...prev.filter(i => i.item_name !== item.item_name), { ...item, quantity: newQty }]);
    }
    fetchData();
  };

  const handlePlus = (item: Item) => updateExactQuantity(item, item.quantity + 1);
  const handleHalf = (item: Item) => updateExactQuantity(item, item.quantity + 0.5);
  const handleMinus = (item: Item) => {
    const newQty = item.quantity % 1 !== 0 ? Math.floor(item.quantity) : Math.max(0, item.quantity - 1);
    updateExactQuantity(item, newQty);
  };

  const saveItemAI = async (item: Item, action: 'add' | 'remove' = 'add') => {
    const name = item.item_name || (item as any).name;
    if (!name) return;
    const { data: existing } = await supabase.from('inventory_items').select('*').eq('item_name', name).maybeSingle();
    
    let newQty = item.quantity;
    if (existing) {
      newQty = action === 'add' ? existing.quantity + item.quantity : Math.max(0, existing.quantity - item.quantity);
      await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', existing.id);
    } else {
      await supabase.from('inventory_items').insert([{ item_name: name, quantity: item.quantity, category: item.category || 'כללי', location: item.location || 'מזווה', household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }]);
    }
    if (newQty <= 2 && newQty > 0) setLowStockAlerts(prev => [...prev.filter(i => i.item_name !== name), { ...item, item_name: name, quantity: newQty }]);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setStatus('⚡ מעבד נתונים...');
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text: input }) });
      const data = await res.json();
      const items = data.items || [];

      // אם אנחנו במסך הקניות - הכל הולך ישירות לקניות
      if (activeView === 'SHOPPING') {
        for (const item of items) {
          const name = item.name || item.item_name;
          const finalName = item.quantity > 1 ? `${name} (${item.quantity})` : name;
          await supabase.from('shopping_list').insert([{ item_name: finalName, category: item.category || 'כללי' }]);
        }
        setStatus('✅ נוסף לרשימת הקניות!');
      } 
      // אם אנחנו במסך המלאי - ממשיכים עם הלוגיקה הרגילה (סיווג וכו')
      else {
        const certain = items.filter((i: any) => !i.uncertain);
        const uncertain = items.filter((i: any) => i.uncertain && (i.name || i.item_name));
        for (const item of certain) { await saveItemAI(item, data.action); }

        if (uncertain.length > 0) {
          setPendingItems(uncertain.map((i: any) => ({ ...i, item_name: i.name || i.item_name })));
          setStatus(`צריך עזרה עם כמה פריטים`);
        } else {
          setStatus('✅ המלאי עודכן!');
        }
      }
      setInput('');
      fetchData();
    } catch { setStatus('❌ שגיאה'); }
  };

  const addToShopping = async (item: Item) => {
    await supabase.from('shopping_list').insert([{ item_name: item.item_name, category: item.category || 'כללי' }]);
    setLowStockAlerts(prev => prev.filter(i => i.item_name !== item.item_name));
    fetchData();
  };

  const markAsBought = async (shopItem: any) => {
    await saveItemAI({ item_name: shopItem.item_name, quantity: 1, category: shopItem.category, location: 'מקרר' }, 'add');
    await supabase.from('shopping_list').delete().eq('id', shopItem.id);
    fetchData();
  };

  const filteredInventory = inventory.filter(i => i.item_name.includes(searchTerm) && (invFilter === 'הכל' || i.location === invFilter)).sort((a, b) => a.item_name.localeCompare(b.item_name, 'he'));
  const filteredShoppingList = shoppingList.filter(s => s.item_name.includes(searchTerm)).sort((a, b) => a.item_name.localeCompare(b.item_name, 'he'));
  const displayCategories = Array.from(new Set([...categories, ...inventory.map(i => i.category), ...shoppingList.map(s => s.category)]));

  // צבעי ההדר משתנים לפי המסך
  const headerGradient = activeView === 'HOME' ? 'from-violet-600 via-fuchsia-600 to-orange-500' :
                         activeView === 'INVENTORY' ? 'from-teal-600 to-emerald-500' :
                         'from-rose-500 to-orange-500';

  return (
    <main className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900" dir="rtl">
      <header className={`bg-gradient-to-r ${headerGradient} text-white p-4 shadow-xl sticky top-0 z-[1000] transition-colors duration-500`}>
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black cursor-pointer pointer-events-auto drop-shadow-md" onClick={() => {setActiveView('HOME'); setSearchTerm('');}}>Smart Kitchen 🍎</h1>
          <nav className="flex gap-2">
            <button onClick={() => {setActiveView('INVENTORY'); setSearchTerm('');}} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all pointer-events-auto ${activeView === 'INVENTORY' ? 'bg-white text-teal-700 shadow-lg' : 'bg-black/20 hover:bg-black/30'}`}>מלאי</button>
            <button onClick={() => {setActiveView('SHOPPING'); setSearchTerm('');}} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all pointer-events-auto ${activeView === 'SHOPPING' ? 'bg-white text-rose-700 shadow-lg' : 'bg-black/20 hover:bg-black/30'}`}>קניות</button>
          </nav>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 relative z-10">
        
        {/* HOME */}
        {activeView === 'HOME' && (
          <div className="grid grid-cols-1 gap-6 mt-10">
            <button onClick={() => setActiveView('INVENTORY')} className="p-8 bg-white rounded-[2.5rem] shadow-xl border-b-[8px] border-teal-500 flex items-center justify-between group active:scale-95 transition-all">
               <div className="text-right">
                  <span className="block text-3xl font-black text-slate-800">ניהול מלאי</span>
                  <span className="text-slate-500">מקרר, מזווה ומוצרים</span>
               </div>
               <span className="text-6xl group-hover:scale-110 transition-transform drop-shadow-sm">📦</span>
            </button>
            <button onClick={() => setActiveView('SHOPPING')} className="p-8 bg-white rounded-[2.5rem] shadow-xl border-b-[8px] border-rose-500 flex items-center justify-between group active:scale-95 transition-all">
               <div className="text-right">
                  <span className="block text-3xl font-black text-slate-800">רשימת קניות</span>
                  <span className="text-slate-500">{shoppingList.length} פריטים חסרים</span>
               </div>
               <span className="text-6xl group-hover:scale-110 transition-transform drop-shadow-sm">🛒</span>
            </button>
          </div>
        )}

        {/* פאנל חיפוש וסידור */}
        {activeView !== 'HOME' && (
          <div className="mb-6 space-y-4">
            <input type="text" placeholder="🔍 חפש מוצר..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-md shadow-sm focus:ring-2 focus:ring-amber-400 pointer-events-auto" />
            <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
              <button onClick={() => setSortBy('category')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${sortBy === 'category' ? 'bg-amber-100 text-amber-800 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>📁 מיון לפי קטגוריות</button>
              <button onClick={() => setSortBy('name')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${sortBy === 'name' ? 'bg-indigo-100 text-indigo-800 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>🔤 מיון לפי א״ב</button>
            </div>
          </div>
        )}

        {/* טופס AI */}
        {activeView !== 'HOME' && (
          <div className="mb-6 bg-white p-5 rounded-[2rem] shadow-xl border border-slate-100">
            <form onSubmit={handleUpdate} className="space-y-3">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={activeView === 'INVENTORY' ? "מה הוספנו למלאי? (למשל: 2 חלב, חצי אבטיח)" : "מה חסר? (למשל: עגבניות, 3 קולה)"} className="w-full rounded-2xl border-none bg-slate-50 p-4 text-md focus:ring-2 focus:ring-amber-400 min-h-[80px] pointer-events-auto" />
              <button type="submit" className={`w-full text-white p-4 rounded-2xl font-bold text-xl shadow-md active:scale-95 transition-all pointer-events-auto ${activeView === 'INVENTORY' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                {activeView === 'INVENTORY' ? 'עדכן מלאי ✨' : 'הוסף לקניות 🛒'}
              </button>
            </form>
            {status && <p className={`text-center mt-3 text-sm font-bold ${status.includes('❌') ? 'text-red-500' : 'text-teal-600'}`}>{status}</p>}
          </div>
        )}

        {/* התראות מלאי */}
        {lowStockAlerts.length > 0 && activeView === 'INVENTORY' && (
          <div className="mb-6 space-y-3">
            {lowStockAlerts.map(alert => (
              <div key={alert.item_name} className="bg-rose-50 border-2 border-rose-200 p-4 rounded-2xl flex justify-between items-center">
                <span className="font-bold text-rose-900 text-sm">רק {alert.quantity} מ"{alert.item_name}". לקניות?</span>
                <div className="flex gap-2">
                  <button onClick={() => addToShopping(alert)} className="bg-rose-600 text-white px-3 py-1.5 rounded-xl font-bold text-sm pointer-events-auto">כן</button>
                  <button onClick={() => setLowStockAlerts(prev => prev.filter(i => i.item_name !== alert.item_name))} className="bg-white text-rose-600 border border-rose-200 px-3 py-1.5 rounded-xl font-bold text-sm pointer-events-auto">לא</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* שאלות סיווג (רק במלאי) */}
        {pendingItems.length > 0 && activeView === 'INVENTORY' && (
          <div className="mb-8 p-6 bg-amber-50 rounded-[2rem] border-2 border-amber-300 shadow-md">
            <h3 className="font-black text-amber-900 mb-4">🤔 שאלות סיווג:</h3>
            <div className="space-y-4">
              {pendingItems.map((item, idx) => {
                const options = (item.options && item.options.length > 0) ? item.options : ['טרי', 'קפואים', 'שימורים', 'יבשים'];
                return (
                  <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-amber-100">
                    <p className="font-bold mb-3 text-slate-800">איך לסווג את "{item.item_name}"?</p>
                    <div className="flex flex-wrap gap-2">
                      {options.map(opt => (
                        <button key={opt} onClick={async () => {
                          await saveItemAI({...item, category: opt, location: ['קפואים', 'קירור', 'טרי'].includes(opt) ? 'מקרר' : 'מזווה'});
                          setPendingItems(prev => prev.filter(p => p.item_name !== item.item_name));
                          fetchData();
                        }} className="bg-amber-100 hover:bg-amber-400 hover:text-amber-900 text-amber-800 px-4 py-2 rounded-xl font-bold text-sm transition-all pointer-events-auto">{opt}</button>
                      ))}
                      <button onClick={() => setPendingItems(prev => prev.filter(p => p.item_name !== item.item_name))} className="text-slate-400 text-xs px-2 pointer-events-auto">התעלם</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* INVENTORY VIEW */}
        {activeView === 'INVENTORY' && (
          <section className="space-y-6">
            <div className="flex gap-2 p-1 bg-white rounded-2xl shadow-sm border border-slate-100">
              {['הכל', 'מקרר', 'מזווה'].map(f => (
                <button key={f} onClick={() => setInvFilter(f as any)} className={`flex-1 py-2.5 rounded-xl font-bold transition-all pointer-events-auto ${invFilter === f ? 'bg-teal-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{f}</button>
              ))}
            </div>

            {sortBy === 'category' ? (
              <div className="space-y-8">
                {displayCategories.map(cat => {
                  const itemsInCat = filteredInventory.filter(i => i.category === cat);
                  if (itemsInCat.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-3">
                      <h3 className="font-black text-teal-700 text-sm uppercase pr-2 border-r-4 border-teal-400">{cat}</h3>
                      <div className="grid gap-3">
                        {itemsInCat.map(item => (
                          <InventoryCard key={item.id} item={item} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} onPlus={() => handlePlus(item)} onHalf={() => handleHalf(item)} onMinus={() => handleMinus(item)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredInventory.map(item => (
                   <InventoryCard key={item.id} item={item} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} onPlus={() => handlePlus(item)} onHalf={() => handleHalf(item)} onMinus={() => handleMinus(item)} />
                ))}
              </div>
            )}
            {filteredInventory.length === 0 && <div className="text-center p-8 text-slate-400 font-bold">לא נמצאו פריטים 🧐</div>}
          </section>
        )}

        {/* SHOPPING VIEW */}
        {activeView === 'SHOPPING' && (
          <section className="space-y-6">
            {sortBy === 'category' ? (
              <div className="space-y-8">
                {displayCategories.map(cat => {
                  const list = filteredShoppingList.filter(s => s.category === cat);
                  if (list.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-3">
                      <h3 className="font-black text-rose-700 text-sm uppercase pr-2 border-r-4 border-rose-400">{cat}</h3>
                      <div className="grid gap-3">
                        {list.map(s => (
                          <ShoppingCard key={s.id} item={s} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} markAsBought={markAsBought} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredShoppingList.map(s => (
                  <ShoppingCard key={s.id} item={s} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} markAsBought={markAsBought} />
                ))}
              </div>
            )}
            {filteredShoppingList.length === 0 && <div className="text-center p-8 text-slate-400 font-bold">העגלה ריקה 🛒</div>}
          </section>
        )}
      </div>
    </main>
  );
}

// כרטיס מלאי
function InventoryCard({ item, editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName, onPlus, onHalf, onMinus }: any) {
  return (
    <div className="flex justify-between items-center bg-white p-4 rounded-[1.5rem] shadow-sm border border-slate-100">
      <div className="text-right flex-1">
        {editingId === item.id ? (
          <div className="flex items-center gap-2 mb-1">
            <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} className="border-b-2 border-teal-500 bg-teal-50 px-2 py-1 outline-none font-bold text-lg w-[120px] pointer-events-auto" />
            <button onClick={() => saveEditedName(item.id, 'inventory_items')} className="bg-green-100 text-green-700 p-2 rounded-lg pointer-events-auto">✅</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="block font-bold text-lg text-slate-800">{item.item_name}</span>
            <button onClick={() => {setEditingId(item.id); setEditNameValue(item.item_name);}} className="text-slate-300 hover:text-amber-500 pointer-events-auto">✏️</button>
          </div>
        )}
        <span className="text-[10px] uppercase font-bold text-slate-400">{item.category} • {item.location}</span>
      </div>
      <div className="flex items-center gap-2" dir="ltr">
        <button onClick={onMinus} className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 font-black pointer-events-auto shadow-sm hover:bg-rose-200">-</button>
        <button onClick={onHalf} className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 font-bold text-xs pointer-events-auto shadow-sm hover:bg-amber-200">½</button>
        <span className={`text-xl font-black min-w-[36px] text-center ${item.quantity <= 2 ? 'text-rose-600' : 'text-slate-700'}`}>{item.quantity}</span>
        <button onClick={onPlus} className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 font-black pointer-events-auto shadow-sm hover:bg-emerald-200">+</button>
      </div>
    </div>
  );
}

// כרטיס קניות
function ShoppingCard({ item, editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName, markAsBought }: any) {
  return (
    <div className="flex items-center gap-4 bg-white p-4 rounded-[1.5rem] shadow-sm border border-rose-50">
      <input type="checkbox" onChange={() => markAsBought(item)} className="w-7 h-7 rounded-lg border-2 border-rose-300 text-rose-500 pointer-events-auto cursor-pointer" />
      {editingId === item.id ? (
        <div className="flex items-center gap-2">
          <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} className="border-b-2 border-rose-500 bg-rose-50 px-2 py-1 outline-none font-bold text-lg w-[120px] pointer-events-auto" />
          <button onClick={() => saveEditedName(item.id, 'shopping_list')} className="bg-green-100 text-green-700 p-2 rounded-lg pointer-events-auto">✅</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-lg">{item.item_name}</span>
          <button onClick={() => {setEditingId(item.id); setEditNameValue(item.item_name);}} className="text-slate-300 hover:text-amber-500 pointer-events-auto">✏️</button>
        </div>
      )}
    </div>
  );
}