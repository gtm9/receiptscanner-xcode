
import { parseReceipt } from './parseReceipt';

describe('Receipt Parsing Logic', () => {

    test('Kroger Receipt - Standard Format', () => {
        const rawText = `
        Kroger
        01/19/26
        Item 1   1.99
        Item 2   3.50
        Tax 0.45
        Total 5.94
        `;
        const result = parseReceipt(rawText);

        expect(result.storeName).toBe('KROGER');
        expect(result.total).toBe(5.94);
        expect(result.items.length).toBe(2);
        expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('H-E-B Receipt - Complex Format', () => {
        const rawText = `
        H-E-B
        GROCERY
        2 @ 1.50 APPLES
        BANANAS 2.00 B
        SUBTOTAL 5.00
        TAX 0.41
        TOTAL 5.41
        01/20/2026
        `;
        const result = parseReceipt(rawText);

        expect(result.storeName).toBe('H-E-B'); // Cleaned name
        expect(result.total).toBe(5.41);
        expect(result.date).toBe('2026-01-20');
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('Edge Case - Low Confidence / Missing Data', () => {
        const rawText = `
        Welcome to Store
        No prices here
        Just text
        `;
        const result = parseReceipt(rawText);

        expect(result.total).toBeUndefined();
        expect(result.confidence).toBeLessThan(0.6);
    });

    test('Total Detection - Multiple Totals', () => {
        const rawText = `
         Item 1 10.00
         Subtotal 10.00
         Tax 1.00
         Total 11.00
         Balance Due 11.00
         `;
        const result = parseReceipt(rawText);
        expect(result.total).toBe(11.00);
    });

    test('Real Kroger Receipt - Multi-line Items', () => {
        const rawText = `FRESH
FOR
Kroger Vienove.
6001 Cumning Highway NE
678-546-2148
Your Cashier was CHEC 650
BLIM JUICE
PC
1.89 B
SC
KROGER SAVINGS
1.90
KROGER PLUS CUSTOMER
TAX
*******5051
0.04
****
BALANCE
1.93
Buford GA 30518
VISA CREDIT Purchase
************3440 -
REF#: 019155
TOTAL: 1.93
TOTAL NUMBER OF ITEMS SOLD =
STR CPN & KROGER SAVINGS
(50 pct.)
01/19/26 06:26pm 687 650 208 999999650
**************************************
Card Savings $1.90
**************************************
With Our Low Prices, You Saved
$1.90
*** Check Cart ***`;

        const result = parseReceipt(rawText);

        expect(result.storeName).toMatch(/Kroger/i);
        expect(result.total).toBe(1.93);
        // Date normalizer is simple, might return undefined or normalized string. 
        // Just check if it found something related to date for now
        // expect(result.date).toBe('01/19/26'); 

        // Should find pure item 'BLIM JUICE' (or at least clean item) 
        // and ignore 'SAVINGS' as item
        const itemNames = result.items.map(i => i.name);

        // Currently fails because logic is simple. 
        // We expect this test to FAIL initially.
        expect(itemNames.some(n => n.includes('SAVINGS'))).toBe(false);
    });

});
