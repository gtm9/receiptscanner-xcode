
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';

// Warm up the browser
WebBrowser.maybeCompleteAuthSession();

import { Alert } from 'react-native';
import * as Linking from 'expo-linking';

export const LoginScreen = () => {
    const { startOAuthFlow: startGoogleFlow } = useOAuth({ strategy: "oauth_google" });

    const onGoogleSignIn = React.useCallback(async () => {
        try {
            const redirectUrl = `receiptscanner://oauth-redirect`;

            const { createdSessionId, setActive, signIn, signUp } = await startGoogleFlow({
                redirectUrl,
            });

            if (createdSessionId) {
                // Top-level session ID (standard flow)
                setActive!({ session: createdSessionId });
            } else if (signIn && signIn.status === 'complete') {
                // Session ID inside signIn object
                setActive!({ session: signIn.createdSessionId });
            } else if (signUp && signUp.status === 'complete') {
                // Session ID inside signUp object
                setActive!({ session: signUp.createdSessionId });
            } else {
                // Auth incomplete (e.g. MFA required, or missing fields)
                Alert.alert("OAuth Incomplete",
                    `SignIn Status: ${signIn?.status}\n` +
                    `SignUp Status: ${signUp?.status}\n` +
                    "See logs for details."
                );
                console.log("Incomplete structure:", { signIn, signUp });
            }
        } catch (err) {
            console.error("OAuth error", err);
            Alert.alert("Sign In Error", JSON.stringify(err));
        }
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Receipt Scanner</Text>
                    <Text style={styles.subtitle}>Enterprise Expense Management</Text>
                </View>

                <View style={styles.form}>
                    <TouchableOpacity
                        style={styles.googleButton}
                        onPress={onGoogleSignIn}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.googleButtonText}>Sign in with Google</Text>
                    </TouchableOpacity>

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Placeholder for standard email login if needed later */}
                    {/* Expanded Email Login Implementation */}
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => Alert.alert("Coming Soon", "Email/Phone sign up will be implemented in the next step")}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.secondaryButtonText}>Use Email or Phone</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 48,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666666',
    },
    form: {
        gap: 16,
    },
    googleButton: {
        backgroundColor: '#007AFF', // Using app primary color
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    googleButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E5E5',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#999999',
        fontSize: 14,
    },
    secondaryButton: {
        backgroundColor: '#F5F5F5',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
    secondaryButtonText: {
        color: '#333333',
        fontSize: 16,
        fontWeight: '600',
    },
});
