import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const prompt = `You are a smart home kitchen inventory AI. Analyze the following user input in Hebrew: "${text}"

    RULES:
    1. INTENT: Is the user adding items, removing items, or explicitly creating new categories?
    2. QUANTITIES: If removing/using items (e.g., "תוריד", "נגמר"), make the quantity NEGATIVE (e.g. -1). If adding, positive. Sum duplicate items.
    3. CATEGORIES: Extract the EXACT category if the user specifies one (e.g., "תוסיף חומוס בשימורים" -> item: חומוס, category: שימורים).
    4. UNKNOWN CATEGORIES: If the user doesn't specify a category and you are completely unsure what standard category fits best, set "needs_classification": true. DO NOT use words like "uncertain". Try to guess standard categories first (e.g., חלב -> מוצרי חלב).
    5. NEW CATEGORIES: If the user explicitly asks to create a new category (e.g., "תוסיף קטגוריה קירור"), return it in the "new_categories" array.

    Return JSON format ONLY exactly like this:
    {
      "items": [
        { "name": "string", "quantity": 1, "category": "string | null", "location": "מקרר או מזווה", "needs_classification": boolean }
      ],
      "new_categories": ["string"]
    }`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: "Return ONLY JSON." }, { role: 'user', content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const parsedData = JSON.parse(response.choices[0].message.content || '{"items":[], "new_categories":[]}');
    return NextResponse.json(parsedData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}