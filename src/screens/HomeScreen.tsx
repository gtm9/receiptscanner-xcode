import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../types';
import { performOCR } from '../utils/ocr';
import { parseReceipt } from '../utils/parseReceipt';
import { saveReceipt } from '../utils/db';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

import { useAuth } from '@clerk/clerk-expo';

export const HomeScreen: React.FC = () => {
    const navigation = useNavigation<HomeScreenNavigationProp>();
    const { userId } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleScanReceipt = () => {
        navigation.navigate('Camera');
    };

    const handleUploadReceipt = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 1,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const imageUri = result.assets[0].uri;
            console.log('Selected image:', imageUri);

            setIsProcessing(true);

            try {
                // Perform OCR on the selected image
                const ocrResult = await performOCR(imageUri);
                console.log('OCR Result:', ocrResult);

                if (ocrResult && ocrResult.text) {
                    // Parse the receipt
                    const parsedReceipt = await parseReceipt(ocrResult.text);
                    console.log('Parsed Receipt:', parsedReceipt);

                    Alert.alert(
                        'Receipt Scanned!',
                        `Items Found: ${parsedReceipt.items.length}\n` +
                        `Total: $${parsedReceipt.total?.toFixed(2) || 'N/A'}\n\n` +
                        `Raw Text Preview:\n${ocrResult.text.substring(0, 50).replace(/\n/g, ' ')}...`,
                        [
                            {
                                text: 'Discard',
                                style: 'destructive',
                            },
                            {
                                text: 'View Raw Text',
                                onPress: () => {
                                    Alert.alert('Raw OCR Text', ocrResult.text, [
                                        {
                                            text: 'Back',
                                            style: 'cancel',
                                            onPress: () => {
                                                // Re-trigger the main alert (optional, but good UX)
                                                // For now, simpler to just let them re-scan if they want to save, 
                                                // or just offer a Save button here too? 
                                                // Let's just go back to main screen or offer nothing.
                                                // Actually, if they view raw text, they lose the ability to save in this flow.
                                                // Let's make the "View Raw Text" alert have a "Save" option too?
                                                // Or just simpler:
                                                // We can't easily re-open the previous alert with state.
                                                // Let's just log it and show it.
                                            }
                                        },
                                        {
                                            text: 'Save Anyway',
                                            onPress: async () => {
                                                if (!userId) {
                                                    Alert.alert('Error', 'You must be logged in to save receipts.');
                                                    return;
                                                }
                                                // Duplicate save logic here
                                                try {
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
                                                        [{ text: 'OK', onPress: () => navigation.navigate('History') }]
                                                    );
                                                } catch (saveError) {
                                                    console.error('Save error:', saveError);
                                                    Alert.alert('Save Failed', 'Could not save receipt. Please try again.');
                                                }
                                            }
                                        }
                                    ]);
                                }
                            },
                            {
                                text: 'Save Receipt',
                                onPress: async () => {
                                    if (!userId) {
                                        Alert.alert('Error', 'You must be logged in to save receipts.');
                                        return;
                                    }
                                    try {
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
                                            [{ text: 'OK', onPress: () => navigation.navigate('History') }]
                                        );
                                    } catch (saveError) {
                                        console.error('Save error:', saveError);
                                        Alert.alert('Save Failed', 'Could not save receipt. Please try again.');
                                    }
                                },
                            },
                        ]
                    );
                } else {
                    Alert.alert(
                        'No Text Found',
                        'Could not detect any text in the image. Try again with a clearer image.',
                    );
                }
            } catch (error) {
                console.error('OCR error:', error);
                Alert.alert('Error', 'Failed to process the receipt. Please try again.');
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleViewHistory = () => {
        navigation.navigate('History');
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>📄 Receipt Scanner</Text>
                    <Text style={styles.subtitle}>
                        Scan receipts and extract items automatically using on-device OCR
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.scanButton}
                    onPress={handleScanReceipt}
                    activeOpacity={0.8}
                    disabled={isProcessing}
                >
                    <Text style={styles.scanButtonIcon}>📷</Text>
                    <Text style={styles.scanButtonText}>Scan Receipt</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.scanButton, styles.uploadButton, isProcessing && styles.disabledButton]}
                    onPress={handleUploadReceipt}
                    activeOpacity={0.8}
                    disabled={isProcessing}
                >
                    {isProcessing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Text style={styles.scanButtonIcon}>🖼️</Text>
                            <Text style={styles.scanButtonText}>Upload Receipt</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.historyButton}
                    onPress={handleViewHistory}
                    activeOpacity={0.7}
                    disabled={isProcessing}
                >
                    <Text style={styles.historyButtonText}>📋 View History</Text>
                </TouchableOpacity>


            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Powered by Apple Vision Framework
                </Text>
                <Text style={styles.footerSubtext}>
                    On-device • Private • No cloud required
                </Text>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    header: {
        alignItems: 'center',
        marginBottom: 60,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1a1a2e',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
    },
    scanButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 24,
        paddingHorizontal: 48,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
        minWidth: 250,
        marginBottom: 20,
    },
    uploadButton: {
        backgroundColor: '#5856D6', // Different color for upload
    },
    disabledButton: {
        opacity: 0.7,
    },
    scanButtonIcon: {
        fontSize: 28,
        marginRight: 12,
    },
    scanButtonText: {
        color: 'white',
        fontSize: 22,
        fontWeight: '700',
    },
    historyButton: {
        marginTop: 10,
        paddingVertical: 16,
        paddingHorizontal: 32,
    },
    historyButtonText: {
        color: '#007AFF',
        fontSize: 18,
        fontWeight: '600',
    },
    footer: {
        alignItems: 'center',
        paddingBottom: 40,
    },
    footerText: {
        fontSize: 14,
        color: '#888',
        fontWeight: '500',
    },
    footerSubtext: {
        fontSize: 12,
        color: '#aaa',
        marginTop: 4,
    },
});
