import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    // Explicit prompt to improve intent classification and handle summing of identical items.
    const prompt = `You are a kitchen inventory parsing expert. Analyze this list: "${text}"

    CRITICAL INTENT RULES (FIXED):
    - Identify if the user's primary intent is adding items to inventory OR removing items from inventory.
    - If words imply addition (הוסף, קניתי, +, קנינו, הוספנו), intent is "add". Quantities are positive.
    - If words imply removal (תוריד, נגמר, -, הורדתי, סיימנו), intent is "remove".
    - IF INTENT IS "REMOVE", QUANTITIES MUST BE NEGATIVE by multiplying them by -1. For example, "Remove 1 corn" must be interpreted as adding -1 quantity of corn.

    SUMMING RULES:
    - If multiple entries for the exact same item name are mentioned, you MUST SUM their quantities. For example, if the input is "Remove 1 corn, and remove another 2 corn," the final corn quantity is -1 + -2 = -3. You must return ONE entry for "corn" with quantity -3.

    FORMAT RULES:
    - CATEGORIES: ["טרי", "קפואים", "שימורים", "יבשים", "רטבים/תבלינים", "ניקיון", "אחר"]
    - LOCATIONS: ["מקרר", "מזווה"]
    - If unclear state, set "uncertain": true and generate options: ["טרי", "קפואים", "שימורים", "יבשים"].
    - Sum quantities as described above. Item names are required.

    Format: { "items": [{ "name": string, "quantity": number, "category": string, "location": string, "uncertain": boolean, "options": string[] }] }`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: "Return ONLY JSON." }, { role: 'user', content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const parsedData = JSON.parse(response.choices[0].message.content || '{"items":[]}');
    
    // Debug logging in Vercel to see the actual AI output.
    console.log("AI Parsed Data for intent logic debug:", parsedData);

    return NextResponse.json(parsedData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}