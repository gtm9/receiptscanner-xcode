import ExpoModulesCore
import Vision
import UIKit

public class ReceiptOcrModule: Module {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ReceiptOcr')` in JavaScript.
    Name("ReceiptOcr")

    // Defines a JavaScript function that always returns a Promise and whose native code
    // is by default dispatched on the different thread than the JavaScript runtime runs on.
    AsyncFunction("scanImage") { (imagePath: String, promise: Promise) in
        
        // 1. Get URL from path
        guard let url = URL(string: imagePath) else {
            promise.reject("ERR_INVALID_PATH", "Invalid image path")
            return
        }
        
        var finalUrl = url
        if url.scheme == nil {
            finalUrl = URL(fileURLWithPath: imagePath)
        }
        
        // 2. Create Request
        let request = VNRecognizeTextRequest { (request, error) in
            if let error = error {
                promise.reject("ERR_VISION_FAILED", "Vision request failed: \(error.localizedDescription)")
                return
            }
            
            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                promise.resolve(["text": "", "blocks": []])
                return
            }
            
            var fullText = ""
            var blocks: [[String: Any]] = []
            
            for observation in observations {
                guard let candidate = observation.topCandidates(1).first else { continue }
                
                fullText += candidate.string + "\n"
                
                let block: [String: Any] = [
                    "text": candidate.string,
                    "confidence": candidate.confidence,
                    // "boundingBox": observation.boundingBox // Requires manual serialization if needed
                ]
                blocks.append(block)
            }
            
            promise.resolve([
                "text": fullText.trimmingCharacters(in: .whitespacesAndNewlines),
                "blocks": blocks
            ])
        }
        
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        
        // 3. Perform Request
        DispatchQueue.global(qos: .userInitiated).async {
            let handler = VNImageRequestHandler(url: finalUrl, options: [:])
            do {
                try handler.perform([request])
            } catch {
                promise.reject("ERR_HANDLER_FAILED", "Failed to perform Vision request: \(error.localizedDescription)")
            }
        }
    }
  }
}
