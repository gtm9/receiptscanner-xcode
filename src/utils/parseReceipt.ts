/**
 * Receipt Parsing Utility
 * 
 * robust, generalized parser for US grocery receipts.
 * Implements heuristic-based extraction and confidence scoring.
 */

import { ReceiptItem, ParsedReceipt } from '../types';

// --- Regex Constants (Modular & Maintainable) ---

const DATE_REGEX = /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]20\d{2})|(\d{1,2}[\/\-.]\d{1,2}[\/\-.]2\d)/; // Strict Year: 20xx or 2x (e.g. 26). Avoids 678-546.
const PRICE_REGEX = /^\$?(\d+\.\d{2})\s*([A-Z]{1,2}|[*TQF])?$/; // Matches "12.34", "$12.34", "12.34 T"
const ITEM_PRICE_AT_END_REGEX = /^(.+?)\s+\$?(\d+\.\d{2})\s*([A-Z]{1,2}|[*TQF])?$/; // Name ... Price
const ITEM_QTY_PREFIX_REGEX = /^(\d+)\s*[@x]\s*\$?(\d+\.\d{2})\s+(.+)$/i; // 2 @ 1.99 Item
// Removed ^ anchor to match "**** Total Sale"
const TOTAL_KEYWORDS_REGEX = /(TOTAL|BALANCE|AMOUNT\s*DUE|GRAND\s*TOTAL|PAYMENT|PAID)/i;
const TAX_KEYWORDS_REGEX = /^(TAX|SALES\s*TAX|HST|GST|VAT)/i;
// Added "you saved", "prices" to filtering
const IGNORE_LINE_REGEX = /^(welcome|visit|store|receipt|change|savings|auth|ref|merchant|terminal|trace|appr|aid|tvr|tsi|arc|iad|visa|mastercard|amex|discover|debit|credit|chip|swipe|insert|tap|usd\$?|amount|customer|card|fuel|points|entry|id|fresh|for|with\s*our|prices|you\s*saved)/i;

/**
 * Parse parsed receipt text into structured data
 * @param text - Raw text from OCR
 * @returns Parsed receipt with items, totals, and confidence score
 */
export function parseReceipt(text: string): ParsedReceipt {
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const items: ReceiptItem[] = [];
    let total: number | null = null;
    let subtotal: number | null = null;
    let tax: number | null = null;
    let date: string | undefined;

    // Heuristic: Store Name is usually in the first few lines
    let storeName = extractStoreName(lines);

    // Heuristic: Date can be anywhere, but usually near header or footer
    date = extractDate(lines);

    // Process Lines
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip garbage/footer lines
        // Use helper to check for SAVINGS anywhere
        if (shouldSkipLine(line)) continue;

        // 1. Check for Total
        if (TOTAL_KEYWORDS_REGEX.test(line)) {
            const val = extractPriceFromLine(line);
            if (val !== null) {
                if (total === null || val > total) {
                    total = val;
                }
            } else if (i + 1 < lines.length) {
                // Lookahead: "Total" \n "12.34"
                const nextLineVal = extractPriceFromLine(lines[i + 1]);
                if (nextLineVal !== null) {
                    total = nextLineVal;
                    i++;
                }
            }
            continue;
        }

        // 2. Check for Tax
        if (TAX_KEYWORDS_REGEX.test(line)) {
            const val = extractPriceFromLine(line);
            if (val !== null) tax = val;
            continue;
        }

        // 3. Extract Items
        // Strategy: Only consider lines that look like items if we haven't hit the "Total" section heavily yet
        const item = extractItem(line);
        if (item) {
            items.push(item);
        } else {
            // Multi-line Item Fallback:
            // If this line is just a price "1.89 B", check if previous line was a potential name
            // AND ensure the previous line wasn't processed as something else.
            const priceMatch = line.match(/^\$?(\d+\.\d{2})\s*([A-Z]{1,2}|[*TQF])?$/);
            if (priceMatch && i > 0) {
                const prevLine = lines[i - 1];
                // Ensure previous line isn't noise, header, or already caught
                if (!shouldSkipLine(prevLine) && !TOTAL_KEYWORDS_REGEX.test(prevLine) && !TAX_KEYWORDS_REGEX.test(prevLine)) {
                    // Check if previous line was already added as an item? 
                    // Simple heuristic: If items array is not empty and last item name == cleanName(prevLine), skip? 
                    // For now, assume previous line was skipped by extractItem because it had no price.

                    items.push({
                        name: cleanName(prevLine),
                        price: parseFloat(priceMatch[1]),
                        quantity: 1,
                    });
                }
            }
        }
    }

    // Default total to sum of items if missing (fallback)
    if (total === null && items.length > 0) {
        // This is a weak fallback, but better than nothing
        // total = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    }

    // Calculate Confidence Score
    const confidence = calculateConfidence({ total, date, storeName, items });

    return {
        items,
        storeName: storeName || undefined,
        date,
        subtotal: subtotal || undefined,
        tax: tax || undefined,
        total: total || undefined,
        rawText: text,
        confidence,
    };
}

