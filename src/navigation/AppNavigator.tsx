import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/clerk-expo';
import { ActivityIndicator, View } from 'react-native';

import { HomeScreen } from '../screens/HomeScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ReceiptDetailScreen } from '../screens/ReceiptDetailScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
    const { isSignedIn, isLoaded } = useAuth();

    if (!isLoaded) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerStyle: {
                        backgroundColor: '#007AFF',
                    },
                    headerTintColor: '#fff',
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                }}
            >
                {isSignedIn ? (
                    <>
                        <Stack.Screen
                            name="Home"
                            component={HomeScreen}
                            options={{ title: 'Receipt Scanner' }}
                        />
                        <Stack.Screen
                            name="Camera"
                            component={CameraScreen}
                            options={{
                                title: 'Scan Receipt',
                                headerShown: false,
                            }}
                        />
                        <Stack.Screen
                            name="History"
                            component={HistoryScreen}
                            options={{ title: 'Receipt History' }}
                        />
                        <Stack.Screen
                            name="ReceiptDetail"
                            component={ReceiptDetailScreen}
                            options={{ title: 'Receipt Details' }}
                        />
                    </>
                ) : (
                    <Stack.Screen
                        name="Login"
                        component={LoginScreen}
                        options={{ headerShown: false }}
                    />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};
