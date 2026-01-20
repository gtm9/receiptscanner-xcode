import { parseReceipt } from '../parseReceipt';

const HEB_RECEIPT_TEXT = `H-E-B
•
1072 8712 0115 2621 5500 373
DYMATIZE PROT COOKIES CRM F 36.97 Q
**********
**
Total Sale***
36.97
*** DEBIT
36.97
ITEMS PURCHASED: 1
US DEBIT
************2807
Contactless Chip
Appr No: 193453
Mode: Issuer
INTERINK
USD$ 36.97
(ет NO
446003
Verified By Pin
ALD: A0000000980840
TVR: 0000000000
IAD: 1F42FF6EA000000000100302730000000040
00000000000000000000000
TSI :
ARC : 00
RECEIPT EXPIRES ON 04-15-26
1072 8712 0115 2621 5500 373
HEB Food-Drugs #02/3/3
16900 N. FM 620,
Round Rock
Phone:
(512)
TX 78681
238-7909
Pharmacy:
(512)
238-7905
Store Hours:
b A.M. to 11 P.M.
cashier: MADISON R
728712 01-15-26 9:55P 222/10/00373`;

describe('parseReceipt', () => {
    it('should correctly parse an HEB receipt', () => {
        const result = parseReceipt(HEB_RECEIPT_TEXT);

        // Check Items
        // Expecting 1 item: "DYMATIZE PROT COOKIES CRM F"
        expect(result.items.length).toBe(1);
        expect(result.items[0].name).toContain('DYMATIZE');
        expect(result.items[0].price).toBe(36.97);

        // Check Total
        // The parser currently fails here (it sees undefined or null)
        expect(result.total).toBe(36.97);

        // It shouldn't pick up "USD$ 36.97" as an item
        const erroneousItem = result.items.find(i => i.name.includes('USD') || i.name.includes('DEBIT'));
        expect(erroneousItem).toBeUndefined();
    });

    it('should handle standard generic receipts', () => {
        const genericText = `
        Walmart
        123 Main St
        
        MILK 1GAL      3.50
        BREAD WHEAT    2.00
        
        SUBTOTAL       5.50
        TAX            0.45
        TOTAL          5.95
        `;

        const result = parseReceipt(genericText);
        expect(result.items.length).toBe(2);
        expect(result.total).toBe(5.95);
        expect(result.subtotal).toBe(5.50);
        expect(result.tax).toBe(0.45);
    });

    it('should return empty struct for empty input', () => {
        const result = parseReceipt('');
        expect(result.items).toEqual([]);
        expect(result.total).toBeUndefined();
    });
});
