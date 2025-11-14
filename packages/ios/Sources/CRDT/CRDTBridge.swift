//
//  CRDTBridge.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import Foundation
import JavaScriptCore

/// Errors that can occur in the CRDT bridge
enum CRDTBridgeError: Error {
    case javascriptLoadFailed(String)
    case javascriptError(String)
    case invalidResult
    case noteNotOpen(String)
    case folderTreeNotOpen(String)
    case invalidBase64
    case bridgeNotInitialized
}

/// Bridge between Swift and JavaScript (JavaScriptCore) for CRDT operations
///
/// This class loads the bundled JavaScript code (from packages/shared) and provides
/// a Swift API for CRDT operations. All actual CRDT logic runs in JavaScriptCore.
///
/// Thread Safety: All operations must be called on the main thread/actor.
@MainActor
class CRDTBridge {
    // MARK: - Properties

    /// The JavaScript context running our bundled code
    private var context: JSContext?

    /// Reference to the NoteCoveBridge JavaScript object
    private var bridgeObject: JSValue?

    // MARK: - Lifecycle

    init() {
        setupContext()
    }

    deinit {
        // Cleanup happens automatically when context is deallocated
        // Cannot call @MainActor methods from deinit
    }

    // MARK: - Setup

    /// Set up the JavaScriptCore context and load the bundle
    private func setupContext() {
        // Create JSContext
        guard let ctx = JSContext() else {
            print("ERROR: Failed to create JSContext")
            return
        }

        self.context = ctx

        // Set up exception handler
        ctx.exceptionHandler = { context, exception in
            guard let exc = exception else { return }
            print("JavaScript Error: \(exc)")
            if let stack = exc.objectForKeyedSubscript("stack") {
                print("Stack: \(stack)")
            }
        }

        // Set up console.log for debugging
        let consoleLog: @convention(block) (String) -> Void = { message in
            print("[JS] \(message)")
        }
        ctx.setObject(consoleLog, forKeyedSubscript: "consoleLog" as NSString)

        // Set up global object (JavaScriptCore doesn't have window or global by default)
        // The bundled JavaScript expects to find 'global' to attach NoteCoveBridge
        ctx.evaluateScript("var global = this;");

        // Set up getRandomValues for crypto polyfill
        let getRandomValues: @convention(block) (JSValue) -> JSValue = { array in
            guard let length = array.objectForKeyedSubscript("length")?.toInt32() else {
                return array
            }

            for i in 0..<length {
                let randomValue = UInt8.random(in: 0...255)
                array.setObject(randomValue, atIndexedSubscript: Int(i))
            }

            return array
        }
        ctx.setObject(getRandomValues, forKeyedSubscript: "_swiftGetRandomValues" as NSString)

        // Evaluate polyfills for atob/btoa (base64 encoding) and crypto
        // JavaScriptCore doesn't have these by default
        ctx.evaluateScript("""
        var atob = function(base64) {
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            var str = base64.replace(/=+$/, '');
            var output = '';

            if (str.length % 4 === 1) {
                throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
            }

            for (
                var bc = 0, bs = 0, buffer, i = 0;
                buffer = str.charAt(i++);
                ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
                    bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
            ) {
                buffer = chars.indexOf(buffer);
            }

            return output;
        };

        var btoa = function(input) {
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            var str = String(input);
            var output = '';

            for (
                var block = 0, charCode, i = 0, map = chars;
                str.charAt(i | 0) || (map = '=', i % 1);
                output += map.charAt(63 & block >> 8 - i % 1 * 8)
            ) {
                charCode = str.charCodeAt(i += 3/4);

                if (charCode > 0xFF) {
                    throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
                }

                block = block << 8 | charCode;
            }

            return output;
        };

        // Crypto polyfill for JavaScriptCore
        var crypto = {
            getRandomValues: function(array) {
                return _swiftGetRandomValues(array);
            },
            subtle: {
                // Minimal stub for crypto.subtle (not used by Yjs for critical operations)
            }
        };
        """)

        // Load the bundled JavaScript
        do {
            try loadBundledJavaScript()
        } catch {
            print("ERROR: Failed to load bundled JavaScript: \(error)")
        }
    }

    /// Load the bundled JavaScript file from the app bundle
    private func loadBundledJavaScript() throws {
        guard let context = self.context else {
            throw CRDTBridgeError.bridgeNotInitialized
        }

        // Find the JavaScript bundle in the app's resources
        guard let bundlePath = Bundle.main.path(forResource: "notecove-bridge", ofType: "js") else {
            throw CRDTBridgeError.javascriptLoadFailed("JavaScript bundle not found in app resources")
        }

        // Read the JavaScript code
        let scriptContent = try String(contentsOfFile: bundlePath, encoding: .utf8)

        // Evaluate the script
        context.evaluateScript(scriptContent)

        // Get reference to the NoteCoveBridge object
        guard let bridge = context.objectForKeyedSubscript("NoteCoveBridge"),
              !bridge.isUndefined else {
            throw CRDTBridgeError.javascriptLoadFailed("NoteCoveBridge object not found in JavaScript")
        }

        self.bridgeObject = bridge
        print("✅ CRDTBridge initialized successfully")
    }

