import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const prompt = `You are a smart home grocery and inventory AI. Analyze this Hebrew text: "${text}"

    CRITICAL RULES:
    1. EXTRACT ITEMS: Identify the items and their quantities. If removal ("תוריד", "נגמר"), use negative numbers.
    2. CATEGORY EXTRACTION: If the user says "X in Y" (e.g., "ביצים בקירור"), X is the item ("ביצים"), Y is the exact category ("קירור").
    3. NEW CATEGORIES: If the user EXPLICITLY asks to add a new category (e.g., "תוסיף קטגוריה קירור"), put the word "קירור" in the "new_categories" array.
    4. UNCERTAINTY: NEVER return "UNCERTAIN" or "uncertain" as a category string. If you cannot confidently guess the category, set "needs_classification" to true and "category" to null.
    5. GUESSING: Try to guess standard Israeli grocery categories (e.g., "מוצרי חלב", "ירקות", "פירות", "בשר", "ניקיון", "שימורים").

    Return JSON EXACTLY like this:
    {
      "items": [
        { "name": "string", "quantity": number, "category": "string | null", "location": "מקרר | מזווה", "needs_classification": boolean }
      ],
      "new_categories": ["string"]
    }`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: "Return ONLY JSON." }, { role: 'user', content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    return NextResponse.json(JSON.parse(response.choices[0].message.content || '{"items":[], "new_categories":[]}'));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}