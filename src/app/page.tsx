'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { id?: string; item_name: string; name?: string; quantity: number; category: string; location: string; needs_classification?: boolean; options?: string[] };
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
    title: '', description: '', urgency: 'סטנדרטית', assignee: 'כולם', target_date: today, status: 'לא התחלתי' 
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
    const [invRes, shopRes, catsRes, tskRes] = await Promise.all([
      supabase.from('inventory_items').select('*'),
      supabase.from('shopping_list').select('*'),
      supabase.from('category_order').select('category_name').order('sort_order'),
      supabase.from('tasks').select('*').order('created_at', { ascending: false })
    ]);
    
    if (invRes.data) {
      const cleanInv = invRes.data.filter((i: any) => {
        if (i.category === 'uncertain' || i.category === 'לא ידוע') {
          setPendingItems(prev => [...prev, { ...i, needs_classification: true }]);
          return false;
        }
        return true;
      });
      setInventory(cleanInv);
    }
    if (shopRes.data) setShoppingList(shopRes.data);
    if (catsRes.data) setCategories(catsRes.data.map(c => c.category_name));
    if (tskRes.data) setTasks(tskRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => window.location.reload();

  const changeView = (view: typeof activeView) => {
    setActiveView(view); setIsMenuOpen(false); setIsSearchOpen(false); setSearchTerm('');
  };

  const updateExactQuantity = (item: Item, newQty: number) => {
    setInventory(prev => prev.map(i => i.id === item.id ? { ...i, quantity: newQty } : i));
    supabase.from('inventory_items').update({ quantity: newQty }).eq('id', item.id).then();
  };

  const handlePlus = (item: Item) => updateExactQuantity(item, item.quantity + 1);
  const handleMinus = (item: Item) => updateExactQuantity(item, Math.max(0, item.quantity - 1));

  const saveItemWithCategory = async (item: any) => {
    const name = item.name || item.item_name;
    const cat = item.category || 'כללי';
    
    if (cat !== 'כללי' && !categories.includes(cat)) {
      await supabase.from('category_order').insert([{ category_name: cat, sort_order: 99 }]);
      setCategories(prev => [...prev, cat]);
    }

    let existing = inventory.find(i => i.item_name === name);
    if (existing) {
      const newQty = Math.max(0, existing.quantity + item.quantity);
      await supabase.from('inventory_items').update({ quantity: newQty, category: cat }).eq('id', existing.id);
    } else {
      await supabase.from('inventory_items').insert([{ 
        item_name: name, 
        quantity: Math.max(0, item.quantity), 
        category: cat, 
        location: item.location || 'מזווה', 
        household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' 
      }]);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    showStatus('מעבד...', false);
    
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text: input }) });
      const data = await res.json();
      
      if (data.new_categories) {
        for (const nc of data.new_categories) {
          if (!categories.includes(nc)) {
            await supabase.from('category_order').insert([{ category_name: nc, sort_order: 99 }]);
          }
        }
      }

      if (data.items) {
        for (const item of data.items) {
          if (item.needs_classification) {
            setPendingItems(prev => [...prev, item]);
          } else {
            await saveItemWithCategory(item);
          }
        }
        showStatus('✅ עודכן!', true);
      }
      
      setInput(''); 
      fetchData();
    } catch { showStatus('❌ שגיאה בחיבור', true); }
  };

  const handleResolvePending = async (item: Item, selectedCategory: string) => {
    const isFridge = ['קפואים', 'קירור', 'טרי', 'מוצרי חלב', 'בשר'].some(c => selectedCategory.includes(c));
    const location = isFridge ? 'מקרר' : 'מזווה';

    if (!categories.includes(selectedCategory)) {
      await supabase.from('category_order').insert([{ category_name: selectedCategory, sort_order: 99 }]);
      setCategories(prev => [...prev, selectedCategory]);
    }

    setPendingItems(prev => prev.filter(p => p.item_name !== item.item_name)); 
    await saveItemWithCategory({...item, category: selectedCategory, location});
    
    if (pendingItems.length <= 1) showStatus('✅ המלאי עודכן!', true);
  };

  const addToShopping = async (item: Item) => {
    await supabase.from('shopping_list').insert([{ item_name: item.item_name || 'פריט', category: item.category || 'כללי' }]);
    setLowStockAlerts(prev => prev.filter(i => i.item_name !== item.item_name));
    showStatus('✅ נוסף לקניות', true); fetchData();
  };

  const handleRemoveFromShopping = async (shopItem: any) => {
    setRemovedItems(prev => [...prev, shopItem]);
    setShoppingList(prev => prev.filter(i => i.id !== shopItem.id));
    await supabase.from('shopping_list').delete().eq('id', shopItem.id);
  };

  const handleRestoreToShopping = async (shopItem: any) => {
    setRemovedItems(prev => prev.filter(i => i.id !== shopItem.id));
    setShoppingList(prev => [...prev, shopItem]);
    await supabase.from('shopping_list').insert([{ item_name: shopItem.item_name || 'פריט', category: shopItem.category || 'כללי' }]);
  };

  const saveEditedName = async (id: string, table: any) => {
    if (editNameValue.trim()) await supabase.from(table).update({ item_name: editNameValue.trim() }).eq('id', id);
    setEditingId(null); fetchData();
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;
    const { error } = await supabase.from('tasks').insert([newTask]);
    if (!error) {
      const dateParts = newTask.target_date.split('-');
      const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      let text = `*משימה חדשה: ${newTask.title}*\n`;
      if (newTask.description) text += `${newTask.description}\n`;
      text += `\n*באחריות:* ${newTask.assignee}`;
      text += `\n*תאריך יעד:* ${formattedDate}`;
      text += `\n*דחיפות:* ${newTask.urgency}`;
      const waLink = `https://wa.me/?text=${encodeURIComponent(text)}`;
      setNewTask({ title: '', description: '', urgency: 'סטנדרטית', assignee: 'כולם', target_date: today, status: 'לא התחלתי' });
      setShowTaskForm(false); fetchData();
      window.location.href = waLink;
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

  const safeInventory = inventory || [];
  const safeShoppingList = shoppingList || [];

  const filteredInventory = safeInventory
    .filter(i => (i.item_name || '').includes(searchTerm) && (invFilter === 'הכל' || i.location === invFilter))
    .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '', 'he'));

  const filteredShoppingList = safeShoppingList
    .filter(s => (s.item_name || '').includes(searchTerm))
    .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '', 'he'));

  const displayCategories = Array.from(new Set([
    ...categories, 
    ...safeInventory.map(i => i.category || 'כללי'), 
    ...safeShoppingList.map(s => s.category || 'כללי')
  ]));

  const activeTasks = tasks.filter(t => t.status !== 'סיימתי');
  const completedTasks = tasks.filter(t => t.status === 'סיימתי');

  const headerGradient = activeView === 'HOME' ? 'from-violet-600 via-fuchsia-600 to-orange-500' : activeView === 'INVENTORY' ? 'from-teal-600 to-emerald-500' : activeView === 'SHOPPING' ? 'from-rose-500 to-orange-500' : 'from-indigo-600 to-purple-700';

  return (
    <main className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900" dir="rtl">
      <header className={`bg-gradient-to-r ${headerGradient} text-white shadow-xl sticky top-0 z-[1000] transition-colors duration-500`}>
        <div className="max-w-2xl mx-auto p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center relative">
            <h1 className="text-2xl font-black cursor-pointer drop-shadow-md" onClick={() => changeView('HOME')}>הבית של ניאו 🏠</h1>
            <div className="flex items-center gap-2">
              {activeView !== 'HOME' && <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="p-2 rounded-xl bg-black/10 hover:bg-black/20 font-black flex items-center justify-center text-lg" title="חפש">🔍</button>}
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
              <input type="text" placeholder={`חיפוש ${activeView === 'INVENTORY' ? 'במלאי' : activeView === 'SHOPPING' ? 'בקניות' : 'במשימות'}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/80 focus:bg-white focus:text-slate-900 focus:placeholder-slate-400 outline-none transition-all shadow-inner font-medium" autoFocus />
            </div>
          )}
        </div>
      </header>

      {isMenuOpen && <div className="fixed inset-0 z-[999]" onClick={() => setIsMenuOpen(false)}></div>}

      <div className="max-w-2xl mx-auto p-4 relative z-10">
        
        {/* אזור התראות סיווג לקטגוריות */}
        {pendingItems.length > 0 && (
          <div className="mb-8 space-y-4">
            {pendingItems.map((item, idx) => (
              <ClassificationCard 
                key={`pending-${idx}`} 
                item={item} 
                categories={categories} 
                onResolve={handleResolvePending} 
                onIgnore={() => {
                  setPendingItems(prev => prev.filter(p => p.item_name !== item.item_name));
                  if (pendingItems.length <= 1) showStatus('✅ המלאי עודכן!', true);
                }}
              />
            ))}
          </div>
        )}

        {activeView === 'HOME' && (
          <div className="grid grid-cols-1 gap-4 mt-6">
            <button onClick={() => changeView('INVENTORY')} className="p-6 bg-white rounded-[2rem] shadow-lg border-b-8 border-teal-500 flex items-center justify-between active:scale-95 transition-all">
               <div className="text-right"><span className="block text-2xl font-black">📦 מלאי</span><span className="text-slate-400 text-sm">ניהול מקרר ומזווה</span></div>
               <span className="text-4xl">🥦</span>
            </button>
            <button onClick={() => changeView('SHOPPING')} className="p-6 bg-white rounded-[2rem] shadow-lg border-b-8 border-rose-500 flex items-center justify-between active:scale-95 transition-all">
               <div className="text-right"><span className="block text-2xl font-black">🛒 קניות</span><span className="text-slate-400 text-sm">{safeShoppingList.length} פריטים</span></div>
               <span className="text-4xl">🛍️</span>
            </button>
            <button onClick={() => changeView('TASKS')} className="p-6 bg-white rounded-[2rem] shadow-lg border-b-8 border-indigo-500 text-2xl font-black flex justify-between items-center">
               <div className="text-right"><span className="block text-2xl font-black">📝 משימות</span><span className="text-slate-400 text-sm">{activeTasks.length} פתוחות</span></div>
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
              <textarea value={input} onChange={e => setInput(e.target.value)} placeholder={activeView === 'INVENTORY' ? "מה הוספנו/הורדנו מהמלאי? (למשל: תוריד 2 חלב, הוסף קטגוריית קירור)" : "מה חסר? (למשל: עגבניות, 3 קולה)"} className="w-full p-4 bg-slate-50 rounded-2xl text-sm min-h-[70px] border-none focus:ring-2 focus:ring-amber-300 pointer-events-auto" />
              <button type="submit" className={`w-full p-4 rounded-2xl text-white font-black text-lg active:scale-95 transition-all shadow-md pointer-events-auto ${activeView === 'INVENTORY' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                 {activeView === 'INVENTORY' ? 'עדכן מלאי ✨' : 'הוסף לקניות 🛒'}
              </button>
            </form>
            {status && (
              <div className="mt-4 flex justify-center animate-in fade-in slide-in-from-bottom-2">
                <span className={`px-4 py-2 rounded-full text-xs font-bold shadow-sm ${status.includes('❌') ? 'bg-red-100 text-red-600' : status.includes('🤔') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{status}</span>
              </div>
            )}
          </div>
        )}

        {lowStockAlerts.length > 0 && activeView === 'INVENTORY' && (
          <div className="mb-6 space-y-3">
            {lowStockAlerts.map(alert => (
              <div key={`alert-${alert.item_name}`} className="bg-rose-50 border-2 border-rose-200 p-4 rounded-2xl flex justify-between items-center">
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
                  const itemsInCat = filteredInventory.filter(i => (i.category || 'כללי') === cat);
                  if (itemsInCat.length === 0) return null;
                  return (
                    <div key={`cat-${cat}`} className="space-y-3">
                      <h3 className="font-black text-teal-700 text-xs uppercase pr-2 border-r-4 border-teal-400">{cat}</h3>
                      <div className="grid gap-3">
                        {itemsInCat.map(item => <InventoryCard key={item.id} item={item} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} updateExactQuantity={updateExactQuantity} onPlus={() => handlePlus(item)} onMinus={() => handleMinus(item)} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredInventory.map(item => <InventoryCard key={item.id} item={item} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} updateExactQuantity={updateExactQuantity} onPlus={() => handlePlus(item)} onMinus={() => handleMinus(item)} />)}
              </div>
            )}
          </section>
        )}

        {activeView === 'SHOPPING' && (
          <section className="space-y-6">
            {sortBy === 'category' ? (
              <div className="space-y-8">
                {displayCategories.map(cat => {
                  const list = filteredShoppingList.filter(s => (s.category || 'כללי') === cat);
                  if (list.length === 0) return null;
                  return (
                    <div key={`shop-cat-${cat}`} className="space-y-3">
                      <h3 className="font-black text-rose-700 text-sm uppercase pr-2 border-r-4 border-rose-400">{cat}</h3>
                      <div className="grid gap-3">
                        {list.map(s => <ShoppingCard key={s.id} item={s} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} onRemove={handleRemoveFromShopping} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredShoppingList.map(s => <ShoppingCard key={s.id} item={s} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} onRemove={handleRemoveFromShopping} />)}
              </div>
            )}
            
            {removedItems.length > 0 && (
               <div className="mt-12 pt-8 border-t-2 border-slate-200">
                 <h3 className="font-black text-slate-400 text-[10px] uppercase mb-4 pr-2 tracking-widest">🗑️ הוסרו לאחרונה:</h3>
                 <div className="grid gap-2 opacity-60">
                   {removedItems.map((item, idx) => (
                     <div key={`removed-${idx}`} className="flex justify-between items-center bg-slate-100 p-3 rounded-xl border border-dashed border-slate-300">
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
          <div className="space-y-8">
            <button onClick={() => setShowTaskForm(!showTaskForm)} className="w-full bg-indigo-600 text-white p-5 rounded-[1.5rem] font-black shadow-lg active:scale-95 transition-all">
              {showTaskForm ? 'סגור טופס ✕' : '+ משימה חדשה'}
            </button>

            {showTaskForm && (
              <form onSubmit={handleAddTask} className="bg-white p-6 rounded-[2rem] shadow-xl space-y-4 border border-indigo-50 relative z-20">
                <input placeholder="שם המשימה" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
                <textarea placeholder="תיאור (אופציונלי)" className="w-full p-4 bg-slate-50 rounded-2xl text-sm" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
                <div className="grid grid-cols-2 gap-3">
                  <select className="p-4 bg-slate-50 rounded-2xl font-bold text-sm" value={newTask.urgency} onChange={e => setNewTask({...newTask, urgency: e.target.value})}>
                    <option>דחופה מאד</option><option>גבוהה</option><option>סטנדרטית</option><option>נמוכה</option>
                  </select>
                  <select className="p-4 bg-slate-50 rounded-2xl font-bold text-sm" value={newTask.assignee} onChange={e => setNewTask({...newTask, assignee: e.target.value})}>
                    <option>שוקי</option><option>הילה</option><option>כולם</option>
                  </select>
                </div>
                <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold" value={newTask.target_date} onChange={e => setNewTask({...newTask, target_date: e.target.value})} />
                <button type="submit" className="w-full bg-emerald-500 text-white p-5 rounded-2xl font-black shadow-md">שמור ושלח לוואטסאפ 💬</button>
              </form>
            )}

            <div className="space-y-4">
              {activeTasks.map(task => {
                const urgencyColor = task.urgency === 'דחופה מאד' ? 'border-red-500 bg-red-50' : task.urgency === 'גבוהה' ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white';
                const isPlural = (task.assignee || '').includes('כולם');
                return (
                  <div key={task.id} className={`bg-white p-6 rounded-[2rem] shadow-md border-r-8 ${urgencyColor} relative group`}>
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <h3 className="font-black text-xl text-slate-800 flex-1">{task.title}</h3>
                      <button onClick={() => deleteTask(task.id!)} className="px-3 py-1.5 rounded-xl bg-slate-50 text-slate-400 text-[10px] font-black border border-slate-100 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all pointer-events-auto">מחק 🗑️</button>
                    </div>
                    {task.description && <p className="text-sm text-slate-500 mb-4">{task.description}</p>}
                    <div className="flex flex-wrap gap-2 text-[10px] font-black text-slate-400">
                      <span className="bg-slate-50 px-2 py-1 rounded-full">👤 {task.assignee}</span>
                      <span className="bg-slate-50 px-2 py-1 rounded-full">📅 {task.target_date}</span>
                      <span className="bg-slate-50 px-2 py-1 rounded-full">🔥 {task.urgency}</span>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-2xl mt-5 gap-1">
                      <button onClick={() => updateTaskStatus(task.id!, 'לא התחלתי')} className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all ${task.status === 'לא התחלתי' || !task.status ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400'}`}>{isPlural ? 'לא התחלנו' : 'לא התחלתי'}</button>
                      <button onClick={() => updateTaskStatus(task.id!, 'בתהליך')} className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all ${task.status === 'בתהליך' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400'}`}>בתהליך</button>
                      <button onClick={() => updateTaskStatus(task.id!, 'סיימתי')} className="flex-1 py-2.5 rounded-xl text-[11px] font-black text-slate-400 hover:bg-emerald-500 hover:text-white transition-all">{isPlural ? 'סיימנו' : 'סיימתי'}</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {completedTasks.length > 0 && (
              <div className="mt-16 pt-8 border-t-2 border-slate-200">
                <h3 className="font-black text-slate-400 text-sm uppercase mb-6 pr-2">✅ משימות שהסתיימו:</h3>
                <div className="space-y-4 opacity-70 hover:opacity-100 transition-opacity">
                  {completedTasks.map(task => <CompletedTaskCard key={task.id} task={task} onRestore={handleRestoreTask} onDelete={deleteTask} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function ClassificationCard({ item, categories, onResolve, onIgnore }: any) {
  const [customCat, setCustomCat] = useState('');
  const quickOptions = Array.from(new Set([...categories, 'טרי', 'קפואים', 'שימורים', 'יבשים'])).slice(0, 5);

  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-amber-100">
      <div className="flex justify-between items-center mb-3">
        <p className="font-black text-lg text-slate-800">איך לסווג: <span className="text-amber-600">{item.item_name || item.name}</span>?</p>
        <button onClick={onIgnore} className="text-slate-400 hover:text-slate-600 text-xs font-bold bg-slate-100 px-3 py-1 rounded-full">התעלם</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {quickOptions.map(opt => (
          <button key={opt} onClick={() => onResolve(item, opt)} className="bg-amber-50 hover:bg-amber-400 hover:text-amber-900 text-amber-700 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm border border-amber-100">
            {opt as string}
          </button>
        ))}
      </div>
      <div className="flex gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100 focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-100 transition-all">
        <input 
          value={customCat} 
          onChange={e => setCustomCat(e.target.value)} 
          placeholder="או הקלד קטגוריה חדשה..." 
          className="flex-1 bg-transparent px-2 outline-none font-bold text-sm text-slate-700" 
          onKeyDown={(e) => e.key === 'Enter' && customCat && onResolve(item, customCat)}
        />
        <button 
          onClick={() => customCat && onResolve(item, customCat)} 
          className={`px-4 py-2 rounded-xl font-black text-sm transition-all ${customCat ? 'bg-amber-400 text-amber-900 shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
        >
          שמור
        </button>
      </div>
    </div>
  );
}

function CompletedTaskCard({ task, onRestore, onDelete }: any) {
  const today = new Date().toISOString().split('T')[0];
  const [newDate, setNewDate] = useState(today);
  return (
    <div className="bg-slate-100 p-5 rounded-[2rem] border border-slate-200">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-black text-base line-through text-slate-500 flex-1">{task.title}</h3>
        <button onClick={() => onDelete(task.id!)} className="px-3 py-1.5 rounded-xl bg-white text-slate-500 text-[11px] font-black border border-slate-200 hover:bg-red-50 hover:text-red-700 transition-colors pointer-events-auto shadow-sm">מחק 🗑️</button>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col gap-2">
        <label className="text-[10px] font-black text-slate-400">תאריך יעד חדש לשחזור:</label>
        <div className="flex gap-2">
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="flex-1 p-2 rounded-xl text-xs font-black bg-white border border-slate-200" />
          <button onClick={() => onRestore(task.id!, newDate)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-[10px] font-black shadow-sm hover:bg-slate-300 transition-colors">שחזר ↺</button>
        </div>
      </div>
    </div>
  );
}

function InventoryCard({ item, editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName, updateExactQuantity, onPlus, onMinus }: any) {
  return (
    <div className="flex justify-between items-center bg-white p-4 rounded-[1.5rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="text-right flex-1">
        {editingId === item.id ? (
          <div className="flex items-center gap-2 mb-1">
            <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEditedName(item.id, 'inventory_items')} className="border-b-2 border-teal-500 bg-teal-50 px-2 py-1 outline-none font-bold text-lg w-[120px] pointer-events-auto" />
            <button onClick={() => saveEditedName(item.id, 'inventory_items')} className="bg-green-100 text-green-700 p-2 rounded-lg pointer-events-auto shadow-sm">✅</button>
          </div>
        ) : (
          <span onClick={() => {setEditingId(item.id); setEditNameValue(item.item_name || 'פריט לא ידוע');}} className="block font-bold text-lg text-slate-800 cursor-pointer hover:text-teal-600 hover:underline decoration-dashed decoration-slate-300 pointer-events-auto transition-colors">{item.item_name || 'פריט לא ידוע'}</span>
        )}
        <span className="text-[10px] uppercase font-bold text-slate-400">{item.category || 'כללי'} • {item.location || 'מזווה'}</span>
      </div>
      <div className="flex items-center gap-2" dir="ltr">
        <button onClick={onMinus} className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 font-black pointer-events-auto shadow-sm hover:bg-rose-200 transition-colors active:scale-90">-</button>
        <div className="relative flex items-center justify-center min-w-[36px]">
          <select value={Math.floor(item.quantity || 0)} onChange={(e) => updateExactQuantity(item, Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer pointer-events-auto">
            {[...Array(21).keys()].map(num => <option key={num} value={num}>{num}</option>)}
          </select>
          <span className={`text-xl font-black pointer-events-none ${(item.quantity || 0) <= 2 ? 'text-rose-600' : 'text-slate-700'}`}>{item.quantity || 0}</span>
        </div>
        <button onClick={onPlus} className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 font-black pointer-events-auto shadow-sm hover:bg-emerald-200 transition-colors active:scale-90">+</button>
      </div>
    </div>
  );
}

function ShoppingCard({ item, editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName, onRemove }: any) {
  return (
    <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-[1.5rem] shadow-sm border border-rose-50 hover:border-rose-100 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        <button onClick={() => onRemove(item)} className="bg-rose-100 text-rose-600 hover:bg-rose-200 px-4 py-2 rounded-2xl text-xs font-black shadow-sm pointer-events-auto transition-colors">הסר</button>
        {editingId === item.id ? (
          <div className="flex items-center gap-2">
            <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEditedName(item.id, 'shopping_list')} className="border-b-2 border-rose-500 bg-rose-50 px-2 py-1 outline-none font-bold text-lg w-[140px] pointer-events-auto" />
            <button onClick={() => saveEditedName(item.id, 'shopping_list')} className="bg-green-100 text-green-700 p-2 rounded-lg pointer-events-auto shadow-sm">✅</button>
          </div>
        ) : (
          <span onClick={() => {setEditingId(item.id); setEditNameValue(item.item_name || 'פריט לא ידוע');}} className="font-bold text-slate-800 text-lg cursor-pointer hover:text-rose-600 hover:underline decoration-dashed decoration-slate-300 pointer-events-auto transition-colors">{item.item_name || 'פריט לא ידוע'}</span>
        )}
      </div>
    </div>
  );
}