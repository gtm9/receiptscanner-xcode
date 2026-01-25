import MlkitOcr, { MlkitOcrResult } from 'react-native-mlkit-ocr';
import { OCRResult } from '../types';

/**
 * Perform OCR on an image file using ML Kit (with Line Stitching)
 * @param imagePath - Path to the image file
 * @returns OCRResult with stitched text
 */
export async function performOCR(imagePath: string): Promise<OCRResult | null> {
    try {
        console.log('Starting MLKit OCR on:', imagePath);

        // Strip file:// prefix for ML Kit on iOS if present
        const cleanPath = imagePath.replace('file://', '');
        const result = await MlkitOcr.detectFromFile(cleanPath);

        if (!result || result.length === 0) {
            console.log('No text recognized (ML Kit)');
            return null;
        }

        console.log('ML Kit Success, blocks:', result.length);

        // Stitch lines based on Y-coordinates to fix columnar issues
        const stitchedText = stitchLines(result);
        console.log('Stitched Text Preview:', stitchedText.substring(0, 100).replace(/\n/g, ' '));

        return {
            text: stitchedText,
            blocks: result.map(block => ({
                text: block.text,
                frame: block.bounding, // Pass through bounding box if needed later
            })),
        };

    } catch (error) {
        console.error('ML Kit OCR Error:', error);
        return null;
    }
}

/**
 * Stitch text blocks into lines based on Y-coordinates.
 * Solves the issue where "Item Name" and "Price" are visually on the same line
 * but returned as separate blocks by the OCR.
 */
function stitchLines(blocks: MlkitOcrResult): string {
    // 1. Flatten all lines from all blocks
    // ML Kit structure: Result -> Blocks -> Lines
    // We want individual lines with their frames
    const allLines: { text: string; top: number; left: number; height: number }[] = [];

    // Helper to process a line
    // blocks is effectively MlkitOcrBlock[]
    // block.lines is Array<MlkitOcrLine>
    // line.frame is { x, y, width, height } or similar depending on platform.
    // NOTE: react-native-mlkit-ocr types might vary, usually it's `bounding` or `frame`.
    // Let's assume standard normalization.

    blocks.forEach(block => {
        block.lines.forEach(line => {
            if (line.bounding) {
                // Ensure we handle potential differences in bounding box format if any
                // Usually it's top, left, width, height
                allLines.push({
                    text: line.text,
                    top: line.bounding.top,
                    left: line.bounding.left,
                    height: line.bounding.height
                });
            }
        });
    });

    if (allLines.length === 0) return '';

    // 2. Sort by Y-coordinate (Top)
    allLines.sort((a, b) => a.top - b.top);

    // 3. Group integers into "Visual Lines"
    // If a line is within `half-height` of the previous line, consider it the same line.

    // Threshold can be dynamic. 10-20px is usually safe for receipts.
    // Or use average height of lines.
    const AVG_HEIGHT = allLines.reduce((sum, l) => sum + l.height, 0) / allLines.length;
    const Y_THRESHOLD = AVG_HEIGHT * 0.5;

    const mergedLines: { text: string; top: number }[] = [];

    // Temporary bucket for current line
    let currentRow: typeof allLines = [];

    allLines.forEach((line) => {
        if (currentRow.length === 0) {
            currentRow.push(line);
        } else {
            // Check vertical distance from the *average* center of the current row?
            // Or just compare to the first item (simplest)
            const refLine = currentRow[0];

            // Calculate center Y for better accuracy
            const refCenterY = refLine.top + (refLine.height / 2);
            const lineCenterY = line.top + (line.height / 2);

            if (Math.abs(lineCenterY - refCenterY) < Y_THRESHOLD) {
                // Same logical line
                currentRow.push(line);
            } else {
                // New line started, process the old one
                mergedLines.push(processRow(currentRow));
                currentRow = [line];
            }
        }
    });

    // Process last row
    if (currentRow.length > 0) {
        mergedLines.push(processRow(currentRow));
    }

    // 4. Join all merged lines
    return mergedLines.map(l => l.text).join('\n');
}

/**
 * Process a row of text elements: Sort left-to-right and join
 */
function processRow(row: { text: string; left: number; top: number }[]): { text: string; top: number } {
    // Sort logic: Left to Right
    row.sort((a, b) => a.left - b.left);

    // Join with space
    const text = row.map(r => r.text).join(' ');

    // Return combined object (use top of first element as ref)
    return {
        text,
        top: row[0].top // metadata if needed
    };
}

