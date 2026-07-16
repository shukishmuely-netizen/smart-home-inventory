'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { id?: string; item_name: string; name?: string; quantity: number; category: string; location: string; needs_classification?: boolean; options?: string[]; removeAll?: boolean };
type Task = { id?: string; title: string; description?: string; urgency: string; assignee: string; target_date: string; status: string; depends_on_task_id?: string | null };
type EditTaskFocus = 'title' | 'urgency' | 'date' | 'assignee' | 'depends' | 'all';
type EquipmentItem = { id?: string; list_type: string; category: string; item_name: string; is_packed: boolean };
type ShoppingTemplate = { id: string; name: string; items: { id: string; item_name: string }[] };

type DisambiguationTask = { originalName: string; matches: Item[]; quantityToSubtract: number; removeAll: boolean; };
type WordChoiceTask = { originalName: string; options: string[]; item: any };

// Curated common Israeli-supermarket products (no emoji, plain names) used as a
// baseline for autocomplete, merged at runtime with the household's own history.
const SUPERMARKET_ITEMS: string[] = [
  // חלב וביצים
  'חלב', 'חלב סויה', 'חלב שקדים', 'חלב שיבולת שועל', 'שמנת מתוקה', 'שמנת חמוצה', 'גבינה לבנה', 'גבינה צהובה',
  'קוטג׳', 'גבינת שמנת', 'גבינה בולגרית', 'גבינת פטה', 'מוצרלה', 'פרמזן', 'לבנה', 'יוגורט', 'יוגורט יווני',
  'גיל', 'מעדן', 'חמאה', 'מרגרינה', 'ביצים', 'ביצים חופש',
  // ירקות
  'עגבניות', 'מלפפון', 'בצל', 'בצל סגול', 'שום', 'גזר', 'תפוח אדמה', 'בטטה', 'פלפל', 'גמבה', 'חציל',
  'קישוא', 'קישוא צהוב', 'כרוב', 'כרובית', 'ברוקולי', 'חסה', 'חסה אייסברג', 'תרד', 'פטרוזיליה', 'כוסברה',
  'שמיר', 'נענע', 'בזיליקום', 'סלרי', 'לימון', 'זנגביל', 'צנון', 'סלק', 'דלעת', 'תירס', 'שעועית ירוקה',
  'אפונה', 'פטריות', 'אבוקדו', 'עגבניות שרי', 'בצל ירוק',
  // פירות
  'תפוח', 'בננה', 'תפוז', 'קלמנטינה', 'אגס', 'ענבים', 'אבטיח', 'מלון', 'תות', 'אפרסק', 'נקטרינה', 'שזיף',
  'משמש', 'מנגו', 'אננס', 'קיווי', 'רימון', 'תמר', 'ליצ׳י', 'אשכולית', 'פומלה',
  // בשר ודגים
  'עוף', 'חזה עוף', 'שוקיים', 'כנפיים', 'טחון', 'בשר טחון', 'אנטריקוט', 'שניצל', 'נקניקיות', 'קבב',
  'סלמון', 'טונה', 'דג', 'פילה דג', 'הודו', 'שווארמה',
  // מאפים ולחם
  'לחם', 'לחם אחיד', 'לחמניות', 'פיתות', 'לחם מחמצת', 'בגט', 'חלה', 'טורטיה', 'קרואסון', 'עוגיות',
  'ביסקוויטים', 'קרקרים', 'מצות',
  // יבשים ופנטרי
  'אורז', 'פסטה', 'ספגטי', 'קוסקוס', 'בורגול', 'קינואה', 'עדשים', 'חומוס יבש', 'שעועית יבשה', 'קמח',
  'קמח מלא', 'סוכר', 'סוכר חום', 'מלח', 'פלפל שחור', 'פפריקה', 'כמון', 'קורנפלור', 'אבקת אפייה', 'שמרים',
  'שמן', 'שמן זית', 'שמן קנולה', 'חומץ', 'רוטב סויה', 'קטשופ', 'מיונז', 'חרדל', 'טחינה', 'ריבה', 'דבש',
  'ממרח שוקולד', 'חמאת בוטנים', 'רסק עגבניות', 'תירס משומר', 'טונה בקופסה', 'זיתים', 'מלפפון חמוץ',
  'קורנפלקס', 'גרנולה', 'שיבולת שועל', 'אגוזים', 'שקדים', 'צימוקים', 'קפה', 'קפה נמס', 'תה', 'קקאו',
  // משקאות
  'מים', 'מים מינרלים', 'סודה', 'קולה', 'ספרייט', 'מיץ', 'מיץ תפוזים', 'מיץ ענבים', 'לימונדה', 'בירה', 'יין',
  // קפואים
  'גלידה', 'ירקות קפואים', 'אפונה קפואה', 'פיצה קפואה', 'מלאווח', 'בורקס', 'קרח',
  // חטיפים וממתקים
  'שוקולד', 'חטיף', 'במבה', 'ביסלי', 'צ׳יפס', 'תפוצ׳יפס', 'פופקורן', 'מסטיק', 'סוכריות', 'ופל',
  // תינוקות
  'מטרנה', 'חיתולים', 'מגבונים', 'מחית לתינוק', 'דייסת תינוק',
  // ניקיון וטואלטיקה
  'נייר טואלט', 'מגבות נייר', 'סבון כלים', 'אבקת כביסה', 'מרכך כביסה', 'מטהר', 'אקונומיקה', 'ספריי ניקוי',
  'שקיות זבל', 'נייר אפייה', 'ניילון נצמד', 'שמפו', 'מרכך שיער', 'סבון גוף', 'משחת שיניים', 'מברשת שיניים',
  'דאודורנט', 'קרם גוף', 'תחבושות', 'טמפונים', 'גילוח',
];

