Project Handover: ReceiptScanner
1. Project Status
Current State: Fully Functional on iOS Physical Device & Simulator. Codebase Location: ~/Desktop/projects/receipt-scanner-xcode/ReceiptScanner

2. Recent Critical Fixes
A. iOS Deployment Target
Issue: Build failed on iPhone 15 Pro (iOS 18.x) because project was targeting iOS 26.2.
Fix: Lowered ios.deploymentTarget to 16.0 in 
ios/Podfile.properties.json
 and 
project.pbxproj
.
B. Build Sandbox Error
Issue: Sandbox: bash deny(1) file-write-create error during build.
Fix: Set ENABLE_USER_SCRIPT_SANDBOXING = NO in 
project.pbxproj
.
C. Parser Hardening
Issue: HEB receipts were missing "Total" and seeing extra noise.
Fix: Updated 
parseReceipt.ts
 with HEB-specific regex and split-line lookahead. Added Unit Tests (npm test).
3. Immediate Next Steps (Pending)
The user needs to push these local fixes to GitHub. The authenticated agent in the new workspace should run:

cd ~/Desktop/projects/receipt-scanner-xcode/ReceiptScanner
git checkout -b fix/ios-deployment-config
git add ios/Podfile.properties.json ios/ReceiptScanner.xcodeproj/project.pbxproj
git commit -m "fix(ios): lower deployment target to 16.0 and disable sandboxing"
git push -u origin fix/ios-deployment-config
4. How to Run
# 1. Start Metro
npx expo start
# 2. Run on Device (Apple ID: appleeskai14)
npx expo run:ios --device "appleeskai14"