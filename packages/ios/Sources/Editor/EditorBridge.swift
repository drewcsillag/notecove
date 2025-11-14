//
//  EditorBridge.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import Foundation
import WebKit

/// Messages sent from JavaScript to Swift
enum EditorMessage: String {
    case editorReady
    case noteLoaded
    case contentChanged
    case documentState
    case update
    case error
}

/// Bridge between WKWebView and Swift for editor communication
@MainActor
class EditorBridge: NSObject, WKScriptMessageHandler {
    weak var viewModel: EditorViewModel?

    /// Handle messages from JavaScript
    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any],
              let typeString = body["type"] as? String,
              let messageType = EditorMessage(rawValue: typeString),
              let data = body["data"] as? [String: Any] else {
            print("[EditorBridge] Invalid message format")
            return
        }

        switch messageType {
        case .editorReady:
            handleEditorReady()

        case .noteLoaded:
            handleNoteLoaded(data)

        case .contentChanged:
            handleContentChanged(data)

        case .documentState:
            handleDocumentState(data)

        case .update:
            handleUpdate(data)

        case .error:
            handleError(data)
        }
    }

    private func handleEditorReady() {
        print("[EditorBridge] Editor ready")
        viewModel?.editorReady = true
    }

    private func handleNoteLoaded(_ data: [String: Any]) {
        guard let noteId = data["noteId"] as? String else { return }
        print("[EditorBridge] Note loaded: \(noteId)")
        viewModel?.isLoading = false
    }

    private func handleContentChanged(_ data: [String: Any]) {
        guard let noteId = data["noteId"] as? String,
              let text = data["text"] as? String,
              let isEmpty = data["isEmpty"] as? Bool else { return }

        // Extract title from first line
        let lines = text.components(separatedBy: .newlines)
        let title = lines.first?.trimmingCharacters(in: .whitespaces) ?? "Untitled"

        Task {
            await viewModel?.handleContentChanged(noteId: noteId, title: title, isEmpty: isEmpty)
        }
    }

    private func handleDocumentState(_ data: [String: Any]) {
        guard let base64 = data["state"] as? String,
              let stateData = Data(base64Encoded: base64) else { return }

        viewModel?.lastDocumentState = stateData
    }

    private func handleUpdate(_ data: [String: Any]) {
        guard let base64 = data["update"] as? String,
              let updateData = Data(base64Encoded: base64) else { return }

        Task {
            await viewModel?.handleUpdate(updateData)
        }
    }

    private func handleError(_ data: [String: Any]) {
        let message = data["message"] as? String ?? "Unknown error"
        print("[EditorBridge] Error from JavaScript: \(message)")
    }
}
