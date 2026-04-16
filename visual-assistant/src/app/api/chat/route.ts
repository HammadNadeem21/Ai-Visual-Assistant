import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  try {
    const { imageBase64, prompt } = await req.json();

    if (!imageBase64 || !prompt) {
      return NextResponse.json({ error: 'Both imageBase64 and prompt are required' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return NextResponse.json({ error: 'API key is not configured on the server. Please add GEMINI_API_KEY to your .env.local' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    
    // Strip out the "data:image/jpeg;base64," prefix for the Google SDK
    const dataParts = imageBase64.split(',');
    const base64Data = dataParts.length === 2 ? dataParts[1] : imageBase64;

    // Retry loop to handle temporary 503 "high demand" errors from Google
    let lastError: any = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          config: {
            systemInstruction: "You are an intelligent, helpful AI visual assistant. You are looking directly at what is currently on the user's screen. Answer the user's prompt by analyzing the provided screenshot. Be direct, concise, and helpful. IMPORTANT: Always respond in plain text only. Do not use markdown, bullet points, bold, backticks, or any special formatting. Your responses will be spoken aloud, so write naturally as if you are speaking.",
          },
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                { 
                  inlineData: { 
                    data: base64Data, 
                    mimeType: "image/jpeg" 
                  } 
                }
              ]
            }
          ]
        });

        return NextResponse.json({ reply: response.text || "I'm sorry, I wasn't able to construct a response." });

      } catch (err: any) {
        lastError = err;
        const errorMsg = err.message || '';
        
        // Only retry on 503 (overloaded) or 429 (rate limit) errors
        if ((errorMsg.includes('503') || errorMsg.includes('429') || errorMsg.includes('UNAVAILABLE')) && attempt < MAX_RETRIES) {
          console.warn(`Attempt ${attempt} failed (server overloaded). Retrying in ${RETRY_DELAY_MS}ms...`);
          await sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
          continue;
        }
        throw err;
      }
    }

    throw lastError;

  } catch (error: any) {
    console.error("Error communicating with AI API:", error.message);
    
    const errorMsg = error.message || '';
    if (errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE')) {
      return NextResponse.json({ error: "The AI model is currently overloaded. Please wait a few seconds and try again." }, { status: 503 });
    }
    
    return NextResponse.json({ error: error.message || "Failed to contact the AI model." }, { status: 500 });
  }
}
