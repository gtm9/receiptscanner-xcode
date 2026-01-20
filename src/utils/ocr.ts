/**
 * OCR Utility using react-native-text-recognition
 * 
 * Switches to a library that supports static image OCR reliably.
 */

import TextRecognition from 'react-native-text-recognition';
import { OCRResult, OCRTextBlock } from '../types';

/**
 * Perform OCR on an image file
 * @param imagePath - Path to the image file (from camera capture or gallery)
 * @returns OCRResult with extracted text and text blocks
 */
export async function performOCR(imagePath: string): Promise<OCRResult | null> {
    try {
        console.log('Starting OCR on:', imagePath);

        // Ensure path is clean for the library if needed, but usually it handles file:// or /path/to/file
        // React Native Text Recognition typically expects a clean path or file:// uri.
        // Let's pass it directly first.

        const result = await TextRecognition.recognize(imagePath);

        if (!result || result.length === 0) {
            console.log('No text recognized');
            return null;
        }

        console.log('OCR success, lines found:', result.length);

        // Convert string array to our OCRResult format
        const blocks: OCRTextBlock[] = result.map((line) => ({
            text: line,
            // Bounding box and confidence are not available in the basic return of this library
            // but that's okay as they are optional in our types.
        }));

        const ocrResult: OCRResult = {
            text: result.join('\n'),
            blocks: blocks,
        };

        return ocrResult;
    } catch (error) {
        console.error('OCR Error:', error);
        return null;
    }
}
