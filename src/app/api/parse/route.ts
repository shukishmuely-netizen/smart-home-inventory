import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { text }: { text: string } = await request.json();
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Convert this Hebrew text into a JSON object. 
    Input: "${text}"
    Rules:
    1. Return ONLY the JSON. No talking.
    2. Format: {"action": "add"|"remove", "items": [{"name": string, "quantity": number}]}
    3. Use Hebrew for item names.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    let rawContent = response.choices[0].message.content || '{}';
    
    // --- מנקה ה-JSON החזק ביותר בעולם ---
    // 1. מסיר סימני Markdown של קוד (```json או ```)
    let cleaned = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // 2. מחפש את הסוגריים המסולסלים הראשונים והאחרונים (זורק כל טקסט לפני או אחרי)
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    console.log("FINAL CLEANED JSON:", cleaned); // זה יופיע בלוגים של Vercel

    return NextResponse.json(JSON.parse(cleaned));

  } catch (error: any) {
    console.error("DETAILED ERROR:", error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}