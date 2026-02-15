/**
 * Receipt Parsing Accuracy Test
 * 
 * This file contains ground truth data for 4 receipt images and
 * a test function to measure OCR + AI parsing accuracy.
 * 
 * Ground truth was manually extracted from visual inspection of the images.
 */

import { ParsedReceipt, ReceiptItem } from '../../types';

// ============================================================================
// GROUND TRUTH DATA (Manually extracted from images)
// ============================================================================

export interface GroundTruth {
    imagePath: string;
    description: string;
    expected: {
        storeName: string;
        date: string; // YYYY-MM-DD
        totalAmount: number;
        tax: number | null;
        items: Array<{ name: string; price: number; quantity: number }>;
        itemCount: number;
    };
}

/**
 * Receipt 1: Kroger - Complex receipt with multiple items
 * Image: uploaded_media_0_1769477758398.jpg
 */
export const RECEIPT_1_KROGER_COMPLEX: GroundTruth = {
    imagePath: 'uploaded_media_0_1769477758398.jpg',
    description: 'Kroger receipt with multiple grocery items',
    expected: {
        storeName: 'Kroger',
        date: '2026-01-19', // 01/19/26
        totalAmount: 64.43,
        tax: 1.26,
        itemCount: 12,
        items: [
            { name: 'SOUR CREAM', price: 4.00, quantity: 1 },
            { name: 'SOUR CREAM', price: 4.00, quantity: 1 },
            { name: 'CROBAR YOGURT', price: 7.29, quantity: 1 },
            { name: 'PRVS GRAND PARM', price: 9.49, quantity: 1 },
            { name: 'PRAYING SWALLUS', price: 0.96, quantity: 1 },
            { name: 'LILLYS CHC BAR', price: 4.99, quantity: 1 },
            { name: 'LILLYS CHC BAR', price: 4.99, quantity: 1 },
            { name: 'NSTL OUTSHINE BARSPC', price: 4.49, quantity: 1 },
            { name: 'NSTL OUTSHINE BARS', price: 6.99, quantity: 1 },
            { name: 'KELLIES LRG EGGS', price: 7.49, quantity: 1 },
            { name: 'KRO GRND TRKY', price: 5.49, quantity: 1 },
            { name: 'KRO GRND TRKY', price: 5.49, quantity: 1 },
        ]
    }
};

/**
 * Receipt 2: H-E-B - Clear receipt with 5 items
 * Image: uploaded_media_1_1769477758398.jpg
 */
export const RECEIPT_2_HEB_GROCERY: GroundTruth = {
    imagePath: 'uploaded_media_1_1769477758398.jpg',
    description: 'H-E-B receipt with groceries (garlic, onion, ribs, tomatoes, bananas)',
    expected: {
        storeName: 'H-E-B',
        date: '2026-01-25', // 01-25-26
        totalAmount: 25.94,
        tax: null, // Food items, no tax shown separately
        itemCount: 5,
        items: [
            { name: 'MI TIENDA MEXICAN GARLIC', price: 2.38, quantity: 1 },
            { name: 'JUMBO YELLOW ONION', price: 6.48, quantity: 1 }, // 5.79 lbs @ 1.12/lb
            { name: 'PK NAT BI BACK RIB COV', price: 14.66, quantity: 1 },
            { name: 'ROMA TOMATOES', price: 1.98, quantity: 1 }, // 2.41 lbs @ 0.82/lb
            { name: 'PREMIUM BANANAS', price: 0.44, quantity: 1 }, // 0.87 lbs @ 0.50/lb
        ]
    }
};

/**
 * Receipt 3: Kroger - Simple single item receipt
 * Image: uploaded_media_2_1769477758398.jpg
 */
export const RECEIPT_3_KROGER_SIMPLE: GroundTruth = {
    imagePath: 'uploaded_media_2_1769477758398.jpg',
    description: 'Kroger receipt with single juice item',
    expected: {
        storeName: 'Kroger',
        date: '2026-01-19', // 01/19/26
        totalAmount: 1.93,
        tax: 0.04,
        itemCount: 1,
        items: [
            { name: 'BLM JUICE', price: 1.89, quantity: 1 },
        ]
    }
};

/**
 * Receipt 4: H-E-B - Single protein item
 * Image: uploaded_media_3_1769477758398.jpg
 */
