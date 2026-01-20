import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ReceiptDetailScreen } from '../screens/ReceiptDetailScreen';
import { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName="Home"
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
            </Stack.Navigator>
        </NavigationContainer>
    );
};
