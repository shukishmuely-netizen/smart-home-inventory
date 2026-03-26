import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const prompt = `You are a kitchen inventory manager. Parse this list: "${text}"
    
    QUANTITY RULES:
    - "חצי" = 0.5, "רבע" = 0.25
    - "מלא" = 10, "קצת" = 1, "0" = 0
    - If multiple types/sizes mentioned, SUM them.
    - If no quantity, assume 1.

    CATEGORIES: ["פירות וירקות", "קירור", "קפואים", "טרי", "יבשים", "שימורים", "רטבים/תבלינים", "ניקיון"]
    LOCATIONS: ["מקרר", "מזווה"]

    AMBIGUITY: If an item can be in multiple states (e.g. Corn, Peas, Chicken, Meat, Beans) and the state is NOT specified, mark "uncertain": true.
    CRITICAL: If "uncertain" is true, YOU MUST ALWAYS provide these exact options in the options array: ["טרי", "קפואים", "שימורים", "יבשים"].

    Format: {
      "items": [{
        "name": string, 
        "quantity": number, 
        "category": string, 
        "location": string, 
        "uncertain": boolean,
        "options": string[]
      }]
    }`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: "Return ONLY JSON." }, { role: 'user', content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    return NextResponse.json(JSON.parse(response.choices[0].message.content || '{"items":[]}'));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}