'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { id?: string; item_name: string; quantity: number; category: string; location: string; uncertain?: boolean; options?: string[] };
type Task = { id?: string; title: string; description?: string; urgency: string; assignee: string; target_date: string; status: string };

export default function HomePage() {
  const [activeView, setActiveView] = useState<'HOME' | 'INVENTORY' | 'SHOPPING' | 'TASKS'>('HOME');
  const [invFilter, setInvFilter] = useState<'מקרר' | 'מזווה' | 'הכל'>('הכל');
  const [sortBy, setSortBy] = useState<'name' | 'category'>('category');
  
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

  const [newTask, setNewTask] = useState<Task>({ title: '', description: '', urgency: 'סטנדרטית', assignee: 'כולם', target_date: '', status: 'לא התחלתי' });
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
    
    setInventory(inv ?? []);
    setShoppingList(shop ?? []);
    setCategories(cats?.map(c => c.category_name) ?? []);
    setTasks(tsk ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => window.location.reload();

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;
    const { error } = await supabase.from('tasks').insert([newTask]);
    if (!error) {
      setNewTask({ title: '', description: '', urgency: 'סטנדרטית', assignee: 'כולם', target_date: '', status: 'לא התחלתי' });
      setShowTaskForm(false);
      showStatus('✅ המשימה נוספה!', true);
      fetchData();
    }
  };

  const updateTaskStatus = async (id: string, newStatus: string) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
    fetchData();
  };

  const deleteTask = async (id: string) => {
    if (confirm('למחוק את המשימה?')) {
      await supabase.from('tasks').delete().eq('id', id);
      fetchData();
    }
  };

  const saveEditedName = async (id: string, table: any) => {
    if (editNameValue.trim()) await supabase.from(table).update({ item_name: editNameValue.trim() }).eq('id', id);
    setEditingId(null);
    fetchData();
  };

  const updateExactQuantity = async (item: Item, newQty: number) => {
    await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', item.id);
    const alreadyInShopping = shoppingList.some(s => s.item_name === item.item_name);
    if (newQty <= 2 && newQty < item.quantity && !alreadyInShopping) {
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
    const { data: existing } = await supabase.from('inventory_items').select('*').eq('item_name', name).maybeSingle();
    let newQty = item.quantity;
    if (existing) {
      newQty = action === 'add' ? existing.quantity + item.quantity : Math.max(0, existing.quantity - item.quantity);
      await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', existing.id);
    } else {
      await supabase.from('inventory_items').insert([{ item_name: name, quantity: item.quantity, category: item.category || 'כללי', location: item.location || 'מזווה', household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }]);
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
        for (const item of data.items) await supabase.from('shopping_list').insert([{ item_name: item.name || item.item_name, category: item.category || 'כללי' }]);
        showStatus('✅ נוסף לקניות!', true);
      } else {
        for (const item of data.items.filter((i: any) => !i.uncertain)) await saveItemAI(item, data.action);
        showStatus('✅ עודכן!', true);
      }
      setInput(''); fetchData();
    } catch { showStatus('❌ שגיאה', true); }
  };

  const handleRemoveFromShopping = async (shopItem: any) => {
    setRemovedItems(prev => [...prev, shopItem]);
    await supabase.from('shopping_list').delete().eq('id', shopItem.id);
    fetchData();
  };

  const handleRestoreToShopping = async (shopItem: any) => {
    setRemovedItems(prev => prev.filter(i => i.id !== shopItem.id));
    await supabase.from('shopping_list').insert([{ item_name: shopItem.item_name, category: shopItem.category }]);
    fetchData();
  };

  const filteredInventory = inventory.filter(i => i.item_name.includes(searchTerm) && (invFilter === 'הכל' || i.location === invFilter)).sort((a, b) => a.item_name.localeCompare(b.item_name, 'he'));
  const filteredShoppingList = shoppingList.filter(s => s.item_name.includes(searchTerm)).sort((a, b) => a.item_name.localeCompare(b.item_name, 'he'));
  const displayCategories = Array.from(new Set([...categories, ...inventory.map(i => i.category), ...shoppingList.map(s => s.category)]));

  const headerGradient = activeView === 'HOME' ? 'from-violet-600 via-fuchsia-600 to-orange-500' :
                         activeView === 'INVENTORY' ? 'from-teal-600 to-emerald-500' :
                         activeView === 'SHOPPING' ? 'from-rose-500 to-orange-500' : 'from-indigo-600 to-purple-700';

  return (
    <main className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900" dir="rtl">
      <header className={`bg-gradient-to-r ${headerGradient} text-white p-4 shadow-xl sticky top-0 z-[1000] transition-colors duration-500`}>
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black cursor-pointer drop-shadow-md" onClick={() => setActiveView('HOME')}>Smart Kitchen 🍎</h1>
          <nav className="flex gap-1 items-center">
            <button onClick={handleRefresh} className="p-2 rounded-xl bg-black/10 hover:bg-black/20">🔄</button>
            <button onClick={() => {setActiveView('INVENTORY'); setStatus('');}} className={`px-3 py-2 rounded-xl font-bold text-xs transition-all ${activeView === 'INVENTORY' ? 'bg-white text-teal-700 shadow-lg' : 'bg-black/10'}`}>מלאי</button>
            <button onClick={() => {setActiveView('SHOPPING'); setStatus('');}} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${activeView === 'SHOPPING' ? 'bg-white text-rose-700 shadow-lg' : 'bg-black/10'}`}>קניות</button>
            <button onClick={() => {setActiveView('TASKS'); setStatus('');}} className={`px-3 py-2 rounded-xl font-bold text-xs transition-all ${activeView === 'TASKS' ? 'bg-white text-purple-700 shadow-lg' : 'bg-black/10'}`}>משימות</button>
          </nav>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 relative z-10">
        
        {activeView === 'HOME' && (
          <div className="grid grid-cols-1 gap-4 mt-6">
            <button onClick={() => setActiveView('INVENTORY')} className="p-6 bg-white rounded-[2rem] shadow-lg border-b-8 border-teal-500 flex items-center justify-between active:scale-95 transition-all">
               <div className="text-right"><span className="block text-2xl font-black">📦 מלאי</span><span className="text-slate-400 text-sm">ניהול מקרר ומזווה</span></div>
               <span className="text-4xl">🥦</span>
            </button>
            <button onClick={() => setActiveView('SHOPPING')} className="p-6 bg-white rounded-[2rem] shadow-lg border-b-8 border-rose-500 flex items-center justify-between active:scale-95 transition-all">
               <div className="text-right"><span className="block text-2xl font-black">🛒 קניות</span><span className="text-slate-400 text-sm">{shoppingList.length} פריטים</span></div>
               <span className="text-4xl">🛍️</span>
            </button>
            <button onClick={() => setActiveView('TASKS')} className="p-6 bg-white rounded-[2rem] shadow-lg border-b-8 border-purple-500 flex items-center justify-between active:scale-95 transition-all">
               <div className="text-right"><span className="block text-2xl font-black">📝 משימות</span><span className="text-slate-400 text-sm">{tasks.filter(t => t.status !== 'סיימתי').length} פתוחות</span></div>
               <span className="text-4xl">📌</span>
            </button>
          </div>
        )}

        {/* TASKS VIEW */}
        {activeView === 'TASKS' && (
          <div className="space-y-6">
            <button onClick={() => setShowTaskForm(!showTaskForm)} className="w-full bg-purple-600 text-white p-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all">
              {showTaskForm ? 'סגור טופס ✕' : '+ משימה חדשה'}
            </button>

            {showTaskForm && (
              <form onSubmit={handleAddTask} className="bg-white p-6 rounded-[2rem] shadow-xl border border-purple-100 space-y-4 animate-in fade-in slide-in-from-top-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 mr-2">שם המשימה</label>
                  <input placeholder="מה עושים?" className="w-full p-3 bg-slate-50 rounded-xl font-bold" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 mr-2">פירוט (אופציונלי)</label>
                  <textarea placeholder="פרטים נוספים..." className="w-full p-3 bg-slate-50 rounded-xl text-sm" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 mr-2">רמת דחיפות</label>
                    <select className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold" value={newTask.urgency} onChange={e => setNewTask({...newTask, urgency: e.target.value})}>
                      <option>דחופה מאד</option><option>גבוהה</option><option>סטנדרטית</option><option>נמוכה</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 mr-2">מי עושה?</label>
                    <select className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold" value={newTask.assignee} onChange={e => setNewTask({...newTask, assignee: e.target.value})}>
                      <option>הילה</option><option>שוקי</option><option>כולם</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 mr-2">תאריך יעד</label>
                  <input type="date" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold" value={newTask.target_date} onChange={e => setNewTask({...newTask, target_date: e.target.value})} />
                </div>
                <button type="submit" className="w-full bg-emerald-500 text-white p-4 rounded-xl font-black shadow-md active:scale-95 transition-all">שמור משימה</button>
              </form>
            )}

            <div className="space-y-4">
              {tasks.map(task => {
                const urgencyColor = task.urgency === 'דחופה מאד' ? 'border-red-500 bg-red-50' : task.urgency === 'גבוהה' ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white';
                return (
                  <div key={task.id} className={`p-5 rounded-[2rem] border-r-8 shadow-sm transition-all ${urgencyColor} ${task.status === 'סיימתי' ? 'opacity-50 grayscale' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-black text-lg ${task.status === 'סיימתי' ? 'line-through text-slate-400' : ''}`}>{task.title}</h3>
                      <button onClick={() => deleteTask(task.id!)} className="text-slate-300 text-xs hover:text-red-400">מחק</button>
                    </div>
                    {task.description && <p className="text-sm text-slate-500 mb-3">{task.description}</p>}
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold mb-4">
                      <span className="bg-white/70 px-2 py-1 rounded-full border border-black/5 shadow-sm">👤 {task.assignee}</span>
                      <span className="bg-white/70 px-2 py-1 rounded-full border border-black/5 shadow-sm">📅 {task.target_date || 'ללא תאריך'}</span>
                      <span className="bg-white/70 px-2 py-1 rounded-full border border-black/5 shadow-sm">🔥 {task.urgency}</span>
                    </div>
                    <select 
                      className="w-full p-2 rounded-xl text-xs font-bold bg-white border border-slate-100 shadow-inner" 
                      value={task.status} 
                      onChange={e => updateTaskStatus(task.id!, e.target.value)}
                    >
                      <option>לא התחלתי</option><option>בתהליך</option><option>לקראת סיום</option><option>סיימתי</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* INVENTORY & SHOPPING VIEWS (עם כל התיקונים הקודמים) */}
        {(activeView === 'INVENTORY' || activeView === 'SHOPPING') && (
           <>
            <div className="mb-4 space-y-3">
              <input type="text" placeholder="🔍 חפש מוצר..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-4 rounded-2xl shadow-sm border-none bg-white focus:ring-2 focus:ring-amber-400" />
              <div className="flex bg-white rounded-xl shadow-sm p-1">
                <button onClick={() => setSortBy('category')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${sortBy === 'category' ? 'bg-amber-100 text-amber-900' : 'text-slate-400'}`}>📁 קטגוריות</button>
                <button onClick={() => setSortBy('name')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${sortBy === 'name' ? 'bg-indigo-100 text-indigo-900' : 'text-slate-400'}`}>🔤 א-ת</button>
              </div>
            </div>
            <div className="bg-white p-5 rounded-[2rem] shadow-xl mb-6 border border-slate-50">
              <form onSubmit={handleUpdate} className="space-y-3">
                <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="עדכון חופשי (למשל: 3 חלב, פסטה)" className="w-full p-4 bg-slate-50 rounded-2xl text-sm min-h-[70px] border-none focus:ring-2 focus:ring-amber-300" />
                <button type="submit" className={`w-full p-4 rounded-2xl text-white font-black text-lg active:scale-95 transition-all shadow-md ${activeView === 'INVENTORY' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-rose-600 hover:bg-rose-700'}`}>עדכן ✨</button>
              </form>
              {status && (
                <div className="mt-4 flex justify-center animate-in fade-in slide-in-from-bottom-2">
                  <span className={`px-4 py-2 rounded-full text-xs font-bold shadow-sm ${status.includes('❌') ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                    {status}
                  </span>
                </div>
              )}
            </div>
           </>
        )}

        {activeView === 'INVENTORY' && (
          <section className="space-y-6">
            <div className="flex gap-1 p-1 bg-white rounded-xl shadow-sm border border-slate-100">
              {['הכל', 'מקרר', 'מזווה'].map(f => (
                <button key={f} onClick={() => setInvFilter(f as any)} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${invFilter === f ? 'bg-teal-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>{f}</button>
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
          </section>
        )}

        {activeView === 'SHOPPING' && (
          <section className="space-y-6">
            <div className="grid gap-3">
              {filteredShoppingList.map(s => (
                <ShoppingCard key={s.id} item={s} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} onRemove={handleRemoveFromShopping} />
              ))}
            </div>
            
            {removedItems.length > 0 && (
               <div className="mt-12 pt-8 border-t-2 border-slate-200">
                 <h3 className="font-black text-slate-400 text-[10px] uppercase mb-4 pr-2 tracking-widest">🗑️ הוסרו לאחרונה:</h3>
                 <div className="grid gap-2 opacity-60">
                   {removedItems.map((item, idx) => (
                     <div key={idx} className="flex justify-between items-center bg-slate-100 p-3 rounded-xl border border-dashed border-slate-300">
                       <span className="text-xs line-through text-slate-500 font-medium">{item.item_name}</span>
                       <button onClick={() => handleRestoreToShopping(item)} className="text-[10px] font-black bg-white text-slate-700 px-3 py-1.5 rounded-lg border shadow-sm hover:bg-slate-50 transition-colors">החזר חזרה +</button>
                     </div>
                   ))}
                 </div>
               </div>
            )}
          </section>
        )}

      </div>
    </main>
  );
}

// קומפוננטות עזר
function InventoryCard({ item, editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName, onPlus, onHalf, onMinus }: any) {
  return (
    <div className="flex justify-between items-center bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="text-right flex-1">
        {editingId === item.id ? (
          <div className="flex gap-2">
            <input autoFocus value={editNameValue} onChange={e => setEditNameValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditedName(item.id, 'inventory_items')} className="bg-teal-50 px-3 py-1 rounded-xl w-[140px] font-bold border-b-2 border-teal-500 outline-none" />
            <button onClick={() => saveEditedName(item.id, 'inventory_items')} className="bg-green-100 text-green-700 px-2 rounded-lg text-sm">✅</button>
          </div>
        ) : (
          <span onClick={() => {setEditingId(item.id); setEditNameValue(item.item_name);}} className="block font-bold text-lg text-slate-800 cursor-pointer hover:text-teal-600 transition-colors">{item.item_name}</span>
        )}
        <p className="text-[9px] uppercase font-bold text-slate-400 mt-1">{item.category} • {item.location}</p>
      </div>
      <div className="flex items-center gap-2" dir="ltr">
        <button onClick={onHalf} className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 text-xs font-black shadow-sm hover:bg-amber-200 transition-colors">½</button>
        <button onClick={onMinus} className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 font-black shadow-sm hover:bg-rose-200 transition-colors">-</button>
        <span className={`min-w-[36px] text-center text-xl font-black ${item.quantity <= 2 ? 'text-rose-600' : 'text-slate-700'}`}>{item.quantity}</span>
        <button onClick={onPlus} className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 font-black shadow-sm hover:bg-emerald-200 transition-colors">+</button>
      </div>
    </div>
  );
}

function ShoppingCard({ item, editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName, onRemove }: any) {
  return (
    <div className="flex justify-between items-center bg-white p-5 rounded-[2rem] shadow-sm border border-rose-50 hover:border-rose-100 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        <button onClick={() => onRemove(item)} className="bg-rose-100 text-rose-600 hover:bg-rose-200 px-4 py-2 rounded-2xl text-xs font-black shadow-sm transition-colors">הסר</button>
        {editingId === item.id ? (
          <input autoFocus value={editNameValue} onChange={e => setEditNameValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditedName(item.id, 'shopping_list')} className="bg-rose-50 px-3 py-1 rounded-xl w-[140px] font-bold border-b-2 border-rose-500 outline-none" />
        ) : (
          <span onClick={() => {setEditingId(item.id); setEditNameValue(item.item_name);}} className="font-bold text-lg text-slate-800 cursor-pointer hover:text-rose-600 transition-colors">{item.item_name}</span>
        )}
      </div>
    </div>
  );
}