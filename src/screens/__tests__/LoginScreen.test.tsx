import React from 'react';
import { render } from '@testing-library/react-native';
import { LoginScreen } from '../LoginScreen';

// Mock Clerk hook
jest.mock('@clerk/clerk-expo', () => ({
    useOAuth: () => ({
        startOAuthFlow: jest.fn().mockResolvedValue({
            createdSessionId: 'sess_123',
            setActive: jest.fn(),
        }),
    }),
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
    maybeCompleteAuthSession: jest.fn(),
}));

describe('LoginScreen', () => {
    it('renders correctly', () => {
        const { getByText } = render(<LoginScreen />);

        expect(getByText('Receipt Scanner')).toBeTruthy();
        expect(getByText('Enterprise Expense Management')).toBeTruthy();
        expect(getByText('Sign in with Google')).toBeTruthy();
    });
});
