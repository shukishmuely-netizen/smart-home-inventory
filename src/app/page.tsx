// ... (חלקי הקוד הקודמים נשארים, וודא שפונקציית onSubmit נראית כך:)
const onSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!input.trim()) return;
  setStatus('מעבד...');

  try {
    const res = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text: input }) });
    const parsed = await res.json();

    for (const item of parsed.items) {
      // אנחנו מחפשים אם כבר יש מוצר בשם הזה במלאי
      const { data: existingItem } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('item_name', item.name)
        .maybeSingle(); // חשוב: maybeSingle לא קורס אם אין כלום
      
      if (existingItem) {
        // אם קיים - מעדכנים כמות (מוסיפים או מורידים)
        const change = parsed.action === 'add' ? item.quantity : -item.quantity;
        const newQty = Math.max(0, existingItem.quantity + change);
        
        await supabase
          .from('inventory_items')
          .update({ quantity: newQty })
          .eq('id', existingItem.id);
      } else if (parsed.action === 'add') {
        // אם לא קיים וזו הוספה - יוצרים חדש
        await supabase.from('inventory_items').insert([{ 
          item_name: item.name, 
          quantity: item.quantity, 
          household_id: '92e1a987-99b7-41ec-93fb-ae2ada2bcf72' 
        }]);
      }
    }
    setStatus('עודכן!');
    setInput('');
    fetchInventory(); // מרענן את הרשימה במסך
  } catch (error) { 
    setStatus('שגיאה'); 
  }
};