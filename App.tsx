import React from 'react';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { AppNavigator } from './src/navigation/AppNavigator';
import { tokenCache } from './src/utils/tokenCache';
import { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY } from '@env';

const publishableKey = EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error(
    'Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env',
  )
}

import { useEffect } from 'react';
import { initializeDatabase } from './src/utils/db';

export default function App() {
  useEffect(() => {
    initializeDatabase().catch(console.error);
  }, []);

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <ClerkLoaded>
        <AppNavigator />
      </ClerkLoaded>
    </ClerkProvider>
  );
}
