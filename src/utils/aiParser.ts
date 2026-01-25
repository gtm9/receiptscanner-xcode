import { ParsedReceipt } from '../types';
import OpenAI from 'openai';
import { AppleFoundationModels } from '@react-native-ai/apple';

// Initialize OpenAI (Requires API Key in .env)
// Initialize OpenAI (Requires API Key in .env)
const openai = new OpenAI({
    apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
    dangerouslyAllowBrowser: true // Required for React Native
});

const SYSTEM_PROMPT = `
You are a smart receipt parser. Extract data from OCR text.
The text lines often follow this format: "ITEM NAME CODE PRICE FLAG".
Example: "SBUX CREAMER PC 4.00 B" -> {"name": "SBUX CREAMER", "price": 4.00, "quantity": 1}

Rules:
1. **Extract Every Item**: Look for lines with a price (number with decimal).
2. **Clean Names**: Remove codes like "PC", "SC", "WT", "QP" from the end of the name.
3. **Format**: Return ONLY valid JSON.
4. **Missing Data**: Use null if not found.

Schema:
{
  "storeName": string | null,
  "date": string | null (YYYY-MM-DD),
  "total": number | null,
  "tax": number | null,
  "items": [
    { "name": string, "price": number, "quantity": number }
  ]
}
`;

/**
 * Parse receipt text using AI (On-Device Apple Intelligence -> OpenAI Fallback)
 */
export async function parseReceiptWithAI(rawText: string): Promise<ParsedReceipt | null> {
    try {
        console.log('AI Parser: Starting...');

        // Preprocess text to remove extreme noise
        const cleanText = preprocessOCRText(rawText);
        console.log('AI Parser: Preprocessed Text Sample:', cleanText.substring(0, 100).replace(/\n/g, ' '));

        // 1. Try On-Device Apple Intelligence (if available)
        let isAppleAvailable = false;
        try {
            // isAvailable is a sync method in the Spec, but better wrap in try/catch just in case of native failure
            isAppleAvailable = AppleFoundationModels.isAvailable();
            console.log('AI Parser: AppleFoundationModels.isAvailable() returned:', isAppleAvailable);
        } catch (checkError) {
            console.error('AI Parser: AppleFoundationModels.isAvailable() threw error:', checkError);
            isAppleAvailable = false;
        }

        if (isAppleAvailable) {
            console.log('AI Parser: Using Apple On-Device Intelligence');
            try {
                // generateText expects messages array
                const response = await AppleFoundationModels.generateText([
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: cleanText } // Use cleaned text
                ], {
                    // Optional: temperature, etc.
                });

                // Response is an array of content/tool calls
                // We expect a single text response
                const firstResponse = response[0];
                if (firstResponse && firstResponse.type === 'text' && firstResponse.text) {
                    // It might output markdown code block like ```json ... ```, strip it
                    const cleanResponse = firstResponse.text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const data = JSON.parse(cleanResponse);
                    return mapAiResponseToParsedReceipt(data, rawText, 1.0); // High confidence for on-device
                }
            } catch (appleError) {
                console.warn('AI Parser: Apple On-Device Failed, falling back...', appleError);
            }
        } else {
            console.log('AI Parser: Apple Intelligence not available/supported on this device.');
        }

        // 2. Fallback to OpenAI Cloud
        if (process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
            console.log('AI Parser: Using OpenAI Cloud Fallback');
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini", // Fast & Cheap
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: cleanText }
                ],
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0].message.content;
            if (content) {
                const data = JSON.parse(content);
                return mapAiResponseToParsedReceipt(data, rawText, 0.95);
            }
        } else {
            console.warn('AI Parser: No OpenAI Key found. Skipping cloud fallback.');
        }

        return null; // Both failed

    } catch (error) {
        console.error('AI Parser Error:', error);
        return null;
    }
}

function mapAiResponseToParsedReceipt(data: any, rawText: string, confidence: number): ParsedReceipt {
    return {
        storeName: data.storeName || undefined,
        date: data.date || undefined,
        total: typeof data.total === 'number' ? data.total : undefined,
        tax: typeof data.tax === 'number' ? data.tax : undefined,
        items: Array.isArray(data.items) ? data.items.map((item: any) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1
        })) : [],
        rawText,
        confidence
    };
}

/**
 * Basic noise filter for OCR text
 */
function preprocessOCRText(text: string): string {
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => {
            // Keep empty lines as separators
            if (line.length === 0) return true;
            // Keep lines that look like prices
            if (/^\$?\d+\.\d{2}$/.test(line)) return true;
            // Keep lines that are long enough to be words
            if (line.length > 2) return true;
            // Drop short garbage
            return false;
        })
        .join('\n');
}
