/**
 * Receipt Accuracy Test Screen
 * 
 * Automated on-device testing of OCR + AI parsing accuracy.
 * Images are bundled with the app - no manual setup required.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { performOCR } from '../utils/ocr';
import { parseReceiptWithAI } from '../utils/aiParser';
import { ParsedReceipt, ReceiptItem } from '../types';

// ============================================================================
// BUNDLED TEST IMAGES (loaded from assets folder)
// ============================================================================

const TEST_IMAGES = {
    krogerComplex: require('../../assets/test_receipts/receipt_kroger_complex.jpg'),
    hebGrocery: require('../../assets/test_receipts/receipt_heb_grocery.jpg'),
    krogerSimple: require('../../assets/test_receipts/receipt_kroger_simple.jpg'),
    hebProtein: require('../../assets/test_receipts/receipt_heb_protein.jpg'),
};

// ============================================================================
// GROUND TRUTH DATA
// ============================================================================

interface GroundTruth {
    id: string;
    description: string;
    imageAsset: any;
    expected: {
        storeName: string;
        date: string;
        totalAmount: number;
        tax: number | null;
        items: Array<{ name: string; price: number; quantity: number }>;
    };
}

const GROUND_TRUTH: GroundTruth[] = [
    {
        id: 'kroger_complex',
        description: 'Kroger - 12 items (Complex)',
        imageAsset: TEST_IMAGES.krogerComplex,
        expected: {
            storeName: 'Kroger',
            date: '2026-01-19',
            totalAmount: 64.43,
            tax: 1.26,
            items: [
                { name: 'SOUR CREAM', price: 4.00, quantity: 1 },
                { name: 'SOUR CREAM', price: 4.00, quantity: 1 },
                { name: 'CROBAR YOGURT', price: 7.29, quantity: 1 },
                { name: 'PRVS GRAND PARM', price: 9.49, quantity: 1 },
                { name: 'PRAYING SWALLUS', price: 0.96, quantity: 1 },
                { name: 'LILLYS CHC BAR', price: 4.99, quantity: 1 },
                { name: 'LILLYS CHC BAR', price: 4.99, quantity: 1 },
                { name: 'NSTL OUTSHINE BARSPC', price: 4.49, quantity: 1 },
                { name: 'NSTL OUTSHINE BARS', price: 6.99, quantity: 1 },
                { name: 'KELLIES LRG EGGS', price: 7.49, quantity: 1 },
                { name: 'KRO GRND TRKY', price: 5.49, quantity: 1 },
                { name: 'KRO GRND TRKY', price: 5.49, quantity: 1 },
            ]
        }
    },
    {
        id: 'heb_grocery',
        description: 'H-E-B - 5 items (Grocery)',
        imageAsset: TEST_IMAGES.hebGrocery,
        expected: {
            storeName: 'H-E-B',
            date: '2026-01-25',
            totalAmount: 25.94,
            tax: null,
            items: [
                { name: 'MI TIENDA MEXICAN GARLIC', price: 2.38, quantity: 1 },
                { name: 'JUMBO YELLOW ONION', price: 6.48, quantity: 1 },
                { name: 'PK NAT BI BACK RIB COV', price: 14.66, quantity: 1 },
                { name: 'ROMA TOMATOES', price: 1.98, quantity: 1 },
                { name: 'PREMIUM BANANAS', price: 0.44, quantity: 1 },
            ]
        }
    },
    {
        id: 'kroger_simple',
        description: 'Kroger - 1 item (Simple)',
        imageAsset: TEST_IMAGES.krogerSimple,
        expected: {
            storeName: 'Kroger',
            date: '2026-01-19',
            totalAmount: 1.93,
            tax: 0.04,
            items: [
                { name: 'BLM JUICE', price: 1.89, quantity: 1 },
            ]
        }
    },
    {
        id: 'heb_protein',
        description: 'H-E-B - 1 item (Protein)',
        imageAsset: TEST_IMAGES.hebProtein,
        expected: {
            storeName: 'H-E-B',
            date: '2026-01-15',
            totalAmount: 36.97,
            tax: null,
            items: [
                { name: 'DYMATIZE PROT COOKIES CRM', price: 36.97, quantity: 1 },
            ]
        }
    },
];

// ============================================================================
// TEST RESULT TYPES
// ============================================================================

interface TestResult {
    groundTruth: GroundTruth;
    localUri: string | null;
    ocrText: string | null;
    ocrDuration: number;
    parsedResult: ParsedReceipt | null;
    parseDuration: number;
    accuracy: AccuracyScore | null;
    error?: string;
}

interface AccuracyScore {
    storeMatch: boolean;
    dateMatch: boolean;
    totalMatch: boolean;
    taxMatch: boolean;
    itemCountMatch: boolean;
    itemsAccuracy: number;
    overallScore: number;
    details: {
        parsedStore: string | undefined;
        parsedDate: string | undefined;
        parsedTotal: number | undefined;
        parsedTax: number | undefined;
        parsedItemCount: number;
    };
}

// ============================================================================
// ACCURACY CALCULATION
// ============================================================================

function calculateAccuracy(parsed: ParsedReceipt | null, gt: GroundTruth): AccuracyScore | null {
    if (!parsed) return null;

    const expected = gt.expected;

    // Store match (case-insensitive partial)
    const storeMatch = parsed.storeName
        ? expected.storeName.toLowerCase().includes(parsed.storeName.toLowerCase()) ||
        parsed.storeName.toLowerCase().includes(expected.storeName.toLowerCase())
        : false;

    // Date match
    const dateMatch = parsed.date === expected.date;

    // Total match (within $0.50)
    const totalMatch = parsed.total !== undefined
        ? Math.abs(parsed.total - expected.totalAmount) < 0.50
        : false;

    // Tax match
    const taxMatch = expected.tax === null
        ? parsed.tax === undefined || parsed.tax === null
        : parsed.tax !== undefined && Math.abs(parsed.tax - expected.tax) < 0.10;

    // Item count
    const parsedItemCount = parsed.items?.length || 0;
    const itemCountMatch = Math.abs(parsedItemCount - expected.items.length) <= 1;

    // Items accuracy by price matching
    let itemsMatched = 0;
    const expectedPrices = expected.items.map(i => ({ price: i.price, matched: false }));
    const parsedItems = (parsed.items || []).map(i => ({ price: i.price, matched: false }));

    for (const exp of expectedPrices) {
        for (const par of parsedItems) {
            if (!par.matched && Math.abs(exp.price - par.price) < 0.10) {
                exp.matched = true;
                par.matched = true;
                itemsMatched++;
                break;
            }
        }
    }

    const itemsAccuracy = expected.items.length > 0
        ? (itemsMatched / expected.items.length) * 100
        : 100;

    // Weighted overall score
    const weights = { store: 15, date: 15, total: 25, tax: 10, itemCount: 10, items: 25 };
    const overallScore =
        (storeMatch ? weights.store : 0) +
        (dateMatch ? weights.date : 0) +
        (totalMatch ? weights.total : 0) +
        (taxMatch ? weights.tax : 0) +
        (itemCountMatch ? weights.itemCount : 0) +
        (itemsAccuracy / 100) * weights.items;

    return {
        storeMatch,
        dateMatch,
        totalMatch,
        taxMatch,
        itemCountMatch,
        itemsAccuracy,
        overallScore,
        details: {
            parsedStore: parsed.storeName,
            parsedDate: parsed.date,
            parsedTotal: parsed.total,
            parsedTax: parsed.tax,
            parsedItemCount,
        }
    };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AccuracyTestScreen() {
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<TestResult[]>([]);
    const [currentTest, setCurrentTest] = useState<string>('');
    const [assetsLoaded, setAssetsLoaded] = useState(false);

    // Preload assets on mount
    useEffect(() => {
        async function loadAssets() {
            try {
                const assets = Object.values(TEST_IMAGES).map(img => Asset.fromModule(img));
                await Promise.all(assets.map(asset => asset.downloadAsync()));
                setAssetsLoaded(true);
                console.log('Test assets loaded');
            } catch (e) {
                console.error('Failed to load assets:', e);
            }
        }
        loadAssets();
    }, []);

    const runAllTests = async () => {
        if (!assetsLoaded) {
            console.warn('Assets not loaded yet');
            return;
        }

        setIsRunning(true);
        setResults([]);
        const allResults: TestResult[] = [];

        for (let i = 0; i < GROUND_TRUTH.length; i++) {
            const gt = GROUND_TRUTH[i];
            setCurrentTest(`${i + 1}/${GROUND_TRUTH.length}: ${gt.description}`);

            try {
                // Get local URI from asset
                const asset = Asset.fromModule(gt.imageAsset);
                await asset.downloadAsync();
                const localUri = asset.localUri;

                if (!localUri) {
                    allResults.push({
                        groundTruth: gt,
                        localUri: null,
                        ocrText: null,
                        ocrDuration: 0,
                        parsedResult: null,
                        parseDuration: 0,
                        accuracy: null,
                        error: 'Could not get local URI for asset',
                    });
                    continue;
                }

                console.log(`Testing ${gt.id} from: ${localUri}`);

                // Run OCR
                const ocrStart = Date.now();
                const ocrResult = await performOCR(localUri);
                const ocrDuration = Date.now() - ocrStart;

                if (!ocrResult || !ocrResult.text) {
                    allResults.push({
                        groundTruth: gt,
                        localUri,
                        ocrText: null,
                        ocrDuration,
                        parsedResult: null,
                        parseDuration: 0,
                        accuracy: null,
                        error: 'OCR returned no text',
                    });
                    continue;
                }

                console.log(`OCR completed in ${ocrDuration}ms, text length: ${ocrResult.text.length}`);

                // Run AI Parsing
                const parseStart = Date.now();
                const parsedResult = await parseReceiptWithAI(ocrResult.text);
                const parseDuration = Date.now() - parseStart;

                console.log(`AI Parse completed in ${parseDuration}ms`);

                // Calculate accuracy
                const accuracy = calculateAccuracy(parsedResult, gt);

                console.log(`\n=== RESULTS FOR ${gt.id} ===`);
                console.log(`OCR Text Length: ${ocrResult.text.length}`);
                console.log(`Parsed Store: ${parsedResult?.storeName}`);
                console.log(`Parsed Date: ${parsedResult?.date}`);
                console.log(`Parsed Total: ${parsedResult?.total}`);
                console.log(`Parsed Items: ${parsedResult?.items?.length}`);
                if (parsedResult && parsedResult.items && parsedResult.items.length > 0) {
                    console.log('Parsed Items List:', JSON.stringify(parsedResult.items));
                }
                console.log(`Accuracy Score: ${accuracy?.overallScore}%`);
                console.log('===========================\n');

                allResults.push({
                    groundTruth: gt,
                    localUri,
                    ocrText: ocrResult.text,
                    ocrDuration,
                    parsedResult,
                    parseDuration,
                    accuracy,
                });

            } catch (error: any) {
                console.error(`Test failed for ${gt.id}:`, error);
                allResults.push({
                    groundTruth: gt,
                    localUri: null,
                    ocrText: null,
                    ocrDuration: 0,
                    parsedResult: null,
                    parseDuration: 0,
                    accuracy: null,
                    error: error.message || 'Unknown error',
                });
            }

            // Update results progressively
            setResults([...allResults]);
        }

        setCurrentTest('');
        setIsRunning(false);
    };

    // Calculate summary
    const validResults = results.filter(r => r.accuracy);
    const avgScore = validResults.length > 0
        ? validResults.reduce((sum, r) => sum + (r.accuracy?.overallScore || 0), 0) / validResults.length
        : 0;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.header}>🧪 Receipt Parsing Accuracy Test</Text>
                <Text style={styles.subheader}>
                    Automated testing with {GROUND_TRUTH.length} bundled receipts
                </Text>

                {!assetsLoaded ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#4CAF50" />
                        <Text style={styles.loadingText}>Loading test images...</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.runButton, isRunning && styles.runButtonDisabled]}
                        onPress={runAllTests}
                        disabled={isRunning}
                    >
                        {isRunning ? (
                            <View style={styles.runningRow}>
                                <ActivityIndicator color="#FFF" />
                                <Text style={styles.runButtonText}>{currentTest}</Text>
                            </View>
                        ) : (
                            <Text style={styles.runButtonText}>▶ Run All Tests</Text>
                        )}
                    </TouchableOpacity>
                )}

                {/* Summary Card */}
                {results.length > 0 && (
                    <View style={[styles.summaryCard, avgScore >= 80 ? styles.summaryGood : styles.summaryBad]}>
                        <Text style={styles.summaryTitle}>
                            {avgScore >= 80 ? '✅' : '⚠️'} Average Score
                        </Text>
                        <Text style={styles.summaryScore}>{avgScore.toFixed(1)}%</Text>
                        <Text style={styles.summaryDetail}>
                            {validResults.filter(r => r.accuracy?.storeMatch).length}/{validResults.length} Store •{' '}
                            {validResults.filter(r => r.accuracy?.totalMatch).length}/{validResults.length} Total •{' '}
                            {validResults.filter(r => r.accuracy?.dateMatch).length}/{validResults.length} Date
                        </Text>
                    </View>
                )}

                {/* Individual Results */}
                {results.map((result, index) => (
                    <View key={index} style={styles.resultCard}>
                        <View style={styles.resultHeader}>
                            <Text style={styles.resultTitle}>{result.groundTruth.description}</Text>
                            {result.accuracy && (
                                <Text style={[
                                    styles.resultScore,
                                    result.accuracy.overallScore >= 80 ? styles.scoreGood : styles.scoreBad
                                ]}>
                                    {result.accuracy.overallScore.toFixed(0)}%
                                </Text>
                            )}
                        </View>

                        {result.error ? (
                            <Text style={styles.errorText}>❌ {result.error}</Text>
                        ) : result.accuracy ? (
                            <>
                                {/* Match indicators */}
                                <View style={styles.indicators}>
                                    <Text style={result.accuracy.storeMatch ? styles.pass : styles.fail}>
                                        Store {result.accuracy.storeMatch ? '✓' : '✗'}
                                    </Text>
                                    <Text style={result.accuracy.dateMatch ? styles.pass : styles.fail}>
                                        Date {result.accuracy.dateMatch ? '✓' : '✗'}
                                    </Text>
                                    <Text style={result.accuracy.totalMatch ? styles.pass : styles.fail}>
                                        Total {result.accuracy.totalMatch ? '✓' : '✗'}
                                    </Text>
                                    <Text style={result.accuracy.taxMatch ? styles.pass : styles.fail}>
                                        Tax {result.accuracy.taxMatch ? '✓' : '✗'}
                                    </Text>
                                    <Text style={result.accuracy.itemCountMatch ? styles.pass : styles.fail}>
                                        Items {result.accuracy.itemCountMatch ? '✓' : '✗'}
                                    </Text>
                                </View>

                                {/* Parsed values */}
                                <View style={styles.parsedBox}>
                                    <Text style={styles.parsedLabel}>Parsed:</Text>
                                    <Text style={styles.parsedValue}>
                                        {result.accuracy.details.parsedStore || '—'} |{' '}
                                        {result.accuracy.details.parsedDate || '—'} |{' '}
                                        ${result.accuracy.details.parsedTotal?.toFixed(2) || '—'}
                                    </Text>
                                    <Text style={styles.parsedLabel}>Expected:</Text>
                                    <Text style={styles.parsedValue}>
                                        {result.groundTruth.expected.storeName} |{' '}
                                        {result.groundTruth.expected.date} |{' '}
                                        ${result.groundTruth.expected.totalAmount.toFixed(2)}
                                    </Text>
                                </View>

                                {/* Timing */}
                                <Text style={styles.timing}>
                                    OCR: {result.ocrDuration}ms | AI Parse: {result.parseDuration}ms
                                </Text>
                            </>
                        ) : (
                            <ActivityIndicator size="small" color="#888" />
                        )}
                    </View>
                ))}

                {/* OCR Text Debug (collapsible in future) */}
                {results.length > 0 && (
                    <View style={styles.debugSection}>
                        <Text style={styles.debugTitle}>📝 OCR Output (Debug)</Text>
                        {results.map((r, i) => r.ocrText && (
                            <View key={i} style={styles.debugItem}>
                                <Text style={styles.debugLabel}>{r.groundTruth.id}:</Text>
                                <Text style={styles.debugText}>
                                    {r.ocrText.substring(0, 200).replace(/\n/g, ' ')}...
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    subheader: {
        fontSize: 14,
        color: '#666666',
        marginBottom: 24,
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        color: '#888888',
        marginTop: 12,
    },
    runButton: {
        backgroundColor: '#4CAF50',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 24,
    },
    runButtonDisabled: {
        backgroundColor: '#2E7D32',
    },
    runButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    runningRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    summaryCard: {
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        marginBottom: 24,
    },
    summaryGood: {
        backgroundColor: '#1B5E20',
    },
    summaryBad: {
        backgroundColor: '#B71C1C',
    },
    summaryTitle: {
        fontSize: 16,
        color: '#FFFFFF',
        opacity: 0.9,
    },
    summaryScore: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    summaryDetail: {
        fontSize: 14,
        color: '#FFFFFF',
        opacity: 0.8,
        marginTop: 4,
    },
    resultCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        flex: 1,
    },
    resultScore: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    scoreGood: {
        color: '#4CAF50',
    },
    scoreBad: {
        color: '#FF5722',
    },
    indicators: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    pass: {
        color: '#4CAF50',
        fontSize: 12,
        backgroundColor: '#1B5E20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    fail: {
        color: '#FF5722',
        fontSize: 12,
        backgroundColor: '#BF360C',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    parsedBox: {
        backgroundColor: '#252525',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    parsedLabel: {
        fontSize: 11,
        color: '#888888',
        marginBottom: 2,
    },
    parsedValue: {
        fontSize: 13,
        color: '#CCCCCC',
        marginBottom: 8,
    },
    timing: {
        fontSize: 11,
        color: '#555555',
    },
    errorText: {
        color: '#FF5722',
        fontSize: 14,
    },
    debugSection: {
        marginTop: 32,
        backgroundColor: '#111111',
        borderRadius: 12,
        padding: 16,
    },
    debugTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 12,
    },
    debugItem: {
        marginBottom: 12,
    },
    debugLabel: {
        fontSize: 12,
        color: '#888888',
        marginBottom: 4,
    },
    debugText: {
        fontSize: 10,
        color: '#555555',
        fontFamily: 'monospace',
    },
});
