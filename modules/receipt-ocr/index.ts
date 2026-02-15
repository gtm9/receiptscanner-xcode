import { requireNativeModule } from 'expo-modules-core';

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
const ReceiptOcr = requireNativeModule('ReceiptOcr');

export async function scanImage(imagePath: string): Promise<{ text: string, blocks: any[] }> {
    return await ReceiptOcr.scanImage(imagePath);
}
