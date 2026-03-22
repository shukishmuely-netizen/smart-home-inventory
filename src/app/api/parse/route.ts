import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { text }: { text: string } = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are a smart home inventory assistant. 
    Convert Hebrew text into a JSON object.
    
    SPECIAL DICTIONARY:
    - "מלפפוץ" or "מלפפוצים" = "מלפפון חמוץ"
    
    RULES:
    1. Return ONLY JSON.
    2. Normalize names to singular (e.g., "מלפפונים" -> "מלפפון").
    3. If the same item is mentioned multiple times with different quantities, SUM them into one total.
    4. Fix typos based on context.
    
    Format: {"action": "add"|"remove", "items": [{"name": string, "quantity": number}]}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt + `\nInput: "${text}"` }],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const content = response.choices[0].message.content || '{}';
    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}