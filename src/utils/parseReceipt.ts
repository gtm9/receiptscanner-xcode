import { ReceiptItem, ParsedReceipt } from '../types';
import { parseReceiptWithAI } from './aiParser';

// --- Regex Constants (Modular & Maintainable) ---

const DATE_REGEX = /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]20\d{2})|(\d{1,2}[\/\-.]\d{1,2}[\/\-.]2\d)/; // Strict Year: 20xx or 2x (e.g. 26). Avoids 678-546.
const PRICE_REGEX = /^\$?(\d+\.\d{2})\s*([A-Z]{1,2}|[*TQF])?$/; // Matches "12.34", "$12.34", "12.34 T"
const ITEM_PRICE_AT_END_REGEX = /^(.+?)\s+\$?(\d+\.\d{2})\s*([A-Z]{1,2}|[*TQF])?$/; // Name ... Price
const ITEM_QTY_PREFIX_REGEX = /^(\d+)\s*[@x]\s*\$?(\d+\.\d{2})\s+(.+)$/i; // 2 @ 1.99 Item
// Removed ^ anchor to match "**** Total Sale"
const TOTAL_KEYWORDS_REGEX = /(TOTAL|BALANCE|AMOUNT\s*DUE|GRAND\s*TOTAL|PAYMENT|PAID)/i;
const TAX_KEYWORDS_REGEX = /^(TAX|SALES\s*TAX|HST|GST|VAT)/i;
// Added "you saved", "prices" to filtering
const IGNORE_LINE_REGEX = /^(welcome|visit|store|receipt|change|savings|auth|ref|merchant|terminal|trace|appr|aid|tvr|tsi|arc|iad|visa|mastercard|amex|discover|debit|credit|chip|swipe|insert|tap|usd\$?|amount|customer|card|fuel|points|entry|id|fresh|for|with\s*our|prices|you\s*saved|lb|kg)/i;

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

    // 2. Fallback to Regex (Sync logic)
    console.log('Fallback to Regex Parser');
    return parseReceiptWithRegex(text);
}

/**
 * Parse parsed receipt text into structured data (Regex Implementation)
 * @param text - Raw text from OCR
 * @returns Parsed receipt with items, totals, and confidence score
 */
export function parseReceiptWithRegex(text: string): ParsedReceipt {
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
            if (val !== null) {
                tax = val;
            } else {
                // Lookahead for Tax (handling noise like masked card numbers between Label and Value)
                // "TAX"
                // "**** 1234"
                // "0.04"
                for (let j = 1; j <= 2; j++) {
                    if (i + j < lines.length) {
                        const nextLine = lines[i + j];
                        // If line is just a number/price, likely the tax amount
                        const nextVal = extractPriceFromLine(nextLine);
                        if (nextVal !== null) {
                            tax = nextVal;
                            // Don't advance 'i' yet.
                            break;
                        }
                    }
                }
            }
            continue;
        }

        // 3. Extract Items
        // Strategy: Only consider lines that look like items if we haven't hit the "Total" section heavily yet
        let item = extractItem(line);

        // NEW: Check for latent price even if item name was rejected (e.g. "PC 1.89 B" -> price 1.89)
        let fallbackPrice: number | null = null;

        // Check extractItem match (which might have been rejected due to Name=Noise)
        const matchItem = line.match(ITEM_PRICE_AT_END_REGEX);
        if (!item && matchItem) {
            fallbackPrice = parseFloat(matchItem[2]);
        }

        // Also check strict price regex (for "1.89")
        const strictPriceMatch = line.match(/^\$?(\d+\.\d{2})\s*([A-Z]{1,2}|[*TQF])?$/);
        if (strictPriceMatch) {
            fallbackPrice = parseFloat(strictPriceMatch[1]);
        }

        if (item) {
            // Heuristic refinement: 
            // If the captured name is very short (e.g. "PC", "TAX", "F"), it might be a code, 
            // and the real name is on the previous line.
            if (item.name.length <= 4 && i > 0) {
                const prevLine = lines[i - 1];
                // Ensure previous line isn't a date, special keyword, or already processed item (implied by price check)
                if (!shouldSkipLine(prevLine) && !isNoise(prevLine) && extractPriceFromLine(prevLine) === null) {
                    // Use previous line as the name
                    item.name = cleanName(prevLine);
                }
            }
            items.push(item);
        } else if (fallbackPrice !== null && i > 0) {

            // Heuristic: If previous line was explicitly a SAVINGS line, this number is likely the discount amount.
            // e.g. "SC KROGER SAVINGS" \n "1.90"
            const prevLineImmediate = lines[i - 1];
            if (shouldSkipLine(prevLineImmediate) && prevLineImmediate.toUpperCase().includes('SAVINGS')) {
                continue;
            }

            // Multi-line Item Fallback with Lookback
            let foundName: string | null = null;

            // Look back up to 3 lines for a valid name
            for (let k = 1; k <= 3; k++) {
                if (i - k < 0) break;
                const candidate = lines[i - k];

                // Check if candidate is noise
                if (shouldSkipLine(candidate) || isNoise(candidate)) continue;

                // Check if candidate is conflicting type (Tax/Total)
                if (TOTAL_KEYWORDS_REGEX.test(candidate) || TAX_KEYWORDS_REGEX.test(candidate)) break;

                // CRITICAL: If candidate line ITSELF has a price, stop looking back. 
                // We don't want to skip over a valid item to steal its name.
                // Exception: Unless it was the savings discount we just skipped? No, assume strict.
                if (extractPriceFromLine(candidate) !== null) break;

                // Candidate is potentially valid
                foundName = cleanName(candidate);

                // Don't reuse the exact same name as the immediately previous item (prevent double matching)
                if (items.length > 0 && items[items.length - 1].name === foundName) {
                    foundName = null;
                    continue;
                }

                break;
            }

            if (foundName) {
                const isHash = /^[A-Z0-9]{8,}$/.test(foundName) && /\d/.test(foundName) && /[A-Z]/.test(foundName) && !foundName.includes(' ');
                const isNumericName = /^\d+$/.test(foundName);
                const isTC = foundName.startsWith('TC');

                if (!isHash && !isNumericName && !isTC) {
                    items.push({
                        name: foundName,
                        price: fallbackPrice,
                        quantity: 1,
                    });
                }
            }
        }
    }

    // Default total to sum of items if missing (fallback)
    if (total === null && items.length > 0) {
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
            return normalizeDate(match[0]);
        }
    }
    return undefined;
}

function normalizeDate(rawDate: string): string {
    try {
        // Handle separators: / . -
        const parts = rawDate.split(/[\/\-\.]/);

        if (parts.length === 3) {
            let month = parseInt(parts[0], 10);
            let day = parseInt(parts[1], 10);
            let year = parseInt(parts[2], 10);

            // Basic Validation
            if (isNaN(month) || isNaN(day) || isNaN(year)) return rawDate;

            // Handle 2-digit year (assume 20xx for receipts)
            if (year < 100) {
                year += 2000;
            }

            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        return rawDate;
    } catch (e) {
        return rawDate;
    }
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
    if (text === 'PC') return true; // Explicitly ignore "PC" as a name (common noise/code)
    if (/^\d+$/.test(text)) return true; // Only numbers
    if (shouldSkipLine(text)) return true;
    return false;
}
