'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

// Types
type Item = { id?: string; item_name: string; quantity: number; category: string; location: string; uncertain?: boolean; options?: string[] };
type ShoppingItem = { id?: string; item_name: string; category: string; household_id: string; created_at: string; recently_removed: boolean };

export default function HomePage() {
  const [activeView, setActiveView] = useState<'INVENTORY' | 'SHOPPING'>('INVENTORY');
  const [invFilter, setInvFilter] = useState<'מקרר' | 'מזווה' | 'הכל'>('הכל');
  
  const [inventory, setInventory] = useState<Item[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  
  const [pendingItems, setPendingItems] = useState<Item[]>([]); // To track AI ambiguity
  const [removedRecently, setRemovedRecently] = useState<ShoppingItem[]>([]);

  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [newLocationValue, setNewLocationValue] = useState<'מקרר' | 'מזווה'>('מקרר');

  const [isSearchOpen, setIsSearchOpen] = useState(false); // UI FIX: Handle search icon UI

  const fetchData = async () => {
    // 1. Fetch Inventory View
    const { data: inv } = await supabase.from('household_inventory_view').select('*');
    if (inv) setInventory(inv);

    // 2. Fetch Shopping View
    const { data: shop } = await supabase.from('current_shopping_view').select('*');
    if (shop) setShoppingList(shop);

    // 3. Fetch Category Order
    const { data: cats } = await supabase.from('category_order').select('category_name').order('sort_order');
    if (cats) setCategories(cats.map(c => c.category_name));

    // 4. Fetch recently removed shopping list
    const { data: removed } = await supabase.from('recently_removed_shopping_view').select('*');
    if (removed) setRemovedRecently(removed);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const clearStatus = () => setTimeout(() => setStatus(''), 4000);

  const handleManualInventoryAdd = async () => {
    if (!editNameValue.trim()) return;
    await supabase.from('current_items').insert([{ item_name: editNameValue.trim(), quantity: 1, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }]);
    setEditNameValue('');
    fetchData();
  };

  const handleManualShoppingAdd = async () => {
    if (!editNameValue.trim()) return;
    await supabase.from('current_items').insert([{ item_name: editNameValue.trim(), quantity: -1, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }]);
    setEditNameValue('');
    fetchData();
  };

  const saveEditedName = async (id: string, table: 'current_items' | 'current_shopping_view') => {
    if (table === 'current_items') {
      await supabase.from('current_items').update({ item_name: editNameValue.trim() }).eq('id', id);
    } else {
      await supabase.from('current_shopping_view').update({ item_name: editNameValue.trim() }).eq('id', id);
    }
    setEditingId(null);
    fetchData();
  };

  const deleteItem = async (id: string, name: string) => {
    if (confirm(`למחוק את ${name} לתמיד?`)) {
      await supabase.from('current_items').delete().eq('id', id);
      fetchData();
    }
  };

  const toggleLocation = async (id: string, name: string, currentLocation: string, category: string) => {
    const newLoc = currentLocation === 'מקרר' ? 'מזווה' : 'מקרר';
    await supabase.from('household_inventory_view').update({ location: newLoc }).eq('item_name', name);
    fetchData();
  };

  const updateExactQuantity = async (item: Item, newQty: number) => {
    await supabase.from('current_items').insert([{ item_name: item.item_name, quantity: newQty - item.quantity, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }]);
    fetchData();
  };

  const handlePlus = (item: Item) => updateExactQuantity(item, item.quantity + 1);
  const handleHalf = (item: Item) => updateExactQuantity(item, item.quantity + 0.5);
  const handleMinus = (item: Item) => {
    const newQty = item.quantity % 1 !== 0 ? Math.floor(item.quantity) : Math.max(0, item.quantity - 1);
    updateExactQuantity(item, newQty);
  };

  const saveParsedItems = async (items: Item[]) => {
    for (const item of items) {
      if (!item.uncertain && item.name) {
        // AI FIX: The NLP route now handles intent by sending negative quantity. 
        // We just insert the update record. Sum Logic view handles it.
        await supabase.from('current_items').insert([{ item_name: item.name, quantity: item.quantity, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }]);
      }
    }
    fetchData();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setStatus('⚡ מעבד נתונים...');
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text: input }) });
      const data = await res.json();
      const items = data.items || [];
      const certain = items.filter((i: any) => !i.uncertain);
      const uncertain = items.filter((i: any) => i.uncertain && i.name);

      await saveParsedItems(certain);

      if (uncertain.length > 0) {
        setPendingItems(uncertain);
        setStatus(`צריך עזרה עם ${uncertain.length} פריטים:`);
      } else {
        setStatus('✅ המטבח עודכן בהצלחה!');
        clearStatus();
      }
      setInput('');
    } catch {
      setStatus('❌ שגיאה בעיבוד הנתונים');
      clearStatus();
    }
  };

  const moveToRecentlyRemoved = async (id: string, name: string) => {
    await supabase.from('current_shopping_view').update({ recently_removed: true }).eq('id', id);
    fetchData();
  };

  const restoreRecentlyRemoved = async (id: string) => {
    await supabase.from('recently_removed_shopping_view').update({ recently_removed: false }).eq('id', id);
    fetchData();
  };

  // State FIX: Explicitly handle resetting state after classification is chosen.
  const selectClassificationOption = async (item: Item, chosenCategory: string, chosenLocation: 'מקרר' | 'מזווה') => {
    // 1. First, explicitly remove this item from the pending list so it disappears.
    setPendingItems(prev => prev.filter(p => p.name !== item.name));

    // 2. Perform the actual manual insertion.
    await supabase.from('household_inventory_view').insert([{ 
      item_name: item.name, 
      category: chosenCategory, 
      location: chosenLocation, 
      household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' 
    }]);

    // 3. (Implicitly) Perform update record insert (positive qty for add intent). Sum Logic view handles it.
    await supabase.from('current_items').insert([{ item_name: item.name, quantity: item.quantity, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }]);

    // 4. Then, update status and fetch data.
    if (pendingItems.length === 1) { // This was the last pending item
        setStatus('✅ סיווג הושלם!');
        clearStatus();
    }
    fetchData();
  };

  const filteredInventory = inventory.filter(i => i.item_name.includes(searchTerm) && (invFilter === 'הכל' || i.location === invFilter));
  const filteredShoppingList = shoppingList.filter(s => s.item_name.includes(searchTerm));

  // Category view grouping
  const groupedInventory: { [key: string]: Item[] } = {};
  filteredInventory.forEach(item => {
    const cat = item.category || 'כללי';
    if (!groupedInventory[cat]) groupedInventory[cat] = [];
    groupedInventory[cat].push(item);
  });
  const displayCategoriesInv = Array.from(new Set([...categories, ...Object.keys(groupedInventory)]));

  const groupedShopping: { [key: string]: ShoppingItem[] } = {};
  filteredShoppingList.forEach(item => {
    const cat = item.category || 'כללי';
    if (!groupedShopping[cat]) groupedShopping[cat] = [];
    groupedShopping[cat].push(item);
  });
  const displayCategoriesShop = Array.from(new Set([...categories, ...Object.keys(groupedShopping)]));

  return (
    <main className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900" dir="rtl">
      
      {/* UI FIX: Modified header placement to include search icon requested in Image 2. */}
      <header className="bg-[#2DAB88] text-white p-4 shadow-xl sticky top-0 z-[1000]">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          
          <div className="flex justify-between items-center relative">
            <h1 className="text-2xl font-black cursor-pointer" onClick={() => setActiveView('INVENTORY')}>
                הבית של ניאו 🏠
            </h1>
            
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded-xl bg-black/10 font-bold flex gap-2 items-center">
                  <span>☰</span> תפריט
              </button>
              
              {/* Search Icon Button: Placement requested in Image 2 (red box). */}
              <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="p-2.5 rounded-xl bg-black/10 font-black text-lg" title="פתח/סגור חיפוש">
                  🔍
              </button>
            </div>
          </div>

          {/* Dynamic Search Input: Appears when icon is clicked */}
          {isSearchOpen && (
            <div className="relative w-full animate-in fade-in slide-in-from-top-2">
              <input 
                type="text" 
                placeholder={`🔍 חפש ${activeView === 'INVENTORY' ? 'במלאי' : 'בקניות'}...`} 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full rounded-2xl border border-white/30 bg-white/10 p-3 text-lg placeholder-white/70 focus:bg-white focus:text-slate-900 focus:placeholder-slate-400 outline-none transition-all shadow-inner font-medium"
                autoFocus
              />
            </div>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 relative z-10">
        
        {/* VIEW SELECTOR */}
        <div className="flex bg-[#6200EE] rounded-2xl shadow-md p-1.5 mb-8">
          <button onClick={() => setActiveView('INVENTORY')} className={`flex-1 py-3.5 rounded-xl font-bold text-lg transition-all ${activeView === 'INVENTORY' ? 'bg-white text-[#6200EE] shadow-lg' : 'text-white/80 hover:bg-black/10'}`}>📦 מלאי</button>
          <button onClick={() => setActiveView('SHOPPING')} className={`flex-1 py-3.5 rounded-xl font-bold text-lg transition-all ${activeView === 'SHOPPING' ? 'bg-white text-[#6200EE] shadow-lg' : 'text-white/80 hover:bg-black/10'}`}>🛒 קניות ({filteredShoppingList.length})</button>
        </div>

        {/* NLP INPUT BOX */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 mb-8 relative z-20">
          <form onSubmit={handleUpdate} className="space-y-4">
            <textarea value={input} onChange={e => setInput(e.target.value)} placeholder={activeView === 'INVENTORY' ? "מה הוספנו למטבח? (למשל: 3 חלב, אפונה קפואה)" : "מה חסר? (למשל: פסטה, 2 עגבניות)"} className="w-full rounded-3xl border-none bg-slate-50 p-5 text-xl min-h-[100px] focus:ring-2 focus:ring-[#6200EE]" />
            <button type="submit" className={`w-full text-white p-5 rounded-3xl font-black text-2xl shadow-md active:scale-95 transition-all ${activeView === 'INVENTORY' ? 'bg-[#6200EE] hover:bg-[#5000CC]' : 'bg-[#E91E63] hover:bg-[#D81B60]'}`}>✨ תהפוך את זה למציאות</button>
          </form>
          {status && <p className={`text-center mt-5 text-lg font-bold ${status.includes('❌') ? 'text-red-500' : 'text-[#2DAB88]'}`}>{status}</p>}
        </div>

        {/* AI Ambiguity Handling: Shows classification needed prompts */}
        {pendingItems.length > 0 && activeView === 'INVENTORY' && (
          <div className="mb-10 p-8 bg-amber-50 rounded-[3rem] border-2 border-amber-200 shadow-md">
            <h3 className="font-black text-amber-900 text-2xl mb-6">אנחנו צריכים רגע את עזרתך: 🤔</h3>
            <div className="space-y-5">
              {pendingItems.map((item, idx) => {
                const options = (item.options && item.options.length > 0) ? item.options : ['טרי', 'קפואים', 'שימורים', 'יבשים', 'אחר'];
                return (
                  <div key={idx} className="bg-white p-6 rounded-[2rem] shadow-sm border border-amber-100">
                    <p className="font-bold text-xl mb-4 text-slate-800">איך לסווג את "{item.name}"?</p>
                    <div className="flex flex-wrap gap-2.5">
                      {options.map(opt => (
                        <button key={opt} onClick={() => selectClassificationOption(item, opt, ['קפואים', 'קירור', 'טרי'].includes(opt) ? 'מקרר' : 'מזווה')} className="bg-amber-100 hover:bg-amber-400 hover:text-amber-900 text-amber-800 px-5 py-2.5 rounded-full font-bold text-base transition-all">{opt}</button>
                      ))}
                      <button onClick={() => setPendingItems(prev => prev.filter(p => p.name !== item.name))} className="text-slate-400 text-sm px-2">התעלם</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MANUAL ADDITION BAR */}
        <div className="mb-8 p-1.5 flex bg-white rounded-3xl shadow-md border border-slate-100 gap-2">
            <input type="text" placeholder="הוספה ידנית מהירה (למשל: בצל)" value={editingId === null ? editNameValue : ''} onChange={e => editingId === null && setEditNameValue(e.target.value)} className="flex-1 rounded-2xl border-none bg-slate-50 p-4 text-lg focus:ring-1 focus:ring-slate-300" />
            <button onClick={activeView === 'INVENTORY' ? handleManualInventoryAdd : handleManualShoppingAdd} className="bg-slate-200 text-slate-700 font-bold px-6 rounded-2xl active:scale-95 transition-all text-xl">
                ➕
            </button>
        </div>

        {/* INVENTORY VIEW */}
        {activeView === 'INVENTORY' && (
          <section className="space-y-6">
            <div className="flex gap-2 p-1.5 bg-white rounded-3xl shadow-sm border border-slate-100">
              {['הכל', 'מקרר', 'מזווה'].map(f => (
                <button key={f} onClick={() => setInvFilter(f as any)} className={`flex-1 py-3 rounded-xl font-bold transition-all ${invFilter === f ? 'bg-[#2DAB88] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{f}</button>
              ))}
            </div>

            <div className="space-y-12">
              {displayCategoriesInv.map(cat => {
                const itemsInCat = groupedInventory[cat];
                if (!itemsInCat || itemsInCat.length === 0) return null;
                return (
                  <div key={cat} className="space-y-4">
                    <h3 className="font-black text-[#2DAB88] text-base uppercase pr-2 border-r-4 border-[#2DAB88]">{cat}</h3>
                    <div className="grid gap-4">
                      {itemsInCat.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 group relative">
                          <div className="text-right flex-1">
                            {editingId === item.id ? (
                              <div className="flex items-center gap-2 mb-1">
                                <input autoFocus value={editNameValue} onChange={e => setEditNameValue(e.target.value)} className="border-b-2 border-[#6200EE] bg-indigo-50 px-2 py-1 outline-none font-bold text-xl" />
                                <button onClick={() => saveEditedName(item.id!, 'current_items')} className="bg-green-100 text-green-700 p-2 rounded-xl">✅</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="block font-bold text-xl text-slate-800">{item.item_name}</span>
                                <button onClick={() => { setEditingId(item.id!); setEditNameValue(item.item_name); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-amber-500">✏️</button>
                                <button onClick={() => deleteItem(item.id!, item.item_name)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500">🗑️</button>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 mt-1 cursor-pointer hover:text-[#6200EE]" onClick={() => toggleLocation(item.id!, item.item_name, item.location, item.category)}>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{item.location === 'מקרר' ? '❄️ מקרר' : '📦 מזווה'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5" dir="ltr">
                            <button onClick={() => handleMinus(item)} className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 font-bold active:scale-95 transition-all">-</button>
                            <button onClick={() => handleHalf(item)} className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 font-bold active:scale-95 transition-all">½</button>
                            <span className="text-2xl font-black min-w-[40px] text-center text-slate-700">{item.quantity}</span>
                            <button onClick={() => handlePlus(item)} className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 font-bold active:scale-95 transition-all">+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SHOPPING VIEW */}
        {activeView === 'SHOPPING' && (
          <section className="space-y-6">
            <div className="space-y-12">
              {displayCategoriesShop.map(cat => {
                const list = groupedShopping[cat];
                if (!list || list.length === 0) return null;
                return (
                  <div key={cat} className="space-y-4">
                    <h3 className="font-black text-[#E91E63] text-base uppercase pr-2 border-r-4 border-[#E91E63]">{cat}</h3>
                    <div className="grid gap-3">
                      {list.map(s => (
                        <div key={s.id} className="flex justify-between items-center gap-4 bg-white p-4 rounded-[1.5rem] shadow-sm border border-rose-50 group">
                          <div className="flex items-center gap-3.5 flex-1">
                            {editingId === s.id ? (
                              <input autoFocus value={editNameValue} onChange={e => setEditNameValue(e.target.value)} className="border-b-2 border-[#E91E63] bg-rose-50 px-2 py-1 outline-none font-bold text-xl" />
                            ) : (
                              <span className="font-bold text-slate-800 text-xl">{s.item_name}</span>
                            )}
                             <button onClick={() => { setEditingId(s.id!); setEditNameValue(s.item_name); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-amber-500">✏️</button>
                          </div>
                          <button onClick={() => moveToRecentlyRemoved(s.id!, s.item_name)} className="bg-rose-100 text-rose-600 hover:bg-rose-200 px-4 py-2 rounded-xl text-sm font-bold shadow-inner">
                            🗑️ הסר
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {removedRecently.length > 0 && (
               <div className="mt-14 pt-8 border-t-2 border-slate-200 opacity-60">
                 <p className="text-[11px] font-bold mb-3 uppercase tracking-wider text-slate-400">🗑️ הוסרו לאחרונה</p>
                 {removedRecently.map((item, idx) => (
                   <div key={idx} className="flex justify-between items-center bg-slate-100 p-3 rounded-xl mb-1.5 border border-dashed border-slate-300">
                     <span className="text-sm line-through text-slate-500 font-medium">{item.item_name}</span>
                     <button onClick={() => restoreRecentlyRemoved(item.id!)} className="text-[11px] font-bold text-slate-600 bg-white px-3 py-1.5 rounded-lg border shadow-inner">החזר חזרה +</button>
                   </div>
                 ))}
               </div>
            )}
          </section>
        )}

      </div>
    </main>
  );
}