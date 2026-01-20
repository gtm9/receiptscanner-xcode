/**
 * Receipt Parsing Utility
 * 
 * Parses raw OCR text from receipts into structured data.
 * Focused on US grocery receipt format.
 */

import { Receipt, ReceiptItem } from '../types';

interface ParsedReceipt {
    items: ReceiptItem[];
    subtotal?: number;
    tax?: number;
    total?: number;
    rawText: string;
}

/**
 * Parse receipt text into structured data
 * @param text - Raw text from OCR
 * @returns Parsed receipt with items and totals
 */
export function parseReceipt(text: string): ParsedReceipt {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

    const items: ReceiptItem[] = [];
    let subtotal: number | undefined;
    let tax: number | undefined;
    let total: number | undefined;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Try to parse as total line
        // Support specific single-line match or lookahead
        const totalMatch = parseTotalLine(line);
        if (totalMatch !== null) {
            total = totalMatch;
            continue;
        }

        // Lookahead for Split Total: "Total Sale***" \n "36.97"
        if (/^Total\s*Sale/i.test(line) || /^Total$/i.test(line)) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                if (/^\$?(\d+\.\d{2})$/.test(nextLine)) {
                    total = parseFloat(nextLine.replace('$', ''));
                    i++; // Skip next line
                    continue;
                }
            }
        }

        // Try to parse as subtotal line
        const subtotalMatch = parseSubtotalLine(line);
        if (subtotalMatch !== null) {
            subtotal = subtotalMatch;
            continue;
        }

        // Try to parse as tax line
        const taxMatch = parseTaxLine(line);
        if (taxMatch !== null) {
            tax = taxMatch;
            continue;
        }

        // Try to parse as item line
        const itemMatch = parseItemLine(line);
        if (itemMatch) {
            items.push({
                receiptId: 0, // Will be set when saving to DB
                name: itemMatch.name,
                price: itemMatch.price,
            });
        }
    }

    return {
        items,
        subtotal,
        tax,
        total,
        rawText: text,
    };
}

/**
 * Parse a line as an item with name and price
 * Common formats:
 * - "MILK 2% GAL    3.99"
 * - "BANANAS        $1.29"
 * - "BREAD WHOLE WHEAT 2.49 F"
 * - "3 @ 0.50  LEMONS  1.50"
 */
function parseItemLine(line: string): { name: string; price: number } | null {
    // Skip common non-item lines
    const skipPatterns = [
        /^(welcome|thank|visit|store|receipt|date|time|card|cash|change|balance|savings)/i,
        /^(subtotal|total|tax|discount|coupon)/i,
        /^\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/, // Date patterns
        /^\d{1,2}:\d{2}/, // Time patterns
        /^[\*\-=]+$/, // Decorative lines
        /^(visa|mastercard|amex|discover|debit|credit|us debit)/i,
        /^(auth|ref|merchant|terminal|trace|appr|aid|tvr|tsi|arc|iad)/i, // Payment terminal info
        /^(contactless|chip|swipe|insert|tap)/i,
        /^(usd\$?|amount)/i, // Currency lines often duplicated
        /^(\*)+/ // Lines starting with ***
    ];

    for (const pattern of skipPatterns) {
        if (pattern.test(line)) {
            return null;
        }
    }

    // HEB Special Case: "Total Sale*** 36.97"
    // Sometimes the OCR attaches the price to the total line and we handle that in parseTotalLine,
    // but we must ensure such lines are NOT treated as items.
    if (/total\s*sale/i.test(line)) return null;

    // Pattern 1: Item name followed by price at end
    // "ITEM NAME HERE    $12.34" or "ITEM NAME HERE    12.34"
    const priceAtEndMatch = line.match(/^(.+?)\s+\$?(\d+\.\d{2})\s*[A-Z]?$/);
    if (priceAtEndMatch) {
        const name = cleanItemName(priceAtEndMatch[1]);
        const price = parseFloat(priceAtEndMatch[2]);

        // Filter out "USD $36.97" types that might slip through
        if (name.startsWith('USD') || name === 'DEBIT') return null;

        if (name && !isNaN(price) && price > 0 && price < 1000) {
            return { name, price };
        }
    }

    // Pattern 2: Quantity @ unit price then item total
    // "3 @ 0.50  LEMONS  1.50"
    const quantityMatch = line.match(/^(\d+)\s*@\s*\$?(\d+\.\d{2})\s+(.+?)\s+\$?(\d+\.\d{2})$/);
    if (quantityMatch) {
        const name = cleanItemName(quantityMatch[3]);
        const price = parseFloat(quantityMatch[4]);
        if (name && !isNaN(price)) {
            return { name, price };
        }
    }

    // Pattern 3: Price at start (less common)
    // "$3.99  MILK 2%"
    const priceAtStartMatch = line.match(/^\$?(\d+\.\d{2})\s+(.+)$/);
    if (priceAtStartMatch) {
        const name = cleanItemName(priceAtStartMatch[2]);
        const price = parseFloat(priceAtStartMatch[1]);
        if (name && !isNaN(price) && price > 0 && price < 1000) {
            return { name, price };
        }
    }

    return null;
}

/**
 * Parse total line
 * "TOTAL    $45.67" or "TOTAL DUE: 45.67"
 * HEB: "Total Sale*** 36.97"
 */
function parseTotalLine(line: string): number | null {
    const patterns = [
        /^TOTAL\s*(?:DUE)?[:\s]*\$?(\d+\.\d{2})/i,
        /^GRAND\s*TOTAL[:\s]*\$?(\d+\.\d{2})/i,
        /^AMOUNT\s*DUE[:\s]*\$?(\d+\.\d{2})/i,
        /^Total\s*Sale[\*\s]*\$?(\d+\.\d{2})/i, // HEB Pattern
    ];

    for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
            return parseFloat(match[1]);
        }
    }

    return null;
}

/**
 * Parse subtotal line
 * "SUBTOTAL    $42.50"
 */
function parseSubtotalLine(line: string): number | null {
    const match = line.match(/^SUBTOTAL[:\s]*\$?(\d+\.\d{2})/i);
    return match ? parseFloat(match[1]) : null;
}

/**
 * Parse tax line
 * "TAX    $3.17" or "SALES TAX 7.25%    3.17"
 */
function parseTaxLine(line: string): number | null {
    const patterns = [
        /^(?:SALES\s*)?TAX[^$]*\$?(\d+\.\d{2})/i,
        /^HST[:\s]*\$?(\d+\.\d{2})/i,
        /^GST[:\s]*\$?(\d+\.\d{2})/i,
    ];

    for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
            return parseFloat(match[1]);
        }
    }

    return null;
}

/**
 * Clean up item name
 */
function cleanItemName(name: string): string {
    return name
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/[^\w\s\-\&\']/g, '')  // Remove special chars except common ones
        .trim()
        .toUpperCase();
}
