'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { id?: string; item_name: string; name?: string; quantity: number; category: string; location: string; needs_classification?: boolean; options?: string[]; removeAll?: boolean };
type Task = { id?: string; title: string; description?: string; urgency: string; assignee: string; target_date: string; status: string; depends_on_task_id?: string | null };
type EditTaskFocus = 'title' | 'urgency' | 'date' | 'assignee' | 'depends' | 'all';
type EquipmentItem = { id?: string; list_type: string; category: string; item_name: string; is_packed: boolean };

type DisambiguationTask = { originalName: string; matches: Item[]; quantityToSubtract: number; removeAll: boolean; };
type WordChoiceTask = { originalName: string; options: string[]; item: any };

export default function HomePage() {
  const today = new Date().toISOString().split('T')[0];
  const [activeView, setActiveView] = useState<'HOME' | 'INVENTORY' | 'SHOPPING' | 'TASKS' | 'EQUIPMENT'>('HOME');
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
  const [disambiguationItems, setDisambiguationItems] = useState<DisambiguationTask[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<Item[]>([]);
  const [duplicateShoppingAlerts, setDuplicateShoppingAlerts] = useState<string[]>([]);
  const [wordChoiceTasks, setWordChoiceTasks] = useState<WordChoiceTask[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [equipListType, setEquipListType] = useState<'חו"ל' | 'חד"כ' | 'סופ"ש'>('חד"כ');
  const [showResetDialog, setShowResetDialog] = useState<string | null>(null);
  const EQUIP_CATEGORIES = ['ניאו', 'חשמל', 'בגדים', 'תרופות', 'נעליים', 'ציוד נוסף'];

  const [newTask, setNewTask] = useState<Task>({
    title: '', description: '', urgency: 'סטנדרטית', assignee: 'כולם', target_date: today, status: 'לא התחלתי', depends_on_task_id: null
  });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskDraft, setEditTaskDraft] = useState<Task | null>(null);
  const [editTaskFocus, setEditTaskFocus] = useState<EditTaskFocus>('all');
  const [poofingTaskId, setPoofingTaskId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    fireworks: {
      top: number;
      left: number;
      delay: number;
      color: string;
      secondaryColor: string;
      streaks: { angle: number; fly: number; width: number; height: number }[];
      sparks: { sx: number; sy: number; size: number; delay: number }[];
    }[];
    balloons: { left: number; delay: number; bx: number; br: number; emoji: string }[];
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingCatItemId, setEditingCatItemId] = useState<string | null>(null);
  const [editCatValue, setEditCatValue] = useState('');
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showStatus = (msg: string, autoClear: boolean = false) => {
    setStatus(msg);
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    if (autoClear) statusTimeoutRef.current = setTimeout(() => setStatus(''), 4000);
  };

  const fetchData = async () => {
    const [invRes, shopRes, catsRes, tskRes, equipRes] = await Promise.all([
      supabase.from('inventory_items').select('*'),
      supabase.from('shopping_list').select('*'),
      supabase.from('category_order').select('category_name').order('sort_order'),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('equipment_items').select('*')
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
    if (equipRes.data) setEquipmentItems(equipRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => window.location.reload();

  const changeView = (view: typeof activeView) => {
    setActiveView(view); setIsMenuOpen(false); setIsSearchOpen(false); setSearchTerm('');
  };

  const updateExactQuantity = async (item: Item, newQty: number) => {
    const finalQty = Math.max(0, newQty);
    if (finalQty === item.quantity) return;
    const now = new Date().toISOString();
    setInventory(prev => prev.map(i => i.id === item.id ? { ...i, quantity: finalQty, updated_at: now } : i));
    await supabase.from('inventory_items').update({ quantity: finalQty, updated_at: now }).eq('id', item.id);
    
    if (finalQty <= 2 && finalQty < item.quantity) {
      const alreadyInShopping = shoppingList.some(s => s.item_name === item.item_name);
      if (!alreadyInShopping) {
        setLowStockAlerts(prev => [...prev.filter(i => i.item_name !== item.item_name), { ...item, quantity: finalQty }]);
      }
    }
  };

  const handlePlus = (item: Item) => updateExactQuantity(item, item.quantity + 1);
  const handleMinus = (item: Item) => updateExactQuantity(item, item.quantity - 1);

  const deleteInventoryItem = async (item: Item) => {
    if (!confirm(`למחוק לצמיתות את "${item.item_name}"?`)) return;
    setInventory(prev => prev.filter(i => i.id !== item.id));
    await supabase.from('inventory_items').delete().eq('id', item.id);
  };

  const deleteShoppingItem = async (shopItem: any) => {
    if (!confirm(`למחוק לצמיתות את "${shopItem.item_name}"?`)) return;
    setShoppingList(prev => prev.filter(i => i.id !== shopItem.id));
    await supabase.from('shopping_list').delete().eq('id', shopItem.id);
  };

  const moveShoppingToInventory = async (shopItem: any, qty: number) => {
    const existing = inventory.find(i => i.item_name === shopItem.item_name);
    if (existing) {
      const newQty = (existing.quantity || 0) + qty;
      await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', existing.id);
    } else {
      await supabase.from('inventory_items').insert([{
        item_name: shopItem.item_name, quantity: qty, category: shopItem.category || 'כללי',
        location: 'מזווה', household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'
      }]);
    }
    await supabase.from('shopping_list').delete().eq('id', shopItem.id);
    fetchData();
    showStatus(`✅ ${shopItem.item_name} הועבר למלאי`, true);
  };

  const executeRemoval = async (invItem: Item, qtyToSubtract: number, removeAll: boolean) => {
    const newQty = removeAll ? 0 : invItem.quantity + qtyToSubtract; // qtyToSubtract is negative
    await updateExactQuantity(invItem, newQty);
  };

  const saveItemWithCategory = async (item: any) => {
    const name = item.name || item.item_name || 'פריט לא ידוע';
    let cat = item.category || 'כללי';
    if (cat.toLowerCase() === 'uncertain' || cat === 'לא ידוע') cat = 'כללי';

    if (cat !== 'כללי' && !categories.includes(cat)) {
      await supabase.from('category_order').insert([{ category_name: cat, sort_order: 99 }]);
      setCategories(prev => Array.from(new Set([...prev, cat])));
    }

    if (activeView === 'INVENTORY') {
      let existing = inventory.find(i => i.item_name === name);
      if (existing) {
        const newQty = Math.max(0, existing.quantity + (item.quantity || 1));
        await supabase.from('inventory_items').update({ quantity: newQty, category: cat }).eq('id', existing.id);
      } else {
        await supabase.from('inventory_items').insert([{ 
          item_name: name, quantity: Math.max(0, item.quantity || 1), category: cat, location: item.location || 'מזווה', household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' 
        }]);
      }
    } else if (activeView === 'SHOPPING') {
      const finalName = item.quantity > 1 ? `${name} (${item.quantity})` : name;
      await supabase.from('shopping_list').insert([{ item_name: finalName, category: cat }]);
    }
    fetchData();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    showStatus('מעבד...', false);
    
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text: input, categories: categories }) });
      const data = await res.json();
      
      if (data.new_categories && data.new_categories.length > 0) {
        for (const nc of data.new_categories) {
          if (!categories.includes(nc)) {
            await supabase.from('category_order').insert([{ category_name: nc, sort_order: 99 }]);
            setCategories(prev => Array.from(new Set([...prev, nc])));
          }
        }
      }

      if (data.items && data.items.length > 0) {
        const certainItems: any[] = [];
        const uncertainItems: any[] = [];
        const ambiguousRemovals: DisambiguationTask[] = [];
        let movedCount = 0;

        const duplicateShoppingItems: string[] = [];
        const wordChoiceTasksLocal: WordChoiceTask[] = [];
        const normalizeShopName = (n: string) => (n || '').replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
        const stripPrefix = (w: string) => w.replace(/^(ה|ב|ל|מ|ש|ו|כ)/, '');

        for (const item of data.items) {
          const name = item.name || item.item_name || 'פריט';
          const isRemoval = (item.quantity || 0) < 0 || item.removeAll;
          const cat = (item.category || '').toLowerCase();

          // לוגיקת העברה בין קטגוריות (מלאי + קניות)
          if (item.moveToCategory) {
            const cleanName = name.replace(/^(את כל ה|כל ה|את ה|ה)/g, '').trim().toLowerCase();
            const table = activeView === 'SHOPPING' ? 'shopping_list' : 'inventory_items';
            const sourceList = activeView === 'SHOPPING' ? shoppingList : inventory;
            const matches = sourceList.filter(i => (i.item_name || '').toLowerCase().includes(cleanName));
            for (const match of matches) {
              await supabase.from(table).update({ category: item.moveToCategory }).eq('id', match.id);
            }
            if (matches.length === 0) showStatus(`לא מצאתי "${name}" ברשימה`, true);
            else movedCount += matches.length;
          }
          // לוגיקת המחיקה: חיפוש עם ניקוי תחיליות עבריות וסיווג כפילויות
          else if (activeView === 'INVENTORY' && isRemoval) {
            const cleanName = name.replace(/^(את כל ה|כל ה|את ה|ה)/g, '').trim().toLowerCase();
            const matches = inventory.filter(i => (i.item_name || '').toLowerCase().includes(cleanName));
            // אם יש התאמה מדויקת אחת בלבד - בצע ישירות
            const exactMatch = matches.find(i => (i.item_name || '').toLowerCase() === cleanName);
            if (exactMatch && matches.length > 1) {
              // יש התאמה מדויקת אבל גם אחרות - שאל את המשתמש
              ambiguousRemovals.push({ originalName: name, matches, quantityToSubtract: item.quantity, removeAll: item.removeAll });
            } else if (matches.length === 1) {
              await executeRemoval(matches[0], item.quantity, item.removeAll);
            } else if (matches.length > 1) {
              ambiguousRemovals.push({ originalName: name, matches, quantityToSubtract: item.quantity, removeAll: item.removeAll });
            } else {
              showStatus(`לא מצאתי "${name}" במלאי`, true);
            }
          } 
          // הוספת פריט (רגיל)
          else {
            // בדיקת כפילות ברשימת קניות
            if (activeView === 'SHOPPING') {
              const baseName = normalizeShopName(name);
              const existsInList = shoppingList.some(s => normalizeShopName(s.item_name || '') === baseName);
              const alreadyQueued = certainItems.some(c => normalizeShopName(c.name || c.item_name || '') === baseName)
                || uncertainItems.some(u => normalizeShopName(u.name || u.item_name || '') === baseName);
              if (existsInList || alreadyQueued) {
                duplicateShoppingItems.push(name);
                continue;
              }
              // בדיקת מילים-מוצרים-בפני-עצמן
              const words = baseName.split(/\s+/).filter(w => w.length > 1);
              if (words.length > 1) {
                const knownNames = new Set<string>();
                inventory.forEach(i => knownNames.add(normalizeShopName(i.item_name || '')));
                shoppingList.forEach(s => knownNames.add(normalizeShopName(s.item_name || '')));
                const matchingWords: string[] = [];
                for (const w of words) {
                  const candidates = [w, stripPrefix(w)].filter(c => c.length > 1);
                  for (const c of candidates) {
                    if (knownNames.has(c) && !matchingWords.includes(c)) matchingWords.push(c);
                  }
                }
                if (matchingWords.length > 0) {
                  wordChoiceTasksLocal.push({ originalName: name, options: matchingWords, item });
                  continue;
                }
              }
            }
            if (item.needs_classification || cat === 'uncertain' || cat === 'לא ידוע' || cat === 'null') {
              uncertainItems.push(item);
            } else {
              certainItems.push(item);
            }
          }
        }

        // ביצוע השמירות
        for (const item of certainItems) await saveItemWithCategory(item);
        
        // עדכון סטייטים לחלונות הקופצים
        if (duplicateShoppingItems.length > 0) {
          setDuplicateShoppingAlerts(prev => Array.from(new Set([...prev, ...duplicateShoppingItems])));
        }
        if (wordChoiceTasksLocal.length > 0) {
          setWordChoiceTasks(prev => [...prev, ...wordChoiceTasksLocal]);
        }
        if (ambiguousRemovals.length > 0) {
          setDisambiguationItems(prev => [...prev, ...ambiguousRemovals]);
          showStatus(`יש כמה אפשרויות`, false);
        } else if (wordChoiceTasksLocal.length > 0 && certainItems.length === 0 && uncertainItems.length === 0) {
          showStatus(`🤔 איזה מהמוצרים?`, false);
        } else if (uncertainItems.length > 0) {
          setPendingItems(uncertainItems.map((i: any) => ({ ...i, item_name: i.name || i.item_name || 'פריט' })));
          showStatus(`🤔 נדרש סיווג`, false);
        } else if (movedCount > 0) {
          fetchData();
          showStatus(`✅ ${movedCount} פריטים הועברו!`, true);
        } else if (duplicateShoppingItems.length > 0 && certainItems.length === 0) {
          showStatus(`⚠️ כבר ברשימה`, false);
        } else {
          showStatus('✅ עודכן!', true);
        }
      }
      
      setInput(''); 
    } catch { showStatus('❌ שגיאה בחיבור', true); }
  };

  const handleResolvePending = async (item: Item, selectedCategory: string) => {
    setPendingItems(prev => prev.filter(p => p.item_name !== item.item_name)); 
    await saveItemWithCategory({...item, category: selectedCategory});
    if (pendingItems.length <= 1 && disambiguationItems.length === 0) showStatus('✅ מעודכן!', true);
  };

  const handleResolveDisambiguation = async (task: DisambiguationTask, chosenItem: Item | 'ALL') => {
    if (chosenItem === 'ALL') {
      for (const match of task.matches) {
        await executeRemoval(match, task.quantityToSubtract, task.removeAll);
      }
    } else {
      await executeRemoval(chosenItem, task.quantityToSubtract, task.removeAll);
    }
    setDisambiguationItems(prev => prev.filter(t => t !== task));
    if (disambiguationItems.length <= 1 && pendingItems.length === 0) showStatus('✅ המלאי עודכן!', true);
  };

  const handleResolveWordChoice = async (task: WordChoiceTask, chosen: string) => {
    setWordChoiceTasks(prev => prev.filter(t => t !== task));
    const baseName = (chosen || '').replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
    const existsInList = shoppingList.some(s => (s.item_name || '').replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase() === baseName);
    if (existsInList) {
      setDuplicateShoppingAlerts(prev => Array.from(new Set([...prev, chosen])));
      showStatus(`⚠️ כבר ברשימה`, false);
      return;
    }
    await saveItemWithCategory({ ...task.item, name: chosen, item_name: chosen });
    if (wordChoiceTasks.length <= 1) showStatus('✅ נוסף לקניות', true);
  };

  const addToShopping = async (item: Item) => {
    await supabase.from('shopping_list').insert([{ item_name: item.item_name || 'פריט', category: item.category || 'כללי' }]);
    setLowStockAlerts(prev => prev.filter(i => i.item_name !== item.item_name));
    showStatus('✅ נוסף לקניות', true); fetchData();
  };

  const saveEditedName = async (id: string, table: any) => {
    if (editNameValue.trim()) await supabase.from(table).update({ item_name: editNameValue.trim() }).eq('id', id);
    setEditingId(null); fetchData();
  };

  const saveEditedCategory = async (id: string, table: string, directValue?: string) => {
    const val = (directValue || editCatValue).trim();
    if (val) await supabase.from(table).update({ category: val }).eq('id', id);
    setEditingCatItemId(null); fetchData();
  };

  const urgencyEmoji = (u: string): string => {
    if (u === 'דחופה מאד') return '🚨';
    if (u === 'גבוהה') return '🔥';
    if (u === 'סטנדרטית') return '📋';
    if (u === 'נמוכה') return '💤';
    return '📋';
  };

  const buildWhatsAppLink = (t: Task) => {
    const dateParts = t.target_date.split('-');
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    let text = `*משימה חדשה: ${t.title}*\n`;
    if (t.description) text += `${t.description}\n`;
    text += `\n*באחריות:* ${t.assignee}`;
    text += `\n*תאריך יעד:* ${formattedDate}`;
    text += `\n*דחיפות:* ${t.urgency}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const persistNewTask = async (sendToWhatsApp: boolean) => {
    if (!newTask.title) return;
    const { error } = await supabase.from('tasks').insert([newTask]);
    if (error) return;
    const taskCopy = { ...newTask };
    setNewTask({ title: '', description: '', urgency: 'סטנדרטית', assignee: 'כולם', target_date: today, status: 'לא התחלתי', depends_on_task_id: null });
    setShowTaskForm(false);
    fetchData();
    if (sendToWhatsApp) {
      window.location.href = buildWhatsAppLink(taskCopy);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistNewTask(true);
  };

  const startEditTask = (task: Task, focus: EditTaskFocus = 'all') => {
    if (editingTaskId === task.id) {
      // toggle off if clicking the same area twice with no specific focus
      if (focus === 'all') {
        setEditingTaskId(null);
        setEditTaskDraft(null);
      } else {
        setEditTaskFocus(focus);
      }
      return;
    }
    setEditingTaskId(task.id || null);
    setEditTaskDraft({ ...task, depends_on_task_id: task.depends_on_task_id || null });
    setEditTaskFocus(focus);
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditTaskDraft(null);
    setEditTaskFocus('all');
  };

  const saveEditTask = async () => {
    if (!editingTaskId || !editTaskDraft) return;
    const updates: any = {
      title: editTaskDraft.title,
      description: editTaskDraft.description || '',
      urgency: editTaskDraft.urgency,
      assignee: editTaskDraft.assignee,
      target_date: editTaskDraft.target_date,
      depends_on_task_id: editTaskDraft.depends_on_task_id || null,
    };
    setTasks(prev => prev.map(t => t.id === editingTaskId ? { ...t, ...updates } : t));
    await supabase.from('tasks').update(updates).eq('id', editingTaskId);
    cancelEditTask();
    fetchData();
  };

  const getBlockingTask = (task: Task): Task | null => {
    if (!task.depends_on_task_id) return null;
    const dep = tasks.find(t => t.id === task.depends_on_task_id);
    if (!dep || dep.status === 'סיימתי') return null;
    return dep;
  };

  const buildCelebration = () => {
    const COLORS = ['#ff3b6b', '#ffd23f', '#3ddbff', '#7cf86b', '#ff7ee5', '#ff9533', '#9b6bff', '#5af0c2', '#ff5577', '#ff2d8a'];
    const BALLOON_EMOJIS = ['🎈', '🎈', '🎈', '🎉', '🎊'];
    const fireworks = Array.from({ length: 12 }).map(() => {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      let secondaryColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      while (secondaryColor === color) secondaryColor = COLORS[Math.floor(Math.random() * COLORS.length)];

      // Long radial streaks (the main "rays" of the firework).
      const streakCount = 38 + Math.floor(Math.random() * 14);
      const baseFly = 150 + Math.random() * 90;
      const streaks = Array.from({ length: streakCount }).map((_, i) => {
        const angle = (i / streakCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
        const fly = baseFly * (0.75 + Math.random() * 0.55);
        return {
          angle,
          fly,
          width: 70 + Math.floor(Math.random() * 40),
          height: 3 + Math.floor(Math.random() * 2),
        };
      });

      // Bright glowing sparks scattered at random angles/distances.
      const sparkCount = 18 + Math.floor(Math.random() * 8);
      const sparks = Array.from({ length: sparkCount }).map(() => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 130;
        return {
          sx: Math.cos(angle) * dist,
          sy: Math.sin(angle) * dist,
          size: 4 + Math.floor(Math.random() * 5),
          delay: Math.random() * 250,
        };
      });

      return {
        top: 10 + Math.random() * 60,
        left: 8 + Math.random() * 84,
        delay: 200 + Math.random() * 1800,
        color,
        secondaryColor,
        streaks,
        sparks,
      };
    });
    const balloons = Array.from({ length: 8 }).map(() => ({
      left: 5 + Math.random() * 90,
      delay: Math.random() * 1200,
      bx: (Math.random() - 0.5) * 120,
      br: (Math.random() - 0.5) * 30,
      emoji: BALLOON_EMOJIS[Math.floor(Math.random() * BALLOON_EMOJIS.length)],
    }));
    return { fireworks, balloons };
  };

  const updateTaskStatus = async (id: string, newStatus: string) => {
    if (newStatus === 'סיימתי') {
      setPoofingTaskId(id);
      setCelebration(buildCelebration());
      // Persist in background while the animation plays.
      supabase.from('tasks').update({ status: newStatus }).eq('id', id).then(() => {});
      window.setTimeout(() => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
      }, 1500);
      window.setTimeout(() => {
        setPoofingTaskId(null);
        setCelebration(null);
      }, 4200);
      return;
    }
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

  // --- Equipment functions ---
  const checkEquipmentSession = async (listType: string) => {
    const { data } = await supabase.from('equipment_sessions').select('*').eq('list_type', listType).single();
    const todayStr = new Date().toISOString().split('T')[0];
    if (data && data.last_pack_date !== todayStr) {
      setShowResetDialog(listType);
    }
  };

  const resetPacking = async (listType: string) => {
    await supabase.from('equipment_items').update({ is_packed: false }).eq('list_type', listType);
    setEquipmentItems(prev => prev.map(i => i.list_type === listType ? { ...i, is_packed: false } : i));
    const todayStr = new Date().toISOString().split('T')[0];
    await supabase.from('equipment_sessions').upsert({ list_type: listType, last_pack_date: todayStr, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }, { onConflict: 'list_type,household_id' });
    setShowResetDialog(null);
  };

  const dismissResetDialog = async (listType: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    await supabase.from('equipment_sessions').upsert({ list_type: listType, last_pack_date: todayStr, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }, { onConflict: 'list_type,household_id' });
    setShowResetDialog(null);
  };

  const togglePacked = async (item: EquipmentItem) => {
    const newPacked = !item.is_packed;
    setEquipmentItems(prev => prev.map(i => i.id === item.id ? { ...i, is_packed: newPacked } : i));
    await supabase.from('equipment_items').update({ is_packed: newPacked }).eq('id', item.id);
    // Update session date
    const todayStr = new Date().toISOString().split('T')[0];
    await supabase.from('equipment_sessions').upsert({ list_type: item.list_type, last_pack_date: todayStr, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }, { onConflict: 'list_type,household_id' });
  };

  const handleEquipmentUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    showStatus('מעבד...', false);
    try {
      const equipCats = Array.from(new Set([...EQUIP_CATEGORIES, ...equipmentItems.filter(i => i.list_type === equipListType).map(i => i.category)]));
      const res = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text: input, categories: equipCats, context: 'equipment' }) });
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          const name = item.name || item.item_name || 'פריט';
          const isRemoval = (item.quantity || 0) < 0 || item.removeAll;
          if (isRemoval) {
            const cleanName = name.replace(/^(את כל ה|כל ה|את ה|ה)/g, '').trim().toLowerCase();
            const matches = equipmentItems.filter(i => i.list_type === equipListType && (i.item_name || '').toLowerCase().includes(cleanName));
            for (const m of matches) {
              setEquipmentItems(prev => prev.filter(i => i.id !== m.id));
              await supabase.from('equipment_items').delete().eq('id', m.id);
            }
            if (matches.length === 0) showStatus(`לא מצאתי "${name}" ברשימה`, true);
          } else {
            const cat = item.category && equipCats.includes(item.category) ? item.category : 'ציוד נוסף';
            if (data.new_categories) {
              for (const nc of data.new_categories) {
                if (!equipCats.includes(nc)) equipCats.push(nc);
              }
            }
            const finalCat = item.category && [...equipCats, ...(data.new_categories || [])].includes(item.category) ? item.category : cat;
            const { data: inserted } = await supabase.from('equipment_items').insert([{ item_name: name, category: finalCat, list_type: equipListType, is_packed: false, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }]).select();
            if (inserted) setEquipmentItems(prev => [...prev, ...inserted]);
          }
        }
        showStatus('✅ עודכן!', true);
      }
      setInput('');
    } catch { showStatus('❌ שגיאה בחיבור', true); }
  };

  const deleteEquipmentItem = async (item: EquipmentItem) => {
    setEquipmentItems(prev => prev.filter(i => i.id !== item.id));
    await supabase.from('equipment_items').delete().eq('id', item.id);
  };

  const safeInventory = inventory || [];
  const safeShoppingList = shoppingList || [];

  const filteredInventory = safeInventory
    .filter(i => (i.item_name || '').includes(searchTerm) && (invFilter === 'הכל' || i.location === invFilter))
    .sort((a, b) => {
      const aLow = (a.quantity || 0) <= 2 ? 0 : 1;
      const bLow = (b.quantity || 0) <= 2 ? 0 : 1;
      if (aLow !== bLow) return aLow - bLow;
      return (a.item_name || '').localeCompare(b.item_name || '', 'he');
    });

  const filteredShoppingList = safeShoppingList
    .filter(s => (s.item_name || '').includes(searchTerm))
    .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '', 'he'));

  const displayCategories = Array.from(new Set([
    ...categories, 
    ...safeInventory.map(i => i.category || 'כללי'), 
    ...safeShoppingList.map(s => s.category || 'כללי')
  ])).filter(c => c !== 'uncertain' && c !== 'null');

  const activeTasks = tasks.filter(t => t.status !== 'סיימתי');
  const completedTasks = tasks.filter(t => t.status === 'סיימתי');

  const headerGradient = activeView === 'HOME' ? 'from-violet-600 via-fuchsia-600 to-orange-500' : activeView === 'INVENTORY' ? 'from-teal-600 to-emerald-500' : activeView === 'SHOPPING' ? 'from-rose-500 to-orange-500' : activeView === 'EQUIPMENT' ? 'from-sky-600 to-cyan-500' : 'from-indigo-600 to-purple-700';

  const currentEquipItems = equipmentItems.filter(i => i.list_type === equipListType);
  const unpackedEquip = currentEquipItems.filter(i => !i.is_packed);
  const packedEquip = currentEquipItems.filter(i => i.is_packed);
  const equipCategories = Array.from(new Set([...EQUIP_CATEGORIES, ...currentEquipItems.map(i => i.category)])).filter(Boolean);

  return (
    <main className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900" dir="rtl">
      {celebration && (
        <div className="fixed inset-0 z-[2000] pointer-events-none overflow-hidden">
          {celebration.fireworks.map((fw, i) => (
            <div key={`fw-${i}`} className="absolute" style={{ top: `${fw.top}%`, left: `${fw.left}%` }}>
              {/* Launch trail (rocket rising) */}
              <span
                className="absolute animate-firework-launch"
                style={{
                  width: '4px',
                  height: '90px',
                  top: 0,
                  left: 0,
                  background: `linear-gradient(to top, transparent 0%, ${fw.color} 60%, #fff 100%)`,
                  borderRadius: '4px',
                  boxShadow: `0 0 14px ${fw.color}`,
                  transformOrigin: '50% 100%',
                  animationDelay: `${Math.max(0, fw.delay - 600)}ms`,
                }}
              />

              {/* White-hot core */}
              <span
                className="absolute rounded-full animate-firework-flash"
                style={{
                  width: '24px',
                  height: '24px',
                  top: 0,
                  left: 0,
                  background: 'radial-gradient(circle, #ffffff 0%, #ffffff 30%, transparent 80%)',
                  boxShadow: `0 0 50px 16px #fff, 0 0 90px 30px ${fw.color}`,
                  animationDelay: `${fw.delay}ms`,
                }}
              />

              {/* Outer colored halo */}
              <span
                className="absolute rounded-full animate-firework-flash"
                style={{
                  width: '60px',
                  height: '60px',
                  top: 0,
                  left: 0,
                  background: `radial-gradient(circle, ${fw.color} 0%, ${fw.secondaryColor} 50%, transparent 80%)`,
                  boxShadow: `0 0 60px 20px ${fw.color}`,
                  animationDelay: `${fw.delay + 30}ms`,
                  opacity: 0.7,
                }}
              />

              {/* Long comet-like streaks radiating outward */}
              {fw.streaks.map((s, si) => (
                <span
                  key={`s-${si}`}
                  className="absolute animate-firework-streak"
                  style={{
                    top: 0,
                    left: 0,
                    width: `${s.width}px`,
                    height: `${s.height}px`,
                    background: `linear-gradient(to right, transparent 0%, ${fw.color} 35%, ${fw.color} 70%, #ffffff 100%)`,
                    borderRadius: '999px',
                    boxShadow: `0 0 12px ${fw.color}, 0 0 4px #fff`,
                    transformOrigin: '0 50%',
                    animationDelay: `${fw.delay}ms`,
                    ['--angle' as any]: `${s.angle}rad`,
                    ['--fly' as any]: `${s.fly}px`,
                  }}
                />
              ))}

              {/* Bright glowing sparks scattered around the burst */}
              {fw.sparks.map((sp, spi) => (
                <span
                  key={`sp-${spi}`}
                  className="absolute rounded-full animate-firework-spark"
                  style={{
                    top: 0,
                    left: 0,
                    width: `${sp.size}px`,
                    height: `${sp.size}px`,
                    background: `radial-gradient(circle, #ffffff 10%, ${fw.secondaryColor} 70%)`,
                    boxShadow: `0 0 ${sp.size * 2}px ${fw.color}, 0 0 4px #fff`,
                    animationDelay: `${fw.delay + sp.delay}ms`,
                    ['--sx' as any]: `${sp.sx}px`,
                    ['--sy' as any]: `${sp.sy}px`,
                  }}
                />
              ))}
            </div>
          ))}
          {celebration.balloons.map((b, i) => (
            <span
              key={`bl-${i}`}
              className="absolute text-5xl animate-balloon-rise"
              style={{
                left: `${b.left}%`,
                bottom: 0,
                animationDelay: `${b.delay}ms`,
                ['--bx' as any]: `${b.bx}px`,
                ['--br' as any]: `${b.br}deg`,
              }}
            >{b.emoji}</span>
          ))}
        </div>
      )}
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
        
        {/* קופסאות שאלות סיווג למלאי ולקניות */}
        {pendingItems.length > 0 && (activeView === 'INVENTORY' || activeView === 'SHOPPING') && (
          <div className="mb-8 space-y-4">
            {pendingItems.map((item, idx) => (
              <ClassificationCard 
                key={`pending-${idx}`} 
                item={item} 
                categories={categories} 
                onResolve={handleResolvePending} 
                onIgnore={() => {
                  setPendingItems(prev => prev.filter(p => p.item_name !== item.item_name));
                  if (pendingItems.length <= 1) showStatus('✅ נשמר ב"כללי"', true);
                }}
              />
            ))}
          </div>
        )}

        {/* קופסאות הבהרה (Disambiguation) למחיקה של כפילויות */}
        {disambiguationItems.length > 0 && activeView === 'INVENTORY' && (
          <div className="mb-8 space-y-4">
            {disambiguationItems.map((task, idx) => (
              <div key={`dis-${idx}`} className="bg-rose-50 p-6 rounded-[2rem] border-2 border-rose-200 shadow-lg animate-bounce-short">
                <p className="font-black text-lg mb-4 text-rose-900">
                  יש כמה סוגים של "<span className="text-rose-600">{task.originalName}</span>" במלאי. <br/> איזה מהם להוריד?
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {task.matches.map(match => (
                    <button key={match.id} onClick={() => handleResolveDisambiguation(task, match)} className="bg-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm border border-rose-100 hover:bg-rose-500 hover:text-white transition-all">
                      {match.item_name} ({match.quantity})
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 border-t border-rose-200 pt-4">
                  <button onClick={() => handleResolveDisambiguation(task, 'ALL')} className="flex-1 bg-rose-600 text-white px-4 py-3 rounded-xl font-black text-sm shadow-sm hover:bg-rose-700 transition-all">
                    🔄 הכל — {task.removeAll ? "אפס את כולם ל-0" : `הורד ${Math.abs(task.quantityToSubtract)} מכל אחד`}
                  </button>
                  <button onClick={() => setDisambiguationItems(prev => prev.filter(t => t !== task))} className="bg-slate-200 text-slate-500 px-4 py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-300 transition-all">
                    ביטול
                  </button>
                </div>
              </div>
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
            <button onClick={() => changeView('EQUIPMENT')} className="p-6 bg-white rounded-[2rem] shadow-lg border-b-8 border-sky-500 flex items-center justify-between active:scale-95 transition-all">
               <div className="text-right"><span className="block text-2xl font-black">🧳 רשימת ציוד</span><span className="text-slate-400 text-sm">{equipmentItems.filter(i => !i.is_packed).length} לא נארזו</span></div>
               <span className="text-4xl">🎒</span>
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
              <textarea value={input} onChange={e => setInput(e.target.value)} placeholder={activeView === 'INVENTORY' ? "מה הוספנו/הורדנו מהמלאי? (למשל: תוריד את כל המיונז)" : "מה חסר? (למשל: ביצים בקירור, 3 קולה)"} className="w-full p-4 bg-slate-50 rounded-2xl text-sm min-h-[70px] border-none focus:ring-2 focus:ring-amber-300 pointer-events-auto" />
              <button type="submit" className={`w-full p-4 rounded-2xl text-white font-black text-lg active:scale-95 transition-all shadow-md pointer-events-auto ${activeView === 'INVENTORY' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                 {activeView === 'INVENTORY' ? 'עדכן מלאי ✨' : 'הוסף לקניות 🛒'}
              </button>
            </form>
            {status && (
              <div className="mt-4 flex justify-center animate-in fade-in slide-in-from-bottom-2">
                <span className={`px-4 py-2 rounded-full text-xs font-bold shadow-sm ${status.includes('❌') ? 'bg-red-100 text-red-600' : status.includes('🤔') || status.includes('כמה') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{status}</span>
              </div>
            )}
          </div>
        )}

        {wordChoiceTasks.length > 0 && activeView === 'SHOPPING' && (
          <div className="mb-8 space-y-4">
            {wordChoiceTasks.map((task, idx) => (
              <div key={`wc-${idx}`} className="bg-rose-50 p-6 rounded-[2rem] border-2 border-rose-200 shadow-lg">
                <p className="font-black text-lg mb-4 text-rose-900">
                  למה התכוונת? אחת מהמילים ב<span className="text-rose-600">&quot;{task.originalName}&quot;</span> היא מוצר בפני עצמו.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => handleResolveWordChoice(task, task.originalName)}
                    className="bg-rose-600 text-white px-4 py-2 rounded-xl font-black text-sm shadow-sm hover:bg-rose-700 transition-all"
                  >
                    {task.originalName}
                  </button>
                  {task.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => handleResolveWordChoice(task, opt)}
                      className="bg-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm border border-rose-100 hover:bg-rose-500 hover:text-white transition-all"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setWordChoiceTasks(prev => prev.filter(t => t !== task))}
                  className="bg-slate-200 text-slate-500 px-4 py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-300 transition-all"
                >
                  ביטול
                </button>
              </div>
            ))}
          </div>
        )}

        {duplicateShoppingAlerts.length > 0 && activeView === 'SHOPPING' && (
          <div className="mb-6 space-y-3">
            {duplicateShoppingAlerts.map(name => (
              <div key={`dup-${name}`} className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex justify-between items-center gap-3">
                <span className="font-bold text-amber-900 text-sm">⚠️ &quot;{name}&quot; כבר ברשימה</span>
                <button
                  onClick={() => setDuplicateShoppingAlerts(prev => prev.filter(n => n !== name))}
                  className="bg-amber-500 text-white px-4 py-1.5 rounded-xl font-black text-sm pointer-events-auto hover:bg-amber-600 transition-colors"
                >
                  הבנתי
                </button>
              </div>
            ))}
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
                        {itemsInCat.map(item => <InventoryCard key={item.id} item={item} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} updateExactQuantity={updateExactQuantity} onPlus={() => handlePlus(item)} onMinus={() => handleMinus(item)} onAddToShopping={addToShopping} shoppingList={shoppingList} onDelete={deleteInventoryItem} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredInventory.map(item => <InventoryCard key={item.id} item={item} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} updateExactQuantity={updateExactQuantity} onPlus={() => handlePlus(item)} onMinus={() => handleMinus(item)} onAddToShopping={addToShopping} shoppingList={shoppingList} onDelete={deleteInventoryItem} />)}
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
                        {list.map(s => <ShoppingCard key={s.id} item={s} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} editingCatItemId={editingCatItemId} editCatValue={editCatValue} setEditingCatItemId={setEditingCatItemId} setEditCatValue={setEditCatValue} saveEditedCategory={saveEditedCategory} categories={displayCategories} onDelete={deleteShoppingItem} onMoveToInventory={moveShoppingToInventory} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredShoppingList.map(s => <ShoppingCard key={s.id} item={s} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} editingCatItemId={editingCatItemId} editCatValue={editCatValue} setEditingCatItemId={setEditingCatItemId} setEditCatValue={setEditCatValue} saveEditedCategory={saveEditedCategory} categories={displayCategories} onDelete={deleteShoppingItem} onMoveToInventory={moveShoppingToInventory} />)}
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
                <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold text-center" value={newTask.target_date} onChange={e => setNewTask({...newTask, target_date: e.target.value})} />
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-black text-slate-500 pr-1">תלות במשימה (אופציונלי)</label>
                  <select
                    className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold"
                    value={newTask.depends_on_task_id || ''}
                    onChange={e => setNewTask({...newTask, depends_on_task_id: e.target.value || null})}
                  >
                    <option value="">ללא תלות</option>
                    {tasks.filter(t => t.status !== 'סיימתי').map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => persistNewTask(false)} className="flex-1 bg-emerald-500 text-white p-5 rounded-2xl font-black shadow-md hover:bg-emerald-600 active:scale-95 transition-all">💾 שמור</button>
                  <button type="button" onClick={() => persistNewTask(true)} className="flex-1 bg-emerald-600 text-white p-5 rounded-2xl font-black shadow-md hover:bg-emerald-700 active:scale-95 transition-all">💬 שמור + וואטסאפ</button>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {activeTasks.map(task => {
                const urgencyColor = task.urgency === 'דחופה מאד' ? 'border-red-500 bg-red-50' : task.urgency === 'גבוהה' ? 'border-orange-400 bg-orange-50' : task.urgency === 'נמוכה' ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white';
                const isPlural = (task.assignee || '').includes('כולם');
                const blockedBy = getBlockingTask(task);
                const isEditing = editingTaskId === task.id;
                const isPoofing = poofingTaskId === task.id;
                const draft = isEditing ? editTaskDraft : null;
                const stop = (e: React.MouseEvent) => e.stopPropagation();
                const chipBase = "px-2 py-1 rounded-full pointer-events-auto transition-colors hover:bg-slate-200";
                return (
                  <div
                    key={task.id}
                    onClick={() => !isPoofing && startEditTask(task, 'all')}
                    className={`bg-white p-6 rounded-[2rem] shadow-md border-r-8 ${urgencyColor} relative group cursor-pointer ${blockedBy ? 'opacity-60 grayscale-[40%]' : ''} ${isEditing ? 'ring-2 ring-indigo-300' : ''} ${isPoofing ? 'animate-task-poof overflow-hidden' : ''}`}
                  >
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <h3 className="font-black text-xl text-slate-800 flex-1">{task.title}</h3>
                      <button
                        onClick={(e) => { stop(e); deleteTask(task.id!); }}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 text-slate-400 text-[10px] font-black border border-slate-100 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all pointer-events-auto"
                      >
                        מחק 🗑️
                      </button>
                    </div>
                    {task.description && <p className="text-sm text-slate-500 mb-4">{task.description}</p>}
                    {blockedBy && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl text-xs font-bold mb-3 flex items-center gap-2">
                        <span>⏳ ממתין למשימה:</span>
                        <span className="font-black">{blockedBy.title}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 text-[10px] font-black text-slate-400">
                      <button type="button" onClick={(e) => { stop(e); startEditTask(task, 'assignee'); }} className={`bg-slate-50 ${chipBase}`}>👤 {task.assignee}</button>
                      <button type="button" onClick={(e) => { stop(e); startEditTask(task, 'date'); }} className={`bg-slate-50 ${chipBase}`}>📅 {task.target_date}</button>
                      <button type="button" onClick={(e) => { stop(e); startEditTask(task, 'urgency'); }} className={`bg-slate-50 ${chipBase}`}>{urgencyEmoji(task.urgency)} {task.urgency}</button>
                    </div>

                    {isEditing && draft && (
                      <div onClick={stop} className="mt-5 pt-5 border-t border-slate-200 space-y-3">
                        <input
                          autoFocus={editTaskFocus === 'all' || editTaskFocus === 'title'}
                          value={draft.title}
                          onChange={e => setEditTaskDraft({ ...draft, title: e.target.value })}
                          placeholder="שם המשימה"
                          className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm pointer-events-auto"
                        />
                        <textarea
                          value={draft.description || ''}
                          onChange={e => setEditTaskDraft({ ...draft, description: e.target.value })}
                          placeholder="תיאור (אופציונלי)"
                          className="w-full p-3 bg-slate-50 rounded-xl text-sm pointer-events-auto"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            autoFocus={editTaskFocus === 'urgency'}
                            value={draft.urgency}
                            onChange={e => setEditTaskDraft({ ...draft, urgency: e.target.value })}
                            className={`p-3 bg-slate-50 rounded-xl font-bold text-sm pointer-events-auto ${editTaskFocus === 'urgency' ? 'ring-2 ring-indigo-300' : ''}`}
                          >
                            <option>דחופה מאד</option><option>גבוהה</option><option>סטנדרטית</option><option>נמוכה</option>
                          </select>
                          <select
                            autoFocus={editTaskFocus === 'assignee'}
                            value={draft.assignee}
                            onChange={e => setEditTaskDraft({ ...draft, assignee: e.target.value })}
                            className={`p-3 bg-slate-50 rounded-xl font-bold text-sm pointer-events-auto ${editTaskFocus === 'assignee' ? 'ring-2 ring-indigo-300' : ''}`}
                          >
                            <option>שוקי</option><option>הילה</option><option>כולם</option>
                          </select>
                        </div>
                        <input
                          type="date"
                          autoFocus={editTaskFocus === 'date'}
                          value={draft.target_date}
                          onChange={e => setEditTaskDraft({ ...draft, target_date: e.target.value })}
                          className={`w-full p-3 bg-slate-50 rounded-xl text-sm font-bold text-center pointer-events-auto ${editTaskFocus === 'date' ? 'ring-2 ring-indigo-300' : ''}`}
                        />
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-black text-slate-500 pr-1">תלות במשימה</label>
                          <select
                            autoFocus={editTaskFocus === 'depends'}
                            value={draft.depends_on_task_id || ''}
                            onChange={e => setEditTaskDraft({ ...draft, depends_on_task_id: e.target.value || null })}
                            className="p-3 bg-slate-50 rounded-xl text-sm font-bold pointer-events-auto"
                          >
                            <option value="">ללא תלות</option>
                            {tasks.filter(t => t.id !== task.id && t.status !== 'סיימתי').map(t => (
                              <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button type="button" onClick={saveEditTask} className="flex-1 bg-indigo-600 text-white p-3 rounded-xl font-black text-sm pointer-events-auto hover:bg-indigo-700 transition-all">💾 שמור שינויים</button>
                          <button type="button" onClick={cancelEditTask} className="flex-1 bg-slate-200 text-slate-600 p-3 rounded-xl font-bold text-sm pointer-events-auto hover:bg-slate-300 transition-all">ביטול</button>
                        </div>
                      </div>
                    )}

                    <div onClick={stop} className="flex bg-slate-100 p-1 rounded-2xl mt-5 gap-1">
                      <button
                        disabled={!!blockedBy}
                        onClick={() => updateTaskStatus(task.id!, 'לא התחלתי')}
                        className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed ${task.status === 'לא התחלתי' || !task.status ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400'}`}
                      >
                        {isPlural ? 'לא התחלנו' : 'לא התחלתי'}
                      </button>
                      <button
                        disabled={!!blockedBy}
                        onClick={() => updateTaskStatus(task.id!, 'בתהליך')}
                        className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed ${task.status === 'בתהליך' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400'}`}
                      >
                        בתהליך
                      </button>
                      <button
                        disabled={!!blockedBy}
                        onClick={() => updateTaskStatus(task.id!, 'סיימתי')}
                        className="flex-1 py-2.5 rounded-xl text-[11px] font-black text-slate-400 hover:bg-emerald-500 hover:text-white transition-all pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPlural ? 'סיימנו' : 'סיימתי'}
                      </button>
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

        {activeView === 'EQUIPMENT' && (
          <div className="space-y-6">
            {/* Reset dialog */}
            {showResetDialog && (
              <div className="bg-sky-50 border-2 border-sky-200 p-6 rounded-[2rem] shadow-lg animate-bounce-short">
                <p className="font-black text-lg text-sky-900 mb-4">התחלת אריזה חדשה?</p>
                <p className="text-sm text-sky-700 mb-4">נראה שארזת לאחרונה. רוצה לאפס את הסימונים ולהתחיל מחדש?</p>
                <div className="flex gap-2">
                  <button onClick={() => resetPacking(showResetDialog)} className="flex-1 bg-sky-600 text-white px-4 py-3 rounded-xl font-black text-sm">כן, אריזה חדשה</button>
                  <button onClick={() => dismissResetDialog(showResetDialog)} className="flex-1 bg-slate-200 text-slate-600 px-4 py-3 rounded-xl font-bold text-sm">לא, להמשיך מאיפה שהפסקתי</button>
                </div>
              </div>
            )}

            {/* List type tabs */}
            <div className="flex gap-1 p-1 bg-white rounded-xl shadow-sm border border-slate-100">
              {(['חו"ל', 'חד"כ', 'סופ"ש'] as const).map(lt => (
                <button key={lt} onClick={() => { setEquipListType(lt); checkEquipmentSession(lt); }} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all pointer-events-auto ${equipListType === lt ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>{lt}</button>
              ))}
            </div>

            {/* Free text input */}
            <div className="bg-white p-5 rounded-[2rem] shadow-xl border border-slate-50 relative z-20">
              <form onSubmit={handleEquipmentUpdate} className="space-y-3">
                <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="הוסף או הורד ציוד (למשל: מטען, אוזניות, תרופות שינה)" className="w-full p-4 bg-slate-50 rounded-2xl text-sm min-h-[70px] border-none focus:ring-2 focus:ring-sky-300 pointer-events-auto" />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 p-4 rounded-2xl text-white font-black text-lg active:scale-95 transition-all shadow-md pointer-events-auto bg-sky-600 hover:bg-sky-700">
                    עדכן רשימה 🧳
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetDialog(equipListType)}
                    disabled={packedEquip.length === 0}
                    className="p-4 rounded-2xl text-white font-black text-lg active:scale-95 transition-all shadow-md pointer-events-auto bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
                    title="אפס את כל הסימונים"
                  >
                    חדש ✨
                  </button>
                </div>
              </form>
              {status && (
                <div className="mt-4 flex justify-center animate-in fade-in slide-in-from-bottom-2">
                  <span className={`px-4 py-2 rounded-full text-xs font-bold shadow-sm ${status.includes('❌') ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>{status}</span>
                </div>
              )}
            </div>

            {/* Unpacked items by category */}
            {equipCategories.map(cat => {
              const items = unpackedEquip.filter(i => i.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={`eqcat-${cat}`} className="space-y-2">
                  <h3 className="font-black text-sky-700 text-xs uppercase pr-2 border-r-4 border-sky-400">{cat}</h3>
                  <div className="grid gap-2">
                    {items.map(item => (
                      <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-[1.5rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 flex-1">
                          <button onClick={() => togglePacked(item)} className="w-7 h-7 rounded-lg border-2 border-sky-300 bg-white flex items-center justify-center hover:bg-sky-50 transition-colors pointer-events-auto flex-shrink-0" />
                          {editingId === item.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEditedName(item.id!, 'equipment_items')} className="border-b-2 border-sky-500 bg-sky-50 px-2 py-1 outline-none font-bold text-sm flex-1 pointer-events-auto" />
                              <button onClick={() => saveEditedName(item.id!, 'equipment_items')} className="bg-green-100 text-green-700 p-2 rounded-lg pointer-events-auto shadow-sm">✅</button>
                            </div>
                          ) : (
                            <span onClick={() => { setEditingId(item.id!); setEditNameValue(item.item_name); }} className="font-bold text-slate-800 cursor-pointer hover:text-sky-600 pointer-events-auto flex-1">{item.item_name}</span>
                          )}
                        </div>
                        <button onClick={() => { if (confirm(`למחוק לצמיתות את "${item.item_name}"?`)) deleteEquipmentItem(item); }} className="text-slate-300 hover:text-red-500 text-sm font-bold pointer-events-auto transition-colors px-2">🗑️</button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {unpackedEquip.length === 0 && !showResetDialog && (
              <div className="text-center py-12 text-slate-400">
                <span className="text-4xl block mb-3">🧳</span>
                <span className="font-bold text-sm">הרשימה ריקה. הוסף ציוד בטקסט חופשי למעלה</span>
              </div>
            )}

            {/* Packed items */}
            {packedEquip.length > 0 && (
              <div className="mt-8 pt-6 border-t-2 border-slate-200">
                <h3 className="font-black text-emerald-600 text-sm mb-4 pr-2">✅ נארז ({packedEquip.length})</h3>
                <div className="grid gap-2 opacity-70">
                  {packedEquip.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                      <div className="flex items-center gap-3 flex-1">
                        <button onClick={() => togglePacked(item)} className="w-7 h-7 rounded-lg border-2 border-emerald-400 bg-emerald-500 flex items-center justify-center pointer-events-auto">
                          <span className="text-white text-sm font-black">✓</span>
                        </button>
                        <span className="font-medium text-emerald-800 line-through text-sm">{item.item_name}</span>
                      </div>
                      <span className="text-[10px] text-emerald-500 font-bold">{item.category}</span>
                    </div>
                  ))}
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
  const quickOptions = Array.from(new Set([...categories, 'טרי', 'קפואים', 'שימורים', 'יבשים'])).filter(c => c !== 'uncertain' && c !== 'null' && c !== 'כללי').slice(0, 5);

  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-amber-100">
      <div className="flex justify-between items-center mb-3">
        <p className="font-black text-lg text-slate-800">איפה נשמור: <span className="text-amber-600">{item.item_name || item.name}</span>?</p>
        <button onClick={onIgnore} className="text-slate-400 hover:text-slate-600 text-xs font-bold bg-slate-100 px-3 py-1 rounded-full">לשמור בכללי</button>
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
          type="button"
          onClick={(e) => { e.preventDefault(); if(customCat) onResolve(item, customCat); }} 
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
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="flex-1 p-2 rounded-xl text-xs font-black bg-white border border-slate-200 pointer-events-auto" />
          <button onClick={() => onRestore(task.id!, newDate)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-[10px] font-black shadow-sm hover:bg-slate-300 transition-colors pointer-events-auto">שחזר ↺</button>
        </div>
      </div>
    </div>
  );
}

function InventoryCard({ item, editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName, updateExactQuantity, onPlus, onMinus, onAddToShopping, shoppingList, onDelete }: any) {
  const isLow = (item.quantity || 0) <= 2;
  const alreadyInShopping = shoppingList?.some((s: any) => (s.item_name || '').includes(item.item_name));
  return (
    <div className={`flex justify-between items-center bg-white p-4 rounded-[1.5rem] shadow-sm border ${isLow ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'} hover:shadow-md transition-shadow`}>
      <div className="text-right flex-1">
        {editingId === item.id ? (
          <div className="flex items-center gap-2 mb-1">
            <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEditedName(item.id, 'inventory_items')} className="border-b-2 border-teal-500 bg-teal-50 px-2 py-1 outline-none font-bold text-lg w-[120px] pointer-events-auto" />
            <button onClick={() => saveEditedName(item.id, 'inventory_items')} className="bg-green-100 text-green-700 p-2 rounded-lg pointer-events-auto shadow-sm">✅</button>
          </div>
        ) : (
          <span onClick={() => {setEditingId(item.id); setEditNameValue(item.item_name || 'פריט לא ידוע');}} className="block font-bold text-lg text-slate-800 cursor-pointer hover:text-teal-600 hover:underline decoration-dashed decoration-slate-300 pointer-events-auto transition-colors">{item.item_name || 'פריט לא ידוע'}</span>
        )}
        <span className="text-[10px] uppercase font-bold text-slate-400">{item.category || 'כללי'} • {item.location || 'מזווה'}{item.updated_at ? ` • ${new Date(item.updated_at).toLocaleDateString('he-IL')}` : ''}</span>
        {isLow && !alreadyInShopping && (
          <button onClick={() => onAddToShopping(item)} className="block mt-1 text-[10px] font-black text-rose-600 bg-rose-100 px-3 py-1 rounded-lg hover:bg-rose-200 pointer-events-auto transition-colors">+ הוסף לקניות</button>
        )}
      </div>
      <div className="flex items-center gap-2" dir="ltr">
        <button onClick={onMinus} className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 font-black pointer-events-auto shadow-sm hover:bg-rose-200 transition-colors active:scale-90">-</button>
        <div className="relative flex items-center justify-center min-w-[36px]">
          <select value={Math.floor(item.quantity || 0)} onChange={(e) => updateExactQuantity(item, Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer pointer-events-auto">
            {[...Array(21).keys()].map(num => <option key={num} value={num}>{num}</option>)}
          </select>
          <span className={`text-xl font-black pointer-events-none ${isLow ? 'text-rose-600' : 'text-slate-700'}`}>{item.quantity || 0}</span>
        </div>
        <button onClick={onPlus} className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 font-black pointer-events-auto shadow-sm hover:bg-emerald-200 transition-colors active:scale-90">+</button>
        <button onClick={() => onDelete(item)} className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 font-black text-xs pointer-events-auto shadow-sm transition-colors active:scale-90" title="מחק לצמיתות">🗑️</button>
      </div>
    </div>
  );
}

function ShoppingCard({ item, editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName, editingCatItemId, editCatValue, setEditingCatItemId, setEditCatValue, saveEditedCategory, categories, onDelete, onMoveToInventory }: any) {
  const [showQtyDialog, setShowQtyDialog] = useState(false);
  const [qty, setQty] = useState(1);
  return (
    <div className="flex flex-col gap-3 bg-white p-4 rounded-[1.5rem] shadow-sm border border-rose-50 hover:border-rose-100 transition-colors">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => onDelete(item)} className="bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 px-3 py-1.5 rounded-xl text-xs font-black shadow-sm pointer-events-auto transition-colors">🗑️ מחק</button>
        <button onClick={() => setShowQtyDialog(!showQtyDialog)} className="bg-teal-100 text-teal-700 hover:bg-teal-200 px-3 py-1.5 rounded-xl text-xs font-black shadow-sm pointer-events-auto transition-colors">📦 הוסף למלאי</button>
        <div className="flex flex-col gap-0.5 flex-1 text-right">
          {editingId === item.id ? (
            <div className="flex items-center gap-2">
              <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEditedName(item.id, 'shopping_list')} className="border-b-2 border-rose-500 bg-rose-50 px-2 py-1 outline-none font-bold text-lg w-[140px] pointer-events-auto" />
              <button onClick={() => saveEditedName(item.id, 'shopping_list')} className="bg-green-100 text-green-700 p-2 rounded-lg pointer-events-auto shadow-sm">✅</button>
            </div>
          ) : (
            <span onClick={() => {setEditingId(item.id); setEditNameValue(item.item_name || 'פריט לא ידוע');}} className="font-bold text-slate-800 text-lg cursor-pointer hover:text-rose-600 hover:underline decoration-dashed decoration-slate-300 pointer-events-auto transition-colors">{item.item_name || 'פריט לא ידוע'}</span>
          )}
          {editingCatItemId === item.id ? (
            <div className="flex items-center gap-1 flex-wrap">
              {categories?.filter((c: string) => c !== 'uncertain' && c !== 'null').map((cat: string) => (
                <button key={cat} onClick={async () => { await saveEditedCategory(item.id, 'shopping_list', cat); }}
                  className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-lg text-[10px] font-bold hover:bg-rose-500 hover:text-white transition-all pointer-events-auto">{cat}</button>
              ))}
              <input value={editCatValue} onChange={(e) => setEditCatValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEditedCategory(item.id, 'shopping_list')} placeholder="קטגוריה..." className="border-b border-rose-300 bg-transparent px-1 outline-none text-[10px] font-bold w-[80px] pointer-events-auto" autoFocus />
              <button onClick={() => saveEditedCategory(item.id, 'shopping_list')} className="text-[10px] font-black text-green-600 pointer-events-auto">✅</button>
              <button onClick={() => setEditingCatItemId(null)} className="text-[10px] font-black text-slate-400 pointer-events-auto">✕</button>
            </div>
          ) : (
            <button type="button" onClick={() => { setEditingCatItemId(item.id); setEditCatValue(item.category || 'כללי'); }} className="text-[11px] font-bold text-slate-400 cursor-pointer hover:text-rose-500 pointer-events-auto transition-colors text-right bg-transparent border-none p-0 underline decoration-dashed decoration-slate-300">{item.category || 'כללי'}</button>
          )}
        </div>
      </div>
      {showQtyDialog && (
        <div className="flex items-center gap-2 bg-teal-50 p-3 rounded-xl border border-teal-200">
          <span className="text-xs font-bold text-teal-900 flex-1">כמות להוספה למלאי:</span>
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 rounded-full bg-white text-teal-600 font-black pointer-events-auto shadow-sm">-</button>
          <span className="text-lg font-black text-teal-800 min-w-[28px] text-center">{qty}</span>
          <button onClick={() => setQty(qty + 1)} className="w-8 h-8 rounded-full bg-white text-teal-600 font-black pointer-events-auto shadow-sm">+</button>
          <button onClick={() => { onMoveToInventory(item, qty); setShowQtyDialog(false); setQty(1); }} className="bg-teal-600 text-white px-3 py-1.5 rounded-xl text-xs font-black pointer-events-auto">אישור ✓</button>
        </div>
      )}
    </div>
  );
}