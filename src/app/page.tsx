'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const HOUSEHOLD = '92e1a987-99b7-41ec-93fb-ae2ada2bcf72';

type Item = { id?: string; item_name: string; name?: string; quantity: number; category: string; location: string; updated_at?: string; needs_classification?: boolean; removeAll?: boolean };
type Task = { id?: string; title: string; description?: string; urgency: string; assignee: string; target_date: string; status: string; depends_on_task_id?: string | null };
type EditTaskFocus = 'title' | 'urgency' | 'date' | 'assignee' | 'depends' | 'all';
type EquipmentItem = { id?: string; list_type: string; category: string; item_name: string; is_packed: boolean };
type ShoppingTemplate = { id: string; name: string; items: { id: string; item_name: string; category?: string | null }[] };
type DisambiguationTask = { originalName: string; matches: Item[]; quantityToSubtract: number; removeAll: boolean };
type WordChoiceTask = { originalName: string; options: string[]; category: string };
type View = 'HOME' | 'INVENTORY' | 'SHOPPING' | 'TASKS' | 'TEMPLATES' | 'SETTINGS';
type NoteKind = 'ok' | 'warn' | 'danger' | 'info';
type Note = { kind: NoteKind; text: string } | null;

const THEME_OPTIONS = [
  { key: 'pastel',   name: 'פסטל',    desc: 'לבנדר, ורוד ומנטה — רך ומודרני',      bg: '#f7f4ff', primary: '#7c5cf0', head: '#4a3a80' },
  { key: 'lyra',     name: 'ליירה',   desc: 'קרם ואלמוג, כותרות סריף, קווים דקים', bg: '#fbf6ee', primary: '#d15c2c', head: '#1e2c5f' },
  { key: 'ocean',    name: 'אוקיינוס', desc: 'תכלת וטורקיז, פינות רכות ורחבות',    bg: '#eef8ff', primary: '#0284c7', head: '#0c4a6e' },
  { key: 'sunset',   name: 'סורבה',   desc: 'אפרסק וורוד שקיעה, חם ורווי',        bg: '#fff6ed', primary: '#ea6a09', head: '#9a3412' },
  { key: 'mono',     name: 'מינימל',  desc: 'שחור־לבן, בלי צבע ובלי צללים',       bg: '#fafafa', primary: '#18181b', head: '#09090b' },
  { key: 'midnight', name: 'חצות',    desc: 'כהה, סגול זוהר על רקע לילי',         bg: '#14131c', primary: '#8b63ff', head: '#cfc6ff' },
];

const FONT_OPTIONS = [
  { key: 'heebo',     name: 'היבו',        desc: 'נקי ומודרני',   varName: 'var(--font-heebo)' },
  { key: 'assistant', name: 'אסיסטנט',    desc: 'קליל וידידותי', varName: 'var(--font-assistant)' },
  { key: 'rubik',     name: 'רוביק',       desc: 'עגלגל ובולט',   varName: 'var(--font-rubik)' },
  { key: 'varela',    name: 'ורלה ראונד', desc: 'רך ומעוגל',     varName: 'var(--font-varela)' },
  { key: 'frank',     name: 'פרנק רוהל',  desc: 'קלאסי עם אופי', varName: 'var(--font-frank)' },
];

// Curated common Israeli-supermarket products, merged at runtime with the
// household's own history to drive autocomplete.
const SUPERMARKET_ITEMS: string[] = [
  'חלב', 'חלב סויה', 'חלב שקדים', 'חלב שיבולת שועל', 'שמנת מתוקה', 'שמנת חמוצה', 'גבינה לבנה', 'גבינה צהובה',
  'קוטג׳', 'גבינת שמנת', 'גבינה בולגרית', 'גבינת פטה', 'מוצרלה', 'פרמזן', 'לבנה', 'יוגורט', 'יוגורט יווני',
  'גיל', 'מעדן', 'חמאה', 'מרגרינה', 'ביצים', 'ביצים חופש',
  'עגבניות', 'מלפפון', 'בצל', 'בצל סגול', 'שום', 'גזר', 'תפוח אדמה', 'בטטה', 'פלפל', 'גמבה', 'חציל',
  'קישוא', 'קישוא צהוב', 'כרוב', 'כרובית', 'ברוקולי', 'חסה', 'חסה אייסברג', 'תרד', 'פטרוזיליה', 'כוסברה',
  'שמיר', 'נענע', 'בזיליקום', 'סלרי', 'לימון', 'זנגביל', 'צנון', 'סלק', 'דלעת', 'תירס', 'שעועית ירוקה',
  'אפונה', 'פטריות', 'אבוקדו', 'עגבניות שרי', 'בצל ירוק',
  'תפוח', 'בננה', 'תפוז', 'קלמנטינה', 'אגס', 'ענבים', 'אבטיח', 'מלון', 'תות', 'אפרסק', 'נקטרינה', 'שזיף',
  'משמש', 'מנגו', 'אננס', 'קיווי', 'רימון', 'תמר', 'ליצ׳י', 'אשכולית', 'פומלה',
  'עוף', 'חזה עוף', 'שוקיים', 'כנפיים', 'בשר טחון', 'אנטריקוט', 'שניצל', 'נקניקיות', 'קבב',
  'סלמון', 'טונה', 'דג', 'פילה דג', 'הודו', 'שווארמה',
  'לחם', 'לחם אחיד', 'לחמניות', 'פיתות', 'לחם מחמצת', 'בגט', 'חלה', 'טורטיה', 'קרואסון', 'עוגיות',
  'ביסקוויטים', 'קרקרים', 'מצות',
  'אורז', 'פסטה', 'ספגטי', 'קוסקוס', 'בורגול', 'קינואה', 'עדשים', 'חומוס יבש', 'שעועית יבשה', 'קמח',
  'קמח מלא', 'סוכר', 'סוכר חום', 'מלח', 'פלפל שחור', 'פפריקה', 'כמון', 'קורנפלור', 'אבקת אפייה', 'שמרים',
  'שמן', 'שמן זית', 'שמן קנולה', 'חומץ', 'רוטב סויה', 'קטשופ', 'מיונז', 'חרדל', 'טחינה', 'ריבה', 'דבש',
  'ממרח שוקולד', 'חמאת בוטנים', 'רסק עגבניות', 'תירס משומר', 'טונה בקופסה', 'זיתים', 'מלפפון חמוץ',
  'קורנפלקס', 'גרנולה', 'שיבולת שועל', 'אגוזים', 'שקדים', 'צימוקים', 'קפה', 'קפה נמס', 'תה', 'קקאו',
  'מים', 'מים מינרלים', 'סודה', 'קולה', 'ספרייט', 'מיץ', 'מיץ תפוזים', 'מיץ ענבים', 'לימונדה', 'בירה', 'יין',
  'גלידה', 'ירקות קפואים', 'אפונה קפואה', 'פיצה קפואה', 'מלאווח', 'בורקס', 'קרח',
  'שוקולד', 'חטיף', 'במבה', 'ביסלי', 'צ׳יפס', 'תפוצ׳יפס', 'פופקורן', 'מסטיק', 'סוכריות', 'ופל',
  'מטרנה', 'חיתולים', 'מגבונים', 'מחית לתינוק', 'דייסת תינוק',
  'נייר טואלט', 'מגבות נייר', 'סבון כלים', 'אבקת כביסה', 'מרכך כביסה', 'מטהר', 'אקונומיקה', 'ספריי ניקוי',
  'שקיות זבל', 'נייר אפייה', 'ניילון נצמד', 'שמפו', 'מרכך שיער', 'סבון גוף', 'משחת שיניים', 'מברשת שיניים',
  'דאודורנט', 'קרם גוף', 'תחבושות', 'טמפונים', 'סכיני גילוח',
  'דלי מגבונים', 'מגבונים לחים', 'מגבוני חיטוי', 'נוזל כלים', 'ספוג כלים',
  'כפפות חד פעמיות', 'צלחות חד פעמי', 'כוסות חד פעמי', 'סכום חד פעמי', 'מפיות נייר',
  'שקיות אשפה', 'קפסולות כביסה', 'טאבלטים למדיח', 'מלח למדיח', 'מבריק למדיח',
];

/* ------------------------------------------------------------------ *
 * icons — one 20px stroke set, currentColor, replaces emoji as UI
 * ------------------------------------------------------------------ */
const PATHS: Record<string, string> = {
  box: 'M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16V8Zm0 0L12 12.5 20.5 8M12 12.5v8',
  cart: 'M3 4h2.2l2.4 10.4a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H6.4M10 20.5h.01M17 20.5h.01',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  pin: 'M9 3.5h6M12 3.5v5M6.5 20.5h11l-2-8.5a4 4 0 0 0-7 0l-2 8.5Z',
  gear: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm8-3.2-.1-1.1 1.6-1.5-1.6-2.8-2.1.6-1-.6-.4-2.1h-3.2l-.4 2.1-1 .6-2.1-.6-1.6 2.8 1.6 1.5-.1 1.1.1 1.1-1.6 1.5 1.6 2.8 2.1-.6 1 .6.4 2.1h3.2l.4-2.1 1-.6 2.1.6 1.6-2.8-1.6-1.5.1-1.1Z',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.8.3L20 21.5',
  refresh: 'M20 12a8 8 0 1 1-2.6-5.9M20 4.5V9h-4.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 11v5.5M13.5 11v5.5',
  pencil: 'M4 20h4L20 8l-4-4L4 16v4Zm11-13 4 4',
  check: 'M4.5 12.5 9.5 17.5 19.5 6.5',
  x: 'M6 6l12 12M18 6 6 18',
  chevron: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  snow: 'M12 3v18M4 7.5l16 9M20 7.5l-16 9',
  suitcase: 'M4 8h16v12H4V8Zm5 0V5h6v3M4 13h16',
  home: 'M4 10.5 12 4l8 6.5V20H4v-9.5Z',
  home_out: 'M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4v-9.5Z',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 7.5V12l3.5 2',
  sparkle: 'M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8L12 3.5Z',
  alert: 'M12 8.5v5M12 17h.01M12 3.5 21 19.5H3L12 3.5Z',
  folder: 'M3.5 7.5h5l2 2.5h10v9H3.5v-11.5Z',
  whatsapp: 'M4 20l1.3-3.8A8 8 0 1 1 8.6 19L4 20Zm5-6.2c.6 1.4 1.9 2.6 3.3 3.1l1.3-1.1 2 .7v1.6',
};

function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true" focusable="false"
    >
      <path d={PATHS[name] || PATHS.box} />
    </svg>
  );
}

