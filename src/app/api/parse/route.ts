import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { text }: { text: string } = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const prompt = `Convert Hebrew text into a JSON object.
    Dictionary: "מלפפוץ" = "מלפפון חמוץ".
    Rules: Return ONLY JSON. Normalize names to singular. Sum quantities.
    Format: {"action": "add"|"remove", "items": [{"name": string, "quantity": number}]}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt + `\nInput: "${text}"` }],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const content = response.choices[0].message.content || '{}';
    return NextResponse.json(JSON.parse(content));
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}