import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { text, categories } = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    // מקבלים את רשימת הקטגוריות הקיימות מהאפליקציה
    const existingCats = categories && categories.length > 0 ? categories.join(", ") : "אין קטגוריות עדיין";

    const prompt = `You are a STRICT home inventory AI. Analyze this Hebrew text: "${text}"

    EXISTING CATEGORIES: [${existingCats}]

    CRITICAL RULES - DO NOT DISOBEY:
    1. CATEGORY ASSIGNMENT: You MUST ONLY assign items to one of the EXACT EXISTING CATEGORIES. 
    2. DO NOT INVENT: NEVER invent or hallucinate a category (e.g. do not invent "מוצרי חלב" if it's not in the list).
    3. FORCE CLASSIFICATION: If the item does not clearly belong to ANY of the existing categories, you MUST set "needs_classification": true and "category": null. Do NOT guess. Let the user decide.
    4. EXPLICIT NEW CATEGORY: ONLY if the user explicitly says words like "תוסיף קטגוריה X" or "X בקירור" (explicitly naming a new category), then you may put it in the "new_categories" array or assign it.
    5. QUANTITIES: Negative for removal ("תוריד", "נגמר").

    Output JSON ONLY:
    {
      "items": [
        { "name": "string", "quantity": number, "category": "string | null", "location": "מקרר | מזווה", "needs_classification": boolean }
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