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

  const changeView = (view: typeof activeView) => {
    setActiveView(view); setIsMenuOpen(false); setIsSearchOpen(false); setSearchTerm('');
  };

  const updateExactQuantity = (item: Item, newQty: number) => {
    setInventory(prev => prev.map(i => i.id === item.id ? { ...i, quantity: newQty } : i));
    supabase.from('inventory_items').update({ quantity: newQty }).eq('id', item.id).then();
  };

  const handlePlus = (item: Item) => updateExactQuantity(item, item.quantity + 1);
  const handleMinus = (item: Item) => updateExactQuantity(item, Math.max(0, item.quantity - 1));

  const saveItemAI = async (item: Item) => {
    const name = item.item_name || (item as any).name;
    let existing = inventory.find(i => i.item_name === name);
    if (existing) {
      const newQty = Math.max(0, existing.quantity + item.quantity);
      await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', existing.id);
    } else {
      await supabase.from('inventory_items').insert([{ item_name: name, quantity: Math.max(0, item.quantity), category: item.category || 'כללי', location: item.location || 'מזווה', household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }]);
    }
    fetchData();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    showStatus('מעבד...', false);
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text: input }) });
      const data = await res.json();
      for (const item of data.items.filter((i: any) => !i.uncertain)) await saveItemAI(item);
      showStatus('عודכן!', true);
      setInput(''); fetchData();
    } catch { showStatus('שגיאה', true); }
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
      setShowTaskForm(false); 
      fetchData();
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

  const filteredInventory = inventory.filter(i => i.item_name.includes(searchTerm)).sort((a, b) => a.item_name.localeCompare(b.item_name, 'he'));
  const filteredShoppingList = shoppingList.filter(s => s.item_name.includes(searchTerm));

  const activeTasks = tasks.filter(t => t.status !== 'סיימתי');
  const completedTasks = tasks.filter(t => t.status === 'סיימתי');

  return (
    <main className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900" dir="rtl">
      <header className="bg-indigo-600 text-white shadow-xl sticky top-0 z-[1000] p-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black cursor-pointer" onClick={() => changeView('HOME')}>הבית של ניאו 🏠</h1>
          <div className="flex gap-2">
            {activeView !== 'HOME' && <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="p-2 bg-white/20 rounded-lg">🔍</button>}
            <button onClick={() => window.location.reload()} className="p-2 bg-white/20 rounded-lg">🔄</button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 bg-white/20 rounded-lg">☰</button>
          </div>
        </div>
        {isSearchOpen && activeView !== 'HOME' && (
          <div className="max-w-2xl mx-auto mt-3">
            <input type="text" placeholder="חיפוש..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-3 rounded-xl bg-white/20 text-white placeholder-white/60 outline-none" autoFocus />
          </div>
        )}
      </header>

      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-[1001]" onClick={() => setIsMenuOpen(false)}>
          <div className="bg-white w-64 h-full p-6 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button className="w-full text-right font-black py-3 border-b border-slate-100 flex justify-between" onClick={() => changeView('INVENTORY')}><span>מלאי</span><span>📦</span></button>
            <button className="w-full text-right font-black py-3 border-b border-slate-100 flex justify-between" onClick={() => changeView('SHOPPING')}><span>קניות</span><span>🛒</span></button>
            <button className="w-full text-right font-black py-3 border-b border-slate-100 flex justify-between" onClick={() => changeView('TASKS')}><span>משימות</span><span>📌</span></button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto p-4">
        {activeView === 'HOME' && (
          <div className="grid gap-4 mt-10">
            <button onClick={() => changeView('INVENTORY')} className="p-8 bg-white rounded-[2rem] shadow-lg border-b-8 border-teal-500 text-2xl font-black flex justify-between items-center">מלאי 📦</button>
            <button onClick={() => changeView('SHOPPING')} className="p-8 bg-white rounded-[2rem] shadow-lg border-b-8 border-rose-500 text-2xl font-black flex justify-between items-center">קניות 🛒</button>
            <button onClick={() => changeView('TASKS')} className="p-8 bg-white rounded-[2rem] shadow-lg border-b-8 border-indigo-500 text-2xl font-black flex justify-between items-center">משימות 📌</button>
          </div>
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
                const isPlural = task.assignee.includes('כולם');
                return (
                  <div key={task.id} className="bg-white p-6 rounded-[2rem] shadow-md border-r-8 border-indigo-500 relative group">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <h3 className="font-black text-xl text-slate-800 flex-1">{task.title}</h3>
                      <button 
                        onClick={() => deleteTask(task.id!)} 
                        className="px-3 py-1.5 rounded-xl bg-slate-50 text-slate-400 text-[10px] font-black border border-slate-100 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all pointer-events-auto"
                      >
                        מחק 🗑️
                      </button>
                    </div>
                    {task.description && <p className="text-sm text-slate-500 mb-4">{task.description}</p>}
                    <div className="flex flex-wrap gap-2 text-[10px] font-black text-slate-400">
                      <span className="bg-slate-50 px-2 py-1 rounded-full">👤 {task.assignee}</span>
                      <span className="bg-slate-50 px-2 py-1 rounded-full">📅 {task.target_date}</span>
                      <span className="bg-slate-50 px-2 py-1 rounded-full">🔥 {task.urgency}</span>
                    </div>
                    
                    {/* 3 כפתורי סטטוס ישירים */}
                    <div className="flex bg-slate-100 p-1 rounded-2xl mt-5 gap-1">
                      <button 
                        onClick={() => updateTaskStatus(task.id!, 'לא התחלתי')} 
                        className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all ${task.status === 'לא התחלתי' || !task.status ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400'}`}
                      >
                        {isPlural ? 'לא התחלנו' : 'לא התחלתי'}
                      </button>
                      <button 
                        onClick={() => updateTaskStatus(task.id!, 'בתהליך')} 
                        className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all ${task.status === 'בתהליך' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400'}`}
                      >
                        בתהליך
                      </button>
                      <button 
                        onClick={() => updateTaskStatus(task.id!, 'סיימתי')} 
                        className="flex-1 py-2.5 rounded-xl text-[11px] font-black text-slate-400 hover:bg-emerald-500 hover:text-white transition-all"
                      >
                        {isPlural ? 'סיימנו' : 'סיימתי'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ארכיון משימות שהסתיימו */}
            {completedTasks.length > 0 && (
              <div className="mt-16 pt-8 border-t-2 border-slate-200">
                <h3 className="font-black text-slate-400 text-sm uppercase mb-6 pr-2">✅ משימות שהסתיימו:</h3>
                <div className="space-y-4 opacity-70 hover:opacity-100 transition-opacity">
                  {completedTasks.map(task => (
                     <CompletedTaskCard key={task.id} task={task} onRestore={handleRestoreTask} onDelete={deleteTask} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'INVENTORY' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-[2rem] shadow-xl border border-indigo-50">
              <form onSubmit={handleUpdate} className="flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)} placeholder="מה הוספנו/הורדנו מהמלאי?" className="flex-1 p-3 bg-slate-50 rounded-2xl outline-none font-bold" />
                <button type="submit" className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black active:scale-95 transition-all">שלח ✨</button>
              </form>
            </div>
            <div className="grid gap-3">
              {filteredInventory.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-[2rem] shadow-sm flex justify-between items-center border border-slate-100 hover:shadow-md transition-all">
                  <div>
                    <div className="font-black text-lg text-slate-800">{item.item_name}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase">{item.category} • {item.location}</div>
                  </div>
                  <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl" dir="ltr">
                    <button onClick={() => handleMinus(item)} className="w-9 h-9 rounded-xl bg-white text-rose-500 font-black shadow-sm active:scale-90">-</button>
                    <span className="font-black text-xl min-w-[30px] text-center">{item.quantity}</span>
                    <button onClick={() => handlePlus(item)} className="w-9 h-9 rounded-xl bg-white text-emerald-500 font-black shadow-sm active:scale-90">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function CompletedTaskCard({ task, onRestore, onDelete }: any) {
  const today = new Date().toISOString().split('T')[0];
  const [newDate, setNewDate] = useState(today);
  return (
    <div className="bg-slate-100 p-5 rounded-[2rem] border border-slate-200">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-black text-base line-through text-slate-500">{task.title}</h3>
        <button onClick={() => onDelete(task.id!)} className="text-slate-400 text-xs hover:text-red-500">מחק</button>
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