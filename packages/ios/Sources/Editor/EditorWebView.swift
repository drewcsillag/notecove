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

        // Add message handler for editor messages
        configuration.userContentController.add(
            context.coordinator.bridge,
            name: "editor"
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.scrollView.isScrollEnabled = true
        webView.scrollView.bounces = true

        // Allow inline media playback
        configuration.allowsInlineMediaPlayback = true

        // Set reference to web view in view model
        viewModel.setWebView(webView)

        // Load editor HTML
        if let htmlPath = Bundle.main.path(forResource: "editor", ofType: "html") {
            let htmlURL = URL(fileURLWithPath: htmlPath)
            webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        } else {
            print("[EditorWebView] editor.html not found in bundle")
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
    class Coordinator: NSObject {
        let bridge: EditorBridge
        let viewModel: EditorViewModel

        init(viewModel: EditorViewModel) {
            self.viewModel = viewModel
            self.bridge = EditorBridge()
            super.init()
            self.bridge.viewModel = viewModel
        }
    }
}
