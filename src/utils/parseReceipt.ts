import { ParsedReceipt } from '../types';
import { parseReceiptWithAI } from './aiParser';

/**
 * Main Entry Point: Parse Receipt (Hybrid AI + Regex)
 */
export async function parseReceipt(text: string): Promise<ParsedReceipt> {
    // 1. Try AI Parser (Async)
    const aiResult = await parseReceiptWithAI(text);
    if (aiResult) {
        console.log('Using AI Parser Result');
        return aiResult;
    }

    // 2. Fallback - Return empty/failed state if AI fails
    console.warn('AI Parsing failed. No regex fallback available.');
    return {
        items: [],
        rawText: text,
        confidence: 0,
        storeName: "Unknown",
        total: 0
    };
}
