// Navigation type definitions
export type RootStackParamList = {
    Home: undefined;
    Login: undefined;
    Camera: undefined;
    History: undefined;
    ReceiptDetail: { receiptId: number };
    Account: undefined;
    Stats: undefined;
};

// Receipt data types
export interface ReceiptItem {
    id?: number;
    receiptId?: number;
    name: string;
    price: number;
    quantity?: number;
}

export interface Receipt {
    id?: number;
    date?: string;
    storeName?: string;
    subtotal?: number;
    tax?: number;
    total?: number;
    rawText?: string;
    items?: ReceiptItem[];
}

// Parsed receipt from OCR (before saving to DB)
export interface ParsedReceipt {
    items: ReceiptItem[];
    storeName?: string;
    subtotal?: number;
    tax?: number;
    total?: number;
    rawText: string;
    date?: string;
    confidence: number; // 0-1 score indicating parsing quality
}

// OCR result types
export interface OCRTextBlock {
    text: string;
    boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    confidence?: number;
}

export interface OCRResult {
    text: string;
    blocks: OCRTextBlock[];
}
