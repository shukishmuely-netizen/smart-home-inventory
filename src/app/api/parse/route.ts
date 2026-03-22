import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { text }: { text: string } = await request.json();
    
    // בדיקה אם המפתח בכלל קיים במערכת
    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OpenAI API Key in Environment Variables");
      return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Parse this Hebrew text into JSON. Format: {"action": "add"|"remove", "items": [{"name": string, "quantity": number}]}. Text: "${text}"`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const content = response.choices[0].message.content || '{}';
    const cleanedJson = content.replace(/```json|```/g, '').trim();
    return NextResponse.json(JSON.parse(cleanedJson));

  } catch (error: any) {
    // השורה הזו היא הקריטית - היא תדפיס לנו את השגיאה האמיתית בלוגים של Vercel
    console.error("OPENAI_ERROR_DETAILS:", error.message || error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}