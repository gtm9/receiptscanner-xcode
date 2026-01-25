import { NativeModules } from 'react-native';

const { ReceiptParserModule } = NativeModules;

interface NativeReceiptParserInterface {
    scanReceipt(text: string): Promise<{
        storeName?: string;
        total?: number;
        date?: string;
        items?: Array<{ name: string; price: number; quantity: number }>;
        confidence: number;
    }>;
}

export const NativeReceiptParser = ReceiptParserModule as NativeReceiptParserInterface;

export async function parseReceiptWithNativeLLM(text: string) {
    try {
        console.log("Available Native Modules:", Object.keys(NativeModules));
        if (!NativeReceiptParser) {
            console.warn('ReceiptParserModule is not available. Ensure you have rebuilt the native app.');
            throw new Error('Native Module not found');
        }
        const result = await NativeReceiptParser.scanReceipt(text);
        return result;
    } catch (error) {
        console.error('Native Parse Error:', error);
        throw error;
    }
}