export const RECEIPT_4_HEB_PROTEIN: GroundTruth = {
    imagePath: 'uploaded_media_3_1769477758398.jpg',
    description: 'H-E-B receipt with single protein cookies item',
    expected: {
        storeName: 'H-E-B',
        date: '2026-01-15', // 01-15-26
        totalAmount: 36.97,
        tax: null,
        itemCount: 1,
        items: [
            { name: 'DYMATIZE PROT COOKIES CRM', price: 36.97, quantity: 1 },
        ]
    }
};

// All ground truth data
export const ALL_GROUND_TRUTH: GroundTruth[] = [
    RECEIPT_1_KROGER_COMPLEX,
    RECEIPT_2_HEB_GROCERY,
    RECEIPT_3_KROGER_SIMPLE,
    RECEIPT_4_HEB_PROTEIN,
];

// ============================================================================
// ACCURACY CALCULATION UTILITIES
// ============================================================================

export interface AccuracyResult {
    receiptDescription: string;
    storeNameMatch: boolean;
    dateMatch: boolean;
    totalMatch: boolean;
    taxMatch: boolean;
    itemCountMatch: boolean;
    itemsAccuracy: number; // 0-100%
    overallScore: number; // 0-100%
    details: {
        expectedStoreName: string;
        parsedStoreName: string | undefined;
        expectedDate: string;
        parsedDate: string | undefined;
        expectedTotal: number;
        parsedTotal: number | undefined;
        expectedTax: number | null;
        parsedTax: number | undefined;
        expectedItemCount: number;
        parsedItemCount: number;
        itemsMatched: number;
        itemsMissed: string[];
        itemsExtra: string[];
    };
}

/**
 * Compare parsed receipt with ground truth
 */
export function calculateAccuracy(
    parsed: ParsedReceipt | null,
    groundTruth: GroundTruth
): AccuracyResult {
    const expected = groundTruth.expected;

    if (!parsed) {
        return {
            receiptDescription: groundTruth.description,
            storeNameMatch: false,
            dateMatch: false,
            totalMatch: false,
            taxMatch: false,
            itemCountMatch: false,
            itemsAccuracy: 0,
            overallScore: 0,
            details: {
                expectedStoreName: expected.storeName,
                parsedStoreName: undefined,
                expectedDate: expected.date,
                parsedDate: undefined,
                expectedTotal: expected.totalAmount,
                parsedTotal: undefined,
                expectedTax: expected.tax,
                parsedTax: undefined,
                expectedItemCount: expected.itemCount,
                parsedItemCount: 0,
                itemsMatched: 0,
                itemsMissed: expected.items.map(i => i.name),
                itemsExtra: [],
            }
        };
    }

    // Store name match (case-insensitive, partial match)
    const storeNameMatch = parsed.storeName
        ? expected.storeName.toLowerCase().includes(parsed.storeName.toLowerCase()) ||
        parsed.storeName.toLowerCase().includes(expected.storeName.toLowerCase())
        : false;

    // Date match (exact or close)
    const dateMatch = parsed.date === expected.date;

    // Total match (within $0.50 tolerance for rounding)
    const totalMatch = parsed.total !== undefined
        ? Math.abs(parsed.total - expected.totalAmount) < 0.50
        : false;

    // Tax match (within $0.10 tolerance or both null)
    const taxMatch = expected.tax === null
        ? parsed.tax === undefined || parsed.tax === null
        : parsed.tax !== undefined && Math.abs(parsed.tax - expected.tax) < 0.10;

    // Item count match (exact or within 1)
    const parsedItemCount = parsed.items?.length || 0;
    const itemCountMatch = Math.abs(parsedItemCount - expected.itemCount) <= 1;

    // Items accuracy - try to match by price (most reliable)
    const { matched, missed, extra } = matchItems(expected.items, parsed.items || []);
    const itemsAccuracy = expected.items.length > 0
        ? (matched / expected.items.length) * 100
        : 100;

    // Overall score (weighted)
    const weights = {
        storeName: 15,
        date: 15,
        total: 25,
        tax: 10,
        itemCount: 10,
        items: 25,
    };

    const overallScore =
        (storeNameMatch ? weights.storeName : 0) +
        (dateMatch ? weights.date : 0) +
        (totalMatch ? weights.total : 0) +
        (taxMatch ? weights.tax : 0) +
        (itemCountMatch ? weights.itemCount : 0) +
        (itemsAccuracy / 100) * weights.items;

    return {
        receiptDescription: groundTruth.description,
        storeNameMatch,
        dateMatch,
        totalMatch,
        taxMatch,
        itemCountMatch,
        itemsAccuracy,
        overallScore,
        details: {
            expectedStoreName: expected.storeName,
            parsedStoreName: parsed.storeName,
            expectedDate: expected.date,
            parsedDate: parsed.date,
            expectedTotal: expected.totalAmount,
            parsedTotal: parsed.total,
            expectedTax: expected.tax,
            parsedTax: parsed.tax,
            expectedItemCount: expected.itemCount,
            parsedItemCount,
            itemsMatched: matched,
            itemsMissed: missed,
            itemsExtra: extra,
        }
    };
}