    /// Clean up resources
    private func cleanup() {
        bridgeObject = nil
        context = nil
    }

    // MARK: - Note Operations

    /// Create a new note document
    func createNote(noteId: String) throws {
        guard let bridge = bridgeObject else {
            throw CRDTBridgeError.bridgeNotInitialized
        }

        let result = bridge.invokeMethod("createNote", withArguments: [noteId])

        if let error = context?.exception {
            throw CRDTBridgeError.javascriptError(error.toString())
        }

        // Check if result is undefined (void function succeeded)
        if result?.isUndefined == true {
            return // Success
        }
    }

    /// Apply a CRDT update to an open note
    func applyUpdate(noteId: String, updateData: Data) throws {
        guard let bridge = bridgeObject else {
            throw CRDTBridgeError.bridgeNotInitialized
        }

        let base64 = updateData.base64EncodedString()
        let result = bridge.invokeMethod("applyUpdate", withArguments: [noteId, base64])

        if let error = context?.exception {
            throw CRDTBridgeError.javascriptError(error.toString())
        }

        if result?.isUndefined == true {
            return // Success
        }
    }

    /// Get the current state of a note document as a CRDT update
    func getDocumentState(noteId: String) throws -> Data {
        guard let bridge = bridgeObject else {
            throw CRDTBridgeError.bridgeNotInitialized
        }

        let result = bridge.invokeMethod("getDocumentState", withArguments: [noteId])

        if let error = context?.exception {
            throw CRDTBridgeError.javascriptError(error.toString())
        }

        guard let result = result,
              !result.isUndefined,
              !result.isNull,
              let base64 = result.toString() else {
            throw CRDTBridgeError.invalidResult
        }

        guard let data = Data(base64Encoded: base64) else {
            throw CRDTBridgeError.invalidBase64
        }

        return data
    }

    /// Extract the title from a note's CRDT state
    func extractTitle(stateData: Data) throws -> String {
        guard let bridge = bridgeObject else {
            throw CRDTBridgeError.bridgeNotInitialized
        }

        let base64 = stateData.base64EncodedString()
        let result = bridge.invokeMethod("extractTitle", withArguments: [base64])

        if let error = context?.exception {
            throw CRDTBridgeError.javascriptError(error.toString())
        }

        guard let result = result,
              !result.isUndefined,
              !result.isNull,
              let title = result.toString() else {
            throw CRDTBridgeError.invalidResult
        }

        return title
    }

    /// Close a note document (free memory)
    func closeNote(noteId: String) {
        guard let bridge = bridgeObject else { return }
        _ = bridge.invokeMethod("closeNote", withArguments: [noteId])
    }

    // MARK: - Folder Tree Operations

    /// Create a new folder tree document
    func createFolderTree(sdId: String) throws {
        guard let bridge = bridgeObject else {
            throw CRDTBridgeError.bridgeNotInitialized
        }

        let result = bridge.invokeMethod("createFolderTree", withArguments: [sdId])

        if let error = context?.exception {
            throw CRDTBridgeError.javascriptError(error.toString())
        }

        if result?.isUndefined == true {
            return // Success
        }
    }

    /// Load a folder tree from its CRDT state
    func loadFolderTree(sdId: String, stateData: Data) throws {
        guard let bridge = bridgeObject else {
            throw CRDTBridgeError.bridgeNotInitialized
        }

        let base64 = stateData.base64EncodedString()
        let result = bridge.invokeMethod("loadFolderTree", withArguments: [sdId, base64])

        if let error = context?.exception {
            throw CRDTBridgeError.javascriptError(error.toString())
        }

        if result?.isUndefined == true {
            return // Success
        }
    }

    /// Get the current state of a folder tree as a CRDT update
    func getFolderTreeState(sdId: String) throws -> Data {
        guard let bridge = bridgeObject else {
            throw CRDTBridgeError.bridgeNotInitialized
        }

        let result = bridge.invokeMethod("getFolderTreeState", withArguments: [sdId])

        if let error = context?.exception {
            throw CRDTBridgeError.javascriptError(error.toString())
        }

        guard let result = result,
              !result.isUndefined,
              !result.isNull,
              let base64 = result.toString() else {
            throw CRDTBridgeError.invalidResult
        }

        guard let data = Data(base64Encoded: base64) else {
            throw CRDTBridgeError.invalidBase64
        }

        return data
    }

    /// Close a folder tree (free memory)
    func closeFolderTree(sdId: String) {
        guard let bridge = bridgeObject else { return }
        _ = bridge.invokeMethod("closeFolderTree", withArguments: [sdId])
    }

    // MARK: - Memory Management

    /// Clear all cached documents (called on memory warning)
    func clearDocumentCache() {
        guard let bridge = bridgeObject else { return }
        _ = bridge.invokeMethod("clearDocumentCache", withArguments: [])
        print("📝 Cleared CRDT document cache")
    }

    /// Get the number of currently open documents (for debugging)
    func getOpenDocumentCount() -> Int {
        guard let bridge = bridgeObject else { return 0 }
        let result = bridge.invokeMethod("getOpenDocumentCount", withArguments: [])
        return Int(result?.toInt32() ?? 0)
    }
}
