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
      showStatus('עודכן!', true);
      setInput(''); fetchData();
    } catch { showStatus('שגיאה', true); }
  };

  // ----- גרסת וואטסאפ נקייה לחלוטין -----
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;
    
    const { error } = await supabase.from('tasks').insert([newTask]);
    
    if (!error) {
      const dateParts = newTask.target_date.split('-');
      const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      
      // בניית טקסט ללא שום אימוג'י או תווים מיוחדים
      let text = `משימה חדשה: ${newTask.title}\n`;
      if (newTask.description) text += `תיאור: ${newTask.description}\n`;
      text += `אחראי: ${newTask.assignee}\n`;
      text += `תאריך: ${formattedDate}\n`;
      text += `דחיפות: ${newTask.urgency}`;

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

  const deleteTask = async (id: string) => {
    if (confirm('למחוק את המשימה?')) {
      setTasks(prev => prev.filter(t => t.id !== id));
      await supabase.from('tasks').delete().eq('id', id);
    }
  };

  const filteredInventory = inventory.filter(i => i.item_name.includes(searchTerm)).sort((a, b) => a.item_name.localeCompare(b.item_name, 'he'));
  const filteredShoppingList = shoppingList.filter(s => s.item_name.includes(searchTerm));

  return (
    <main className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900" dir="rtl">
      <header className="bg-indigo-600 text-white shadow-xl sticky top-0 z-[1000] p-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black cursor-pointer" onClick={() => changeView('HOME')}>הבית של ניאו</h1>
          <div className="flex gap-2">
            {activeView !== 'HOME' && <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="p-2 bg-white/20 rounded-lg">🔍</button>}
            <button onClick={() => window.location.reload()} className="p-2 bg-white/20 rounded-lg">🔄</button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 bg-white/20 rounded-lg">☰</button>
          </div>
        </div>
        {isSearchOpen && activeView !== 'HOME' && (
          <div className="max-w-2xl mx-auto mt-3">
            <input type="text" placeholder="חיפוש..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 rounded-lg bg-white/20 text-white placeholder-white/60 outline-none" autoFocus />
          </div>
        )}
      </header>

      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-[1001]" onClick={() => setIsMenuOpen(false)}>
          <div className="bg-white w-64 h-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <button className="w-full text-right font-bold py-2" onClick={() => changeView('INVENTORY')}>מלאי 📦</button>
            <button className="w-full text-right font-bold py-2" onClick={() => changeView('SHOPPING')}>קניות 🛒</button>
            <button className="w-full text-right font-bold py-2" onClick={() => changeView('TASKS')}>משימות 📌</button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto p-4">
        {activeView === 'HOME' && (
          <div className="grid gap-4 mt-10">
            <button onClick={() => changeView('INVENTORY')} className="p-8 bg-white rounded-3xl shadow-lg border-b-4 border-teal-500 text-2xl font-black">מלאי 📦</button>
            <button onClick={() => changeView('SHOPPING')} className="p-8 bg-white rounded-3xl shadow-lg border-b-4 border-rose-500 text-2xl font-black">קניות 🛒</button>
            <button onClick={() => changeView('TASKS')} className="p-8 bg-white rounded-3xl shadow-lg border-b-4 border-indigo-500 text-2xl font-black">משימות 📌</button>
          </div>
        )}

        {activeView === 'TASKS' && (
          <div className="space-y-6">
            <button onClick={() => setShowTaskForm(!showTaskForm)} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold shadow-lg">
              {showTaskForm ? 'סגור' : '+ משימה חדשה'}
            </button>

            {showTaskForm && (
              <form onSubmit={handleAddTask} className="bg-white p-6 rounded-3xl shadow-xl space-y-4 border border-indigo-100">
                <input placeholder="שם המשימה" className="w-full p-3 bg-slate-50 rounded-xl font-bold" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
                <textarea placeholder="תיאור (אופציונלי)" className="w-full p-3 bg-slate-50 rounded-xl" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
                <div className="grid grid-cols-2 gap-3">
                  <select className="p-3 bg-slate-50 rounded-xl font-bold" value={newTask.urgency} onChange={e => setNewTask({...newTask, urgency: e.target.value})}>
                    <option>דחופה מאד</option><option>גבוהה</option><option>סטנדרטית</option><option>נמוכה</option>
                  </select>
                  <select className="p-3 bg-slate-50 rounded-xl font-bold" value={newTask.assignee} onChange={e => setNewTask({...newTask, assignee: e.target.value})}>
                    <option>שוקי</option><option>הילה</option><option>כולם</option>
                  </select>
                </div>
                <input type="date" className="w-full p-3 bg-slate-50 rounded-xl" value={newTask.target_date} onChange={e => setNewTask({...newTask, target_date: e.target.value})} />
                <button type="submit" className="w-full bg-emerald-500 text-white p-4 rounded-xl font-bold">שמור ושלח לוואטסאפ</button>
              </form>
            )}

            <div className="space-y-4">
              {tasks.filter(t => t.status !== 'סיימתי').map(task => (
                <div key={task.id} className="bg-white p-5 rounded-3xl shadow-md border-r-8 border-indigo-500">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg">{task.title}</h3>
                    <button onClick={() => deleteTask(task.id!)} className="text-slate-300 text-xs">מחק</button>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{task.description}</p>
                  <div className="flex gap-2 mt-3 text-xs font-bold text-slate-400">
                    <span>👤 {task.assignee}</span>
                    <span>📅 {task.target_date}</span>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => updateTaskStatus(task.id!, 'בתהליך')} className={`flex-1 p-2 rounded-lg text-xs font-bold ${task.status === 'בתהליך' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}>בתהליך</button>
                    <button onClick={() => updateTaskStatus(task.id!, 'סיימתי')} className="flex-1 p-2 rounded-lg bg-slate-100 text-xs font-bold hover:bg-emerald-500 hover:text-white">סיימתי</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'INVENTORY' && (
          <div className="space-y-4">
            <form onSubmit={handleUpdate} className="bg-white p-4 rounded-2xl shadow-md flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)} placeholder="עדכן מלאי..." className="flex-1 p-2 outline-none" />
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-xl">שלח</button>
            </form>
            <div className="grid gap-3">
              {filteredInventory.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center border border-slate-100">
                  <div>
                    <div className="font-bold text-lg">{item.item_name}</div>
                    <div className="text-xs text-slate-400">{item.category} | {item.location}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleMinus(item)} className="w-8 h-8 rounded-full bg-slate-100 font-bold">-</button>
                    <span className="font-black text-xl">{item.quantity}</span>
                    <button onClick={() => handlePlus(item)} className="w-8 h-8 rounded-full bg-slate-100 font-bold">+</button>
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