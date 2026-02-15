import { ParsedReceipt } from '../types';

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const SITE_URL = 'https://receiptscanner.app'; // For OpenRouter rankings
const SITE_NAME = 'ReceiptScanner';

const SYSTEM_PROMPT = `
You are a receipt parser. Output **ONLY** valid JSON — no explanations, no markdown, no code blocks, no extra text before or after.

Schema:
{
  "storeName": string | null,
  "date": string | null (YYYY-MM-DD format),
  "tax": number | null,
  "totalAmount": number | null,
  "items": [
    { "name": string, "price": number, "quantity": number }
  ]
}

Rules:
- Correct common OCR errors (e.g., 'BLIH' -> 'BLIM', 'KRŪGER' -> 'KROGER').
- Date: Normalize MM/DD/YY to YYYY-MM-DD (assume 2026 if YY=26).
- Items: Extract product names + prices; quantity default 1; ignore savings/coupons/ads.
- Use null for missing fields.
- **Do NOT** add any text outside the JSON object.
`;

/**
 * Parse receipt text using OpenRouter LLM
 */
export async function parseReceiptWithAI(rawText: string): Promise<ParsedReceipt | null> {
    if (!OPENROUTER_API_KEY) {
        console.error('AI Parser: Missing OpenRouter API Key');
        return null;
    }

    try {
        console.warn('AI Parser: Calling OpenRouter (gpt-oss-120b:free)...');
        console.warn('AI Parser: OCR Input Sample:', rawText.substring(0, 500).replace(/\n/g, ' '));
        const startTime = Date.now();

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "HTTP-Referer": SITE_URL,
                "X-Title": SITE_NAME,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "openai/gpt-oss-120b:free",
                "messages": [
                    { "role": "system", "content": SYSTEM_PROMPT },
                    { "role": "user", "content": rawText }
                ],
                "reasoning": { "enabled": true }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`AI Parser: OpenRouter API Error (${response.status}):`, errorText);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        const elapsed = Date.now() - startTime;
        console.log(`AI Parser: Completed in ${elapsed}ms`);

        if (content) {
            return parseLLMResponse(content, rawText);
        }

        return null;

    } catch (error) {
        console.error('AI Parser: OpenRouter Request Failed:', error);
        return null;
    }
}

function parseLLMResponse(content: string, rawText: string): ParsedReceipt | null {
    try {
        // Clean markdown if present (though system prompt forbids it, LLMs can be stubborn)
        let cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();

        // Find JSON boundaries
        const start = cleanContent.indexOf('{');
        const end = cleanContent.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            cleanContent = cleanContent.substring(start, end + 1);
        }

        const data = JSON.parse(cleanContent);

        return {
            storeName: data.storeName || undefined,
            date: data.date || undefined,
            total: (typeof data.totalAmount === 'number' ? data.totalAmount : data.total) || undefined,
            tax: typeof data.tax === 'number' ? data.tax : undefined,
            items: Array.isArray(data.items) ? data.items.map((item: any) => ({
                name: item.name,
                price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
                quantity: typeof item.quantity === 'number' ? item.quantity : 1
            })) : [],
            rawText,
            confidence: 0.9 // Optimistic confidence for LLM
        };
    } catch (e) {
        console.error('AI Parser: Failed to parse LLM JSON response:', e);
        console.log('AI Parser: Raw content was:', content);
        return null;
    }
}
