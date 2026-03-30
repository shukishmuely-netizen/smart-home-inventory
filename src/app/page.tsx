'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { id?: string; item_name: string; quantity: number; category: string; location: string; uncertain?: boolean; options?: string[] };
type Task = { id?: string; title: string; description?: string; urgency: string; assignee: string; target_date: string; status: string };

export default function HomePage() {
  const today = new Date().toISOString().split('T')[0];

  const [activeView, setActiveView] = useState<'HOME' | 'INVENTORY' | 'SHOPPING' | 'TASKS'>('HOME');
  const [invFilter, setInvFilter] = useState<'מקרר' | 'מזווה' | 'הכל'>('הכל');
  const [sortBy, setSortBy] = useState<'name' | 'category'>('name');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false); 
  
  const [inventory, setInventory] = useState<Item[]>([]);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('');
  const [pendingItems, setPendingItems] = useState<Item[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<Item[]>([]);
  const [removedItems, setRemovedItems] = useState<any[]>([]);

  const [newTask, setNewTask] = useState<Task>({ 
    title: '', description: '', urgency: 'סטנדרטית', assignee: '👫 כולם', target_date: today, status: 'לא התחלתי' 
  });
  const [showTaskForm, setShowTaskForm] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showStatus = (msg: string, autoClear: boolean = false) => {
    setStatus(msg);
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    if (autoClear) statusTimeoutRef.current = setTimeout(() => setStatus(''), 4000);
  };

  const fetchData = async () => {
    const { data: inv } = await supabase.from('inventory_items').select('*');
    const { data: shop } = await supabase.from('shopping_list').select('*');
    const { data: cats } = await supabase.from('category_order').select('category_name').order('sort_order');
    const { data: tsk } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    
    if (inv) setInventory(inv);
    if (shop) setShoppingList(shop);
    if (cats) setCategories(cats.map(c => c.category_name));
    if (tsk) setTasks(tsk);
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => window.location.reload();

  const changeView = (view: typeof activeView) => {
    setActiveView(view);
    setIsMenuOpen(false);
    setIsSearchOpen(false);
    setSearchTerm('');
  };

  const updateExactQuantity = (item: Item, newQty: number) => {
    setInventory(prev => prev.map(i => i.id === item.id ? { ...i, quantity: newQty } : i));
    supabase.from('inventory_items').update({ quantity: newQty }).eq('id', item.id).then();
    
    const alreadyInShopping = shoppingList.some(s => s.item_name === item.item_name);
    if (newQty <= 2 && newQty < item.quantity && !alreadyInShopping) {
      setLowStockAlerts(prev => [...prev.filter(i => i.item_name !== item.item_name), { ...item, quantity: newQty }]);
    }
  };

  const handlePlus = (item: Item) => updateExactQuantity(item, item.quantity + 1);
  const handleHalf = (item: Item) => updateExactQuantity(item, item.quantity + 0.5);
  const handleMinus = (item: Item) => {
    const newQty = item.quantity % 1 !== 0 ? Math.floor(item.quantity) : Math.max(0, item.quantity - 1);
    updateExactQuantity(item, newQty);
  };

  const saveItemAI = async (item: Item, action: 'add' | 'remove' = 'add') => {
    const name = item.item_name || (item as any).name;
    const existing = inventory.find(i => i.item_name === name);
    let newQty = item.quantity; 
    
    if (existing) {
      newQty = Math.max(0, existing.quantity + item.quantity); 
      setInventory(prev => prev.map(i => i.item_name === name ? { ...i, quantity: newQty } : i));
      await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', existing.id);
    } else {
      const newItem = { item_name: name, quantity: Math.max(0, item.quantity), category: item.category || 'כללי', location: item.location || 'מזווה', household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' };
      setInventory(prev => [...prev, newItem as Item]);
      await supabase.from('inventory_items').insert([newItem]);
    }
    fetchData();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    showStatus('⚡ מעבד...', false);
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text: input }) });
      const data = await res.json();
      if (activeView === 'SHOPPING') {
        for (const item of data.items) {
           const finalName = item.quantity > 1 ? `${item.name} (${item.quantity})` : item.name;
           await supabase.from('shopping_list').insert([{ item_name: finalName, category: item.category || 'כללי' }]);
        }
        showStatus('✅ נוסף לקניות!', true);
      } else {
        const certainItems = [];
        const uncertainItems = [];

        for (const item of data.items) {
          const name = item.name || item.item_name;
          const isRemoval = item.quantity < 0; 

          if (item.uncertain && isRemoval) {
            const matches = inventory.filter(i => i.item_name === name || i.item_name.includes(name));
            if (matches.length === 1) {
              certainItems.push({ ...item, uncertain: false, item_name: matches[0].item_name, name: matches[0].item_name, category: matches[0].category, location: matches[0].location });
            } else if (matches.length > 1) {
              uncertainItems.push({ ...item, options: Array.from(new Set(matches.map(m => m.category))) });
            } else {
              certainItems.push({ ...item, uncertain: false });
            }
          } else if (item.uncertain) {
            uncertainItems.push(item);
          } else {
            certainItems.push(item);
          }
        }

        for (const item of certainItems) await saveItemAI(item);
        
        if (uncertainItems.length > 0) {
          setPendingItems(uncertainItems.map((i: any) => ({ ...i, item_name: i.name || i.item_name })));
          showStatus(`🤔 נדרש סיווג`, false); 
        } else {
          showStatus('✅ עודכן!', true);
        }
      }
      setInput(''); fetchData();
    } catch { showStatus('❌ שגיאה', true); }
  };

  const addToShopping = async (item: Item) => {
    await supabase.from('shopping_list').insert([{ item_name: item.item_name, category: item.category || 'כללי' }]);
    setLowStockAlerts(prev => prev.filter(i => i.item_name !== item.item_name));
    showStatus('✅ נוסף לקניות', true);
    fetchData();
  };

  const handleRemoveFromShopping = async (shopItem: any) => {
    setRemovedItems(prev => [...prev, shopItem]);
    setShoppingList(prev => prev.filter(i => i.id !== shopItem.id));
    await supabase.from('shopping_list').delete().eq('id', shopItem.id);
  };

  const handleRestoreToShopping = async (shopItem: any) => {
    setRemovedItems(prev => prev.filter(i => i.id !== shopItem.id));
    setShoppingList(prev => [...prev, shopItem]);
    await supabase.from('shopping_list').insert([{ item_name: shopItem.item_name, category: shopItem.category }]);
  };

  const saveEditedName = async (id: string, table: any) => {
    if (editNameValue.trim()) await supabase.from(table).update({ item_name: editNameValue.trim() }).eq('id', id);
    setEditingId(null);
    fetchData();
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;
    const { error } = await supabase.from('tasks').insert([newTask]);
    if (!error) {
      setNewTask({ title: '', description: '', urgency: 'סטנדרטית', assignee: '👫 כולם', target_date: today, status: 'לא התחלתי' });
      setShowTaskForm(false);
      showStatus('✅ המשימה נוספה!', true);
      fetchData();
    }
  };

  const updateTaskStatus = async (id: string, newStatus: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
  };

  const handleRestoreTask = async (id: string, newDate: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'לא התחלתי', target_date: newDate } : t));
    await supabase.from('tasks').update({ status: 'לא התחלתי', target_date: newDate }).eq('id', id);
  };

  const deleteTask = async (id: string) => {
    if (confirm('למחוק את המשימה לתמיד?')) {
      setTasks(prev => prev.filter(t => t.id !== id));
      await supabase.from('tasks').delete().eq('id', id);
    }
  };

  const filteredInventory = inventory.filter(i => i.item_name.includes(searchTerm) && (invFilter === 'הכל' || i.location === invFilter)).sort((a, b) => a.item_name.localeCompare(b.item_name, 'he'));
  const filteredShoppingList = shoppingList.filter(s => s.item_name.includes(searchTerm)).sort((a, b) => a.item_name.localeCompare(b.item_name, 'he'));
  const displayCategories = Array.from(new Set([...categories, ...inventory.map(i => i.category), ...shoppingList.map(s => s.category)]));

  const headerGradient = activeView === 'HOME' ? 'from-violet-600 via-fuchsia-600 to-orange-500' :
                         activeView === 'INVENTORY' ? 'from-teal-600 to-emerald-500' :
                         activeView === 'SHOPPING' ? 'from-rose-500 to-orange-500' : 'from-indigo-600 to-purple-700';

  return (
    <main className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900" dir="rtl">
      
      <header className={`bg-gradient-to-r ${headerGradient} text-white shadow-xl sticky top-0 z-[1000] transition-colors duration-500`}>
        <div className="max-w-2xl mx-auto p-4 flex flex-col gap-3">
          
          <div className="flex justify-between items-center relative">
            <h1 className="text-2xl font-black cursor-pointer drop-shadow-md" onClick={() => changeView('HOME')}>הבית של ניאו 🏠</h1>
            
            <div className="flex items-center gap-2">
              {activeView !== 'HOME' && (
                <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="p-2 rounded-xl bg-black/10 hover:bg-black/20 font-black flex items-center justify-center text-lg" title="חפש">🔍</button>
              )}
              <button onClick={handleRefresh} className="p-2 rounded-xl bg-black/10 hover:bg-black/20 font-black flex items-center justify-center text-lg" title="רענן עמוד">🔄</button>
              
              <div className="relative">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="px-3 py-2 rounded-xl bg-black/20 hover:bg-black/30 font-bold tracking-wide shadow-inner flex items-center gap-2">
                  <span>☰</span> תפריט
                </button>
                
                {isMenuOpen && (
                  <div className="absolute left-0 top-12 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col text-slate-800 z-[1001] animate-in fade-in slide-in-from-top-2">
                    <button className="p-4 text-right font-black hover:bg-teal-50 border-b flex justify-between" onClick={() => changeView('INVENTORY')}><span>מלאי</span><span>📦</span></button>
                    <button className="p-4 text-right font-black hover:bg-rose-50 border-b flex justify-between" onClick={() => changeView('SHOPPING')}><span>קניות</span><span>🛒</span></button>
                    <button className="p-4 text-right font-black hover:bg-purple-50 flex justify-between" onClick={() => changeView('TASKS')}><span>משימות</span><span>📌</span></button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isSearchOpen && activeView !== 'HOME' && (
            <div className="relative w-full animate-in fade-in slide-in-from-top-2 mt-2">
              <input 
                type="text" 
                placeholder={`חיפוש ${activeView === 'INVENTORY' ? 'במלאי' : activeView === 'SHOPPING' ? 'בקניות' : 'במשימות'}...`} 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/80 focus:bg-white focus:text-slate-900 focus:placeholder-slate-400 outline-none transition-all shadow-inner font-medium"
                autoFocus
              />
            </div>
          )}
        </div>
      </header>

      {isMenuOpen && <div className="fixed inset-0 z-[999]" onClick={() => setIsMenuOpen(false)}></div>}

      <div className="max-w-2xl mx-auto p-4 relative z-10">
        
        {activeView === 'HOME' && (
          <div className="grid grid-cols-1 gap-4 mt-6">
            <button onClick={() => changeView('INVENTORY')} className="p-6 bg-white rounded-[2rem] shadow-lg border-b-8 border-teal-500 flex items-center justify-between active:scale-95 transition-all">
               <div className="text-right"><span className="block text-2xl font-black">📦 מלאי</span><span className="text-slate-400 text-sm">ניהול מקרר ומזווה</span></div>
               <span className="text-4xl">🥦</span>
            </button>
            <button onClick={() => changeView('SHOPPING')} className="p-6 bg-white rounded-[2rem] shadow-lg border-b-8 border-rose-500 flex items-center justify-between active:scale-95 transition-all">
               <div className="text-right"><span className="block text-2xl font-black">🛒 קניות</span><span className="text-slate-400 text-sm">{shoppingList.length} פריטים</span></div>
               <span className="text-4xl">🛍️</span>
            </button>
            <button onClick={() => changeView('TASKS')} className="p-6 bg-white rounded-[2rem] shadow-lg border-b-8 border-purple-500 flex items-center justify-between active:scale-95 transition-all">
               <div className="text-right"><span className="block text-2xl font-black">📝 משימות</span><span className="text-slate-400 text-sm">{tasks.filter(t => t.status !== 'סיימתי').length} פתוחות</span></div>
               <span className="text-4xl">📌</span>
            </button>
          </div>
        )}

        {(activeView === 'INVENTORY' || activeView === 'SHOPPING') && (
           <div className="mb-4 flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
             <button onClick={() => setSortBy('name')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${sortBy === 'name' ? 'bg-indigo-100 text-indigo-800 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>🔤 לפי א״ב</button>
             <button onClick={() => setSortBy('category')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${sortBy === 'category' ? 'bg-amber-100 text-amber-800 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>📁 לפי קטגוריות</button>
           </div>
        )}

        {(activeView === 'INVENTORY' || activeView === 'SHOPPING') && (
          <div className="bg-white p-5 rounded-[2rem] shadow-xl mb-6 border border-slate-50 relative z-20">
            <form onSubmit={handleUpdate} className="space-y-3">
              <textarea value={input} onChange={e => setInput(e.target.value)} placeholder={activeView === 'INVENTORY' ? "מה הוספנו/הורדנו מהמלאי? (למשל: תוריד 2 חלב, נגמרה הפסטה)" : "מה חסר? (למשל: עגבניות, 3 קולה)"} className="w-full p-4 bg-slate-50 rounded-2xl text-sm min-h-[70px] border-none focus:ring-2 focus:ring-amber-300 pointer-events-auto" />
              <button type="submit" className={`w-full p-4 rounded-2xl text-white font-black text-lg active:scale-95 transition-all shadow-md pointer-events-auto ${activeView === 'INVENTORY' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                 {activeView === 'INVENTORY' ? 'עדכן מלאי ✨' : 'הוסף לקניות 🛒'}
              </button>
            </form>
            {status && (
              <div className="mt-4 flex justify-center animate-in fade-in slide-in-from-bottom-2">
                <span className={`px-4 py-2 rounded-full text-xs font-bold shadow-sm ${status.includes('❌') ? 'bg-red-100 text-red-600' : status.includes('🤔') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                  {status}
                </span>
              </div>
            )}
          </div>
        )}

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
                          const isFridge = ['קפואים', 'קירור', 'טרי'].includes(opt);
                          setPendingItems(prev => prev.filter(p => p.item_name !== item.item_name)); 
                          await saveItemAI({...item, category: opt, location: isFridge ? 'מקרר' : 'מזווה'});
                          if (pendingItems.length <= 1) showStatus('✅ המלאי עודכן!', true);
                        }} className="bg-amber-100 hover:bg-amber-400 hover:text-amber-900 text-amber-800 px-4 py-2 rounded-xl font-bold text-sm transition-all pointer-events-auto">{opt}</button>
                      ))}
                      <button onClick={() => {
                        setPendingItems(prev => prev.filter(p => p.item_name !== item.item_name));
                        if (pendingItems.length <= 1) showStatus('✅ המלאי עודכן!', true);
                      }} className="text-slate-400 text-xs px-2 pointer-events-auto">התעלם</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

        {activeView === 'INVENTORY' && (
          <section className="space-y-6">
            <div className="flex gap-1 p-1 bg-white rounded-xl shadow-sm border border-slate-100">
              {['הכל', 'מקרר', 'מזווה'].map(f => (
                <button key={f} onClick={() => setInvFilter(f as any)} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all pointer-events-auto ${invFilter === f ? 'bg-teal-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>{f}</button>
              ))}
            </div>

            {sortBy === 'category' ? (
              <div className="space-y-8">
                {displayCategories.map(cat => {
                  const itemsInCat = filteredInventory.filter(i => i.category === cat);
                  if (itemsInCat.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-3">
                      <h3 className="font-black text-teal-700 text-xs uppercase pr-2 border-r-4 border-teal-400">{cat}</h3>
                      <div className="grid gap-3">
                        {itemsInCat.map(item => (
                          <InventoryCard key={item.id} item={item} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} updateExactQuantity={updateExactQuantity} onPlus={() => handlePlus(item)} onHalf={() => handleHalf(item)} onMinus={() => handleMinus(item)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredInventory.map(item => (
                   <InventoryCard key={item.id} item={item} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} updateExactQuantity={updateExactQuantity} onPlus={() => handlePlus(item)} onHalf={() => handleHalf(item)} onMinus={() => handleMinus(item)} />
                ))}
              </div>
            )}
          </section>
        )}

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
                          <ShoppingCard key={s.id} item={s} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} onRemove={handleRemoveFromShopping} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredShoppingList.map(s => (
                  <ShoppingCard key={s.id} item={s} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} onRemove={handleRemoveFromShopping} />
                ))}
              </div>
            )}
            
            {removedItems.length > 0 && (
               <div className="mt-12 pt-8 border-t-2 border-slate-200">
                 <h3 className="font-black text-slate-400 text-[10px] uppercase mb-4 pr-2 tracking-widest">🗑️ הוסרו לאחרונה:</h3>
                 <div className="grid gap-2 opacity-60">
                   {removedItems.map((item, idx) => (
                     <div key={idx} className="flex justify-between items-center bg-slate-100 p-3 rounded-xl border border-dashed border-slate-300">
                       <span className="text-xs line-through text-slate-500 font-medium">{item.item_name}</span>
                       <button onClick={() => handleRestoreToShopping(item)} className="text-[10px] font-black bg-white text-slate-700 px-3 py-1.5 rounded-lg border shadow-sm hover:bg-slate-50 transition-colors pointer-events-auto">החזר חזרה +</button>
                     </div>
                   ))}
                 </div>
               </div>
            )}
          </section>
        )}

        {activeView === 'TASKS' && (
          <div className="space-y-6 mt-4">
            <button onClick={() => setShowTaskForm(!showTaskForm)} className="w-full bg-purple-600 text-white p-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all pointer-events-auto">
              {showTaskForm ? 'סגור טופס ✕' : '+ משימה חדשה'}
            </button>

            {showTaskForm && (
              <form onSubmit={handleAddTask} className="bg-white p-6 rounded-[2rem] shadow-xl border border-purple-100 space-y-4 animate-in fade-in slide-in-from-top-4 relative z-20">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 mr-2">שם המשימה</label>
                  <input placeholder="מה עושים?" className="w-full p-3 bg-slate-50 rounded-xl font-bold pointer-events-auto" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 mr-2">פירוט (אופציונלי)</label>
                  <textarea placeholder="פרטים נוספים..." className="w-full p-3 bg-slate-50 rounded-xl text-sm pointer-events-auto" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 mr-2">רמת דחיפות</label>
                    <select className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold pointer-events-auto" value={newTask.urgency} onChange={e => setNewTask({...newTask, urgency: e.target.value})}>
                      <option>דחופה מאד</option><option>גבוהה</option><option>סטנדרטית</option><option>נמוכה</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 mr-2">מי עושה?</label>
                    <select className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold pointer-events-auto" value={newTask.assignee} onChange={e => setNewTask({...newTask, assignee: e.target.value})}>
                      <option>🙋‍♂️ שוקי</option><option>🙋‍♀️ הילה</option><option>👫 כולם</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 mr-2">תאריך יעד</label>
                  <input type="date" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold pointer-events-auto" value={newTask.target_date} onChange={e => setNewTask({...newTask, target_date: e.target.value})} />
                </div>
                <button type="submit" className="w-full bg-emerald-500 text-white p-4 rounded-xl font-black shadow-md active:scale-95 transition-all pointer-events-auto">שמור משימה</button>
              </form>
            )}

            <div className="space-y-4">
              {/* משימות פעילות (לא הסתיימו) */}
              {tasks.filter(t => t.status !== 'סיימתי').map(task => {
                const urgency