/**
 * Match items by price (most reliable for OCR)
 */
function matchItems(
    expected: Array<{ name: string; price: number }>,
    parsed: ReceiptItem[]
): { matched: number; missed: string[]; extra: string[] } {
    const expectedPrices = expected.map(i => ({ name: i.name, price: i.price, matched: false }));
    const parsedItems = parsed.map(i => ({ name: i.name, price: i.price, matched: false }));

    let matched = 0;

    // Match by price first (within $0.10 tolerance)
    for (const exp of expectedPrices) {
        for (const par of parsedItems) {
            if (!par.matched && Math.abs(exp.price - par.price) < 0.10) {
                exp.matched = true;
                par.matched = true;
                matched++;
                break;
            }
        }
    }

    const missed = expectedPrices.filter(i => !i.matched).map(i => `${i.name} ($${i.price})`);
    const extra = parsedItems.filter(i => !i.matched).map(i => `${i.name} ($${i.price})`);

    return { matched, missed, extra };
}

/**
 * Format accuracy results as a readable report
 */
export function formatAccuracyReport(results: AccuracyResult[]): string {
    let report = '# Receipt Parsing Accuracy Report\n\n';

    const avgScore = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
    report += `## Summary\n`;
    report += `- **Receipts Tested:** ${results.length}\n`;
    report += `- **Average Accuracy Score:** ${avgScore.toFixed(1)}%\n\n`;

    report += '## Individual Results\n\n';

    for (const r of results) {
        report += `### ${r.receiptDescription}\n`;
        report += `**Overall Score: ${r.overallScore.toFixed(1)}%**\n\n`;

        report += '| Field | Expected | Parsed | Match |\n';
        report += '|-------|----------|--------|-------|\n';
        report += `| Store | ${r.details.expectedStoreName} | ${r.details.parsedStoreName || 'N/A'} | ${r.storeNameMatch ? '✅' : '❌'} |\n`;
        report += `| Date | ${r.details.expectedDate} | ${r.details.parsedDate || 'N/A'} | ${r.dateMatch ? '✅' : '❌'} |\n`;
        report += `| Total | $${r.details.expectedTotal.toFixed(2)} | $${r.details.parsedTotal?.toFixed(2) || 'N/A'} | ${r.totalMatch ? '✅' : '❌'} |\n`;
        report += `| Tax | ${r.details.expectedTax !== null ? '$' + r.details.expectedTax.toFixed(2) : 'N/A'} | ${r.details.parsedTax !== undefined ? '$' + r.details.parsedTax.toFixed(2) : 'N/A'} | ${r.taxMatch ? '✅' : '❌'} |\n`;
        report += `| Items | ${r.details.expectedItemCount} | ${r.details.parsedItemCount} | ${r.itemCountMatch ? '✅' : '❌'} |\n\n`;

        report += `**Items Accuracy:** ${r.itemsAccuracy.toFixed(1)}%\n`;
        if (r.details.itemsMissed.length > 0) {
            report += `- Missed: ${r.details.itemsMissed.join(', ')}\n`;
        }
        if (r.details.itemsExtra.length > 0) {
            report += `- Extra: ${r.details.itemsExtra.join(', ')}\n`;
        }
        report += '\n---\n\n';
    }

    return report;
}
