import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const prompt = `You are a kitchen manager AI. Analyze this Hebrew text: "${text}"

    CRITICAL RULES:
    1. CATEGORY EXTRACTION: If the user says "X in Y" (X ב-Y), X is the item and Y is the category (e.g., "ביצים בקירור" -> name: "ביצים", category: "קירור").
    2. NEW CATEGORIES: If the user says "add category X" (תוסיף קטגוריה בשם X), put X in the "new_categories" array.
    3. NO UNCERTAIN: Never return "uncertain" as a category string. If you don't know the category and the user didn't specify one, set "needs_classification": true and "category": null.
    4. QUANTITIES: Use negative numbers for removal ("תוריד", "נגמר").

    Output JSON ONLY:
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