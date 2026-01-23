import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { BarChart } from 'react-native-gifted-charts';
import { getAllReceipts } from '../utils/db';
import { Receipt } from '../types';

const screenWidth = Dimensions.get('window').width;

export const StatsScreen: React.FC = () => {
    const { userId } = useAuth();
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [userId]);

    const loadData = async () => {
        if (!userId) return;
        try {
            setIsLoading(true);
            const data = await getAllReceipts(userId);
            setReceipts(data);
        } catch (err) {
            console.error('Failed to load stats data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const stats = useMemo(() => {
        const totalSpent = receipts.reduce((sum, r) => sum + (r.total || 0), 0);
        const totalReceipts = receipts.length;
        const average = totalReceipts > 0 ? totalSpent / totalReceipts : 0;

        // Group by Month (Last 6 months)
        const monthlyData = new Map<string, number>();
        const monthLabels: string[] = [];

        // Initialize last 6 months with 0
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.toLocaleString('default', { month: 'short' });
            monthlyData.set(key, 0);
            monthLabels.push(key);
        }

        receipts.forEach(r => {
            if (r.date) {
                const d = new Date(r.date);
                const key = d.toLocaleString('default', { month: 'short' });
                // Only count if it's in our window (simple check)
                if (monthlyData.has(key)) {
                    monthlyData.set(key, (monthlyData.get(key) || 0) + (r.total || 0));
                }
            }
        });

        const barData = monthLabels.map(label => ({
            value: monthlyData.get(label) || 0,
            label: label,
            frontColor: '#007AFF',
            topLabelComponent: () => (
                <Text style={{ color: '#007AFF', fontSize: 10, marginBottom: 4 }}>
                    ${Math.round(monthlyData.get(label) || 0)}
                </Text>
            ),
        }));

        return {
            totalSpent,
            totalReceipts,
            average,
            barData,
        };
    }, [receipts]);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                {/* Summary Cards */}
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryCard}>
                        <Text style={styles.cardLabel}>Total Spent</Text>
                        <Text style={styles.cardValue}>${stats.totalSpent.toFixed(2)}</Text>
                    </View>
                    <View style={styles.row}>
                        <View style={[styles.summaryCard, styles.halfCard]}>
                            <Text style={styles.cardLabel}>Receipts</Text>
                            <Text style={styles.cardValue}>{stats.totalReceipts}</Text>
                        </View>
                        <View style={[styles.summaryCard, styles.halfCard]}>
                            <Text style={styles.cardLabel}>Average</Text>
                            <Text style={styles.cardValue}>${stats.average.toFixed(0)}</Text>
                        </View>
                    </View>
                </View>

                {/* Chart Section */}
                <View style={styles.chartContainer}>
                    <Text style={styles.sectionTitle}>Monthly Spending</Text>
                    {stats.totalReceipts > 0 ? (
                        <View style={{ overflow: 'hidden' }}>
                            <BarChart
                                data={stats.barData}
                                barWidth={32}
                                spacing={20}
                                roundedTop
                                simplified
                                roundedBottom={false}
                                hideRules
                                xAxisThickness={0}
                                yAxisThickness={0}
                                yAxisTextStyle={{ color: '#888' }}
                                noOfSections={3}
                                maxValue={Math.max(...stats.barData.map(d => d.value)) * 1.2 || 100}
                                width={screenWidth - 80}
                                height={200}
                            />
                        </View>
                    ) : (
                        <View style={styles.emptyChart}>
                            <Text style={styles.emptyText}>No data to display</Text>
                        </View>
                    )}
                </View>
            </View>
        </ScrollView>
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
    },
    content: {
        padding: 16,
    },
    summaryContainer: {
        marginBottom: 24,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    summaryCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    halfCard: {
        flex: 0.48,
    },
    cardLabel: {
        fontSize: 14,
        color: '#888',
        marginBottom: 8,
    },
    cardValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a2e',
    },
    chartContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a1a2e',
        marginBottom: 24,
        alignSelf: 'flex-start',
    },
    emptyChart: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#ccc',
        fontSize: 16,
    },
});
