import { scanImage } from 'receipt-ocr';
import { OCRResult } from '../types';

/**
 * Perform OCR on an image file using Apple Vision (Native Module)
 * @param imagePath - Path to the image file
 * @returns OCRResult
 */
export async function performOCR(imagePath: string): Promise<OCRResult | null> {
    try {
        console.warn('Starting Apple Vision OCR on:', imagePath);

        // Call the local native module
        const result = await scanImage(imagePath);

        if (!result || !result.text) {
            console.log('No text recognized (Apple Vision)');
            return null;
        }

        console.log('Apple Vision Success, text length:', result.text.length);

        return {
            text: result.text,
            blocks: result.blocks.map((block: any) => ({
                text: block.text,
                frame: block.bounding, // Pass through bounding box if available
                confidence: block.confidence
            })),
        };

    } catch (error) {
        console.error('Apple Vision OCR Error:', error);
        return null;
    }
}


