import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    SafeAreaView,
} from 'react-native';
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
    PhotoFile,
} from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/clerk-expo';
import { RootStackParamList } from '../types';
import { performOCR } from '../utils/ocr';
import { parseReceipt } from '../utils/parseReceipt';
import { saveReceipt } from '../utils/db';

type CameraScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Camera'>;

export const CameraScreen: React.FC = () => {
    const navigation = useNavigation<CameraScreenNavigationProp>();
    const camera = useRef<Camera>(null);
    const device = useCameraDevice('back');
    const { hasPermission, requestPermission } = useCameraPermission();
    const { userId } = useAuth();

    const [isProcessing, setIsProcessing] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<PhotoFile | null>(null);

    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission, requestPermission]);

    const handleCapture = useCallback(async () => {
        if (!camera.current) return;

        try {
            setIsProcessing(true);

            // Capture photo
            const photo = await camera.current.takePhoto({
                flash: 'off',
                enableShutterSound: false,
            });

            setCapturedPhoto(photo);
            console.log('Photo captured:', photo.path);

            // Perform OCR on the captured image
            const ocrResult = await performOCR(photo.path);
            console.log('OCR Result:', ocrResult);

            if (ocrResult && ocrResult.text) {
                // Parse the receipt
                const parsedReceipt = parseReceipt(ocrResult.text);
                console.log('Parsed Receipt:', parsedReceipt);

                // Check confidence
                if (parsedReceipt.confidence < 0.6) {
                    console.log('Low confidence parsing:', parsedReceipt.confidence);
                    // In the future, this is where we would trigger AI Fallback
                    Alert.alert(
                        'Review Needed',
                        'We had trouble reading some details. Please verify the total and date.',
                    );
                }

                // Show confirmation dialog
                Alert.alert(
                    'Receipt Scanned!',
                    `Store: ${parsedReceipt.storeName || 'Unknown'}\n` +
                    `Date: ${parsedReceipt.date || 'Unknown'}\n` +
                    `Total: $${parsedReceipt.total?.toFixed(2) || 'N/A'}\n` +
                    `Confidence: ${(parsedReceipt.confidence * 100).toFixed(0)}%`,
                    [
                        {
                            text: 'Discard',
                            style: 'destructive',
                            onPress: () => setCapturedPhoto(null),
                        },
                        {
                            text: 'Save Receipt',
                            onPress: async () => {
                                if (!userId) {
                                    Alert.alert('Error', 'You must be logged in to save receipts.');
                                    setCapturedPhoto(null);
                                    return;
                                }

                                try {
                                    // Save to Neon database
                                    const savedReceipt = await saveReceipt({
                                        storeName: parsedReceipt.storeName,
                                        subtotal: parsedReceipt.subtotal,
                                        tax: parsedReceipt.tax,
                                        total: parsedReceipt.total,
                                        rawText: parsedReceipt.rawText,
                                        items: parsedReceipt.items,
                                        confidence: parsedReceipt.confidence,
                                    }, userId);

                                    Alert.alert(
                                        'Saved!',
                                        `Receipt #${savedReceipt.id} saved successfully.`,
                                        [{ text: 'OK', onPress: () => navigation.goBack() }]
                                    );
                                } catch (saveError) {
                                    console.error('Save error:', saveError);
                                    Alert.alert('Save Failed', 'Could not save receipt. Please try again.');
                                    setCapturedPhoto(null);
                                }
                            },
                        },
                    ]
                );
            } else {
                Alert.alert(
                    'No Text Found',
                    'Could not detect any text in the image. Try again with better lighting.',
                    [{ text: 'OK', onPress: () => setCapturedPhoto(null) }]
                );
            }
        } catch (error) {
            console.error('Capture/OCR error:', error);
            Alert.alert('Error', 'Failed to process the receipt. Please try again.');
            setCapturedPhoto(null);
        } finally {
            setIsProcessing(false);
        }
    }, [navigation, userId]);

    // Permission loading state
    if (!hasPermission) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <Text style={styles.permissionText}>Camera permission is required</Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // No device available
    if (!device) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <Text style={styles.errorText}>No camera device found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            <Camera
                ref={camera}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={!isProcessing}
                photo={true}
            />

            {/* Overlay with capture button */}
            <SafeAreaView style={styles.overlay}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerText}>Position receipt in frame</Text>
                    <View style={styles.placeholder} />
                </View>

                {/* Guide frame */}
                <View style={styles.frameGuide}>
                    <View style={styles.cornerTL} />
                    <View style={styles.cornerTR} />
                    <View style={styles.cornerBL} />
                    <View style={styles.cornerBR} />
                </View>

                {/* Capture button */}
                <View style={styles.footer}>
                    {isProcessing ? (
                        <View style={styles.processingContainer}>
                            <ActivityIndicator size="large" color="#fff" />
                            <Text style={styles.processingText}>Processing...</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.captureButton}
                            onPress={handleCapture}
                            activeOpacity={0.7}
                        >
                            <View style={styles.captureButtonInner} />
                        </TouchableOpacity>
                    )}
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    permissionText: {
        color: '#fff',
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20,
    },
    permissionButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    permissionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    errorText: {
        color: '#ff4444',
        fontSize: 18,
        textAlign: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    headerText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    placeholder: {
        width: 40,
    },
    frameGuide: {
        flex: 1,
        marginHorizontal: 30,
        marginVertical: 60,
        position: 'relative',
    },
    cornerTL: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 40,
        height: 40,
        borderTopWidth: 3,
        borderLeftWidth: 3,
        borderColor: '#fff',
    },
    cornerTR: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 40,
        height: 40,
        borderTopWidth: 3,
        borderRightWidth: 3,
        borderColor: '#fff',
    },
    cornerBL: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 40,
        height: 40,
        borderBottomWidth: 3,
        borderLeftWidth: 3,
        borderColor: '#fff',
    },
    cornerBR: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 40,
        height: 40,
        borderBottomWidth: 3,
        borderRightWidth: 3,
        borderColor: '#fff',
    },
    footer: {
        alignItems: 'center',
        paddingBottom: 40,
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#fff',
    },
    captureButtonInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#fff',
    },
    processingContainer: {
        alignItems: 'center',
    },
    processingText: {
        color: '#fff',
        marginTop: 10,
        fontSize: 16,
    },
});
