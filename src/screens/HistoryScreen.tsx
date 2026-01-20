import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Receipt } from '../types';
import { getAllReceipts, getReceiptStats, initializeDatabase } from '../utils/db';

type HistoryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'History'>;

interface ReceiptStats {
    totalReceipts: number;
    totalSpent: number;
    averageTotal: number;
}

export const HistoryScreen: React.FC = () => {
    const navigation = useNavigation<HistoryScreenNavigationProp>();
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [stats, setStats] = useState<ReceiptStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }
            setError(null);

            // Initialize database (creates tables if needed)
            await initializeDatabase();

            // Load receipts and stats in parallel
            const [receiptsList, receiptStats] = await Promise.all([
                getAllReceipts(),
                getReceiptStats(),
            ]);

            setReceipts(receiptsList);
            setStats(receiptStats);
        } catch (err) {
            console.error('Failed to load data:', err);
            setError('Failed to load receipts. Please check your connection.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // Load data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleReceiptPress = (receiptId: number) => {
        navigation.navigate('ReceiptDetail', { receiptId });
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Unknown date';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatCurrency = (amount?: number) => {
        if (amount === undefined || amount === null) return '$0.00';
        return `$${amount.toFixed(2)}`;
    };

    const renderReceiptItem = ({ item }: { item: Receipt }) => (
        <TouchableOpacity
            style={styles.receiptCard}
            onPress={() => item.id && handleReceiptPress(item.id)}
            activeOpacity={0.7}
        >
            <View style={styles.receiptInfo}>
                <Text style={styles.receiptStore}>
                    {item.storeName || 'Unknown Store'}
                </Text>
                <Text style={styles.receiptDate}>{formatDate(item.date)}</Text>
            </View>
            <View style={styles.receiptAmount}>
                <Text style={styles.receiptTotal}>{formatCurrency(item.total)}</Text>
                <Text style={styles.chevron}>›</Text>
            </View>
        </TouchableOpacity>
    );

    const renderEmptyList = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyTitle}>No Receipts Yet</Text>
            <Text style={styles.emptySubtitle}>
                Scan your first receipt to start tracking expenses
            </Text>
            <TouchableOpacity
                style={styles.scanButton}
                onPress={() => navigation.navigate('Camera')}
            >
                <Text style={styles.scanButtonText}>Scan Receipt</Text>
            </TouchableOpacity>
        </View>
    );

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading receipts...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => loadData()}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Stats Header */}
            {stats && stats.totalReceipts > 0 && (
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{stats.totalReceipts}</Text>
                        <Text style={styles.statLabel}>Receipts</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{formatCurrency(stats.totalSpent)}</Text>
                        <Text style={styles.statLabel}>Total Spent</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{formatCurrency(stats.averageTotal)}</Text>
                        <Text style={styles.statLabel}>Average</Text>
                    </View>
                </View>
            )}

            {/* Receipt List */}
            <FlatList
                data={receipts}
                keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                renderItem={renderReceiptItem}
                ListEmptyComponent={renderEmptyList}
                contentContainerStyle={receipts.length === 0 ? styles.emptyListContent : styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => loadData(true)}
                        tintColor="#007AFF"
                    />
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    loadingText: {
        marginTop: 12,
        color: '#666',
        fontSize: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 20,
    },
    errorIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    errorText: {
        color: '#666',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingVertical: 20,
        paddingHorizontal: 16,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a2e',
    },
    statLabel: {
        fontSize: 12,
        color: '#888',
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        backgroundColor: '#eee',
        marginVertical: 4,
    },
    listContent: {
        padding: 16,
    },
    emptyListContent: {
        flex: 1,
    },
    receiptCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    receiptInfo: {
        flex: 1,
    },
    receiptStore: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a2e',
        marginBottom: 4,
    },
    receiptDate: {
        fontSize: 14,
        color: '#888',
    },
    receiptAmount: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    receiptTotal: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF',
        marginRight: 8,
    },
    chevron: {
        fontSize: 24,
        color: '#ccc',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1a1a2e',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        marginBottom: 24,
    },
    scanButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
    },
    scanButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
