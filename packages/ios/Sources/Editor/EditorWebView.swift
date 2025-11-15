//
//  EditorWebView.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import SwiftUI
import WebKit

/// SwiftUI wrapper for WKWebView with TipTap editor
struct EditorWebView: UIViewRepresentable {
    @ObservedObject var viewModel: EditorViewModel

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = WKUserContentController()

        // JavaScript is enabled by default in iOS 14+

        // Allow inline media playback
        configuration.allowsInlineMediaPlayback = true

        // Add message handler for editor messages
        configuration.userContentController.add(
            context.coordinator.bridge,
            name: "editor"
        )

        // Add console message handler to capture JavaScript console.log/error
        configuration.userContentController.add(
            context.coordinator,
            name: "consoleLog"
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.scrollView.isScrollEnabled = true
        webView.scrollView.bounces = true

        // Set navigation delegate for debugging
        webView.navigationDelegate = context.coordinator

        // Set reference to web view in view model
        viewModel.setWebView(webView)

        // Load editor HTML with local bundle resources
        if let htmlURL = Bundle.main.url(forResource: "editor", withExtension: "html") {
            print("[EditorWebView] Loading editor from: \(htmlURL.path)")
            // Use loadFileURL to properly load local HTML with local resources
            // Allow read access to the entire bundle directory so JS files can be loaded
            let bundleURL = Bundle.main.bundleURL
            print("[EditorWebView] Allowing read access to: \(bundleURL.path)")
            webView.loadFileURL(htmlURL, allowingReadAccessTo: bundleURL)
        } else {
            print("[EditorWebView] ERROR: editor.html not found in bundle or couldn't be read")
            // Try to list what's in the bundle
            if let bundlePath = Bundle.main.resourcePath {
                print("[EditorWebView] Bundle path: \(bundlePath)")
                if let files = try? FileManager.default.contentsOfDirectory(atPath: bundlePath) {
                    print("[EditorWebView] Files in bundle: \(files)")
                }
            }
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // No updates needed for now
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(viewModel: viewModel)
    }

    @MainActor
    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let bridge: EditorBridge
        let viewModel: EditorViewModel

        init(viewModel: EditorViewModel) {
            self.viewModel = viewModel
            self.bridge = EditorBridge()
            super.init()
            self.bridge.viewModel = viewModel
        }

        // Navigation delegate methods for debugging
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            print("[EditorWebView] ✅ Page loaded successfully")

            // Inject console capture script
            let consoleScript = """
            (function() {
                var originalLog = console.log;
                var originalError = console.error;
                var originalWarn = console.warn;

                console.log = function(...args) {
                    try {
                        window.webkit.messageHandlers.consoleLog.postMessage({type: 'log', message: args.join(' ')});
                    } catch(e) {}
                    originalLog.apply(console, args);
                };
                console.error = function(...args) {
                    try {
                        window.webkit.messageHandlers.consoleLog.postMessage({type: 'error', message: args.join(' ')});
                    } catch(e) {}
                    originalError.apply(console, args);
                };
                console.warn = function(...args) {
                    try {
                        window.webkit.messageHandlers.consoleLog.postMessage({type: 'warn', message: args.join(' ')});
                    } catch(e) {}
                    originalWarn.apply(console, args);
                };
            })();
            """
            webView.evaluateJavaScript(consoleScript)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            print("[EditorWebView] ❌ Navigation failed: \(error.localizedDescription)")
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            print("[EditorWebView] ❌ Provisional navigation failed: \(error.localizedDescription)")
        }

        // Handle console messages from JavaScript
        nonisolated func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            let messageName = message.name
            let messageBody = message.body

            if messageName == "consoleLog" {
                if let body = messageBody as? [String: Any],
                   let type = body["type"] as? String,
                   let msg = body["message"] as? String {
                    print("[JS Console] [\(type.uppercased())] \(msg)")
                }
            } else {
                // Forward other messages to EditorBridge
                Task { @MainActor in
                    bridge.userContentController(userContentController, didReceive: message)
                }
            }
        }
    }
}