/**
 * Calculate a 0-1 confidence score
 */
function calculateConfidence(data: { total: number | null; date?: string; storeName?: string; items: any[] }): number {
    let score = 0;
    if (data.total !== null) score += 0.4;
    if (data.date) score += 0.3;
    if (data.storeName) score += 0.2;
    if (data.items.length > 0) score += 0.1;
    return parseFloat(score.toFixed(2));
}

/**
 * Extract Store Name (First valid non-numeric line)
 */
function extractStoreName(lines: string[]): string | undefined {
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const line = lines[i];
        // Skip dates, phone numbers, common header junk
        if (line.length < 3) continue;
        if (/^\d/.test(line)) continue;
        if (shouldSkipLine(line)) continue;

        return cleanName(line);
    }
    return undefined;
}

/**
 * Extract Date
 */
function extractDate(lines: string[]): string | undefined {
    for (const line of lines) {
        const match = line.match(DATE_REGEX);
        if (match) {
            return match[0]; // Return the full matched date string
        }
    }
    return undefined;
}

/**
 * Extract Price from a line (returns first valid float found at end or start)
 */
function extractPriceFromLine(line: string): number | null {
    // Try end first
    const matchEnd = line.match(/(\d+\.\d{2})\s*$/);
    if (matchEnd) return parseFloat(matchEnd[1]);

    // Try start (less common for labeled lines like "Total: 12.34")
    const matchStart = line.match(/^\$?(\d+\.\d{2})/);
    if (matchStart) return parseFloat(matchStart[1]);

    return null;
}

/**
 * Extract Item from Line
 */
function extractItem(line: string): ReceiptItem | null {
    // 1. Classic: "Item Name   1.99"
    const matchEnd = line.match(ITEM_PRICE_AT_END_REGEX);
    if (matchEnd) {
        const name = cleanName(matchEnd[1]);
        if (isNoise(name)) return null;

        return {
            name,
            price: parseFloat(matchEnd[2]),
            quantity: 1,
        };
    }

    // 2. Qty Prefix: "2 @ 1.99 Item Name"
    // Note: The structure might be different, let's look for "2 @ 1.99"
    const matchQty = line.match(ITEM_QTY_PREFIX_REGEX);
    if (matchQty) {
        // This regex matched "2 @ 1.99 ItemName" -> Groups: Qty, UnitPrice, Name
        // Total price isn't explicitly captured by this simple regex, usually it's at the end.
        // Let's assume the Line *ends* with the total, or calculate it.
        // Simple version:
        return {
            name: cleanName(matchQty[3]),
            price: parseFloat(matchQty[2]), // Unit price
            quantity: parseInt(matchQty[1], 10),
        };
    }

    return null;
}

function cleanName(text: string): string {
    return text.replace(/[^\w\s\-\&\']/g, '').trim().toUpperCase();
}

function shouldSkipLine(text: string): boolean {
    if (IGNORE_LINE_REGEX.test(text)) return true;
    if (text.toUpperCase().includes('SAVINGS')) return true; // Aggressive skip for 'SAVINGS' anywhere
    return false;
}

function isNoise(text: string): boolean {
    if (text.length < 2) return true;
    if (/^\d+$/.test(text)) return true; // Only numbers
    if (shouldSkipLine(text)) return true;
    return false;
}
