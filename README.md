# Receipt Scanner

An iOS receipt scanning app built with Expo + React Native that uses **Apple's native Vision framework** for on-device OCR text recognition and **OpenRouter** for intelligent parsing.

## 🚀 features

- **On-Device OCR**: Uses Apple's Vision Framework for fast, private text recognition.
- **AI Parsing**: Intelligent receipt parsing using OpenRouter (LLM).
- **Authentication**: User management via Clerk.
- **Data Persistence**: Local storage with SQLite (or optional Cloud DB).

## 🛠️ Prerequisites

- **Node.js** (v18+)
- **Xcode** (v15+)
- **CocoaPods**
- **iOS Device** or **Simulator**

## 🏁 Getting Started

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd ReceiptScanner
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory by copying the example:
    ```bash
    cp .env.example .env
    ```
    Then, fill in your keys in `.env`:
    - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: Your Clerk Publishable Key.
    - `EXPO_PUBLIC_OPENROUTER_API_KEY`: Your OpenRouter API Key.
    - `EXPO_PUBLIC_USE_MOCK_DB`: Set to `true` for dev/testing, `false` for production DB.

4.  **Install iOS Pods**
    ```bash
    npx expo prebuild --platform ios
    cd ios && pod install && cd ..
    ```

## 📱 Running the App

### Development (Simulator)
To run the app on the iOS Simulator:
```bash
npx expo run:ios
```

### Development (Physical Device)
To run on a physical iPhone:
1.  Connect your iPhone via USB.
2.  Open `ios/ReceiptScanner.xcworkspace` in Xcode.
3.  Select your **Development Team** in `Signing & Capabilities`.
4.  Run:
    ```bash
    npx expo run:ios --device
    ```

## 🏗️ Building for Production

To build a production IPA for TestFlight or the App Store:

1.  **Install EAS CLI**
    ```bash
    npm install -g eas-cli
    ```

2.  **Configure Build**
    Ensure `eas.json` is configured (default is usually sufficient for standard builds).

3.  **Build**
    ```bash
    eas build --platform ios
    ```

## 🧪 Testing

Run the test suite (if available):
```bash
npm test
```

## 📄 License

MIT
