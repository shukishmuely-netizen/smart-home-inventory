import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { text, categories } = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const existingCats = categories && categories.length > 0 ? categories.join(", ") : "אין קטגוריות עדיין";

    const prompt = `You are a STRICT home inventory AI. Analyze this Hebrew text: "${text}"

    EXISTING CATEGORIES: [${existingCats}]

    CRITICAL RULES:
    1. CATEGORY ASSIGNMENT: Assign items ONLY to the EXACT EXISTING CATEGORIES. Do NOT invent categories.
    2. FORCE CLASSIFICATION: If adding an item and you are unsure of the category, set "needs_classification": true and "category": null.
    3. EXPLICIT NEW CATEGORY: ONLY if the user says "תוסיף קטגוריה X" or "X בקירור" (explicitly naming a new category), add it to "new_categories".
    4. QUANTITIES & REMOVAL: 
       - If adding, use positive numbers.
       - If removing/using ("תוריד", "לקחתי"), use negative numbers (e.g., -1).
       - IF THE USER SAYS TO REMOVE "ALL" ("את כל ה", "נגמר", "לרוקן", "לאפס"), set "removeAll": true. Otherwise "removeAll": false.

    Output JSON ONLY:
    {
      "items": [
        { "name": "string", "quantity": number, "removeAll": boolean, "category": "string | null", "location": "מקרר | מזווה", "needs_classification": boolean }
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