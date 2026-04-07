'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { id?: string; item_name: string; name?: string; quantity: number; category: string; location: string; needs_classification?: boolean };
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

  const [newTask, setNewTask] = useState<Task>({ title: '', description: '', urgency: 'סטנדרטית', assignee: 'כולם', target_date: today, status: 'לא התחלתי' });
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
      // 💡 ניקוי אוטומטי של קטגוריית uncertain - אם נמצא מוצר כזה, הוא עובר לטיפול ידני
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

  const saveItemWithCategory = async (item: any) => {
    const name = item.name || item.item_name;
    const cat = item.category || 'כללי';
    
    // אם הקטגוריה חדשה - נוסיף אותה למאגר
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
      
      // 1. יצירת קטגוריות חדשות אם נתבקשנו
      if (data.new_categories) {
        for (const nc of data.new_categories) {
          if (!categories.includes(nc)) {
            await supabase.from('category_order').insert([{ category_name: nc, sort_order: 99 }]);
          }
        }
      }

      // 2. טיפול בפריטים
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
    } catch { showStatus('❌ שגיאה', true); }
  };

  const updateTaskStatus = async (id: string, newStatus: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
  };

  const deleteTask = async (id: string) => {
    if (confirm('למחוק?')) {
      setTasks(prev => prev.filter(t => t.id !== id));
      await supabase.from('tasks').delete().eq('id', id);
    }
  };

  const activeTasks = tasks.filter(t => t.status !== 'סיימתי');
  const completedTasks = tasks.filter(t => t.status === 'סיימתי');

  return (
    <main className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900" dir="rtl">
      <header className={`bg-indigo-600 text-white shadow-xl sticky top-0 z-[1000] transition-all p-4`}>
        <div className="max-w-2xl mx-auto flex justify-between items-center relative">
          <h1 className="text-2xl font-black cursor-pointer" onClick={() => changeView('HOME')}>הבית של ניאו 🏠</h1>
          <div className="flex items-center gap-2">
            {activeView !== 'HOME' && <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="p-2 rounded-xl bg-black/10 hover:bg-black/20">🔍</button>}
            <button onClick={handleRefresh} className="p-2 rounded-xl bg-black/10 hover:bg-black/20">🔄</button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="px-3 py-2 rounded-xl bg-black/20 font-bold">☰ תפריט</button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 relative z-10">
        {/* שאלות סיווג שקופצות בראש העמוד */}
        {pendingItems.length > 0 && (
          <div className="mb-8 space-y-4">
            {pendingItems.map((item, idx) => (
              <div key={idx} className="bg-amber-50 p-6 rounded-[2rem] border-2 border-amber-200 shadow-lg animate-bounce-short">
                <p className="font-black text-lg mb-4 text-amber-900">איפה לשמור את "{item.name || item.item_name}"?</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {categories.slice(0, 6).map(c => (
                    <button key={c} onClick={() => {
                      saveItemWithCategory({...item, category: c});
                      setPendingItems(prev => prev.filter(p => p !== item));
                    }} className="bg-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm border border-amber-100 hover:bg-amber-500 hover:text-white transition-all">{c}</button>
                  ))}
                </div>
                <input 
                  placeholder="או הקלד קטגוריה חדשה..." 
                  className="w-full p-3 rounded-xl border-none font-bold text-sm shadow-inner"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveItemWithCategory({...item, category: e.currentTarget.value});
                      setPendingItems(prev => prev.filter(p => p !== item));
                    }
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {activeView === 'HOME' && (
          <div className="grid grid-cols-1 gap-4 mt-6">
            <button onClick={() => changeView('INVENTORY')} className="p-10 bg-white rounded-[2rem] shadow-lg border-b-8 border-teal-500 text-2xl font-black flex justify-between items-center">מלאי 📦</button>
            <button onClick={() => changeView('SHOPPING')} className="p-10 bg-white rounded-[2rem] shadow-lg border-b-8 border-rose-500 text-2xl font-black flex justify-between items-center">קניות 🛒</button>
            <button onClick={() => changeView('TASKS')} className="p-10 bg-white rounded-[2rem] shadow-lg border-b-8 border-indigo-500 text-2xl font-black flex justify-between items-center">משימות 📌</button>
          </div>
        )}

        {(activeView === 'INVENTORY' || activeView === 'SHOPPING') && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-[2rem] shadow-xl border border-slate-100">
              <form onSubmit={handleUpdate} className="flex flex-col gap-3">
                <textarea 
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  placeholder="מה להוסיף? (למשל: ביצים בקירור, תוסיף קטגוריה קפואים)" 
                  className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold min-h-[80px]"
                />
                <button type="submit" className="bg-indigo-600 text-white p-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all">עדכן ✨</button>
              </form>
            </div>

            <div className="grid gap-3">
              {(activeView === 'INVENTORY' ? safeInventory : safeShoppingList).map((item: any) => (
                <div key={item.id} className="bg-white p-5 rounded-[2rem] shadow-sm flex justify-between items-center border border-slate-100">
                  <div>
                    <div className="font-black text-lg">{item.item_name}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase">{item.category} • {item.location}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleMinus(item)} className="w-9 h-9 rounded-full bg-slate-100 font-black">-</button>
                    <span className="font-black text-xl">{item.quantity}</span>
                    <button onClick={() => handlePlus(item)} className="w-9 h-9 rounded-full bg-slate-100 font-black">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'TASKS' && (
          <div className="space-y-4">
            {activeTasks.map(task => (
              <div key={task.id} className="bg-white p-6 rounded-[2rem] shadow-md border-r-8 border-indigo-500">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-black text-xl">{task.title}</h3>
                  <button onClick={() => deleteTask(task.id!)} className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black hover:bg-red-500 hover:text-white transition-all">מחק 🗑️</button>
                </div>
                <div className="flex gap-2 mb-4">
                  <button onClick={() => updateTaskStatus(task.id!, 'לא התחלתי')} className={`flex-1 p-2 rounded-xl text-[10px] font-black ${task.status === 'לא התחלתי' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>לא התחלתי</button>
                  <button onClick={() => updateTaskStatus(task.id!, 'בתהליך')} className={`flex-1 p-2 rounded-xl text-[10px] font-black ${task.status === 'בתהליך' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}>בתהליך</button>
                  <button onClick={() => updateTaskStatus(task.id!, 'סיימתי')} className="flex-1 p-2 rounded-xl text-[10px] font-black bg-slate-100">סיימתי</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// פונקציות עזר וקומפוננטות קטנות שהיו חסרות
function InventoryCard({ item, editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName, updateExactQuantity, onPlus, onMinus }: any) {
  return null; // (הקומפוננטה המלאה כבר נמצאת בתוך הלופ הראשי בקוד למעלה)
}