/* ---- deterministic accent per category, so lists are colour-scannable ---- */
const SPINE_VARS = ['var(--c-primary)', 'var(--c-acc1)', 'var(--c-acc2)', 'var(--c-acc3)'];
const spineFor = (key: string) => {
  let h = 0;
  for (let i = 0; i < (key || '').length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return SPINE_VARS[Math.abs(h) % SPINE_VARS.length];
};

/* ---- local (not UTC) yyyy-mm-dd, so "today" is right before 03:00 ---- */
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDate = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

export default function HomePage() {
  const today = localToday();

  /* ---------------- state ---------------- */
  const [activeView, setActiveView] = useState<View>('HOME');
  const [appTheme, setAppTheme] = useState('pastel');
  const [appFont, setAppFont] = useState('heebo');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const [invFilter, setInvFilter] = useState<'מקרר' | 'מזווה' | 'הכל'>('הכל');
  const [sortBy, setSortBy] = useState<'name' | 'category'>('name');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [inventory, setInventory] = useState<Item[]>([]);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [shoppingTemplates, setShoppingTemplates] = useState<ShoppingTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [historyNames, setHistoryNames] = useState<string[]>([]);

  const [invInput, setInvInput] = useState('');
  const [equipInput, setEquipInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [note, setNote] = useState<Note>(null);

  const [localPending, setLocalPending] = useState<any[]>([]);
  const [disambiguationItems, setDisambiguationItems] = useState<DisambiguationTask[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<Item[]>([]);
  const [duplicateShoppingAlerts, setDuplicateShoppingAlerts] = useState<string[]>([]);
  const [wordChoiceTasks, setWordChoiceTasks] = useState<WordChoiceTask[]>([]);
  const [addedSummary, setAddedSummary] = useState<{ name: string; category: string }[]>([]);

  const [equipListType, setEquipListType] = useState<string>('חו"ל');
  const EQUIP_CATEGORIES = ['ניאו', 'חשמל', 'בגדים', 'תרופות', 'נעליים', 'ציוד נוסף'];

  const [newTask, setNewTask] = useState<Task>({
    title: '', description: '', urgency: 'סטנדרטית', assignee: 'כולם', target_date: today, status: 'לא התחלתי', depends_on_task_id: null,
  });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskDraft, setEditTaskDraft] = useState<Task | null>(null);
  const [editTaskFocus, setEditTaskFocus] = useState<EditTaskFocus>('all');
  const [poofingIds, setPoofingIds] = useState<string[]>([]);

  const [categoryAddOpen, setCategoryAddOpen] = useState<string | null>(null);
  const [categoryAddInput, setCategoryAddInput] = useState('');
  const [categoryAddLoading, setCategoryAddLoading] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [categoryNameValue, setCategoryNameValue] = useState('');

  const emptyQuickAddRow = () => ({ name: '', category: '', newCategory: '' });
  const [quickAddRows, setQuickAddRows] = useState([emptyQuickAddRow(), emptyQuickAddRow()]);
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [suggestRow, setSuggestRow] = useState<number | null>(null);
  const [suggestIdx, setSuggestIdx] = useState(0);
  const [catGuessingRow, setCatGuessingRow] = useState<number | null>(null);

  const [showCategorize, setShowCategorize] = useState(false);
  const [categorizeAssignments, setCategorizeAssignments] = useState<Record<string, string>>({});
  const [categorizeNewCats, setCategorizeNewCats] = useState<Record<string, string>>({});

  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateItemsText, setNewTemplateItemsText] = useState('');
  const [addingTemplateId, setAddingTemplateId] = useState<string | null>(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  const [celebration, setCelebration] = useState<{
    fireworks: { top: number; left: number; delay: number; color: string; color2: string;
      streaks: { angle: number; fly: number; w: number; h: number }[];
      sparks: { sx: number; sy: number; size: number; delay: number }[] }[];
    balloons: { left: number; delay: number; bx: number; br: number; emoji: string }[];
  } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingCatItemId, setEditingCatItemId] = useState<string | null>(null);
  const [editCatValue, setEditCatValue] = useState('');

  const noteTimer = useRef<number | null>(null);
  const fetchSeq = useRef(0);
  const celebTimers = useRef<number[]>([]);

  /* ---------------- helpers ---------------- */
  const showNote = useCallback((kind: NoteKind, text: string, autoClear = true) => {
    setNote({ kind, text });
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    if (autoClear) noteTimer.current = window.setTimeout(() => setNote(null), 4000);
  }, []);

  // Reports a failed write instead of pretending it succeeded.
  const failed = useCallback((error: any, what: string) => {
    if (!error) return false;
    showNote('danger', `${what} נכשל: ${error.message || 'שגיאת שמירה'}`, false);
    return true;
  }, [showNote]);

  // Strip leading emoji/punctuation and a trailing "(N)" so names compare cleanly.
  const stripName = (n: string) => (n || '')
    .replace(/^[^A-Za-z0-9֐-׿]+/, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();
  const normKey = (n: string) => stripName(n).toLowerCase();

  const parseJson = async (body: any): Promise<any | null> => {
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) { showNote('danger', `שירות הפירוק החזיר שגיאה (${res.status})`, false); return null; }
      return await res.json();
    } catch {
      showNote('danger', 'אין חיבור לשירות הפירוק', false);
      return null;
    }
  };

  /* ---------------- data ---------------- */
  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current;
    const [invRes, shopRes, catsRes, tskRes, equipRes, tplRes, tplItemsRes, histRes] = await Promise.all([
      supabase.from('inventory_items').select('*'),
      supabase.from('shopping_list').select('*'),
      supabase.from('category_order').select('category_name').order('sort_order'),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('equipment_items').select('*'),
      supabase.from('shopping_templates').select('*').order('created_at'),
      supabase.from('shopping_template_items').select('*').order('sort_order'),
      supabase.from('shopping_history').select('item_name'),
    ]);
    // A newer fetch already answered — discard this one so deleted rows
    // cannot be resurrected by a slower earlier request.
    if (seq !== fetchSeq.current) return;

    const firstErr = [invRes, shopRes, catsRes, tskRes, equipRes].map(r => (r as any).error).find(Boolean);
    setLoadError(firstErr ? (firstErr.message || 'טעינת הנתונים נכשלה') : null);

    if (invRes.data) setInventory(invRes.data as Item[]);
    if (shopRes.data) setShoppingList(shopRes.data);
    if (catsRes.data) setCategories(catsRes.data.map((c: any) => c.category_name));
    if (tskRes.data) setTasks(tskRes.data as Task[]);
    if (equipRes.data) setEquipmentItems(equipRes.data as EquipmentItem[]);
    if (histRes.data) setHistoryNames((histRes.data as any[]).map(h => h.item_name).filter(Boolean));

    const tplErr = (tplRes as any).error || (tplItemsRes as any).error;
    setTemplatesError(tplErr ? (tplErr.message || 'שגיאה בטעינת הרשימות') : null);
    if (tplRes.data) {
      const byTpl: Record<string, { id: string; item_name: string; category?: string | null }[]> = {};
      for (const it of (tplItemsRes.data || []) as any[]) {
        (byTpl[it.template_id] = byTpl[it.template_id] || []).push({ id: it.id, item_name: it.item_name, category: it.category || null });
      }
      setShoppingTemplates((tplRes.data as any[]).map(t => ({ id: t.id, name: t.name, items: byTpl[t.id] || [] })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    try {
      const t = localStorage.getItem('neo_theme');
      if (t && THEME_OPTIONS.some(o => o.key === t)) setAppTheme(t);
      const f = localStorage.getItem('neo_font');
      if (f && FONT_OPTIONS.some(o => o.key === f)) setAppFont(f);
    } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The "added to shopping" recap clears itself after 10s.
  useEffect(() => {
    if (addedSummary.length === 0) return;
    const t = window.setTimeout(() => setAddedSummary([]), 10000);
    return () => window.clearTimeout(t);
  }, [addedSummary]);

  useEffect(() => () => {
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    celebTimers.current.forEach(window.clearTimeout);
  }, []);

  const applyTheme = (t: string) => { setAppTheme(t); try { localStorage.setItem('neo_theme', t); } catch {} };
  const applyFont = (f: string) => { setAppFont(f); try { localStorage.setItem('neo_font', f); } catch {} };

  const changeView = (view: View) => {
    setActiveView(view);
    setIsMenuOpen(false);
    setSearchTerm('');
    setAddedSummary([]);
    setNote(null);
    setInvInput('');
    setEquipInput('');
    setShowCategorize(false);
    window.scrollTo({ top: 0 });
  };

  /* ---------------- derived ---------------- */
  const safeInventory = inventory || [];
  const safeShoppingList = shoppingList || [];

  // Rows the parser could not classify stay in the DB with an 'uncertain'
  // category; they are shown as cards and never listed as normal stock.
  const isUncertain = (c: string) => c === 'uncertain' || c === 'לא ידוע';
  const dbPending = safeInventory.filter(i => isUncertain(i.category));
  const stockInventory = safeInventory.filter(i => !isUncertain(i.category));

  const filteredInventory = stockInventory
    .filter(i => (i.item_name || '').includes(searchTerm) && (invFilter === 'הכל' || i.location === invFilter))
    .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '', 'he'));

  const filteredShoppingList = safeShoppingList
    .filter(s => (s.item_name || '').includes(searchTerm))
    .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '', 'he'));

  const displayCategories = Array.from(new Set([
    ...categories,
    ...stockInventory.map(i => i.category || 'כללי'),
    ...safeShoppingList.map(s => s.category || 'כללי'),
  ])).filter(c => c && c !== 'uncertain' && c !== 'null');

  const pickCategories = displayCategories.filter(c => c !== 'כללי');

  const suggestionPool: string[] = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (raw: string) => {
      const clean = stripName(raw);
      const k = clean.toLowerCase();
      if (clean && !seen.has(k)) { seen.add(k); out.push(clean); }
    };
    safeShoppingList.forEach(s => push(s.item_name || ''));
    stockInventory.forEach(i => push(i.item_name || ''));
    shoppingTemplates.forEach(t => t.items.forEach(it => push(it.item_name || '')));
    historyNames.forEach(push);
    SUPERMARKET_ITEMS.forEach(push);
    return out;
  })();

  // Multi-word names double as the dictionary that stops "דלי מגבונים" from
  // being split into two items. Longest first, so a long name is not cut by a
  // shorter one inside it.
  const compoundNames = suggestionPool.filter(n => n.includes(' ')).sort((a, b) => b.length - a.length);

  const activeTasks = tasks.filter(t => t.status !== 'סיימתי');
  const completedTasks = tasks.filter(t => t.status === 'סיימתי');

  const DEFAULT_EQUIP_LISTS = ['חו"ל', 'סופ"ש', 'פסטיבלים וקמפינג'];
  const HIDDEN_EQUIP_LISTS = ['חד"כ'];
  const equipListTypes = Array.from(new Set([
    ...DEFAULT_EQUIP_LISTS,
    ...equipmentItems.map(i => i.list_type).filter(Boolean),
  ])).filter(lt => !HIDDEN_EQUIP_LISTS.includes(lt));
  const currentEquipItems = equipmentItems.filter(i => i.list_type === equipListType);
  const unpackedEquip = currentEquipItems.filter(i => !i.is_packed);
  const packedEquip = currentEquipItems.filter(i => i.is_packed);
  const equipCategories = Array.from(new Set([...EQUIP_CATEGORIES, ...currentEquipItems.map(i => i.category)])).filter(Boolean);
  const unpackedVisible = equipmentItems.filter(i => !i.is_packed && !HIDDEN_EQUIP_LISTS.includes(i.list_type)).length;

  /* ---------------- categories ---------------- */
  const ensureCategory = async (cat: string) => {
    if (!cat || cat === 'כללי' || categories.includes(cat)) return;
    const { error } = await supabase.from('category_order').insert([{ category_name: cat, sort_order: 99 }]);
    if (!error) setCategories(prev => Array.from(new Set([...prev, cat])));
  };

  const startRenameCategory = (cat: string) => { setEditingCategoryName(cat); setCategoryNameValue(cat); };

  const saveRenameCategory = async (oldCat: string) => {
    const newCat = categoryNameValue.trim();
    setEditingCategoryName(null);
    if (!newCat || newCat === oldCat) return;
    // Every table that stores the category string has to move, or the old name
    // reappears as a phantom heading derived from inventory.
    const results = await Promise.all([
      supabase.from('shopping_list').update({ category: newCat }).eq('category', oldCat),
      supabase.from('inventory_items').update({ category: newCat }).eq('category', oldCat),
      supabase.from('shopping_template_items').update({ category: newCat }).eq('category', oldCat),
      supabase.from('category_order').update({ category_name: newCat }).eq('category_name', oldCat),
    ]);
    const err = results.map(r => (r as any).error).find(Boolean);
    if (failed(err, 'שינוי שם הקטגוריה')) return;
    setCategories(prev => Array.from(new Set(prev.map(c => (c === oldCat ? newCat : c)))));
    await fetchData();
    showNote('ok', `הקטגוריה שונתה ל"${newCat}"`);
  };

  const deleteCategory = async (cat: string) => {
    if (!confirm(`למחוק את הקטגוריה "${cat}"? הפריטים שבה יעברו ל"כללי" ולא יימחקו.`)) return;
    const results = await Promise.all([
      supabase.from('shopping_list').update({ category: 'כללי' }).eq('category', cat),
      supabase.from('inventory_items').update({ category: 'כללי' }).eq('category', cat),
      supabase.from('shopping_template_items').update({ category: null }).eq('category', cat),
      supabase.from('category_order').delete().eq('category_name', cat),
    ]);
    const err = results.map(r => (r as any).error).find(Boolean);
    if (failed(err, 'מחיקת הקטגוריה')) return;
    setCategories(prev => prev.filter(c => c !== cat));
    await fetchData();
    showNote('ok', `הקטגוריה "${cat}" נמחקה`);
  };

  const guessCategories = async (names: string[]): Promise<Record<string, string>> => {
    const guesses: Record<string, string> = {};
    const clean = names.map(n => (n || '').trim()).filter(Boolean);
    if (!clean.length) return guesses;
    const data = await parseJson({ text: clean.join(', '), categories });
    for (const it of ((data && data.items) || []) as any[]) {
      const itemName = (it.name || it.item_name || '').trim();
      const raw = (it.category || '').toString();
      const usable = raw && !['uncertain', 'null', 'לא ידוע'].includes(raw.toLowerCase()) && !it.needs_classification;
      if (itemName && usable) guesses[normKey(itemName)] = raw;
    }
    return guesses;
  };

  /* ---------------- inventory ---------------- */
  const updateExactQuantity = async (item: Item, newQty: number) => {
    const finalQty = Math.max(0, Math.min(999, newQty));
    if (finalQty === item.quantity) return;
    const now = new Date().toISOString();
    setInventory(prev => prev.map(i => (i.id === item.id ? { ...i, quantity: finalQty, updated_at: now } : i)));
    const { error } = await supabase.from('inventory_items').update({ quantity: finalQty, updated_at: now }).eq('id', item.id);
    if (failed(error, 'עדכון הכמות')) { await fetchData(); return; }

    if (finalQty <= 2 && finalQty < item.quantity) {
      const already = safeShoppingList.some(s => normKey(s.item_name || '') === normKey(item.item_name));
      if (!already) setLowStockAlerts(prev => [...prev.filter(i => i.id !== item.id), { ...item, quantity: finalQty }]);
    }
  };

  const updateInventoryField = async (item: Item, field: string, value: any) => {
    if ((item as any)[field] === value) return;
    setInventory(prev => prev.map(i => (i.id === item.id ? { ...i, [field]: value } : i)));
    const { error } = await supabase.from('inventory_items').update({ [field]: value }).eq('id', item.id);
    if (failed(error, 'העדכון')) await fetchData();
  };

  const deleteInventoryItem = async (item: Item) => {
    if (!confirm(`למחוק לצמיתות את "${item.item_name}"?`)) return;
    setInventory(prev => prev.filter(i => i.id !== item.id));
    await rememberItemName(item.item_name);
    const { error } = await supabase.from('inventory_items').delete().eq('id', item.id);
    if (failed(error, 'המחיקה')) await fetchData();
  };

  /* ---------------- shopping history ---------------- */
  // The unique index is on lower(item_name), which no onConflict target can
  // name — so insert plainly and treat a duplicate as success.
  const rememberItemName = async (rawName: string) => {
    const name = stripName(rawName || '');
    if (!name) return;
    if (historyNames.some(n => n.toLowerCase() === name.toLowerCase())) return;
    setHistoryNames(prev => (prev.some(n => n.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name]));
    const { error } = await supabase.from('shopping_history')
      .insert([{ item_name: name, household_id: HOUSEHOLD, last_used: new Date().toISOString() }]);
    if (error && (error as any).code !== '23505') {
      // A real failure (not "already there") — keep it quiet but do not pretend
      // the local cache is authoritative.
      setHistoryNames(prev => prev.filter(n => n.toLowerCase() !== name.toLowerCase()));
    }
  };

  /* ---------------- shopping ---------------- */
  const addShoppingRow = async (name: string, category: string, categoryAuto: boolean) => {
    await ensureCategory(category);
    const { error } = await supabase.from('shopping_list')
      .insert([{ item_name: name, category, category_auto: categoryAuto }]);
    return error;
  };

  const deleteShoppingItem = async (shopItem: any, skipConfirm = false) => {
    if (!skipConfirm && !confirm(`למחוק את "${shopItem.item_name}" מהרשימה?`)) return;
    setShoppingList(prev => prev.filter(i => i.id !== shopItem.id));
    await rememberItemName(shopItem.item_name);
    const { error } = await supabase.from('shopping_list').delete().eq('id', shopItem.id);
    if (failed(error, 'המחיקה')) await fetchData();
  };

  const moveShoppingToInventory = async (shopItem: any, qty: number) => {
    const key = normKey(shopItem.item_name || '');
    const existing = stockInventory.find(i => normKey(i.item_name || '') === key);
    const now = new Date().toISOString();
    let error: any = null;
    if (existing) {
      ({ error } = await supabase.from('inventory_items')
        .update({ quantity: (existing.quantity || 0) + qty, updated_at: now }).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('inventory_items').insert([{
        item_name: stripName(shopItem.item_name) || shopItem.item_name,
        quantity: qty, category: shopItem.category || 'כללי',
        location: 'מזווה', updated_at: now, household_id: HOUSEHOLD,
      }]));
    }
    if (failed(error, 'ההעברה למלאי')) return;
    await rememberItemName(shopItem.item_name);
    const { error: delErr } = await supabase.from('shopping_list').delete().eq('id', shopItem.id);
    if (failed(delErr, 'הסרה מהקניות')) return;
    await fetchData();
    showNote('ok', `${stripName(shopItem.item_name)} הועבר למלאי`);
  };

  const addToShopping = async (item: Item) => {
    const err = await addShoppingRow(item.item_name || 'פריט', item.category || 'כללי', false);
    if (failed(err, 'ההוספה לקניות')) return;
    setLowStockAlerts(prev => prev.filter(i => i.id !== item.id));
    showNote('ok', 'נוסף לקניות');
    await fetchData();
  };

  // A multi-word name whose individual words are themselves known products
  // gets a "which did you mean?" card instead of being added blindly.
  const findWordChoices = (name: string): string[] => {
    const stripPrefix = (w: string) => w.replace(/^(ה|ב|ל|מ|ש|ו|כ)/, '');
    const words = normKey(name).split(/\s+/).filter(w => w.length > 1);
    if (words.length < 2) return [];
    const known = new Set<string>();
    stockInventory.forEach(i => known.add(normKey(i.item_name || '')));
    safeShoppingList.forEach(s => known.add(normKey(s.item_name || '')));
    const out: string[] = [];
    for (const w of words) {
      for (const c of [w, stripPrefix(w)]) {
        if (c.length > 1 && known.has(c) && !out.includes(c)) out.push(c);
      }
    }
    return out;
  };

  const splitShoppingInput = (text: string): string[] => {
    const trimmed = (text || '').trim();
    if (!trimmed) return [];
    if (/[,،]/.test(trimmed)) return trimmed.split(/[,،]/).map(s => s.trim()).filter(Boolean);
    const tokens = trimmed.split(/\s+/);
    const items: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      let matched = false;
      for (const compound of compoundNames) {
        const parts = compound.split(/\s+/);
        if (i + parts.length <= tokens.length) {
          const slice = tokens.slice(i, i + parts.length).join(' ');
          if (slice.toLowerCase() === compound.toLowerCase()) {
            items.push(slice); i += parts.length; matched = true; break;
          }
        }
      }
      if (!matched) { items.push(tokens[i]); i++; }
    }
    return items;
  };

  const updateQuickAddRow = (idx: number, patch: Partial<{ name: string; category: string; newCategory: string }>) => {
    setQuickAddRows(prev => {
      const next = prev.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      if (idx === prev.length - 1 && next[idx].name.trim() && next.length < 20) next.push(emptyQuickAddRow());
      return next;
    });
  };

  const autoFillRowCategory = async (idx: number, rawName: string) => {
    const name = (rawName || '').trim();
    if (!name) return;
    if (quickAddRows[idx]?.category) return;
    setCatGuessingRow(idx);
    try {
      const guesses = await guessCategories([name]);
      const guess = guesses[normKey(name)];
      if (!guess) return;
      // Only fill if this row still holds the same name and no manual pick —
      // the form may have been submitted or retyped meanwhile.
      setQuickAddRows(prev => prev.map((r, i) =>
        (i === idx && !r.category && r.name.trim() === name) ? { ...r, category: guess } : r));
      setCategories(prev => (prev.includes(guess) ? prev : [...prev, guess]));
    } finally {
      setCatGuessingRow(null);
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAddSubmitting) return;
    const rows = quickAddRows.filter(r => r.name.trim());
    if (!rows.length) return;
    setQuickAddSubmitting(true);
    showNote('info', 'מעבד…', false);

    const picked = (r: { category: string; newCategory: string }) =>
      (r.category === '__other__' ? r.newCategory.trim() : (r.category === '' ? '' : r.category));
    const needGuess = rows.filter(r => !picked(r)).map(r => r.name.trim());
    const guesses = needGuess.length ? await guessCategories(needGuess) : {};

    const duplicates: string[] = [];
    const choices: WordChoiceTask[] = [];
    const summary: { name: string; category: string }[] = [];
    const queued = new Set<string>();
    let added = 0;
    let hadError = false;

    for (const row of rows) {
      const name = row.name.trim();
      const manual = picked(row);
      const cat = manual || guesses[normKey(name)] || 'כללי';
      const key = normKey(name);
      if (!key || queued.has(key)) continue;
      if (safeShoppingList.some(s => normKey(s.item_name || '') === key)) { duplicates.push(name); continue; }
      const wc = findWordChoices(name);
      if (wc.length) { choices.push({ originalName: name, options: wc, category: cat }); continue; }
      queued.add(key);
      const err = await addShoppingRow(name, cat, !manual);
      if (err) { hadError = true; failed(err, `הוספת "${name}"`); continue; }
      summary.push({ name, category: cat });
      added++;
    }

    if (duplicates.length) setDuplicateShoppingAlerts(prev => Array.from(new Set([...prev, ...duplicates])));
    if (choices.length) setWordChoiceTasks(prev => [...prev, ...choices]);
    setAddedSummary(summary);

    if (added > 0) setNote(null);
    else if (choices.length) showNote('warn', 'איזה מהמוצרים התכוונת?', false);
    else if (duplicates.length) showNote('warn', 'כבר ברשימה');
    else if (!hadError) setNote(null);

    setQuickAddRows([emptyQuickAddRow(), emptyQuickAddRow()]);
    setQuickAddSubmitting(false);
    await fetchData();
  };

  const handleCategoryAdd = async (e: React.FormEvent, category: string) => {
    e.preventDefault();
    const text = categoryAddInput.trim();
    if (!text || categoryAddLoading) return;
    setCategoryAddLoading(true);
    const names = splitShoppingInput(text);
    const duplicates: string[] = [];
    const choices: WordChoiceTask[] = [];
    const summary: { name: string; category: string }[] = [];
    const queued = new Set<string>();
    let added = 0;

    for (const name of names) {
      const key = normKey(name);
      if (!key || queued.has(key)) continue;
      if (safeShoppingList.some(s => normKey(s.item_name || '') === key)) { duplicates.push(name); continue; }
      const wc = findWordChoices(name);
      if (wc.length) { choices.push({ originalName: name, options: wc, category }); continue; }
      queued.add(key);
      const err = await addShoppingRow(name, category, false);
      if (err) { failed(err, `הוספת "${name}"`); continue; }
      summary.push({ name, category });
      added++;
    }

    if (duplicates.length) setDuplicateShoppingAlerts(prev => Array.from(new Set([...prev, ...duplicates])));
    if (choices.length) setWordChoiceTasks(prev => [...prev, ...choices]);
    setAddedSummary(summary);
    if (added === 0 && choices.length) showNote('warn', 'איזה מהמוצרים התכוונת?', false);
    else if (added === 0 && duplicates.length) showNote('warn', 'כבר ברשימה');

    setCategoryAddInput('');
    setCategoryAddOpen(null);
    setCategoryAddLoading(false);
    await fetchData();
  };

  const handleResolveWordChoice = async (task: WordChoiceTask, chosen: string) => {
    setWordChoiceTasks(prev => prev.filter(t => t !== task));
    const key = normKey(chosen);
    if (safeShoppingList.some(s => normKey(s.item_name || '') === key)) {
      setDuplicateShoppingAlerts(prev => Array.from(new Set([...prev, chosen])));
      showNote('warn', 'כבר ברשימה');
      return;
    }
    const err = await addShoppingRow(chosen, task.category || 'כללי', false);
    if (failed(err, 'ההוספה')) return;
    setAddedSummary([{ name: chosen, category: task.category || 'כללי' }]);
    await fetchData();
  };

  const openCategorize = () => { setCategorizeAssignments({}); setCategorizeNewCats({}); setShowCategorize(true); };

  const applyCategorizeAssignments = async () => {
    // Touching the dropdown at all counts as classifying — even picking כללי.
    const entries = Object.entries(categorizeAssignments).filter(([, v]) => !!v);
    if (!entries.length) { setShowCategorize(false); return; }
    showNote('info', 'מעבד…', false);
    let updated = 0;
    for (const [id, chosen] of entries) {
      let target = chosen;
      if (chosen === '__other__') {
        const custom = (categorizeNewCats[id] || '').trim();
        if (!custom) continue;
        target = custom;
        await ensureCategory(target);
      }
      const { error } = await supabase.from('shopping_list')
        .update({ category: target, category_auto: false }).eq('id', id);
      if (error) { failed(error, 'הסיווג'); continue; }
      updated++;
    }
    setCategorizeAssignments({});
    setCategorizeNewCats({});
    setShowCategorize(false);
    await fetchData();
    showNote('ok', `סווגו ${updated} פריטים`);
  };

  /* ---------------- inventory free text ---------------- */
  const executeRemoval = async (invItem: Item, qtyToSubtract: number, removeAll: boolean) => {
    const newQty = removeAll ? 0 : (invItem.quantity || 0) + qtyToSubtract;
    await updateExactQuantity(invItem, newQty);
  };

  const saveInventoryItem = async (name: string, cat: string, quantity: number, location: string) => {
    await ensureCategory(cat);
    const key = normKey(name);
    const existing = stockInventory.find(i => normKey(i.item_name || '') === key);
    const now = new Date().toISOString();
    if (existing) {
      return (await supabase.from('inventory_items')
        .update({ quantity: Math.max(0, (existing.quantity || 0) + quantity), category: cat, updated_at: now })
        .eq('id', existing.id)).error;
    }
    return (await supabase.from('inventory_items').insert([{
      item_name: name, quantity: Math.max(0, quantity), category: cat,
      location: location || 'מזווה', updated_at: now, household_id: HOUSEHOLD,
    }])).error;
  };

  const handleInventoryUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invInput.trim()) return;
    showNote('info', 'מעבד…', false);
    const data = await parseJson({ text: invInput, categories });
    if (!data) return;

    for (const nc of (data.new_categories || [])) await ensureCategory(nc);

    const items = data.items || [];
    if (!items.length) { showNote('warn', 'לא זוהו פריטים'); return; }

    const ambiguous: DisambiguationTask[] = [];
    const uncertain: any[] = [];
    const notFound: string[] = [];
    // A local mirror so two removals of the same row do not each read the
    // pre-loop quantity and lose a decrement.
    const working = stockInventory.map(i => ({ ...i }));
    let moved = 0;
    let saved = 0;

    for (const item of items) {
      const name = item.name || item.item_name || 'פריט';
      const isRemoval = (item.quantity || 0) < 0 || item.removeAll;
      const cat = (item.category || '').toLowerCase();
      const clean = name.replace(/^(את כל ה|כל ה|את ה|ה)/g, '').trim().toLowerCase();

      if (item.moveToCategory) {
        const matches = working.filter(i => (i.item_name || '').toLowerCase().includes(clean));
        for (const m of matches) {
          const { error } = await supabase.from('inventory_items').update({ category: item.moveToCategory }).eq('id', m.id);
          if (!error) moved++;
        }
        if (!matches.length) notFound.push(name);
      } else if (isRemoval) {
        const matches = working.filter(i => (i.item_name || '').toLowerCase().includes(clean));
        const exact = matches.find(i => (i.item_name || '').toLowerCase() === clean);
        if (matches.length === 1 || (exact && matches.length === 1)) {
          await executeRemoval(matches[0], item.quantity, item.removeAll);
          const idx = working.findIndex(w => w.id === matches[0].id);
          if (idx >= 0) working[idx].quantity = item.removeAll ? 0 : Math.max(0, (working[idx].quantity || 0) + item.quantity);
        } else if (matches.length > 1) {
          ambiguous.push({ originalName: name, matches, quantityToSubtract: item.quantity, removeAll: item.removeAll });
        } else {
          notFound.push(name);
        }
      } else if (item.needs_classification || isUncertain(cat) || cat === 'null' || !cat) {
        uncertain.push({ ...item, item_name: name });
      } else {
        const err = await saveInventoryItem(name, item.category, item.quantity || 1, item.location);
        if (err) failed(err, `שמירת "${name}"`);
        else {
          saved++;
          const idx = working.findIndex(w => normKey(w.item_name || '') === normKey(name));
          if (idx >= 0) working[idx].quantity = (working[idx].quantity || 0) + (item.quantity || 1);
          else working.push({ id: `tmp-${name}`, item_name: name, quantity: item.quantity || 1, category: item.category, location: item.location || 'מזווה' });
        }
      }
    }

    if (ambiguous.length) setDisambiguationItems(prev => [...prev, ...ambiguous]);
    if (uncertain.length) setLocalPending(prev => [...prev, ...uncertain]);

    const parts: string[] = [];
    if (saved) parts.push(`נשמרו ${saved}`);
    if (moved) parts.push(`הועברו ${moved}`);
    if (notFound.length) parts.push(`לא נמצאו: ${notFound.join(', ')}`);
    if (ambiguous.length) parts.push('יש כמה אפשרויות');
    if (uncertain.length) parts.push('נדרש סיווג');
    showNote(notFound.length || ambiguous.length || uncertain.length ? 'warn' : 'ok',
      parts.join(' · ') || 'עודכן', !(ambiguous.length || uncertain.length));

    setInvInput('');
    await fetchData();
  };

  // A DB row parked on 'uncertain' is UPDATEd in place; a freshly parsed item
  // with no row yet is inserted.
  const resolveDbPending = async (item: Item, cat: string) => {
    await ensureCategory(cat);
    const { error } = await supabase.from('inventory_items').update({ category: cat }).eq('id', item.id);
    if (failed(error, 'הסיווג')) return;
    await fetchData();
    showNote('ok', `"${item.item_name}" סווג ל"${cat}"`);
  };

  const resolveLocalPending = async (item: any, cat: string) => {
    setLocalPending(prev => prev.filter(p => p !== item));
    const err = await saveInventoryItem(item.item_name || item.name, cat, item.quantity || 1, item.location);
    if (failed(err, 'השמירה')) return;
    await fetchData();
    showNote('ok', `"${item.item_name || item.name}" נשמר ב"${cat}"`);
  };

  const handleResolveDisambiguation = async (task: DisambiguationTask, chosen: Item | 'ALL') => {
    if (chosen === 'ALL') for (const m of task.matches) await executeRemoval(m, task.quantityToSubtract, task.removeAll);
    else await executeRemoval(chosen, task.quantityToSubtract, task.removeAll);
    setDisambiguationItems(prev => prev.filter(t => t !== task));
    showNote('ok', 'המלאי עודכן');
  };

  /* ---------------- row editing ---------------- */
  const saveEditedName = async (id: string, table: string) => {
    const v = editNameValue.trim();
    setEditingId(null);
    if (!v) return;
    const { error } = await supabase.from(table).update({ item_name: v }).eq('id', id);
    if (failed(error, 'שינוי השם')) return;
    await fetchData();
  };

  const saveEditedCategory = async (id: string, table: string, directValue?: string) => {
    const val = (directValue || editCatValue).trim();
    setEditingCatItemId(null);
    if (!val) return;
    await ensureCategory(val);
    const patch: any = { category: val };
    if (table === 'shopping_list') patch.category_auto = false;
    const { error } = await supabase.from(table).update(patch).eq('id', id);
    if (failed(error, 'שינוי הקטגוריה')) return;
    await fetchData();
  };

  /* ---------------- tasks ---------------- */
  const urgencyIcon = (u: string) => (u === 'דחופה מאד' ? '🚨' : u === 'גבוהה' ? '🔥' : u === 'נמוכה' ? '💤' : '📋');
  const urgencyTone = (u: string) =>
    u === 'דחופה מאד' ? 'var(--st-danger)' : u === 'גבוהה' ? 'var(--st-warn)' : u === 'נמוכה' ? 'var(--c-acc1)' : 'var(--c-acc3)';

  const buildWhatsAppLink = (t: Task) => {
    let text = `*משימה חדשה: ${t.title}*\n`;
    if (t.description) text += `${t.description}\n`;
    text += `\n*באחריות:* ${t.assignee}`;
    text += `\n*תאריך יעד:* ${fmtDate(t.target_date)}`;
    text += `\n*דחיפות:* ${t.urgency}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const persistNewTask = async (sendToWhatsApp: boolean) => {
    if (!newTask.title.trim()) { showNote('warn', 'חסר שם למשימה'); return; }
    const { error } = await supabase.from('tasks').insert([newTask]);
    if (failed(error, 'שמירת המשימה')) return;
    const copy = { ...newTask };
    setNewTask({ title: '', description: '', urgency: 'סטנדרטית', assignee: 'כולם', target_date: today, status: 'לא התחלתי', depends_on_task_id: null });
    setShowTaskForm(false);
    await fetchData();
    showNote('ok', 'המשימה נשמרה');
    if (sendToWhatsApp) window.open(buildWhatsAppLink(copy), '_blank', 'noopener');
  };

  const startEditTask = (task: Task, focus: EditTaskFocus = 'all') => {
    if (editingTaskId === task.id) {
      if (focus === 'all') { setEditingTaskId(null); setEditTaskDraft(null); }
      else setEditTaskFocus(focus);
      return;
    }
    setEditingTaskId(task.id || null);
    setEditTaskDraft({ ...task, depends_on_task_id: task.depends_on_task_id || null });
    setEditTaskFocus(focus);
  };

  const cancelEditTask = () => { setEditingTaskId(null); setEditTaskDraft(null); setEditTaskFocus('all'); };

  // Walk the dependency chain so A→B→A cannot deadlock both tasks.
  const wouldCycle = (taskId: string, depId: string | null): boolean => {
    let cur = depId;
    const seen = new Set<string>();
    while (cur) {
      if (cur === taskId) return true;
      if (seen.has(cur)) return false;
      seen.add(cur);
      cur = tasks.find(t => t.id === cur)?.depends_on_task_id || null;
    }
    return false;
  };

  const saveEditTask = async () => {
    if (!editingTaskId || !editTaskDraft) return;
    if (wouldCycle(editingTaskId, editTaskDraft.depends_on_task_id || null)) {
      showNote('danger', 'התלות הזאת יוצרת מעגל — שתי המשימות ייחסמו זו בזו', false);
      return;
    }
    const updates = {
      title: editTaskDraft.title,
      description: editTaskDraft.description || '',
      urgency: editTaskDraft.urgency,
      assignee: editTaskDraft.assignee,
      target_date: editTaskDraft.target_date,
      depends_on_task_id: editTaskDraft.depends_on_task_id || null,
    };
    setTasks(prev => prev.map(t => (t.id === editingTaskId ? { ...t, ...updates } : t)));
    const { error } = await supabase.from('tasks').update(updates).eq('id', editingTaskId);
    if (failed(error, 'עדכון המשימה')) { await fetchData(); return; }
    cancelEditTask();
    await fetchData();
  };

  const getBlockingTask = (task: Task): Task | null => {
    if (!task.depends_on_task_id) return null;
    const dep = tasks.find(t => t.id === task.depends_on_task_id);
    if (!dep || dep.status === 'סיימתי') return null;
    return dep;
  };

  const buildCelebration = () => {
    const COLORS = ['#ff3b6b', '#ffd23f', '#3ddbff', '#7cf86b', '#ff7ee5', '#ff9533', '#9b6bff', '#5af0c2', '#ff2d8a'];
    const BALLOONS = ['🎈', '🎈', '🎈', '🎉', '🎊'];
    const fireworks = Array.from({ length: 12 }).map(() => {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      let color2 = COLORS[Math.floor(Math.random() * COLORS.length)];
      while (color2 === color) color2 = COLORS[Math.floor(Math.random() * COLORS.length)];
      const streakCount = 38 + Math.floor(Math.random() * 14);
      const baseFly = 150 + Math.random() * 90;
      const streaks = Array.from({ length: streakCount }).map((_, i) => ({
        angle: (i / streakCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.18,
        fly: baseFly * (0.75 + Math.random() * 0.55),
        w: 70 + Math.floor(Math.random() * 40),
        h: 3 + Math.floor(Math.random() * 2),
      }));
      const sparks = Array.from({ length: 18 + Math.floor(Math.random() * 8) }).map(() => {
        const a = Math.random() * Math.PI * 2;
        const d = 30 + Math.random() * 130;
        return { sx: Math.cos(a) * d, sy: Math.sin(a) * d, size: 4 + Math.floor(Math.random() * 5), delay: Math.random() * 250 };
      });
      return { top: 10 + Math.random() * 60, left: 8 + Math.random() * 84, delay: 200 + Math.random() * 1800, color, color2, streaks, sparks };
    });
    const balloons = Array.from({ length: 8 }).map(() => ({
      left: 5 + Math.random() * 90,
      delay: Math.random() * 1200,
      bx: (Math.random() - 0.5) * 120,
      br: (Math.random() - 0.5) * 30,
      emoji: BALLOONS[Math.floor(Math.random() * BALLOONS.length)],
    }));
    return { fireworks, balloons };
  };

  const updateTaskStatus = async (id: string, newStatus: string) => {
    if (newStatus === 'סיימתי') {
      setPoofingIds(prev => [...prev, id]);
      setCelebration(buildCelebration());
      const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
      if (error) {
        setPoofingIds(prev => prev.filter(p => p !== id));
        setCelebration(null);
        failed(error, 'סימון המשימה');
        return;
      }
      // Move the card as soon as its own animation ends; the celebration keeps
      // playing over a live, interactive list.
      celebTimers.current.push(window.setTimeout(() => {
        setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: newStatus } : t)));
        setPoofingIds(prev => prev.filter(p => p !== id));
      }, 1200));
      celebTimers.current.push(window.setTimeout(() => setCelebration(null), 4200));
      return;
    }
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: newStatus } : t)));
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
    if (failed(error, 'עדכון הסטטוס')) await fetchData();
  };

  const handleRestoreTask = async (id: string, newDate: string) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: 'לא התחלתי', target_date: newDate } : t)));
    const { error } = await supabase.from('tasks').update({ status: 'לא התחלתי', target_date: newDate }).eq('id', id);
    if (failed(error, 'השחזור')) await fetchData();
  };

  const deleteTask = async (task: Task) => {
    if (!confirm(`למחוק לצמיתות את המשימה "${task.title}"?`)) return;
    setTasks(prev => prev.filter(t => t.id !== task.id));
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (failed(error, 'מחיקת המשימה')) await fetchData();
  };

  /* ---------------- equipment ---------------- */
  const resetPacking = async (listType: string) => {
    setEquipmentItems(prev => prev.map(i => (i.list_type === listType ? { ...i, is_packed: false } : i)));
    const { error } = await supabase.from('equipment_items').update({ is_packed: false }).eq('list_type', listType);
    if (failed(error, 'איפוס הרשימה')) { await fetchData(); return; }
    await supabase.from('equipment_sessions')
      .upsert({ list_type: listType, last_pack_date: localToday(), household_id: HOUSEHOLD }, { onConflict: 'list_type,household_id' });
  };

  useEffect(() => {
    if (activeView !== 'TEMPLATES') return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('equipment_sessions').select('*').eq('list_type', equipListType).maybeSingle();
      if (cancelled) return;
      if (data && data.last_pack_date !== localToday()) await resetPacking(equipListType);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, equipListType]);

  const togglePacked = async (item: EquipmentItem) => {
    const next = !item.is_packed;
    setEquipmentItems(prev => prev.map(i => (i.id === item.id ? { ...i, is_packed: next } : i)));
    const { error } = await supabase.from('equipment_items').update({ is_packed: next }).eq('id', item.id);
    if (failed(error, 'הסימון')) { await fetchData(); return; }
    await supabase.from('equipment_sessions')
      .upsert({ list_type: item.list_type, last_pack_date: localToday(), household_id: HOUSEHOLD }, { onConflict: 'list_type,household_id' });
  };

  const handleEquipmentUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipInput.trim()) return;
    showNote('info', 'מעבד…', false);
    const equipCats = Array.from(new Set([...EQUIP_CATEGORIES, ...currentEquipItems.map(i => i.category)]));
    const data = await parseJson({ text: equipInput, categories: equipCats, context: 'equipment' });
    if (!data) return;
    const items = data.items || [];
    if (!items.length) { showNote('warn', 'לא זוהו פריטים'); return; }

    const notFound: string[] = [];
    let addedCount = 0;
    let removedCount = 0;

    for (const item of items) {
      const name = item.name || item.item_name || 'פריט';
      const isRemoval = (item.quantity || 0) < 0 || item.removeAll;
      if (isRemoval) {
        const clean = name.replace(/^(את כל ה|כל ה|את ה|ה)/g, '').trim().toLowerCase();
        const matches = currentEquipItems.filter(i => (i.item_name || '').toLowerCase().includes(clean));
        for (const m of matches) {
          setEquipmentItems(prev => prev.filter(i => i.id !== m.id));
          const { error } = await supabase.from('equipment_items').delete().eq('id', m.id);
          if (!error) removedCount++;
        }
        if (!matches.length) notFound.push(name);
      } else {
        const allowed = [...equipCats, ...(data.new_categories || [])];
        const finalCat = item.category && allowed.includes(item.category) ? item.category : 'ציוד נוסף';
        const { data: inserted, error } = await supabase.from('equipment_items')
          .insert([{ item_name: name, category: finalCat, list_type: equipListType, is_packed: false, household_id: HOUSEHOLD }])
          .select();
        if (error) failed(error, `הוספת "${name}"`);
        else { if (inserted) setEquipmentItems(prev => [...prev, ...(inserted as EquipmentItem[])]); addedCount++; }
      }
    }

    const parts: string[] = [];
    if (addedCount) parts.push(`נוספו ${addedCount}`);
    if (removedCount) parts.push(`הוסרו ${removedCount}`);
    if (notFound.length) parts.push(`לא נמצאו: ${notFound.join(', ')}`);
    showNote(notFound.length ? 'warn' : 'ok', parts.join(' · ') || 'עודכן');
    setEquipInput('');
  };

  const deleteEquipmentItem = async (item: EquipmentItem) => {
    if (!confirm(`למחוק לצמיתות את "${item.item_name}"?`)) return;
    setEquipmentItems(prev => prev.filter(i => i.id !== item.id));
    const { error } = await supabase.from('equipment_items').delete().eq('id', item.id);
    if (failed(error, 'המחיקה')) await fetchData();
  };

  /* ---------------- templates ---------------- */
  const addTemplateToShopping = async (template: ShoppingTemplate) => {
    if (addingTemplateId) return;
    if (!template.items.length) { showNote('warn', 'הרשימה ריקה'); return; }
    setAddingTemplateId(template.id);
    showNote('info', 'מעבד…', false);

    const list = template.items
      .map(i => ({ name: i.item_name.trim(), category: (i.category || '').trim() }))
      .filter(i => i.name);
    const needGuess = list.filter(i => !i.category).map(i => i.name);
    const guesses = needGuess.length ? await guessCategories(needGuess) : {};

    const duplicates: string[] = [];
    const summary: { name: string; category: string }[] = [];
    const queued = new Set<string>();
    let added = 0;

    for (const it of list) {
      const key = normKey(it.name);
      if (!key || queued.has(key)) continue;
      if (safeShoppingList.some(s => normKey(s.item_name || '') === key)) { duplicates.push(it.name); continue; }
      queued.add(key);
      const cat = it.category || guesses[key] || 'כללי';
      const err = await addShoppingRow(it.name, cat, !it.category);
      if (err) { failed(err, `הוספת "${it.name}"`); continue; }
      summary.push({ name: it.name, category: cat });
      added++;
    }

    if (duplicates.length) setDuplicateShoppingAlerts(prev => Array.from(new Set([...prev, ...duplicates])));
    setAddedSummary(summary);
    if (added > 0) setNote(null);
    else if (duplicates.length) showNote('warn', 'כל הפריטים כבר ברשימה');
    setAddingTemplateId(null);
    await fetchData();
  };

  const createTemplate = async () => {
    const name = newTemplateName.trim();
    const items = newTemplateItemsText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!name) { showNote('warn', 'חסר שם לרשימה'); return; }
    if (!items.length) { showNote('warn', 'אין פריטים ברשימה'); return; }
    const { data: inserted, error } = await supabase.from('shopping_templates')
      .insert([{ name, household_id: HOUSEHOLD }]).select().single();
    if (failed(error, 'יצירת הרשימה') || !inserted) return;
    const { error: itemsErr } = await supabase.from('shopping_template_items')
      .insert(items.map((item_name, idx) => ({ template_id: (inserted as any).id, item_name, sort_order: idx + 1 })));
    if (failed(itemsErr, 'שמירת הפריטים')) return;
    setNewTemplateName(''); setNewTemplateItemsText(''); setShowCreateTemplate(false);
    showNote('ok', `נוצרה הרשימה "${name}"`);
    await fetchData();
  };

  const deleteTemplate = async (template: ShoppingTemplate) => {
    if (!confirm(`למחוק את הרשימה "${template.name}" לצמיתות?`)) return;
    const { error } = await supabase.from('shopping_templates').delete().eq('id', template.id);
    if (failed(error, 'מחיקת הרשימה')) return;
    showNote('ok', `הרשימה "${template.name}" נמחקה`);
    await fetchData();
  };

  /* ================================================================== *
   * render
   * ================================================================== */
  const NAV: { view: View; icon: string; label: string; badge?: number }[] = [
    { view: 'HOME', icon: 'home', label: 'בית' },
    { view: 'INVENTORY', icon: 'box', label: 'מלאי' },
    { view: 'SHOPPING', icon: 'cart', label: 'קניות', badge: safeShoppingList.length },
    { view: 'TEMPLATES', icon: 'suitcase', label: 'רשימות', badge: unpackedVisible },
    { view: 'TASKS', icon: 'pin', label: 'משימות', badge: activeTasks.length },
  ];

  const viewTitle: Record<View, string> = {
    HOME: 'הבית של ניאו', INVENTORY: 'מלאי', SHOPPING: 'קניות',
    TASKS: 'משימות', TEMPLATES: 'רשימות', SETTINGS: 'הגדרות',
  };

  const noteClass = note ? `note note-${note.kind}` : 'note';

  return (
    <main
      data-theme={appTheme}
      data-font={appFont}
      dir="rtl"
      className="min-h-screen pb-28"
    >
      <div className="paper" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      {/* ---------- celebration ---------- */}
      {celebration && (
        <div className="fixed inset-0 z-[2000] pointer-events-none overflow-hidden" aria-hidden="true">
          {celebration.fireworks.map((fw, i) => (
            <div key={`fw-${i}`} className="absolute" style={{ top: `${fw.top}%`, left: `${fw.left}%` }}>
              <span
                className="absolute fw-launch"
                style={{
                  width: 4, height: 90, top: 0, left: 0, borderRadius: 4,
                  background: `linear-gradient(to top, transparent, ${fw.color} 60%, #fff)`,
                  boxShadow: `0 0 14px ${fw.color}`, transformOrigin: '50% 100%',
                  animationDelay: `${Math.max(0, fw.delay - 600)}ms`,
                }}
              />
              <span
                className="absolute rounded-full fw-flash"
                style={{
                  width: 24, height: 24, top: 0, left: 0,
                  background: 'radial-gradient(circle, #fff 0%, #fff 30%, transparent 80%)',
                  boxShadow: `0 0 50px 16px #fff, 0 0 90px 30px ${fw.color}`,
                  animationDelay: `${fw.delay}ms`,
                }}
              />
              <span
                className="absolute rounded-full fw-flash"
                style={{
                  width: 60, height: 60, top: 0, left: 0, opacity: .7,
                  background: `radial-gradient(circle, ${fw.color} 0%, ${fw.color2} 50%, transparent 80%)`,
                  boxShadow: `0 0 60px 20px ${fw.color}`,
                  animationDelay: `${fw.delay + 30}ms`,
                }}
              />
              {fw.streaks.map((s, si) => (
                <span
                  key={si}
                  className="absolute fw-streak"
                  style={{
                    top: 0, left: 0, width: s.w, height: s.h, borderRadius: 999,
                    background: `linear-gradient(to right, transparent, ${fw.color} 35%, ${fw.color} 70%, #fff)`,
                    boxShadow: `0 0 12px ${fw.color}, 0 0 4px #fff`,
                    transformOrigin: '0 50%',
                    animationDelay: `${fw.delay}ms`,
                    ['--angle' as any]: `${s.angle}rad`,
                    ['--fly' as any]: `${s.fly}px`,
                  }}
                />
              ))}
              {fw.sparks.map((sp, spi) => (
                <span
                  key={`s${spi}`}
                  className="absolute rounded-full fw-spark"
                  style={{
                    top: 0, left: 0, width: sp.size, height: sp.size,
                    background: `radial-gradient(circle, #fff 10%, ${fw.color2} 70%)`,
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
              className="absolute balloon"
              style={{
                left: `${b.left}%`, bottom: 0, fontSize: 46,
                animationDelay: `${b.delay}ms`,
                ['--bx' as any]: `${b.bx}px`,
                ['--br' as any]: `${b.br}deg`,
              }}
            >{b.emoji}</span>
          ))}
        </div>
      )}

      {/* ---------- header ---------- */}
      <header className={`appbar ${scrolled ? 'appbar-solid' : ''}`}>
        <div className="max-w-2xl mx-auto px-5 pt-4 pb-3 flex items-center gap-3">
          <h1
            className="t-display flex-1 min-w-0 truncate transition-all"
            style={{ fontSize: scrolled ? 17 : 28 }}
          >
            {viewTitle[activeView]}
          </h1>
          <button className="btn-icon" onClick={() => fetchData()} aria-label="רענן נתונים">
            <Icon name="refresh" />
          </button>
          <div className="relative">
            <button
              className="btn-icon btn-icon-filled"
              onClick={() => setIsMenuOpen(v => !v)}
              aria-label="תפריט"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <Icon name="list" />
            </button>
            {isMenuOpen && (
              <div className="sheet pop-in absolute left-0 top-12 w-52 z-[1001] flex flex-col" role="menu">
                {([
                  ['INVENTORY', 'מלאי', 'box'], ['SHOPPING', 'קניות', 'cart'],
                  ['TEMPLATES', 'רשימות', 'suitcase'], ['TASKS', 'משימות', 'pin'],
                  ['SETTINGS', 'הגדרות', 'gear'],
                ] as [View, string, string][]).map(([v, label, icon]) => (
                  <button
                    key={v}
                    role="menuitem"
                    onClick={() => changeView(v)}
                    className="flex items-center gap-3 px-4 py-3 text-right t-label hover:bg-[var(--s-sunken)] border-b border-[var(--border-subtle)] last:border-0"
                    style={{ color: 'var(--t-primary)' }}
                  >
                    <Icon name={icon} size={18} />
                    <span className="flex-1">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {scrolled && <div className="appbar-accent" />}
      </header>

      {isMenuOpen && <button className="fixed inset-0 z-[999]" onClick={() => setIsMenuOpen(false)} aria-label="סגור תפריט" tabIndex={-1} />}

      <div key={activeView} className="max-w-2xl mx-auto px-5 relative z-10">

        {/* status note */}
        {note && (
          <div className={`${noteClass} mb-4 slide-up`} role="status" aria-live="polite">
            <Icon name={note.kind === 'danger' ? 'alert' : note.kind === 'warn' ? 'alert' : note.kind === 'info' ? 'clock' : 'check'} size={18} />
            <span className="flex-1">{note.text}</span>
            <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={() => setNote(null)} aria-label="סגור הודעה">
              <Icon name="x" size={15} />
            </button>
          </div>
        )}

        {loadError && (
          <div className="note note-danger mb-4" role="alert">
            <Icon name="alert" size={18} />
            <span className="flex-1">הנתונים לא נטענו. {loadError}</span>
          </div>
        )}

        {/* ---------- HOME: dashboard ---------- */}
        {activeView === 'HOME' && (
          loading ? (
            <div className="grid gap-3 mt-2">
              <div className="skel" style={{ height: 132 }} />
              <div className="grid grid-cols-3 gap-3">
                <div className="skel" style={{ height: 96 }} />
                <div className="skel" style={{ height: 96 }} />
                <div className="skel" style={{ height: 96 }} />
              </div>
            </div>
          ) : (
            <div className="stagger grid gap-3 mt-2">
              {(() => {
                const cards = [
                  { view: 'SHOPPING' as View, icon: 'cart', label: 'פריטים לקנות', count: safeShoppingList.length, c: 'var(--c-primary)' },
                  { view: 'TASKS' as View, icon: 'pin', label: 'משימות פתוחות', count: activeTasks.length, c: 'var(--c-acc2)' },
                  { view: 'TEMPLATES' as View, icon: 'suitcase', label: 'פריטים לארוז', count: unpackedVisible, c: 'var(--c-acc3)' },
                  { view: 'INVENTORY' as View, icon: 'box', label: 'פריטים במלאי', count: stockInventory.length, c: 'var(--c-acc1)' },
                ];
                const hero = cards.reduce((a, b) => (b.count > a.count ? b : a), cards[0]);
                const rest = cards.filter(c => c.view !== hero.view);
                return (
                  <>
                    <button
                      onClick={() => changeView(hero.view)}
                      className="card card-interactive spine text-right"
                      style={{ ['--spine-c' as any]: hero.c }}
                    >
                      <div className="flex items-start gap-4">
                        <span className="tile tile-lg" style={{ ['--tile-c' as any]: hero.c }}>
                          <Icon name={hero.icon} size={26} />
                        </span>
                        <span className="flex-1">
                          <span className="block num t-dim" style={{ fontSize: 48, lineHeight: 1.05, fontWeight: 700, color: 'var(--t-primary)' }}>
                            {hero.count}
                          </span>
                          <span className="block t-label t-dim mt-1">{hero.label}</span>
                        </span>
                        <span className="t-faint mt-2"><Icon name="chevron" size={18} /></span>
                      </div>
                    </button>
                    <div className="grid grid-cols-3 gap-3">
                      {rest.map(c => (
                        <button
                          key={c.view}
                          onClick={() => changeView(c.view)}
                          className="card card-tight card-interactive spine text-right"
                          style={{ ['--spine-c' as any]: c.c }}
                        >
                          <span className="tile mb-2" style={{ ['--tile-c' as any]: c.c, width: 36, height: 36 }}>
                            <Icon name={c.icon} size={18} />
                          </span>
                          <span className="block num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--t-primary)' }}>{c.count}</span>
                          <span className="block t-micro t-dim mt-0.5 truncate">{c.label}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => changeView('SETTINGS')} className="card card-tight card-interactive flex items-center gap-3">
                      <span className="tile" style={{ ['--tile-c' as any]: 'var(--c-head)', width: 36, height: 36 }}>
                        <Icon name="gear" size={18} />
                      </span>
                      <span className="flex-1 text-right t-label">עיצוב, פונטים והגדרות</span>
                      <span className="t-faint"><Icon name="chevron" size={16} /></span>
                    </button>
                  </>
                );
              })()}
            </div>
          )
        )}

        {/* ---------- shared: sort + search ---------- */}
        {(activeView === 'INVENTORY' || activeView === 'SHOPPING') && (
          <div className="flex flex-col gap-3 mb-4">
            <div className="seg" role="tablist" aria-label="מיון">
              <button role="tab" aria-selected={sortBy === 'name'} onClick={() => setSortBy('name')} className="seg-item">לפי א״ב</button>
              <button role="tab" aria-selected={sortBy === 'category'} onClick={() => setSortBy('category')} className="seg-item">לפי קטגוריות</button>
            </div>
            <div className="relative">
              <span className="absolute top-1/2 -translate-y-1/2 t-faint pointer-events-none" style={{ insetInlineStart: 14 }}>
                <Icon name="search" size={18} />
              </span>
              <label className="sr-only" htmlFor="search-field">חיפוש</label>
              <input
                id="search-field"
                type="search"
                className="field"
                style={{ paddingInlineStart: 44, paddingInlineEnd: 44 }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={activeView === 'INVENTORY' ? 'חפש פריט במלאי' : 'חפש פריט בקניות'}
              />
              {searchTerm && (
                <button
                  className="btn-icon absolute top-1/2 -translate-y-1/2"
                  style={{ insetInlineEnd: 4, width: 34, height: 34 }}
                  onClick={() => setSearchTerm('')}
                  aria-label="נקה חיפוש"
                >
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
            {searchTerm && (
              <p className="t-micro t-dim">
                {activeView === 'INVENTORY' ? filteredInventory.length : filteredShoppingList.length} תוצאות · לחיצה על שם או קטגוריה פותחת לעריכה
              </p>
            )}
          </div>
        )}

        {/* ---------- classification cards ---------- */}
        {(dbPending.length > 0 || localPending.length > 0) && activeView === 'INVENTORY' && (
          <div className="mb-6 grid gap-3">
            {dbPending.map(item => (
              <ClassificationCard
                key={`dbp-${item.id}`}
                name={item.item_name}
                categories={pickCategories}
                onResolve={cat => resolveDbPending(item, cat)}
                onIgnore={() => resolveDbPending(item, 'כללי')}
              />
            ))}
            {localPending.map((item, idx) => (
              <ClassificationCard
                key={`lp-${idx}-${item.item_name}`}
                name={item.item_name || item.name}
                categories={pickCategories}
                onResolve={cat => resolveLocalPending(item, cat)}
                onIgnore={() => resolveLocalPending(item, 'כללי')}
              />
            ))}
          </div>
        )}

        {/* ---------- disambiguation ---------- */}
        {disambiguationItems.length > 0 && activeView === 'INVENTORY' && (
          <div className="mb-6 grid gap-3">
            {disambiguationItems.map((task, idx) => (
              <div key={`dis-${idx}`} className="card">
                <p className="t-body mb-3">
                  יש כמה סוגים של <b>{task.originalName}</b> במלאי. איזה מהם להוריד?
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {task.matches.map(m => (
                    <button key={m.id} onClick={() => handleResolveDisambiguation(task, m)} className="chip chip-btn">
                      {m.item_name} · <span className="num">{m.quantity}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleResolveDisambiguation(task, 'ALL')} className="btn btn-primary btn-sm flex-1">
                    {task.removeAll ? 'אפס את כולם' : `הורד ${Math.abs(task.quantityToSubtract)} מכל אחד`}
                  </button>
                  <button onClick={() => setDisambiguationItems(prev => prev.filter(t => t !== task))} className="btn btn-secondary btn-sm">ביטול</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------- INVENTORY ---------- */}
        {activeView === 'INVENTORY' && (
          <>
            <form onSubmit={handleInventoryUpdate} className="card mb-4 grid gap-3">
              <label className="field-label" htmlFor="inv-text">עדכון בטקסט חופשי</label>
              <textarea
                id="inv-text"
                className="field"
                value={invInput}
                onChange={e => setInvInput(e.target.value)}
                placeholder="למשל: תוריד את כל המיונז, 2 חלב"
              />
              <button type="submit" className="btn btn-primary" disabled={!invInput.trim()}>
                <Icon name="sparkle" size={18} /> עדכן מלאי
              </button>
            </form>

            <div className="seg mb-4" role="tablist" aria-label="מיקום">
              {(['הכל', 'מקרר', 'מזווה'] as const).map(f => (
                <button key={f} role="tab" aria-selected={invFilter === f} onClick={() => setInvFilter(f)} className="seg-item">
                  {f === 'מקרר' && <Icon name="snow" size={15} />}{f}
                </button>
              ))}
            </div>

            {lowStockAlerts.length > 0 && (
              <div className="mb-4 grid gap-2">
                {lowStockAlerts.map(a => (
                  <div key={`low-${a.id}`} className="note note-warn">
                    <Icon name="alert" size={18} />
                    <span className="flex-1">נשארו <span className="num">{a.quantity}</span> מ{a.item_name}. להוסיף לקניות?</span>
                    <button onClick={() => addToShopping(a)} className="btn btn-primary btn-xs">כן</button>
                    <button onClick={() => setLowStockAlerts(prev => prev.filter(i => i.id !== a.id))} className="btn btn-secondary btn-xs">לא</button>
                  </div>
                ))}
              </div>
            )}

            {loading ? (
              <div className="grid gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="skel" style={{ height: 92 }} />)}</div>
            ) : filteredInventory.length === 0 ? (
              <EmptyState
                icon={searchTerm ? 'search' : 'box'}
                title={searchTerm ? 'אין תוצאות' : 'המלאי ריק'}
                body={searchTerm ? 'אין פריט שתואם את החיפוש.' : 'הוסף פריטים בטקסט חופשי למעלה, או העבר פריטים מהקניות.'}
                actionLabel={searchTerm ? 'נקה חיפוש' : undefined}
                onAction={searchTerm ? () => setSearchTerm('') : undefined}
              />
            ) : sortBy === 'category' ? (
              <div className="grid gap-6">
                {displayCategories.map(cat => {
                  const items = filteredInventory.filter(i => (i.category || 'כללי') === cat);
                  if (!items.length) return null;
                  return (
                    <section key={`cat-${cat}`} className="grid gap-3">
                      <h2 className="eyebrow">{cat}</h2>
                      {items.map(item => (
                        <InventoryCard key={item.id} item={item} {...invCardProps(item)} />
                      ))}
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredInventory.map(item => <InventoryCard key={item.id} item={item} {...invCardProps(item)} />)}
              </div>
            )}
          </>
        )}

        {/* ---------- SHOPPING ---------- */}
        {activeView === 'SHOPPING' && (
          <>
            <form onSubmit={handleQuickAddSubmit} className="card mb-4 grid gap-3">
              {quickAddRows.map((row, i) => {
                const q = normKey(row.name);
                const matches = (suggestRow === i && q.length >= 1)
                  ? suggestionPool.filter(s => { const sl = s.toLowerCase(); return sl.includes(q) && sl !== q; }).slice(0, 7)
                  : [];
                return (
                  <div key={`qa-${i}`} className="grid gap-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <label className="sr-only" htmlFor={`qa-name-${i}`}>{i === 0 ? 'פריט לקנייה' : `פריט נוסף ${i + 1}`}</label>
                        <input
                          id={`qa-name-${i}`}
                          className="field"
                          type="text"
                          value={row.name}
                          autoComplete="off"
                          role="combobox"
                          aria-expanded={matches.length > 0}
                          aria-autocomplete="list"
                          onChange={e => { updateQuickAddRow(i, { name: e.target.value }); setSuggestIdx(0); }}
                          onFocus={() => { setSuggestRow(i); setSuggestIdx(0); }}
                          onBlur={() => { window.setTimeout(() => setSuggestRow(prev => (prev === i ? null : prev)), 150); autoFillRowCategory(i, row.name); }}
                          onKeyDown={e => {
                            if (!matches.length) return;
                            if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestIdx(x => Math.min(x + 1, matches.length - 1)); }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestIdx(x => Math.max(x - 1, 0)); }
                            else if (e.key === 'Enter' && suggestRow === i) {
                              e.preventDefault();
                              const pick = matches[suggestIdx];
                              if (pick) { updateQuickAddRow(i, { name: pick }); setSuggestRow(null); autoFillRowCategory(i, pick); }
                            } else if (e.key === 'Escape') setSuggestRow(null);
                          }}
                          placeholder={i === 0 ? 'פריט לקנייה' : 'פריט נוסף'}
                        />
                        {matches.length > 0 && (
                          <ul className="sheet absolute z-30 top-full mt-1 inset-x-0 max-h-60 overflow-y-auto" role="listbox">
                            {matches.map((m, mi) => (
                              <li key={m} role="option" aria-selected={mi === suggestIdx}>
                                <button
                                  type="button"
                                  onMouseDown={e => { e.preventDefault(); updateQuickAddRow(i, { name: m }); setSuggestRow(null); autoFillRowCategory(i, m); }}
                                  className="w-full text-right px-4 py-3 t-body border-b border-[var(--border-subtle)] last:border-0"
                                  style={{ background: mi === suggestIdx ? 'var(--s-sunken)' : 'transparent' }}
                                >
                                  {m}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <label className="sr-only" htmlFor={`qa-cat-${i}`}>קטגוריה</label>
                      <select
                        id={`qa-cat-${i}`}
                        className="field"
                        style={{ width: 130, flex: 'none' }}
                        value={row.category}
                        onChange={e => updateQuickAddRow(i, { category: e.target.value, newCategory: e.target.value === '__other__' ? row.newCategory : '' })}
                      >
                        <option value="">{catGuessingRow === i ? 'מסווג…' : 'סיווג אוטומטי'}</option>
                        <option value="כללי">כללי</option>
                        {pickCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__other__">+ אחר…</option>
                      </select>
                    </div>
                    {row.category === '__other__' && (
                      <input
                        className="field"
                        type="text"
                        value={row.newCategory}
                        onChange={e => updateQuickAddRow(i, { newCategory: e.target.value })}
                        placeholder="שם קטגוריה חדשה"
                        aria-label="שם קטגוריה חדשה"
                      />
                    )}
                  </div>
                );
              })}
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary flex-1" disabled={quickAddSubmitting || quickAddRows.every(r => !r.name.trim())}>
                  <Icon name="plus" size={18} /> הוסף לקניות
                </button>
                <button type="button" onClick={openCategorize} className="btn btn-secondary" title="חלוקת פריטים לא מסווגים">
                  <Icon name="folder" size={18} /> חלוקה
                </button>
              </div>
            </form>

            <button
              type="button"
              onClick={() => setShowTemplatesPanel(v => !v)}
              className="card card-tight card-interactive w-full flex items-center gap-3 mb-4"
              aria-expanded={showTemplatesPanel}
            >
              <span className="tile" style={{ width: 36, height: 36 }}><Icon name="list" size={18} /></span>
              <span className="flex-1 text-right t-label">רשימות שמורות</span>
              <span className="t-micro t-dim num">{shoppingTemplates.length}</span>
              <span className="t-faint" style={{ transform: showTemplatesPanel ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur)' }}>
                <Icon name="chevronDown" size={16} />
              </span>
            </button>

            {showTemplatesPanel && (
              <div className="grid gap-3 mb-4 slide-up">
                {!showCreateTemplate && (
                  <button onClick={() => { setShowCreateTemplate(true); setNewTemplateName(''); setNewTemplateItemsText(''); }} className="btn btn-secondary">
                    <Icon name="plus" size={18} /> צור רשימה חדשה
                  </button>
                )}
                {showCreateTemplate && (
                  <div className="card grid gap-3">
                    <h3 className="t-title">רשימה חדשה</h3>
                    <input className="field" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="שם הרשימה" aria-label="שם הרשימה" />
                    <textarea className="field" style={{ minHeight: 150 }} value={newTemplateItemsText} onChange={e => setNewTemplateItemsText(e.target.value)} placeholder={'פריט אחד בכל שורה'} aria-label="פריטי הרשימה" />
                    <div className="flex gap-2">
                      <button onClick={createTemplate} className="btn btn-primary flex-1">שמור רשימה</button>
                      <button onClick={() => setShowCreateTemplate(false)} className="btn btn-secondary">ביטול</button>
                    </div>
                  </div>
                )}
                {templatesError ? (
                  <div className="note note-danger" role="alert">
                    <Icon name="alert" size={18} />
                    <span className="flex-1">
                      הרשימות לא נטענו — כנראה חסרות הרשאות לטבלה.
                      <span className="block t-micro mt-1" dir="ltr">{templatesError}</span>
                    </span>
                  </div>
                ) : shoppingTemplates.length === 0 ? (
                  <EmptyState icon="list" title="אין רשימות שמורות" body="רשימה שמורה מוסיפה קבוצת פריטים לקניות בלחיצה אחת." />
                ) : shoppingTemplates.map(tpl => {
                  const isExpanded = expandedTemplateId === tpl.id;
                  const cats = Array.from(new Set(tpl.items.map(it => (it.category || '').trim()).filter(Boolean)));
                  return (
                    <div key={tpl.id} className="card card-tight">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setExpandedTemplateId(isExpanded ? null : tpl.id)} className="flex-1 text-right" aria-expanded={isExpanded}>
                          <span className="block t-label" style={{ color: 'var(--t-primary)', fontSize: 15 }}>{tpl.name}</span>
                          <span className="block t-micro t-dim mt-0.5"><span className="num">{tpl.items.length}</span> פריטים</span>
                        </button>
                        <button onClick={() => addTemplateToShopping(tpl)} disabled={addingTemplateId === tpl.id} className="btn btn-primary btn-xs">
                          {addingTemplateId === tpl.id ? '…' : 'הוסף'}
                        </button>
                        <button onClick={() => deleteTemplate(tpl)} className="btn-icon btn-icon-danger" aria-label={`מחק את ${tpl.name}`}>
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] grid gap-3">
                          {(cats.length ? cats : ['']).map(cat => {
                            const items = cat ? tpl.items.filter(it => (it.category || '').trim() === cat) : tpl.items.filter(it => !(it.category || '').trim());
                            if (!items.length) return null;
                            return (
                              <div key={`tc-${cat}`}>
                                {cat && <h4 className="eyebrow mb-2">{cat}</h4>}
                                <ul className="grid gap-1">
                                  {items.map(it => <li key={it.id} className="t-body t-dim">{it.item_name}</li>)}
                                </ul>
                              </div>
                            );
                          })}
                          {cats.length > 0 && tpl.items.some(it => !(it.category || '').trim()) && (
                            <div>
                              <h4 className="eyebrow mb-2">כללי</h4>
                              <ul className="grid gap-1">
                                {tpl.items.filter(it => !(it.category || '').trim()).map(it => <li key={it.id} className="t-body t-dim">{it.item_name}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {showCategorize && (() => {
              // Anything the app filed on its own, plus anything sitting in כללי.
              const pending = filteredShoppingList.filter(s => s.category_auto === true || !s.category || s.category === 'כללי');
              return (
                <div className="card mb-4 slide-up">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="t-title flex-1">חלוקה לקטגוריות</h3>
                    <button className="btn-icon" onClick={() => setShowCategorize(false)} aria-label="סגור"><Icon name="x" size={17} /></button>
                  </div>
                  {pending.length === 0 ? (
                    <p className="t-body t-dim">הכל מסווג.</p>
                  ) : (
                    <>
                      <p className="t-micro t-dim mb-3">פריטים שלא סווגו ידנית. הסיווג שהאפליקציה בחרה מופיע כברירת מחדל.</p>
                      <div className="grid gap-2 max-h-[55vh] overflow-y-auto">
                        {pending.map(item => {
                          const guessed = item.category && item.category !== 'כללי' ? item.category : null;
                          const chosen = categorizeAssignments[item.id] ?? (guessed || 'כללי');
                          return (
                            <div key={`cz-${item.id}`} className="grid gap-2 p-3 rounded-[var(--r-sm)]" style={{ background: 'var(--s-sunken)' }}>
                              <div className="flex items-center gap-2">
                                <span className="flex-1 t-body">{item.item_name}</span>
                                {guessed && <span className="chip">{guessed}</span>}
                                <select
                                  className="field"
                                  style={{ width: 120, flex: 'none', minHeight: 38 }}
                                  value={chosen}
                                  onChange={e => setCategorizeAssignments(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  aria-label={`קטגוריה ל${item.item_name}`}
                                >
                                  <option value="כללי">כללי</option>
                                  {pickCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                  <option value="__other__">+ אחר…</option>
                                </select>
                              </div>
                              {chosen === '__other__' && (
                                <input className="field" value={categorizeNewCats[item.id] || ''} onChange={e => setCategorizeNewCats(prev => ({ ...prev, [item.id]: e.target.value }))} placeholder="קטגוריה חדשה" aria-label="קטגוריה חדשה" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={applyCategorizeAssignments} className="btn btn-primary flex-1">שמור שינויים</button>
                        <button onClick={() => setShowCategorize(false)} className="btn btn-secondary">ביטול</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {wordChoiceTasks.length > 0 && (
              <div className="mb-4 grid gap-3">
                {wordChoiceTasks.map((task, idx) => (
                  <div key={`wc-${idx}`} className="card">
                    <p className="t-body mb-3">
                      אחת מהמילים ב<b>{task.originalName}</b> היא מוצר בפני עצמו. למה התכוונת?
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <button onClick={() => handleResolveWordChoice(task, task.originalName)} className="btn btn-primary btn-xs">{task.originalName}</button>
                      {task.options.map(opt => (
                        <button key={opt} onClick={() => handleResolveWordChoice(task, opt)} className="chip chip-btn">{opt}</button>
                      ))}
                    </div>
                    <button onClick={() => setWordChoiceTasks(prev => prev.filter(t => t !== task))} className="btn btn-ghost">ביטול</button>
                  </div>
                ))}
              </div>
            )}

            {addedSummary.length > 0 && (
              <div className="note note-ok mb-4 slide-up" role="status">
                <Icon name="check" size={18} />
                <div className="flex-1">
                  <span className="t-label block mb-2">נוסף לקניות</span>
                  <ul className="grid gap-1">
                    {addedSummary.map((a, i) => (
                      <li key={`ad-${i}`} className="flex items-center gap-2 flex-wrap t-body">
                        <span>{a.name}</span>
                        <span className="chip">{a.category}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={() => setAddedSummary([])} aria-label="סגור"><Icon name="x" size={15} /></button>
              </div>
            )}

            {duplicateShoppingAlerts.length > 0 && (
              <div className="mb-4 grid gap-2">
                {duplicateShoppingAlerts.map(name => (
                  <div key={`dup-${name}`} className="note note-warn">
                    <Icon name="alert" size={18} />
                    <span className="flex-1">{name} כבר ברשימה</span>
                    <button onClick={() => setDuplicateShoppingAlerts(prev => prev.filter(n => n !== name))} className="btn btn-secondary btn-xs">הבנתי</button>
                  </div>
                ))}
              </div>
            )}

            {loading ? (
              <div className="grid gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="skel" style={{ height: 78 }} />)}</div>
            ) : filteredShoppingList.length === 0 ? (
              <EmptyState
                icon={searchTerm ? 'search' : 'cart'}
                title={searchTerm ? 'אין תוצאות' : 'רשימת הקניות ריקה'}
                body={searchTerm ? 'אין פריט שתואם את החיפוש.' : 'הוסף פריטים למעלה, או השתמש ברשימה שמורה.'}
                actionLabel={searchTerm ? 'נקה חיפוש' : undefined}
                onAction={searchTerm ? () => setSearchTerm('') : undefined}
              />
            ) : sortBy === 'category' ? (
              <div className="grid gap-6">
                {displayCategories.map(cat => {
                  const list = filteredShoppingList.filter(s => (s.category || 'כללי') === cat);
                  const isAddOpen = categoryAddOpen === cat;
                  if (!list.length && !isAddOpen && searchTerm) return null;
                  return (
                    <section key={`sc-${cat}`} className="grid gap-3">
                      <div className="flex items-center gap-2">
                        {editingCategoryName === cat ? (
                          <>
                            <input
                              autoFocus
                              className="field flex-1"
                              value={categoryNameValue}
                              onChange={e => setCategoryNameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveRenameCategory(cat); if (e.key === 'Escape') setEditingCategoryName(null); }}
                              aria-label="שם הקטגוריה"
                            />
                            <button className="btn-icon" onClick={() => saveRenameCategory(cat)} aria-label="שמור שם"><Icon name="check" size={18} /></button>
                            <button className="btn-icon" onClick={() => setEditingCategoryName(null)} aria-label="ביטול"><Icon name="x" size={18} /></button>
                          </>
                        ) : (
                          <>
                            <h2 className="eyebrow flex-1">{cat}</h2>
                            {cat !== 'כללי' && (
                              <>
                                <button className="btn-icon" onClick={() => startRenameCategory(cat)} aria-label={`שנה שם ל${cat}`}><Icon name="pencil" size={17} /></button>
                                <button className="btn-icon btn-icon-danger" onClick={() => deleteCategory(cat)} aria-label={`מחק את ${cat}`}><Icon name="trash" size={17} /></button>
                              </>
                            )}
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={() => { setCategoryAddOpen(prev => (prev === cat ? null : cat)); setCategoryAddInput(''); }}
                            >
                              {isAddOpen ? 'סגור' : '+ הוסף'}
                            </button>
                          </>
                        )}
                      </div>
                      {isAddOpen && (
                        <form onSubmit={e => handleCategoryAdd(e, cat)} className="flex gap-2">
                          <input
                            autoFocus
                            className="field flex-1"
                            value={categoryAddInput}
                            onChange={e => setCategoryAddInput(e.target.value)}
                            placeholder="תפוזים אפרסק, קישוא צהוב"
                            aria-label={`הוסף פריטים ל${cat}`}
                          />
                          <button type="submit" className="btn btn-primary btn-sm" disabled={categoryAddLoading || !categoryAddInput.trim()}>
                            {categoryAddLoading ? '…' : 'הוסף'}
                          </button>
                        </form>
                      )}
                      {list.map(s => <ShoppingCard key={s.id} item={s} {...shopCardProps(s)} />)}
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredShoppingList.map(s => <ShoppingCard key={s.id} item={s} {...shopCardProps(s)} />)}
              </div>
            )}
          </>
        )}

        {/* ---------- TASKS ---------- */}
        {activeView === 'TASKS' && (
          <>
            <button onClick={() => setShowTaskForm(v => !v)} className="btn btn-primary w-full mb-4">
              <Icon name={showTaskForm ? 'x' : 'plus'} size={18} /> {showTaskForm ? 'סגור טופס' : 'משימה חדשה'}
            </button>

            {showTaskForm && (
              <form
                onSubmit={e => { e.preventDefault(); persistNewTask(false); }}
                className="card mb-6 grid gap-3"
              >
                <div>
                  <label className="field-label" htmlFor="nt-title">שם המשימה</label>
                  <input id="nt-title" className="field" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} placeholder="מה צריך לעשות" />
                </div>
                <div>
                  <label className="field-label" htmlFor="nt-desc">תיאור</label>
                  <textarea id="nt-desc" className="field" value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} placeholder="אופציונלי" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label" htmlFor="nt-urg">דחיפות</label>
                    <select id="nt-urg" className="field" value={newTask.urgency} onChange={e => setNewTask({ ...newTask, urgency: e.target.value })}>
                      <option>דחופה מאד</option><option>גבוהה</option><option>סטנדרטית</option><option>נמוכה</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="nt-who">באחריות</label>
                    <select id="nt-who" className="field" value={newTask.assignee} onChange={e => setNewTask({ ...newTask, assignee: e.target.value })}>
                      <option>שוקי</option><option>הילה</option><option>כולם</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="field-label" htmlFor="nt-date">תאריך יעד</label>
                  <input id="nt-date" type="date" className="field field-center" value={newTask.target_date} onChange={e => setNewTask({ ...newTask, target_date: e.target.value })} />
                </div>
                <div>
                  <label className="field-label" htmlFor="nt-dep">תלות במשימה</label>
                  <select id="nt-dep" className="field" value={newTask.depends_on_task_id || ''} onChange={e => setNewTask({ ...newTask, depends_on_task_id: e.target.value || null })}>
                    <option value="">ללא תלות</option>
                    {activeTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary flex-1">שמור</button>
                  <button type="button" onClick={() => persistNewTask(true)} className="btn btn-secondary flex-1">
                    <Icon name="whatsapp" size={18} /> שמור ושלח
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="grid gap-3">{[0, 1, 2].map(i => <div key={i} className="skel" style={{ height: 150 }} />)}</div>
            ) : activeTasks.length === 0 ? (
              <EmptyState icon="pin" title="אין משימות פתוחות" body="הוסף משימה, אפשר גם עם תלות במשימה אחרת." />
            ) : (
              <div className="grid gap-3">
                {activeTasks.map(task => {
                  const blockedBy = getBlockingTask(task);
                  const isEditing = editingTaskId === task.id;
                  const isPoofing = poofingIds.includes(task.id!);
                  const draft = isEditing ? editTaskDraft : null;
                  const isPlural = (task.assignee || '').includes('כולם');
                  const stop = (e: React.MouseEvent) => e.stopPropagation();
                  return (
                    <div
                      key={task.id}
                      className={`card spine ${isPoofing ? 'task-poof' : ''}`}
                      style={{
                        ['--spine-c' as any]: urgencyTone(task.urgency),
                        opacity: blockedBy ? .62 : 1,
                        boxShadow: isEditing ? 'var(--sh-focus)' : undefined,
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <button className="flex-1 text-right tap-text" onClick={() => !isPoofing && startEditTask(task, 'all')}>
                          <h3 className="t-title">{task.title}</h3>
                        </button>
                        <button onClick={e => { stop(e); deleteTask(task); }} className="btn-icon btn-icon-danger" aria-label={`מחק את ${task.title}`}>
                          <Icon name="trash" size={17} />
                        </button>
                      </div>

                      {task.description && <p className="t-body t-dim mt-1">{task.description}</p>}

                      {blockedBy && (
                        <div className="note note-warn mt-3">
                          <Icon name="clock" size={17} />
                          <span className="flex-1">ממתין למשימה: <b>{blockedBy.title}</b></span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mt-3">
                        <button className="chip chip-btn chip-editable" onClick={e => { stop(e); startEditTask(task, 'assignee'); }}>{task.assignee}</button>
                        <button className="chip chip-btn chip-editable num" onClick={e => { stop(e); startEditTask(task, 'date'); }}>{fmtDate(task.target_date)}</button>
                        <button className="chip chip-btn chip-editable" onClick={e => { stop(e); startEditTask(task, 'urgency'); }}>{urgencyIcon(task.urgency)} {task.urgency}</button>
                      </div>

                      {isEditing && draft && (
                        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] grid gap-3">
                          <input
                            className="field"
                            autoFocus={editTaskFocus === 'all' || editTaskFocus === 'title'}
                            value={draft.title}
                            onChange={e => setEditTaskDraft({ ...draft, title: e.target.value })}
                            aria-label="שם המשימה"
                          />
                          <textarea className="field" value={draft.description || ''} onChange={e => setEditTaskDraft({ ...draft, description: e.target.value })} aria-label="תיאור" />
                          <div className="grid grid-cols-2 gap-3">
                            <select
                              className="field"
                              ref={el => { if (el && editTaskFocus === 'urgency') el.focus(); }}
                              value={draft.urgency}
                              onChange={e => setEditTaskDraft({ ...draft, urgency: e.target.value })}
                              aria-label="דחיפות"
                            >
                              <option>דחופה מאד</option><option>גבוהה</option><option>סטנדרטית</option><option>נמוכה</option>
                            </select>
                            <select
                              className="field"
                              ref={el => { if (el && editTaskFocus === 'assignee') el.focus(); }}
                              value={draft.assignee}
                              onChange={e => setEditTaskDraft({ ...draft, assignee: e.target.value })}
                              aria-label="באחריות"
                            >
                              <option>שוקי</option><option>הילה</option><option>כולם</option>
                            </select>
                          </div>
                          <input
                            type="date"
                            className="field field-center"
                            ref={el => { if (el && editTaskFocus === 'date') el.focus(); }}
                            value={draft.target_date}
                            onChange={e => setEditTaskDraft({ ...draft, target_date: e.target.value })}
                            aria-label="תאריך יעד"
                          />
                          <div>
                            <label className="field-label">תלות במשימה</label>
                            <select
                              className="field"
                              ref={el => { if (el && editTaskFocus === 'depends') el.focus(); }}
                              value={draft.depends_on_task_id || ''}
                              onChange={e => setEditTaskDraft({ ...draft, depends_on_task_id: e.target.value || null })}
                            >
                              <option value="">ללא תלות</option>
                              {tasks.filter(t => t.id !== task.id && t.status !== 'סיימתי').map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={saveEditTask} className="btn btn-primary flex-1">שמור שינויים</button>
                            <button onClick={cancelEditTask} className="btn btn-secondary">ביטול</button>
                          </div>
                        </div>
                      )}

                      <div className="seg mt-4" role="group" aria-label="סטטוס המשימה">
                        {([['לא התחלתי', isPlural ? 'לא התחלנו' : 'לא התחלתי'], ['בתהליך', 'בתהליך'], ['סיימתי', isPlural ? 'סיימנו' : 'סיימתי']] as [string, string][]).map(([val, label]) => (
                          <button
                            key={val}
                            className="seg-item"
                            aria-pressed={(task.status || 'לא התחלתי') === val}
                            disabled={!!blockedBy}
                            onClick={() => updateTaskStatus(task.id!, val)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {completedTasks.length > 0 && (
              <section className="mt-8">
                <h2 className="eyebrow mb-3">משימות שהסתיימו</h2>
                <div className="grid gap-3">
                  {completedTasks.map(task => <CompletedTaskCard key={task.id} task={task} onRestore={handleRestoreTask} onDelete={deleteTask} />)}
                </div>
              </section>
            )}
          </>
        )}

        {/* ---------- TEMPLATES = packing lists ---------- */}
        {activeView === 'TEMPLATES' && (
          <>
            <div className="seg mb-4 flex-wrap" role="tablist" aria-label="רשימות ציוד">
              {equipListTypes.map(lt => (
                <button key={lt} role="tab" aria-selected={equipListType === lt} onClick={() => setEquipListType(lt)} className="seg-item" style={{ minWidth: 92 }}>
                  {lt}
                </button>
              ))}
            </div>

            <form onSubmit={handleEquipmentUpdate} className="card mb-4 grid gap-3">
              <label className="field-label" htmlFor="eq-text">הוסף או הורד ציוד</label>
              <textarea id="eq-text" className="field" value={equipInput} onChange={e => setEquipInput(e.target.value)} placeholder="למשל: מטען, אוזניות, תרופות שינה" />
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary flex-1" disabled={!equipInput.trim()}>
                  <Icon name="plus" size={18} /> עדכן רשימה
                </button>
                <button type="button" onClick={() => resetPacking(equipListType)} disabled={packedEquip.length === 0} className="btn btn-secondary">
                  <Icon name="refresh" size={18} /> חדש
                </button>
              </div>
            </form>

            {loading ? (
              <div className="grid gap-2">{[0, 1, 2, 3, 4].map(i => <div key={i} className="skel" style={{ height: 60 }} />)}</div>
            ) : unpackedEquip.length === 0 ? (
              <EmptyState
                icon="check"
                title={packedEquip.length ? 'הכל ארוז' : 'הרשימה ריקה'}
                body={packedEquip.length ? 'כל הפריטים מסומנים. "חדש" מאפס את הסימונים לאריזה הבאה.' : 'הוסף ציוד בטקסט חופשי למעלה.'}
              />
            ) : (
              <div className="grid gap-6">
                {equipCategories.map(cat => {
                  const items = unpackedEquip.filter(i => i.category === cat);
                  if (!items.length) return null;
                  return (
                    <section key={`eq-${cat}`} className="grid gap-2">
                      <h2 className="eyebrow">{cat}</h2>
                      {items.map(item => (
                        <div key={item.id} className="card card-tight spine flex items-center gap-3" style={{ ['--spine-c' as any]: spineFor(cat) }}>
                          <button
                            onClick={() => togglePacked(item)}
                            role="checkbox"
                            aria-checked={false}
                            aria-label={`סמן ${item.item_name} כנארז`}
                            className="flex-none grid place-items-center"
                            style={{ width: 30, height: 30, borderRadius: 9, border: '2px solid var(--border-strong)', background: 'var(--s-raised)' }}
                          />
                          {editingId === item.id ? (
                            <>
                              <input
                                autoFocus
                                className="field flex-1"
                                value={editNameValue}
                                onChange={e => setEditNameValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveEditedName(item.id!, 'equipment_items'); if (e.key === 'Escape') setEditingId(null); }}
                                aria-label="שם הפריט"
                              />
                              <button className="btn-icon" onClick={() => saveEditedName(item.id!, 'equipment_items')} aria-label="שמור"><Icon name="check" size={18} /></button>
                              <button className="btn-icon" onClick={() => setEditingId(null)} aria-label="ביטול"><Icon name="x" size={18} /></button>
                            </>
                          ) : (
                            <>
                              <button
                                className="flex-1 text-right t-body tap-text"
                                onClick={() => { setEditingId(item.id!); setEditNameValue(item.item_name); }}
                              >
                                {item.item_name}
                              </button>
                              <button className="btn-icon btn-icon-danger" onClick={() => deleteEquipmentItem(item)} aria-label={`מחק את ${item.item_name}`}>
                                <Icon name="trash" size={17} />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </section>
                  );
                })}
              </div>
            )}

            {packedEquip.length > 0 && (
              <section className="mt-8">
                <h2 className="eyebrow mb-3">נארז · <span className="num">{packedEquip.length}</span></h2>
                <div className="grid gap-2">
                  {packedEquip.map(item => (
                    <div key={item.id} className="card card-tight flex items-center gap-3" style={{ background: 'var(--st-ok-bg)', borderColor: 'var(--st-ok-border)' }}>
                      <button
                        onClick={() => togglePacked(item)}
                        role="checkbox"
                        aria-checked
                        aria-label={`בטל סימון של ${item.item_name}`}
                        className="flex-none grid place-items-center"
                        style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--st-ok)', color: '#fff' }}
                      >
                        <Icon name="check" size={17} />
                      </button>
                      <span className="flex-1 t-body" style={{ textDecoration: 'line-through', color: 'var(--st-ok)' }}>{item.item_name}</span>
                      <span className="chip">{item.category}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ---------- SETTINGS ---------- */}
        {activeView === 'SETTINGS' && (
          <div className="grid gap-4">
            <section className="card">
              <h2 className="t-title mb-1">עיצוב</h2>
              <p className="t-body t-dim mb-4">שש ערכות שונות. הבחירה מוחלת מיד ונשמרת במכשיר.</p>
              <div className="grid gap-2">
                {THEME_OPTIONS.map(t => {
                  const active = appTheme === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => applyTheme(t.key)}
                      aria-pressed={active}
                      className="flex items-center gap-3 p-3 text-right rounded-[var(--r-md)] border"
                      style={{
                        borderColor: active ? 'var(--c-primary)' : 'var(--border-subtle)',
                        background: active ? 'var(--s-sunken)' : 'var(--s-raised)',
                        boxShadow: active ? 'var(--sh-focus)' : 'none',
                      }}
                    >
                      <span className="flex gap-1.5 flex-none" dir="ltr">
                        {[t.bg, t.primary, t.head].map((c, i) => (
                          <span key={i} style={{ width: 22, height: 22, borderRadius: 999, background: c, border: '1px solid rgb(0 0 0 / .12)' }} />
                        ))}
                      </span>
                      <span className="flex-1">
                        <span className="block t-label" style={{ color: 'var(--t-primary)' }}>{t.name}</span>
                        <span className="block t-micro t-dim mt-0.5">{t.desc}</span>
                      </span>
                      {active && <Icon name="check" size={18} />}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <h2 className="t-title mb-1">פונט</h2>
              <p className="t-body t-dim mb-4">כל אפשרות מוצגת בפונט של עצמה.</p>
              <div className="grid gap-2">
                {FONT_OPTIONS.map(f => {
                  const active = appFont === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => applyFont(f.key)}
                      aria-pressed={active}
                      style={{
                        fontFamily: `${f.varName}, sans-serif`,
                        borderColor: active ? 'var(--c-primary)' : 'var(--border-subtle)',
                        background: active ? 'var(--s-sunken)' : 'var(--s-raised)',
                        boxShadow: active ? 'var(--sh-focus)' : 'none',
                      }}
                      className="flex items-center gap-3 p-3 text-right rounded-[var(--r-md)] border"
                    >
                      <span className="flex-1">
                        <span className="block" style={{ fontSize: 17, fontWeight: 600, color: 'var(--t-primary)' }}>{f.name}</span>
                        <span className="block t-micro t-dim mt-0.5">אבגדה ABC <span className="num">123</span> · {f.desc}</span>
                      </span>
                      {active && <Icon name="check" size={18} />}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <h2 className="t-title mb-1">גרסה</h2>
              <p className="t-body t-dim">הבית של ניאו · גרסה 2.0</p>
            </section>
          </div>
        )}
      </div>

      {/* ---------- bottom navigation ---------- */}
      <nav className="tabbar" aria-label="ניווט ראשי">
        <div className="max-w-2xl mx-auto flex w-full">
          {NAV.map(n => (
            <button
              key={n.view}
              className="tabbar-item"
              aria-current={activeView === n.view ? 'page' : undefined}
              onClick={() => changeView(n.view)}
            >
              <span className="relative">
                <Icon name={n.view === 'HOME' && activeView === 'HOME' ? 'home_out' : n.icon} size={21} />
                {!!n.badge && n.badge > 0 && <span className="tabbar-badge num">{n.badge > 99 ? '99+' : n.badge}</span>}
              </span>
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );

  /* ---------------- prop bundles (kept out of JSX for readability) ---------------- */
  function invCardProps(item: Item) {
    return {
      editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName,
      updateExactQuantity,
      onPlus: () => updateExactQuantity(item, (item.quantity || 0) + 1),
      onMinus: () => updateExactQuantity(item, (item.quantity || 0) - 1),
      onAddToShopping: addToShopping,
      shoppingList: safeShoppingList,
      onDelete: deleteInventoryItem,
      editingCatItemId, editCatValue, setEditingCatItemId, setEditCatValue, saveEditedCategory,
      categories: pickCategories,
      onUpdateLocation: (loc: string) => updateInventoryField(item, 'location', loc),
      highlight: !!searchTerm && (item.item_name || '').includes(searchTerm),
      normKey,
    };
  }

  function shopCardProps(s: any) {
    return {
      editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName,
      editingCatItemId, editCatValue, setEditingCatItemId, setEditCatValue, saveEditedCategory,
      categories: pickCategories,
      onDelete: deleteShoppingItem,
      onMoveToInventory: moveShoppingToInventory,
      highlight: !!searchTerm && (s.item_name || '').includes(searchTerm),
    };
  }
}

/* ==================================================================== *
 * components
 * ==================================================================== */

function EmptyState({ icon, title, body, actionLabel, onAction }: {
  icon: string; title: string; body: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className="card empty">
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <h3 className="t-title">{title}</h3>
      <p className="t-body t-dim" style={{ maxWidth: 320 }}>{body}</p>
      {actionLabel && onAction && <button onClick={onAction} className="btn btn-secondary btn-sm mt-1">{actionLabel}</button>}
    </div>
  );
}

function ClassificationCard({ name, categories, onResolve, onIgnore }: {
  name: string; categories: string[]; onResolve: (cat: string) => void; onIgnore: () => void;
}) {
  const [customCat, setCustomCat] = useState('');
  const quick = Array.from(new Set([...categories, 'טרי', 'קפואים', 'שימורים', 'יבשים'])).slice(0, 6);
  return (
    <div className="card">
      <div className="flex items-start gap-2 mb-3">
        <p className="t-body flex-1">איפה לשמור את <b>{name}</b>?</p>
        <button onClick={onIgnore} className="btn btn-ghost btn-xs">כללי</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {quick.map(opt => <button key={opt} onClick={() => onResolve(opt)} className="chip chip-btn">{opt}</button>)}
      </div>
      <div className="flex gap-2">
        <input
          className="field flex-1"
          value={customCat}
          onChange={e => setCustomCat(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && customCat.trim()) onResolve(customCat.trim()); }}
          placeholder="או קטגוריה חדשה"
          aria-label="קטגוריה חדשה"
        />
        <button onClick={() => customCat.trim() && onResolve(customCat.trim())} disabled={!customCat.trim()} className="btn btn-primary btn-sm">שמור</button>
      </div>
    </div>
  );
}

function CompletedTaskCard({ task, onRestore, onDelete }: any) {
  const [newDate, setNewDate] = useState(localToday());
  const [open, setOpen] = useState(false);
  return (
    <div className="card card-tight" style={{ background: 'var(--s-sunken)' }}>
      <div className="flex items-center gap-2">
        <h3 className="flex-1 t-body" style={{ textDecoration: 'line-through', color: 'var(--t-secondary)' }}>{task.title}</h3>
        <button onClick={() => setOpen(v => !v)} className="btn btn-ghost btn-xs" aria-expanded={open}>שחזר</button>
        <button onClick={() => onDelete(task)} className="btn-icon btn-icon-danger" aria-label={`מחק את ${task.title}`}>
          <Icon name="trash" size={17} />
        </button>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex gap-2 items-end">
          <div className="flex-1">
            <label className="field-label">תאריך יעד חדש</label>
            <input type="date" className="field field-center" value={newDate} onChange={e => setNewDate(e.target.value)} />
          </div>
          <button onClick={() => { onRestore(task.id, newDate); setOpen(false); }} className="btn btn-primary btn-sm">שחזר</button>
        </div>
      )}
    </div>
  );
}

function Stepper({ value, low, onMinus, onPlus, onSet }: {
  value: number; low: boolean; onMinus: () => void; onPlus: () => void; onSet: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [flash, setFlash] = useState(0);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current !== value) { prev.current = value; setFlash(f => f + 1); }
  }, [value]);

  return (
    <div className={`stepper ${low ? 'stepper-low' : ''}`} dir="ltr">
      <button className="stepper-btn" onClick={onMinus} aria-label="הפחת אחד"><Icon name="minus" size={17} /></button>
      {editing ? (
        <input
          autoFocus
          type="number"
          className="stepper-val"
          style={{ width: 56, background: 'transparent', border: 'none', outline: 'none' }}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { const n = parseInt(draft, 10); setEditing(false); if (!Number.isNaN(n)) onSet(n); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { const n = parseInt(draft, 10); setEditing(false); if (!Number.isNaN(n)) onSet(n); }
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label="כמות"
        />
      ) : (
        <button
          key={flash}
          className="stepper-val val-flash"
          onClick={() => { setDraft(String(value)); setEditing(true); }}
          aria-label={`כמות ${value}, לחיצה להזנה ידנית`}
        >
          {value}
        </button>
      )}
      <button className="stepper-btn" onClick={onPlus} aria-label="הוסף אחד"><Icon name="plus" size={17} /></button>
    </div>
  );
}

function InventoryCard({
  item, editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName,
  updateExactQuantity, onPlus, onMinus, onAddToShopping, shoppingList, onDelete,
  editingCatItemId, editCatValue, setEditingCatItemId, setEditCatValue, saveEditedCategory,
  categories, onUpdateLocation, highlight, normKey,
}: any) {
  const isLow = (item.quantity || 0) <= 2;
  const already = shoppingList?.some((s: any) => normKey(s.item_name || '') === normKey(item.item_name || ''));
  const isFridge = (item.location || 'מזווה') === 'מקרר';
  const other = isFridge ? 'מזווה' : 'מקרר';
  const cat = item.category || 'כללי';

  return (
    <div
      className="card card-tight spine"
      style={{
        ['--spine-c' as any]: spineFor(cat),
        borderColor: highlight ? 'var(--c-primary)' : undefined,
        boxShadow: highlight ? 'var(--sh-focus)' : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {editingId === item.id ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="field flex-1"
                value={editNameValue}
                onChange={e => setEditNameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEditedName(item.id, 'inventory_items'); if (e.key === 'Escape') setEditingId(null); }}
                aria-label="שם הפריט"
              />
              <button className="btn-icon" onClick={() => saveEditedName(item.id, 'inventory_items')} aria-label="שמור"><Icon name="check" size={18} /></button>
            </div>
          ) : (
            <button
              className="block text-right t-body tap-text truncate w-full"
              style={{ fontSize: 16, fontWeight: 600 }}
              onClick={() => { setEditingId(item.id); setEditNameValue(item.item_name || ''); }}
            >
              {item.item_name || 'פריט'}
            </button>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {editingCatItemId === item.id ? (
              <div className="flex items-center gap-1 flex-wrap">
                {categories?.map((c: string) => (
                  <button key={c} onClick={() => saveEditedCategory(item.id, 'inventory_items', c)} className="chip chip-btn">{c}</button>
                ))}
                <input
                  autoFocus
                  className="field"
                  style={{ width: 130, minHeight: 34 }}
                  value={editCatValue}
                  onChange={e => setEditCatValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEditedCategory(item.id, 'inventory_items'); if (e.key === 'Escape') setEditingCatItemId(null); }}
                  placeholder="חדשה"
                  aria-label="קטגוריה חדשה"
                />
                <button className="btn-icon" style={{ width: 32, height: 32 }} onClick={() => setEditingCatItemId(null)} aria-label="ביטול"><Icon name="x" size={16} /></button>
              </div>
            ) : (
              <>
                <button className="chip chip-btn chip-editable" onClick={() => { setEditingCatItemId(item.id); setEditCatValue(cat); }}>{cat}</button>
                <button className="chip chip-btn chip-editable" onClick={() => onUpdateLocation(other)} aria-label={`העבר ל${other}`}>
                  {isFridge && <Icon name="snow" size={13} />}{item.location || 'מזווה'}
                </button>
                {item.updated_at && <span className="t-micro t-faint num">{new Date(item.updated_at).toLocaleDateString('he-IL')}</span>}
              </>
            )}
          </div>
        </div>

        <Stepper
          value={item.quantity || 0}
          low={isLow}
          onMinus={onMinus}
          onPlus={onPlus}
          onSet={(v: number) => updateExactQuantity(item, v)}
        />

        <button className="btn-icon btn-icon-danger flex-none" onClick={() => onDelete(item)} aria-label={`מחק את ${item.item_name}`}>
          <Icon name="trash" size={17} />
        </button>
      </div>

      {isLow && !already && (
        <button onClick={() => onAddToShopping(item)} className="btn btn-ghost btn-xs mt-2">
          <Icon name="cart" size={15} /> הוסף לקניות
        </button>
      )}
    </div>
  );
}

function ShoppingCard({
  item, editingId, editNameValue, setEditingId, setEditNameValue, saveEditedName,
  editingCatItemId, editCatValue, setEditingCatItemId, setEditCatValue, saveEditedCategory,
  categories, onDelete, onMoveToInventory, highlight,
}: any) {
  const [showQty, setShowQty] = useState(false);
  const [qty, setQty] = useState(1);

  // Swipe to delete. dragX lives in a ref as well as state, so the release
  // handler reads the real distance and a fast flick is not lost.
  const THRESHOLD = 96;
  const [dragX, setDragX] = useState(0);
  const dragRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<'none' | 'x' | 'y'>('none');

  const setDrag = (v: number) => { dragRef.current = v; setDragX(v); };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX; startY.current = t.clientY;
    axis.current = 'none';
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (axis.current === 'none') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (axis.current === 'y') return;
    setDrag(Math.max(0, Math.min(dx, 300)));
  };
  const onTouchEnd = () => {
    setDragging(false);
    axis.current = 'none';
    if (dragRef.current >= THRESHOLD) {
      setDrag(420);
      window.setTimeout(() => onDelete(item, true), 170);
      return;
    }
    setDrag(0);
  };

  const armed = dragX >= THRESHOLD;
  const cat = item.category || 'כללי';

  return (
    <div className="relative" style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      {/* the strip uncovered as the card slides right — dir=ltr so the label
          sits at the physical left edge, which is the side being revealed */}
      <div
        dir="ltr"
        className="absolute inset-0 flex items-center px-5"
        style={{
          background: armed ? 'var(--st-danger)' : 'var(--st-danger-bg)',
          color: armed ? '#fff' : 'var(--st-danger)',
          opacity: dragX > 0 ? 1 : 0,
          transition: 'background-color var(--dur) var(--ease-out)',
        }}
        aria-hidden="true"
      >
        <span className="flex items-center gap-2 t-label">
          <Icon name="trash" size={17} />
          {armed ? 'שחרר למחיקה' : 'החלק למחיקה'}
        </span>
      </div>

      <div
        className="card card-tight spine swipe-row"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          ['--spine-c' as any]: spineFor(cat),
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform var(--dur-slow) var(--ease-out)',
          borderColor: highlight ? 'var(--c-primary)' : undefined,
          boxShadow: highlight ? 'var(--sh-focus)' : undefined,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {editingId === item.id ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="field flex-1"
                  value={editNameValue}
                  onChange={e => setEditNameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEditedName(item.id, 'shopping_list'); if (e.key === 'Escape') setEditingId(null); }}
                  aria-label="שם הפריט"
                />
                <button className="btn-icon" onClick={() => saveEditedName(item.id, 'shopping_list')} aria-label="שמור"><Icon name="check" size={18} /></button>
              </div>
            ) : (
              <button
                className="block text-right t-body tap-text truncate w-full"
                style={{ fontSize: 16, fontWeight: 600 }}
                onClick={() => { setEditingId(item.id); setEditNameValue(item.item_name || ''); }}
              >
                {item.item_name || 'פריט'}
              </button>
            )}
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {editingCatItemId === item.id ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {categories?.map((c: string) => (
                    <button key={c} onClick={() => saveEditedCategory(item.id, 'shopping_list', c)} className="chip chip-btn">{c}</button>
                  ))}
                  <input
                    autoFocus
                    className="field"
                    style={{ width: 130, minHeight: 34 }}
                    value={editCatValue}
                    onChange={e => setEditCatValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEditedCategory(item.id, 'shopping_list'); if (e.key === 'Escape') setEditingCatItemId(null); }}
                    placeholder="חדשה"
                    aria-label="קטגוריה חדשה"
                  />
                  <button className="btn-icon" style={{ width: 32, height: 32 }} onClick={() => setEditingCatItemId(null)} aria-label="ביטול"><Icon name="x" size={16} /></button>
                </div>
              ) : (
                <button className="chip chip-btn chip-editable" onClick={() => { setEditingCatItemId(item.id); setEditCatValue(cat); }}>{cat}</button>
              )}
            </div>
          </div>

          <button className="btn btn-ghost btn-xs flex-none" onClick={() => setShowQty(v => !v)} aria-expanded={showQty}>
            <Icon name="box" size={15} /> למלאי
          </button>
          {/* keyboard/desktop delete — the swipe is a shortcut, not the only way */}
          <button className="btn-icon btn-icon-danger flex-none" onClick={() => onDelete(item)} aria-label={`מחק את ${item.item_name}`}>
            <Icon name="trash" size={17} />
          </button>
        </div>

        {showQty && (
          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-3">
            <span className="t-label flex-1">כמה להעביר למלאי?</span>
            <div className="stepper" dir="ltr">
              <button className="stepper-btn" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="פחות"><Icon name="minus" size={16} /></button>
              <span className="stepper-val">{qty}</span>
              <button className="stepper-btn" onClick={() => setQty(q => q + 1)} aria-label="עוד"><Icon name="plus" size={16} /></button>
            </div>
            <button onClick={() => { onMoveToInventory(item, qty); setShowQty(false); setQty(1); }} className="btn btn-primary btn-xs">אישור</button>
          </div>
        )}
      </div>
    </div>
  );
}
