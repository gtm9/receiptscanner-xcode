
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { SafeAreaView } from 'react-native-safe-area-context';

export const AccountScreen = () => {
    const { signOut } = useAuth();
    const { user } = useUser();

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (err) {
            console.error("Sign out error", err);
            Alert.alert("Error", "Failed to sign out");
        }
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
            <View style={styles.content}>
                <View style={styles.profileSection}>
                    <Image
                        source={{ uri: user?.imageUrl }}
                        style={styles.avatar}
                    />
                    <Text style={styles.name}>{user?.fullName || 'User'}</Text>
                    <Text style={styles.email}>{user?.primaryEmailAddress?.emailAddress}</Text>
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.signOutButton}
                        onPress={handleSignOut}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.signOutButtonText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    content: {
        padding: 24,
    },
    profileSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 16,
        backgroundColor: '#E1E1E1',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    email: {
        fontSize: 16,
        color: '#666666',
    },
    actions: {
        gap: 16,
    },
    signOutButton: {
        backgroundColor: '#FF3B30',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    signOutButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
