import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Receipt, ReceiptItem } from '../types';
import { getReceiptById, deleteReceipt } from '../utils/db';

import { useAuth } from '@clerk/clerk-expo';

type ReceiptDetailRouteProp = RouteProp<RootStackParamList, 'ReceiptDetail'>;
type ReceiptDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ReceiptDetail'>;

export const ReceiptDetailScreen: React.FC = () => {
    const route = useRoute<ReceiptDetailRouteProp>();
    const navigation = useNavigation<ReceiptDetailNavigationProp>();
    const { userId } = useAuth();
    const { receiptId } = route.params;

    const [receipt, setReceipt] = useState<Receipt | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (userId) {
            loadReceipt();
        }
    }, [receiptId, userId]);

    const loadReceipt = async () => {
        if (!userId) return;
        try {
            setIsLoading(true);
            setError(null);
            const data = await getReceiptById(receiptId, userId);
            if (data) {
                setReceipt(data);
            } else {
                setError('Receipt not found');
            }
        } catch (err) {
            console.error('Failed to load receipt:', err);
            setError('Failed to load receipt details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Receipt',
            'Are you sure you want to delete this receipt? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        if (!userId) return;
                        try {
                            await deleteReceipt(receiptId, userId);
                            navigation.goBack();
                        } catch (err) {
                            console.error('Failed to delete:', err);
                            Alert.alert('Error', 'Failed to delete receipt');
                        }
                    },
                },
            ]
        );
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Unknown date';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatCurrency = (amount?: number) => {
        if (amount === undefined || amount === null) return '-';
        return `$${amount.toFixed(2)}`;
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    if (error || !receipt) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error || 'Receipt not found'}</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Header Card */}
            <View style={styles.headerCard}>
                <Text style={styles.storeName}>{receipt.storeName || 'Unknown Store'}</Text>
                <Text style={styles.date}>{formatDate(receipt.date)}</Text>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>{formatCurrency(receipt.total)}</Text>
            </View>

            {/* Items List */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Items</Text>
                {receipt.items && receipt.items.length > 0 ? (
                    receipt.items.map((item, index) => (
                        <View key={item.id || index} style={styles.itemRow}>
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                {item.quantity && item.quantity > 1 && (
                                    <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                                )}
                            </View>
                            <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noItems}>No items parsed from this receipt</Text>
                )}
            </View>

            {/* Summary */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Summary</Text>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(receipt.subtotal)}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tax</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(receipt.tax)}</Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={styles.totalLabel2}>Total</Text>
                    <Text style={styles.totalValue}>{formatCurrency(receipt.total)}</Text>
                </View>
            </View>

            {/* Raw Text (Collapsible for debugging) */}
            {receipt.rawText && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Raw OCR Text</Text>
                    <View style={styles.rawTextContainer}>
                        <Text style={styles.rawText} numberOfLines={10}>
                            {receipt.rawText}
                        </Text>
                    </View>
                </View>
            )}

            {/* Delete Button */}
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete Receipt</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 20,
    },
    errorText: {
        color: '#666',
        fontSize: 16,
        marginBottom: 20,
    },
    backButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    headerCard: {
        backgroundColor: '#007AFF',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 20,
    },
    storeName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    date: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 20,
    },
    totalLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    totalAmount: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#fff',
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    itemInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemName: {
        fontSize: 16,
        color: '#1a1a2e',
    },
    itemQuantity: {
        fontSize: 14,
        color: '#888',
        marginLeft: 8,
    },
    itemPrice: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a2e',
    },
    noItems: {
        fontSize: 14,
        color: '#888',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 20,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    summaryLabel: {
        fontSize: 16,
        color: '#666',
    },
    summaryValue: {
        fontSize: 16,
        color: '#1a1a2e',
    },
    totalRow: {
        borderTopWidth: 1,
        borderTopColor: '#eee',
        marginTop: 8,
        paddingTop: 12,
    },
    totalLabel2: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a2e',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    rawTextContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
    },
    rawText: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'Menlo',
        lineHeight: 18,
    },
    deleteButton: {
        backgroundColor: '#ff4444',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
