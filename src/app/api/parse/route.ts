import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const prompt = `You are a professional kitchen manager. Parse the input: "${text}"
    
    AMBIGUITY RULES:
    - Chicken/Meat/Fish: If not specified as "frozen" (קפוא) or "fresh" (טרי), mark as uncertain.
    - Corn (תירס): If not specified as "frozen" (קפוא), "fresh" (טרי), or "canned" (שימורים), mark as uncertain.
    
    CATEGORIES: ["פירות וירקות", "קירור", "קפואים", "טרי", "יבשים", "שימורים", "רטבים/תבלינים", "ניקיון"]
    LOCATIONS: ["מקרר", "מזווה"]

    Format: {
      "action": "add"|"remove",
      "items": [{
        "name": string, 
        "quantity": number, 
        "category": string, 
        "location": string, 
        "uncertain": boolean,
        "options": string[] // If uncertain, provide the relevant category options here
      }]
    }`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    return NextResponse.json(JSON.parse(response.choices[0].message.content || '{}'));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}