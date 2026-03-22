import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { text }: { text: string } = await request.json();
    if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 });

    const prompt = `Parse this Hebrew text into JSON. Format: {"action": "add"|"remove", "items": [{"name": string, "quantity": number}]}. Text: "${text}"`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const content = response.choices[0].message.content || '{}';
    const cleanedJson = content.replace(/```json|```/g, '').trim();
    return NextResponse.json(JSON.parse(cleanedJson));
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}