export default function HomePage() {
  const today = new Date().toISOString().split('T')[0];
  const [activeView, setActiveView] = useState<'HOME' | 'INVENTORY' | 'SHOPPING' | 'TASKS' | 'EQUIPMENT' | 'TEMPLATES'>('HOME');
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
  const EQUIP_CATEGORIES = ['ניאו', 'חשמל', 'בגדים', 'תרופות', 'נעליים', 'ציוד נוסף'];

  const [newTask, setNewTask] = useState<Task>({
    title: '', description: '', urgency: 'סטנדרטית', assignee: 'כולם', target_date: today, status: 'לא התחלתי', depends_on_task_id: null
  });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskDraft, setEditTaskDraft] = useState<Task | null>(null);
  const [editTaskFocus, setEditTaskFocus] = useState<EditTaskFocus>('all');
  const [poofingTaskId, setPoofingTaskId] = useState<string | null>(null);
  const [categoryAddOpen, setCategoryAddOpen] = useState<string | null>(null);
  const [categoryAddInput, setCategoryAddInput] = useState('');
  const [categoryAddLoading, setCategoryAddLoading] = useState(false);
  const emptyQuickAddRow = () => ({ name: '', category: '', newCategory: '' });
  const [quickAddRows, setQuickAddRows] = useState<{ name: string; category: string; newCategory: string }[]>(
    [emptyQuickAddRow(), emptyQuickAddRow()]
  );
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [suggestRow, setSuggestRow] = useState<number | null>(null);
  const [catGuessingRow, setCatGuessingRow] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [categoryNameValue, setCategoryNameValue] = useState('');
  const [showCategorize, setShowCategorize] = useState(false);
  const [categorizeAssignments, setCategorizeAssignments] = useState<Record<string, string>>({});
  const [categorizeNewCats, setCategorizeNewCats] = useState<Record<string, string>>({});
  const [shoppingTemplates, setShoppingTemplates] = useState<ShoppingTemplate[]>([]);
  const [addedSummary, setAddedSummary] = useState<{ name: string; category: string }[]>([]);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateItemsText, setNewTemplateItemsText] = useState('');
  const [addingTemplateId, setAddingTemplateId] = useState<string | null>(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    fireworks: { top: number; left: number; delay: number; color: string; particles: { fx: number; fy: number; size: number }[] }[];
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
    const [invRes, shopRes, catsRes, tskRes, equipRes, tplRes, tplItemsRes] = await Promise.all([
      supabase.from('inventory_items').select('*'),
      supabase.from('shopping_list').select('*'),
      supabase.from('category_order').select('category_name').order('sort_order'),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('equipment_items').select('*'),
      supabase.from('shopping_templates').select('*').order('created_at'),
      supabase.from('shopping_template_items').select('*').order('sort_order'),
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
    if (tplRes.data) {
      const itemsByTemplate: Record<string, { id: string; item_name: string }[]> = {};
      for (const it of (tplItemsRes.data || []) as any[]) {
        const tid = it.template_id;
        (itemsByTemplate[tid] = itemsByTemplate[tid] || []).push({ id: it.id, item_name: it.item_name });
      }
      setShoppingTemplates((tplRes.data as any[]).map(t => ({
        id: t.id,
        name: t.name,
        items: itemsByTemplate[t.id] || [],
      })));
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => window.location.reload();

  const changeView = (view: typeof activeView) => {
    setActiveView(view); setIsMenuOpen(false); setIsSearchOpen(false); setSearchTerm(''); setAddedSummary([]);
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

  const updateInventoryField = async (item: Item, field: string, value: any) => {
    if ((item as any)[field] === value) return;
    setInventory(prev => prev.map(i => i.id === item.id ? { ...i, [field]: value } : i));
    await supabase.from('inventory_items').update({ [field]: value }).eq('id', item.id);
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

  // Known multi-word product names that stay together when the user types without commas.
  const KNOWN_COMPOUND_ITEMS = ['תפוח אדמה', 'תפוחי אדמה'];

  const splitShoppingInput = (text: string): string[] => {
    const trimmed = (text || '').trim();
    if (!trimmed) return [];
    // Commas present → each segment between commas is one item, verbatim.
    if (/[,،]/.test(trimmed)) {
      return trimmed.split(/[,،]/).map(s => s.trim()).filter(Boolean);
    }
    // No commas → every word is its own item, except known compound product names.
    const tokens = trimmed.split(/\s+/);
    const items: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      let matched = false;
      for (const compound of KNOWN_COMPOUND_ITEMS) {
        const compTokens = compound.split(/\s+/);
        if (i + compTokens.length <= tokens.length) {
          const slice = tokens.slice(i, i + compTokens.length).join(' ');
          if (slice === compound) {
            items.push(compound);
            i += compTokens.length;
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        items.push(tokens[i]);
        i++;
      }
    }
    return items;
  };

  const updateQuickAddRow = (idx: number, patch: Partial<{ name: string; category: string; newCategory: string }>) => {
    setQuickAddRows(prev => {
      const next = prev.map((r, i) => i === idx ? { ...r, ...patch } : r);
      // Auto-grow: typing into the last row appends a fresh empty row.
      if (idx === prev.length - 1 && next[idx].name.trim() && next.length < 20) {
        next.push(emptyQuickAddRow());
      }
      return next;
    });
  };

  // On entering an item, auto-pick a category (editable) if the user hasn't chosen one.
  const autoFillRowCategory = async (idx: number, rawName: string) => {
    const name = (rawName || '').trim();
    if (!name) return;
    const current = quickAddRows[idx];
    if (!current || current.category) return; // user already chose one
    setCatGuessingRow(idx);
    try {
      const guesses = await guessCategories([name]);
      const normalize = (n: string) => (n || '').replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
      const guess = guesses[normalize(name)];
      if (guess) {
        setCategories(prev => prev.includes(guess) ? prev : [...prev, guess]);
        setQuickAddRows(prev => prev.map((r, i) => (i === idx && !r.category) ? { ...r, category: guess } : r));
      }
    } finally {
      setCatGuessingRow(null);
    }
  };

  const startRenameCategory = (cat: string) => {
    setEditingCategoryName(cat);
    setCategoryNameValue(cat);
  };

  const saveRenameCategory = async (oldCat: string) => {
    const newCat = categoryNameValue.trim();
    setEditingCategoryName(null);
    if (!newCat || newCat === oldCat) return;
    await supabase.from('shopping_list').update({ category: newCat }).eq('category', oldCat);
    await supabase.from('category_order').update({ category_name: newCat }).eq('category_name', oldCat);
    setCategories(prev => Array.from(new Set(prev.map(c => c === oldCat ? newCat : c))));
    fetchData();
    showStatus(`✏️ הקטגוריה שונתה ל"${newCat}"`, true);
  };

  const deleteCategory = async (cat: string) => {
    if (!confirm(`למחוק את הקטגוריה "${cat}"? הפריטים שבה יעברו ל"כללי" (לא יימחקו).`)) return;
    await supabase.from('shopping_list').update({ category: 'כללי' }).eq('category', cat);
    await supabase.from('category_order').delete().eq('category_name', cat);
    setCategories(prev => prev.filter(c => c !== cat));
    fetchData();
    showStatus(`🗑️ הקטגוריה "${cat}" נמחקה`, true);
  };

  // Ask the parser to suggest a category per item name. Returns a map keyed by
  // normalized name. Unusable suggestions (uncertain/null) are omitted.
  const guessCategories = async (names: string[]): Promise<Record<string, string>> => {
    const normalize = (n: string) => (n || '').replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
    const guesses: Record<string, string> = {};
    const clean = names.map(n => (n || '').trim()).filter(Boolean);
    if (clean.length === 0) return guesses;
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        body: JSON.stringify({ text: clean.join(', '), categories }),
      });
      const data = await res.json();
      for (const it of ((data && data.items) || []) as any[]) {
        const itemName = (it.name || it.item_name || '').trim();
        const rawCat: string = (it.category || '').toString();
        const usable = rawCat && !['uncertain', 'null', 'לא ידוע'].includes(rawCat.toLowerCase()) && !it.needs_classification;
        if (itemName && usable) guesses[normalize(itemName)] = rawCat;
      }
    } catch {
      // network error → caller falls back to 'כללי'
    }
    return guesses;
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAddSubmitting) return;
    const rows = quickAddRows.filter(r => r.name.trim());
    if (rows.length === 0) return;
    setQuickAddSubmitting(true);
    showStatus('מעבד...', false);
    const normalize = (n: string) => (n || '').replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();

    // Items where the user did not pick a category get auto-classified.
    const userPicked = (r: { category: string; newCategory: string }) =>
      (r.category === '__other__' ? r.newCategory.trim() : r.category);
    const needGuess = rows.filter(r => !userPicked(r)).map(r => r.name.trim());
    const guesses = needGuess.length ? await guessCategories(needGuess) : {};

    const duplicates: string[] = [];
    const queued = new Set<string>();
    const summary: { name: string; category: string }[] = [];
    let added = 0;
    try {
      for (const row of rows) {
        const name = row.name.trim();
        let cat: string;
        if (row.category === '__other__') {
          cat = row.newCategory.trim() || guesses[normalize(name)] || 'כללי';
        } else if (row.category) {
          cat = row.category;
        } else {
          cat = guesses[normalize(name)] || 'כללי';
        }
        const base = normalize(name);
        if (!base || queued.has(base)) continue;
        if (shoppingList.some(s => normalize(s.item_name || '') === base)) {
          duplicates.push(name);
          continue;
        }
        queued.add(base);
        if (cat !== 'כללי' && !categories.includes(cat)) {
          await supabase.from('category_order').insert([{ category_name: cat, sort_order: 99 }]);
          setCategories(prev => Array.from(new Set([...prev, cat])));
        }
        await supabase.from('shopping_list').insert([{ item_name: name, category: cat }]);
        summary.push({ name, category: cat });
        added++;
      }
      if (duplicates.length > 0) {
        setDuplicateShoppingAlerts(prev => Array.from(new Set([...prev, ...duplicates])));
      }
      setAddedSummary(summary);
      // Single notification: the green summary panel itself states the
      // category per item, so no separate "added" status pill.
      if (added > 0) showStatus('');
      else if (duplicates.length > 0) showStatus('⚠️ כבר ברשימה', true);
      else showStatus('✅ עודכן', true);
      setQuickAddRows([emptyQuickAddRow(), emptyQuickAddRow()]);
      fetchData();
    } catch {
      showStatus('❌ שגיאה בשמירה', true);
    } finally {
      setQuickAddSubmitting(false);
    }
  };

  const addTemplateToShopping = async (template: ShoppingTemplate) => {
    if (addingTemplateId) return;
    if (!template.items.length) {
      showStatus('הרשימה ריקה', true);
      return;
    }
    setAddingTemplateId(template.id);
    showStatus('מעבד...', false);
    const normalize = (n: string) => (n || '').replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
    const names = template.items.map(i => i.item_name.trim()).filter(Boolean);

    // Ask the parser to suggest categories for the whole template in one call.
    const guesses = await guessCategories(names);

    const duplicates: string[] = [];
    const summary: { name: string; category: string }[] = [];
    let added = 0;
    try {
      for (const itemName of names) {
        const base = normalize(itemName);
        if (!base) continue;
        if (shoppingList.some(s => normalize(s.item_name || '') === base)) {
          duplicates.push(itemName);
          continue;
        }
        const cat = guesses[base] || 'כללי';
        if (cat && cat !== 'כללי' && !categories.includes(cat)) {
          await supabase.from('category_order').insert([{ category_name: cat, sort_order: 99 }]);
          setCategories(prev => Array.from(new Set([...prev, cat])));
        }
        await supabase.from('shopping_list').insert([{
          item_name: itemName,
          category: cat,
          category_auto: true,
        }]);
        summary.push({ name: itemName, category: cat });
        added++;
      }
      if (duplicates.length > 0) {
        setDuplicateShoppingAlerts(prev => Array.from(new Set([...prev, ...duplicates])));
      }
      setAddedSummary(summary);
      // Single notification: the green summary panel states the category.
      if (added > 0) showStatus('');
      else if (duplicates.length > 0) showStatus('⚠️ כל הפריטים כבר ברשימה', true);
      else showStatus('✅ עודכן', true);
      fetchData();
    } catch {
      showStatus('❌ שגיאה בשמירה', true);
    } finally {
      setAddingTemplateId(null);
    }
  };

  const createTemplate = async () => {
    const name = newTemplateName.trim();
    const items = newTemplateItemsText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    if (!name) {
      showStatus('❌ חסר שם רשימה', true);
      return;
    }
    if (items.length === 0) {
      showStatus('❌ אין פריטים ברשימה', true);
      return;
    }
    const { data: inserted, error } = await supabase
      .from('shopping_templates')
      .insert([{ name, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }])
      .select()
      .single();
    if (error || !inserted) {
      showStatus('❌ שגיאה ביצירה', true);
      return;
    }
    const itemsToInsert = items.map((item_name, idx) => ({
      template_id: (inserted as any).id,
      item_name,
      sort_order: idx + 1,
    }));
    await supabase.from('shopping_template_items').insert(itemsToInsert);
    setNewTemplateName('');
    setNewTemplateItemsText('');
    setShowCreateTemplate(false);
    showStatus(`✅ נוצרה הרשימה "${name}"`, true);
    fetchData();
  };

  const deleteTemplate = async (template: ShoppingTemplate) => {
    if (!confirm(`למחוק את הרשימה "${template.name}" לצמיתות?`)) return;
    await supabase.from('shopping_templates').delete().eq('id', template.id);
    showStatus(`🗑️ הרשימה "${template.name}" נמחקה`, true);
    fetchData();
  };

  const openCategorize = () => {
    setCategorizeAssignments({});
    setCategorizeNewCats({});
    setShowCategorize(true);
  };

  const applyCategorizeAssignments = async () => {
    const entries = Object.entries(categorizeAssignments).filter(([, v]) => v && v !== 'כללי');
    if (entries.length === 0) {
      setShowCategorize(false);
      setCategorizeAssignments({});
      return;
    }
    showStatus('מעבד...', false);
    let updated = 0;
    for (const [id, chosen] of entries) {
      let target = chosen;
      if (chosen === '__other__') {
        const custom = (categorizeNewCats[id] || '').trim();
        if (!custom) continue;
        target = custom;
        if (!categories.includes(target)) {
          await supabase.from('category_order').insert([{ category_name: target, sort_order: 99 }]);
          setCategories(prev => Array.from(new Set([...prev, target])));
        }
      }
      await supabase.from('shopping_list').update({ category: target }).eq('id', id);
      updated++;
    }
    setCategorizeAssignments({});
    setCategorizeNewCats({});
    setShowCategorize(false);
    fetchData();
    showStatus(`✅ סווגו ${updated} פריטים`, true);
  };

  const handleCategoryAdd = async (e: React.FormEvent, category: string) => {
    e.preventDefault();
    const text = categoryAddInput.trim();
    if (!text || categoryAddLoading) return;
    setCategoryAddLoading(true);
    const normalize = (n: string) => (n || '').replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
    try {
      const names = splitShoppingInput(text);
      if (names.length === 0) {
        showStatus('❌ לא זוהו פריטים', true);
        return;
      }
      const duplicates: string[] = [];
      const queuedBase = new Set<string>();
      const summary: { name: string; category: string }[] = [];
      let addedCount = 0;
      for (const name of names) {
        const baseName = normalize(name);
        if (!baseName || queuedBase.has(baseName)) continue;
        if (shoppingList.some(s => normalize(s.item_name || '') === baseName)) {
          duplicates.push(name);
          continue;
        }
        queuedBase.add(baseName);
        await supabase.from('shopping_list').insert([{ item_name: name, category }]);
        summary.push({ name, category });
        addedCount++;
      }
      if (duplicates.length > 0) {
        setDuplicateShoppingAlerts(prev => Array.from(new Set([...prev, ...duplicates])));
      }
      setAddedSummary(summary);
      // Single notification: the green summary panel states the category.
      if (addedCount > 0) {
        showStatus('');
      } else if (duplicates.length > 0) {
        showStatus('⚠️ כבר ברשימה', true);
      } else {
        showStatus('✅ עודכן', true);
      }
      setCategoryAddInput('');
      setCategoryAddOpen(null);
      fetchData();
    } catch {
      showStatus('❌ שגיאה בחיבור', true);
    } finally {
      setCategoryAddLoading(false);
    }
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
    const COLORS = ['#ff3b6b', '#ffd23f', '#3ddbff', '#7cf86b', '#ff7ee5', '#ff9533', '#9b6bff', '#5af0c2', '#ff5577'];
    const BALLOON_EMOJIS = ['🎈', '🎈', '🎈', '🎉', '🎊'];
    const fireworks = Array.from({ length: 16 }).map(() => {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const particleCount = 14 + Math.floor(Math.random() * 6);
      const baseDistance = 90 + Math.random() * 80;
      const particles = Array.from({ length: particleCount }).map((_, i) => {
        const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const distance = baseDistance * (0.7 + Math.random() * 0.6);
        return {
          fx: Math.cos(angle) * distance,
          fy: Math.sin(angle) * distance,
          size: 6 + Math.floor(Math.random() * 6),
        };
      });
      return {
        top: 10 + Math.random() * 70,
        left: 8 + Math.random() * 84,
        delay: Math.random() * 1800,
        color,
        particles,
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
      }, 3200);
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
  const resetPacking = async (listType: string) => {
    await supabase.from('equipment_items').update({ is_packed: false }).eq('list_type', listType);
    setEquipmentItems(prev => prev.map(i => i.list_type === listType ? { ...i, is_packed: false } : i));
    const todayStr = new Date().toISOString().split('T')[0];
    await supabase.from('equipment_sessions').upsert({ list_type: listType, last_pack_date: todayStr, household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' }, { onConflict: 'list_type,household_id' });
  };

  // Auto-reset the active equipment list when entering the view or switching
  // tabs, if a day has passed since it was last marked.
  useEffect(() => {
    if (activeView !== 'EQUIPMENT') return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('equipment_sessions').select('*').eq('list_type', equipListType).single();
      if (cancelled) return;
      const todayStr = new Date().toISOString().split('T')[0];
      if (data && data.last_pack_date !== todayStr) {
        await resetPacking(equipListType);
      }
    })();
    return () => { cancelled = true; };
  }, [activeView, equipListType]);

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
    .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '', 'he'));

  const filteredShoppingList = safeShoppingList
    .filter(s => (s.item_name || '').includes(searchTerm))
    .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '', 'he'));

  const displayCategories = Array.from(new Set([
    ...categories,
    ...safeInventory.map(i => i.category || 'כללי'),
    ...safeShoppingList.map(s => s.category || 'כללי')
  ])).filter(c => c !== 'uncertain' && c !== 'null');

  // Autocomplete pool: household history (shopping, inventory, templates) first,
  // then the general supermarket catalog. Names are stripped of leading emoji and
  // trailing "(N)" quantity so matching is clean.
  const stripName = (n: string) => (n || '')
    .replace(/^[^A-Za-z0-9֐-׿]+/, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();
  const suggestionPool: string[] = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (raw: string) => {
      const clean = stripName(raw);
      const key = clean.toLowerCase();
      if (clean && !seen.has(key)) { seen.add(key); out.push(clean); }
    };
    safeShoppingList.forEach(s => push(s.item_name || ''));
    safeInventory.forEach(i => push(i.item_name || ''));
    shoppingTemplates.forEach(t => t.items.forEach(it => push(it.item_name || '')));
    SUPERMARKET_ITEMS.forEach(push);
    return out;
  })();

  const activeTasks = tasks.filter(t => t.status !== 'סיימתי');
  const completedTasks = tasks.filter(t => t.status === 'סיימתי');

  const headerGradient = activeView === 'HOME' ? 'from-violet-600 via-fuchsia-600 to-orange-500' : activeView === 'INVENTORY' ? 'from-teal-600 to-emerald-500' : activeView === 'SHOPPING' ? 'from-rose-500 to-orange-500' : activeView === 'EQUIPMENT' ? 'from-sky-600 to-cyan-500' : activeView === 'TEMPLATES' ? 'from-amber-500 to-orange-500' : 'from-indigo-600 to-purple-700';

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
              <span
                className="absolute rounded-full animate-firework-flash"
                style={{
                  width: '14px',
                  height: '14px',
                  background: `radial-gradient(circle, #fff 0%, ${fw.color} 60%, transparent 100%)`,
                  boxShadow: `0 0 30px 8px ${fw.color}`,
                  animationDelay: `${fw.delay}ms`,
                  top: 0,
                  left: 0,
                }}
              />
              {fw.particles.map((p, pi) => (
                <span
                  key={pi}
                  className="absolute rounded-full animate-firework-particle"
                  style={{
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    backgroundColor: fw.color,
                    boxShadow: `0 0 12px ${fw.color}, 0 0 4px #fff`,
                    animationDelay: `${fw.delay}ms`,
                    ['--fx' as any]: `${p.fx}px`,
                    ['--fy' as any]: `${p.fy}px`,
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
                    <button className="p-4 text-right font-black hover:bg-amber-50 border-b flex justify-between" onClick={() => changeView('TEMPLATES')}><span>רשימות</span><span>📝</span></button>
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
          <div className="mb-4 relative">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">🔎</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={activeView === 'INVENTORY' ? 'חפש פריט במלאי לעריכה...' : 'חפש פריט בקניות לעריכה...'}
              className={`w-full pr-12 pl-12 py-3 bg-white rounded-2xl border-2 text-sm font-bold outline-none transition-all shadow-sm ${searchTerm ? (activeView === 'INVENTORY' ? 'border-teal-300 ring-2 ring-teal-100' : 'border-rose-300 ring-2 ring-rose-100') : 'border-slate-200 focus:border-slate-300'}`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 font-black text-xs pointer-events-auto transition-colors flex items-center justify-center"
                title="נקה חיפוש"
              >
                ✕
              </button>
            )}
            {searchTerm && (
              <div className="absolute -bottom-5 right-3 text-[10px] font-bold text-slate-400">
                {activeView === 'INVENTORY'
                  ? `${filteredInventory.length} תוצאות — לחיצה על שם / קטגוריה / מיקום פותחת לעריכה`
                  : `${filteredShoppingList.length} תוצאות — לחיצה על שם או קטגוריה פותחת לעריכה`}
              </div>
            )}
          </div>
        )}

        {activeView === 'INVENTORY' && (
          <div className="bg-white p-5 rounded-[2rem] shadow-xl mb-6 border border-slate-50 relative z-20">
            <form onSubmit={handleUpdate} className="space-y-3">
              <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="מה הוספנו/הורדנו מהמלאי? (למשל: תוריד את כל המיונז)" className="w-full p-4 bg-slate-50 rounded-2xl text-sm min-h-[70px] border-none focus:ring-2 focus:ring-amber-300 pointer-events-auto" />
              <button type="submit" className="w-full p-4 rounded-2xl text-white font-black text-lg active:scale-95 transition-all shadow-md pointer-events-auto bg-teal-600 hover:bg-teal-700">
                עדכן מלאי ✨
              </button>
            </form>
            {status && (
              <div className="mt-4 flex justify-center animate-in fade-in slide-in-from-bottom-2">
                <span className={`px-4 py-2 rounded-full text-xs font-bold shadow-sm ${status.includes('❌') ? 'bg-red-100 text-red-600' : status.includes('🤔') || status.includes('כמה') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{status}</span>
              </div>
            )}
          </div>
        )}

        {activeView === 'SHOPPING' && (
          <div className="bg-white p-5 rounded-[2rem] shadow-xl mb-6 border border-slate-50 relative z-20">
            <form onSubmit={handleQuickAddSubmit} className="space-y-3">
              {quickAddRows.map((row, i) => {
                const dropdownCats = displayCategories.filter(c => c && c !== 'uncertain' && c !== 'null' && c !== 'כללי');
                const q = stripName(row.name).toLowerCase();
                const matches = (suggestRow === i && q.length >= 1)
                  ? suggestionPool.filter(s => {
                      const sl = s.toLowerCase();
                      return sl.includes(q) && sl !== q;
                    }).slice(0, 7)
                  : [];
                return (
                  <div key={`qa-${i}`} className="space-y-2">
                    <div className="flex gap-2 items-stretch">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateQuickAddRow(i, { name: e.target.value })}
                          onFocus={() => setSuggestRow(i)}
                          onBlur={() => { window.setTimeout(() => setSuggestRow(prev => prev === i ? null : prev), 150); autoFillRowCategory(i, row.name); }}
                          placeholder={i === 0 ? 'פריט לקנייה...' : 'פריט נוסף (אופציונלי)'}
                          className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-rose-300 pointer-events-auto"
                          autoComplete="off"
                        />
                        {matches.length > 0 && (
                          <div className="absolute z-30 top-full mt-1 inset-x-0 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden max-h-60 overflow-y-auto">
                            {matches.map(m => (
                              <button
                                key={m}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  updateQuickAddRow(i, { name: m });
                                  setSuggestRow(null);
                                  autoFillRowCategory(i, m);
                                }}
                                className="w-full text-right px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 border-b border-slate-50 last:border-0 pointer-events-auto transition-colors"
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <select
                        value={row.category}
                        onChange={(e) => updateQuickAddRow(i, { category: e.target.value, newCategory: e.target.value === '__other__' ? row.newCategory : '' })}
                        className="p-3 bg-slate-50 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-rose-300 pointer-events-auto min-w-[110px]"
                      >
                        <option value="">{catGuessingRow === i ? '🤖 מסווג…' : '🤖 סיווג אוטומטי'}</option>
                        <option value="כללי">כללי</option>
                        {dropdownCats.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__other__">+ אחר…</option>
                      </select>
                    </div>
                    {row.category === '__other__' && (
                      <input
                        type="text"
                        value={row.newCategory}
                        onChange={(e) => updateQuickAddRow(i, { newCategory: e.target.value })}
                        placeholder="הקלד שם קטגוריה חדשה..."
                        className="w-full p-3 bg-rose-50 border-2 border-rose-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-300 pointer-events-auto"
                      />
                    )}
                  </div>
                );
              })}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={quickAddSubmitting || quickAddRows.every(r => !r.name.trim())}
                  className="flex-1 p-4 rounded-2xl text-white font-black text-lg active:scale-95 transition-all shadow-md pointer-events-auto bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed"
                >
                  הוסף לקניות 🛒
                </button>
                <button
                  type="button"
                  onClick={openCategorize}
                  className="px-4 py-4 rounded-2xl text-white font-black text-sm active:scale-95 transition-all shadow-md pointer-events-auto bg-indigo-500 hover:bg-indigo-600"
                  title="חלוקת פריטים מ׳כללי׳ לקטגוריות"
                >
                  📁 חלוקה
                </button>
              </div>
            </form>
            {status && (
              <div className="mt-4 flex justify-center animate-in fade-in slide-in-from-bottom-2">
                <span className={`px-4 py-2 rounded-full text-xs font-bold shadow-sm ${status.includes('❌') ? 'bg-red-100 text-red-600' : status.includes('⚠️') || status.includes('🤔') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{status}</span>
              </div>
            )}
          </div>
        )}

        {showCategorize && activeView === 'SHOPPING' && (() => {
          const klaliItems = filteredShoppingList.filter(s => !s.category || s.category === 'כללי');
          const dropdownCats = displayCategories.filter(c => c && c !== 'uncertain' && c !== 'null' && c !== 'כללי');
          return (
            <div className="mb-6 bg-indigo-50 border-2 border-indigo-200 p-5 rounded-[2rem] shadow-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-black text-lg text-indigo-900">📁 חלוקה לקטגוריות</h3>
                <button
                  type="button"
                  onClick={() => { setShowCategorize(false); setCategorizeAssignments({}); setCategorizeNewCats({}); }}
                  className="bg-white text-slate-500 hover:bg-slate-100 w-8 h-8 rounded-full font-black pointer-events-auto"
                >
                  ✕
                </button>
              </div>
              {klaliItems.length === 0 ? (
                <p className="text-sm text-slate-500 italic">אין פריטים בכללי 🎉</p>
              ) : (
                <>
                  <p className="text-xs text-indigo-700 mb-3 font-bold">בחר קטגוריה לכל פריט (או השאר ב״כללי״):</p>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {klaliItems.map(item => {
                      const chosen = categorizeAssignments[item.id] || 'כללי';
                      return (
                        <div key={`cz-${item.id}`} className="bg-white p-3 rounded-xl border border-indigo-100 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="flex-1 font-bold text-slate-800 text-sm">{item.item_name}</span>
                            <select
                              value={chosen}
                              onChange={(e) => setCategorizeAssignments(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="p-2 bg-slate-50 rounded-lg text-xs font-bold border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-300 pointer-events-auto min-w-[100px]"
                            >
                              <option value="כללי">כללי</option>
                              {dropdownCats.map(c => <option key={c} value={c}>{c}</option>)}
                              <option value="__other__">+ אחר…</option>
                            </select>
                          </div>
                          {chosen === '__other__' && (
                            <input
                              type="text"
                              value={categorizeNewCats[item.id] || ''}
                              onChange={(e) => setCategorizeNewCats(prev => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="קטגוריה חדשה..."
                              className="w-full p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-rose-300 pointer-events-auto"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-4 pt-3 border-t border-indigo-200">
                    <button
                      type="button"
                      onClick={applyCategorizeAssignments}
                      className="flex-1 bg-indigo-600 text-white p-3 rounded-xl font-black text-sm pointer-events-auto hover:bg-indigo-700 transition-colors"
                    >
                      💾 שמור שינויים
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCategorize(false); setCategorizeAssignments({}); setCategorizeNewCats({}); }}
                      className="bg-slate-200 text-slate-600 px-4 py-3 rounded-xl font-bold text-sm pointer-events-auto hover:bg-slate-300 transition-colors"
                    >
                      ביטול
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })()}

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

        {addedSummary.length > 0 && (activeView === 'SHOPPING' || activeView === 'TEMPLATES') && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 p-4 rounded-2xl">
            <div className="flex justify-between items-center mb-3">
              <span className="font-black text-emerald-800 text-sm">✅ נוסף לקניות</span>
              <button
                onClick={() => setAddedSummary([])}
                className="bg-white text-slate-500 hover:bg-slate-100 w-7 h-7 rounded-full font-black text-xs pointer-events-auto transition-colors"
                title="סגור"
              >
                ✕
              </button>
            </div>
            <ul className="space-y-1.5">
              {addedSummary.map((a, i) => (
                <li key={`added-${i}`} className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-bold text-emerald-900">{a.name}</span>
                  <span className="text-emerald-400">←</span>
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-black">📁 {a.category}</span>
                </li>
              ))}
            </ul>
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
                        {itemsInCat.map(item => <InventoryCard key={item.id} item={item} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} updateExactQuantity={updateExactQuantity} onPlus={() => handlePlus(item)} onMinus={() => handleMinus(item)} onAddToShopping={addToShopping} shoppingList={shoppingList} onDelete={deleteInventoryItem} editingCatItemId={editingCatItemId} editCatValue={editCatValue} setEditingCatItemId={setEditingCatItemId} setEditCatValue={setEditCatValue} saveEditedCategory={saveEditedCategory} categories={displayCategories} onUpdateLocation={(loc: string) => updateInventoryField(item, 'location', loc)} highlight={!!searchTerm && (item.item_name || '').includes(searchTerm)} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredInventory.map(item => <InventoryCard key={item.id} item={item} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} updateExactQuantity={updateExactQuantity} onPlus={() => handlePlus(item)} onMinus={() => handleMinus(item)} onAddToShopping={addToShopping} shoppingList={shoppingList} onDelete={deleteInventoryItem} editingCatItemId={editingCatItemId} editCatValue={editCatValue} setEditingCatItemId={setEditingCatItemId} setEditCatValue={setEditCatValue} saveEditedCategory={saveEditedCategory} categories={displayCategories} onUpdateLocation={(loc: string) => updateInventoryField(item, 'location', loc)} highlight={!!searchTerm && (item.item_name || '').includes(searchTerm)} />)}
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
                  const isAddOpen = categoryAddOpen === cat;
                  if (list.length === 0 && !isAddOpen && searchTerm) return null;
                  return (
                    <div key={`shop-cat-${cat}`} className="space-y-3">
                      <div className="flex items-center justify-between gap-2 pr-2">
                        {editingCategoryName === cat ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              autoFocus
                              value={categoryNameValue}
                              onChange={(e) => setCategoryNameValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveRenameCategory(cat); if (e.key === 'Escape') setEditingCategoryName(null); }}
                              className="flex-1 border-b-2 border-rose-500 bg-rose-50 px-2 py-1 outline-none font-black text-sm pointer-events-auto"
                            />
                            <button type="button" onClick={() => saveRenameCategory(cat)} className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-black pointer-events-auto">✅</button>
                            <button type="button" onClick={() => setEditingCategoryName(null)} className="bg-slate-100 text-slate-400 px-2 py-1 rounded-lg text-xs font-black pointer-events-auto">✕</button>
                          </div>
                        ) : (
                          <h3 className="font-black text-rose-700 text-sm uppercase border-r-4 border-rose-400 pr-2 flex-1">{cat}</h3>
                        )}
                        {editingCategoryName !== cat && (
                          <div className="flex items-center gap-1.5">
                            {cat !== 'כללי' && (
                              <>
                                <button type="button" onClick={() => startRenameCategory(cat)} title="שנה שם קטגוריה" className="text-[11px] font-black bg-slate-100 text-slate-500 hover:bg-slate-200 px-2.5 py-1.5 rounded-xl pointer-events-auto transition-colors">✏️</button>
                                <button type="button" onClick={() => deleteCategory(cat)} title="מחק קטגוריה" className="text-[11px] font-black bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 px-2.5 py-1.5 rounded-xl pointer-events-auto transition-colors">🗑️</button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setCategoryAddOpen(prev => prev === cat ? null : cat);
                                setCategoryAddInput('');
                              }}
                              className="text-[11px] font-black bg-rose-100 text-rose-700 hover:bg-rose-200 px-3 py-1.5 rounded-xl pointer-events-auto transition-colors"
                            >
                              {isAddOpen ? '✕ סגור' : '+ הוסף'}
                            </button>
                          </div>
                        )}
                      </div>
                      {isAddOpen && (
                        <form onSubmit={(e) => handleCategoryAdd(e, cat)} className="bg-rose-50 border border-rose-200 p-3 rounded-2xl flex flex-wrap gap-2 items-stretch">
                          <input
                            autoFocus
                            value={categoryAddInput}
                            onChange={(e) => setCategoryAddInput(e.target.value)}
                            placeholder={`הוסף ל"${cat}" — תפוזים אפרסק, קישוא צהוב`}
                            className="flex-1 min-w-[160px] bg-white p-3 rounded-xl text-sm font-bold border border-rose-100 outline-none focus:ring-2 focus:ring-rose-300 pointer-events-auto"
                          />
                          <button
                            type="submit"
                            disabled={categoryAddLoading || !categoryAddInput.trim()}
                            className="bg-rose-600 text-white px-4 py-2 rounded-xl font-black text-sm shadow-sm hover:bg-rose-700 transition-all disabled:bg-rose-300 disabled:cursor-not-allowed pointer-events-auto"
                          >
                            {categoryAddLoading ? '...' : 'הוסף ✓'}
                          </button>
                        </form>
                      )}
                      {list.length > 0 && (
                        <div className="grid gap-3">
                          {list.map(s => <ShoppingCard key={s.id} item={s} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} editingCatItemId={editingCatItemId} editCatValue={editCatValue} setEditingCatItemId={setEditingCatItemId} setEditCatValue={setEditCatValue} saveEditedCategory={saveEditedCategory} categories={displayCategories} onDelete={deleteShoppingItem} onMoveToInventory={moveShoppingToInventory} highlight={!!searchTerm && (s.item_name || '').includes(searchTerm)} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredShoppingList.map(s => <ShoppingCard key={s.id} item={s} editingId={editingId} editNameValue={editNameValue} setEditingId={setEditingId} setEditNameValue={setEditNameValue} saveEditedName={saveEditedName} editingCatItemId={editingCatItemId} editCatValue={editCatValue} setEditingCatItemId={setEditingCatItemId} setEditCatValue={setEditCatValue} saveEditedCategory={saveEditedCategory} categories={displayCategories} onDelete={deleteShoppingItem} onMoveToInventory={moveShoppingToInventory} highlight={!!searchTerm && (s.item_name || '').includes(searchTerm)} />)}
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
            {/* List type tabs */}
            <div className="flex gap-1 p-1 bg-white rounded-xl shadow-sm border border-slate-100">
              {(['חו"ל', 'חד"כ', 'סופ"ש'] as const).map(lt => (
                <button key={lt} onClick={() => setEquipListType(lt)} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all pointer-events-auto ${equipListType === lt ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>{lt}</button>
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
                    onClick={() => resetPacking(equipListType)}
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

            {unpackedEquip.length === 0 && (
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

        {activeView === 'TEMPLATES' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl">
              <p className="text-sm font-bold text-amber-900">
                לחיצה על רשימה תוסיף את כל הפריטים שבה לרשימת הקניות. אפשר לערוך, ליצור חדשות, או למחוק.
              </p>
            </div>

            {!showCreateTemplate && (
              <button
                type="button"
                onClick={() => { setShowCreateTemplate(true); setNewTemplateName(''); setNewTemplateItemsText(''); }}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-2xl font-black shadow-md active:scale-95 transition-all pointer-events-auto"
              >
                + צור רשימה חדשה
              </button>
            )}

            {showCreateTemplate && (
              <div className="bg-white p-5 rounded-[2rem] shadow-xl border border-amber-100 space-y-3">
                <h3 className="font-black text-lg text-amber-900">רשימה חדשה</h3>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="שם הרשימה (למשל: ארוחת שישי)"
                  className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm border-none outline-none focus:ring-2 focus:ring-amber-300 pointer-events-auto"
                />
                <textarea
                  value={newTemplateItemsText}
                  onChange={(e) => setNewTemplateItemsText(e.target.value)}
                  placeholder={"פריט אחד בכל שורה. למשל:\n🍅 עגבניות\n🥒 מלפפון\n🧀 גבינה"}
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm min-h-[160px] border-none outline-none focus:ring-2 focus:ring-amber-300 pointer-events-auto"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={createTemplate}
                    className="flex-1 bg-amber-600 text-white p-3 rounded-xl font-black text-sm hover:bg-amber-700 pointer-events-auto"
                  >
                    💾 שמור רשימה
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreateTemplate(false); setNewTemplateName(''); setNewTemplateItemsText(''); }}
                    className="bg-slate-200 text-slate-600 px-4 py-3 rounded-xl font-bold text-sm hover:bg-slate-300 pointer-events-auto"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            {status && (
              <div className="flex justify-center">
                <span className={`px-4 py-2 rounded-full text-xs font-bold shadow-sm ${status.includes('❌') ? 'bg-red-100 text-red-600' : status.includes('⚠️') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{status}</span>
              </div>
            )}

            {shoppingTemplates.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-400">
                <span className="text-4xl block mb-3">📝</span>
                <p className="font-bold text-sm">אין עדיין רשימות. צור רשימה ראשונה למעלה.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {shoppingTemplates.map(tpl => {
                  const isExpanded = expandedTemplateId === tpl.id;
                  const isAdding = addingTemplateId === tpl.id;
                  return (
                    <div key={tpl.id} className="bg-white rounded-[2rem] shadow-md border border-amber-50 overflow-hidden">
                      <div className="p-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedTemplateId(isExpanded ? null : tpl.id)}
                          className="flex-1 text-right pointer-events-auto"
                        >
                          <h3 className="font-black text-lg text-slate-800">{tpl.name}</h3>
                          <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                            {tpl.items.length} פריטים {isExpanded ? '— לחיצה לסגירה' : '— לחיצה לתצוגה'}
                          </p>
                        </button>
                        <button
                          type="button"
                          disabled={isAdding}
                          onClick={() => addTemplateToShopping(tpl)}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-3 rounded-xl font-black text-sm shadow-md pointer-events-auto disabled:bg-rose-300 disabled:cursor-not-allowed"
                          title="הוסף את כל הפריטים לקניות"
                        >
                          {isAdding ? '...' : '🛒 הוסף'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTemplate(tpl)}
                          className="bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 w-9 h-9 rounded-xl font-black text-xs pointer-events-auto"
                          title="מחק רשימה"
                        >
                          🗑️
                        </button>
                      </div>
                      {isExpanded && tpl.items.length > 0 && (
                        <div className="px-4 pb-4 pt-2 border-t border-amber-100 bg-amber-50/30">
                          <ul className="space-y-1">
                            {tpl.items.map(it => (
                              <li key={it.id} className="text-sm font-bold text-slate-700">
                                <span className="text-amber-500 mr-1">•</span> {it.item_name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
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

function InventoryCard({ item, editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName, updateExactQuantity, onPlus, onMinus, onAddToShopping, shoppingList, onDelete, editingCatItemId, editCatValue, setEditingCatItemId, setEditCatValue, saveEditedCategory, categories, onUpdateLocation, highlight }: any) {
  const isLow = (item.quantity || 0) <= 2;
  const alreadyInShopping = shoppingList?.some((s: any) => (s.item_name || '').includes(item.item_name));
  const otherLocation = (item.location || 'מזווה') === 'מקרר' ? 'מזווה' : 'מקרר';
  const locEmoji = (item.location || 'מזווה') === 'מקרר' ? '❄️' : '🏠';
  return (
    <div className={`flex flex-col gap-2 bg-white p-4 rounded-[1.5rem] shadow-sm border transition-shadow hover:shadow-md ${highlight ? 'border-amber-400 ring-2 ring-amber-200 bg-amber-50/30' : isLow ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'}`}>
      <div className="flex justify-between items-center gap-2">
        <div className="text-right flex-1 min-w-0">
          {editingId === item.id ? (
            <div className="flex items-center gap-2 mb-1">
              <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEditedName(item.id, 'inventory_items')} className="border-b-2 border-teal-500 bg-teal-50 px-2 py-1 outline-none font-bold text-lg w-[120px] pointer-events-auto" />
              <button onClick={() => saveEditedName(item.id, 'inventory_items')} className="bg-green-100 text-green-700 p-2 rounded-lg pointer-events-auto shadow-sm">✅</button>
            </div>
          ) : (
            <span onClick={() => {setEditingId(item.id); setEditNameValue(item.item_name || 'פריט לא ידוע');}} className="block font-bold text-lg text-slate-800 cursor-pointer hover:text-teal-600 hover:underline decoration-dashed decoration-slate-300 pointer-events-auto transition-colors">{item.item_name || 'פריט לא ידוע'}</span>
          )}
          {item.updated_at && (
            <span className="text-[10px] font-bold text-slate-400 block mt-0.5">{new Date(item.updated_at).toLocaleDateString('he-IL')}</span>
          )}
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

      <div className="flex items-center gap-2 flex-wrap text-[10px] font-black">
        {editingCatItemId === item.id ? (
          <div className="flex items-center gap-1 flex-wrap flex-1">
            {categories?.filter((c: string) => c !== 'uncertain' && c !== 'null').map((cat: string) => (
              <button key={cat} type="button" onClick={() => saveEditedCategory(item.id, 'inventory_items', cat)} className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-lg text-[10px] font-bold hover:bg-teal-500 hover:text-white transition-all pointer-events-auto">{cat}</button>
            ))}
            <input value={editCatValue} onChange={(e) => setEditCatValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEditedCategory(item.id, 'inventory_items')} placeholder="קטגוריה חדשה..." className="border-b border-teal-300 bg-transparent px-1 outline-none text-[10px] font-bold w-[90px] pointer-events-auto" autoFocus />
            <button type="button" onClick={() => saveEditedCategory(item.id, 'inventory_items')} className="text-[10px] font-black text-green-600 pointer-events-auto">✅</button>
            <button type="button" onClick={() => setEditingCatItemId(null)} className="text-[10px] font-black text-slate-400 pointer-events-auto">✕</button>
          </div>
        ) : (
          <button type="button" onClick={() => { setEditingCatItemId(item.id); setEditCatValue(item.category || 'כללי'); }} className="bg-slate-50 text-slate-500 hover:text-teal-600 hover:bg-teal-50 px-2 py-1 rounded-full pointer-events-auto transition-colors underline decoration-dashed decoration-slate-300">📁 {item.category || 'כללי'}</button>
        )}
        <button type="button" onClick={() => onUpdateLocation(otherLocation)} className="bg-slate-50 text-slate-500 hover:text-teal-600 hover:bg-teal-50 px-2 py-1 rounded-full pointer-events-auto transition-colors" title={`עבור ל${otherLocation}`}>{locEmoji} {item.location || 'מזווה'}</button>
      </div>
    </div>
  );
}

function ShoppingCard({ item, editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName, editingCatItemId, editCatValue, setEditingCatItemId, setEditCatValue, saveEditedCategory, categories, onDelete, onMoveToInventory, highlight }: any) {
  const [showQtyDialog, setShowQtyDialog] = useState(false);
  const [qty, setQty] = useState(1);
  return (
    <div className={`flex flex-col gap-3 bg-white p-4 rounded-[1.5rem] shadow-sm border transition-colors ${highlight ? 'border-amber-400 ring-2 ring-amber-200 bg-amber-50/30' : 'border-rose-50 hover:border-rose-100'}`}>
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