# ReceiptScanner

An iOS receipt scanning app built with Expo + React Native that uses **Apple's native Vision framework** for on-device OCR text recognition.

## Why Apple Vision Framework?

1. **🔒 Privacy**: All text recognition happens on-device. No data is sent to the cloud.
2. **⚡ Performance**: Optimized for Apple Silicon, offering superior speed.
3. **🎯 Accuracy**: State-of-the-art OCR for English text, especially effective for receipts.
4. **📱 Native Integration**: Leverages iOS capabilities directly via `react-native-vision-camera`.

## Tech Stack

- **Expo SDK 54** with Development Build
- **React Native 0.81**
- **TypeScript**
- **react-native-vision-camera** (v4.6+) with frame processors
- **React Navigation** (v7) for routing
- **react-native-sqlite-storage** for local persistence

## Project Structure

```
ReceiptScanner/
├── src/
│   ├── screens/          # Screen components
│   │   └── HomeScreen.tsx
│   ├── components/       # Reusable UI components
│   ├── navigation/       # Navigation configuration
│   │   └── AppNavigator.tsx
│   ├── utils/            # Utilities (OCR, parsing, DB)
│   └── types/            # TypeScript type definitions
│       └── index.ts
├── App.tsx               # Main entry point
├── app.json              # Expo configuration
├── babel.config.js       # Babel config with worklets plugin
└── package.json
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- Xcode 15+ (for iOS development)
- CocoaPods
- An iOS device or Simulator

### Installation

1. **Install dependencies:**
   ```bash
   cd ReceiptScanner
   npm install
   ```

2. **Generate native iOS project (prebuild):**
   ```bash
   npx expo prebuild --platform ios
   ```

3. **Install CocoaPods:**
   ```bash
   cd ios && pod install && cd ..
   ```

4. **Run on iOS:**
   ```bash
   npm run ios
   ```
   
   Or directly:
   ```bash
   npx expo run:ios
   ```

## ⚠️ Important Notes

- **This app requires a Development Build** — it will NOT work in Expo Go.
- The `react-native-vision-camera` library needs native code that isn't in the Expo Go client.
- Run with `npx expo run:ios` which builds a custom development client on your device/simulator.

## Features (MVP)

- [x] Home screen with "Scan Receipt" button
- [ ] Camera screen with full-screen preview
- [ ] Real-time OCR using Apple Vision framework
- [ ] Parse extracted text into structured data (items, prices, totals)
- [ ] Store receipts in local SQLite database
- [ ] History screen to view past receipts

## License

MIT
# receiptscanner-xcode
