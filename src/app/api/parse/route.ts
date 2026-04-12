import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { text, categories, context } = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const existingCats = categories && categories.length > 0 ? categories.join(", ") : "אין קטגוריות עדיין";
    const isEquipment = context === 'equipment';

    const prompt = isEquipment
    ? `You are a packing/equipment list AI. Analyze this Hebrew text: "${text}"

    EXISTING CATEGORIES: [${existingCats}]

    CRITICAL RULES:
    1. CATEGORY ASSIGNMENT: Assign items ONLY to the EXACT EXISTING CATEGORIES. Do NOT invent categories.
    2. If you are unsure of the category, set "category": "ציוד נוסף".
    3. QUANTITIES: If adding, use positive numbers (default 1). If removing ("תוריד", "תמחק", "הורד"), use negative numbers.
    4. If the user explicitly names a new category ("תוסיף קטגוריה X"), add it to "new_categories".
    5. ITEM NAME MUST BE CLEAN: Return ONLY the product name itself. Strip prefixes like "את כל ה", "את ה", "כל ה".

    Output JSON ONLY:
    {
      "items": [
        { "name": "string", "quantity": number, "removeAll": false, "category": "string", "location": "מזווה", "needs_classification": false }
      ],
      "new_categories": ["string"]
    }`
    : `You are a STRICT home inventory AI. Analyze this Hebrew text: "${text}"

    EXISTING CATEGORIES: [${existingCats}]

    CRITICAL RULES:
    1. CATEGORY ASSIGNMENT: Assign items ONLY to the EXACT EXISTING CATEGORIES. Do NOT invent categories.
    2. FORCE CLASSIFICATION: If adding an item and you are unsure of the category, set "needs_classification": true and "category": null.
    3. EXPLICIT NEW CATEGORY: ONLY if the user says "תוסיף קטגוריה X" or "X בקירור" (explicitly naming a new category), add it to "new_categories".
    4. QUANTITIES & REMOVAL:
       - If adding, use positive numbers.
       - If removing/using ("תוריד", "לקחתי"), use negative numbers (e.g., -1).
       - IF THE USER SAYS TO REMOVE "ALL" ("את כל ה", "נגמר", "לרוקן", "לאפס"), set "removeAll": true AND "quantity": 0. Otherwise "removeAll": false.
    5. ITEM NAME MUST BE CLEAN: Return ONLY the product name itself. Strip prefixes like "את כל ה", "את ה", "כל ה", "הרבה", etc.
       For example: "תוריד את כל המיונז" → name: "מיונז", removeAll: true. "נגמר לי הקפה" → name: "קפה", removeAll: true.
    6. MOVE OPERATIONS: If the user says to move items ("תזיז", "תעביר", "העבר", "תעביר מ... ל...") from one category to another, set "moveToCategory" to the EXACT name of the best-matching EXISTING CATEGORY. Use fuzzy matching: "ירקות" → "פירות וירקות", "חלב" → "חלבי". Set quantity: 0, needs_classification: false, removeAll: false for moves. CRITICAL: moveToCategory must be one of the EXISTING CATEGORIES, never null for move operations.
       For example: "תעביר את המלפפון והנענע מהטרי לפירות וירקות" → two items with moveToCategory: "פירות וירקות".
    7. SMART CATEGORIZATION: Fresh produce (fruits, vegetables, herbs like מלפפון, עגבניה, נענע, בצל, תפוח, בננה, לימון etc.) should go to "פירות וירקות" if that category exists, NOT to "טרי". "טרי" is for dairy/deli items.

    Output JSON ONLY:
    {
      "items": [
        { "name": "string", "quantity": number, "removeAll": boolean, "category": "string | null", "location": "מקרר | מזווה", "needs_classification": boolean, "moveToCategory": "string | null" }
      ],
      "new_categories": ["string"]
    }`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: "Return ONLY strict JSON." }, { role: 'user', content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    return NextResponse.json(JSON.parse(response.choices[0].message.content || '{"items":[], "new_categories":[]}'));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}