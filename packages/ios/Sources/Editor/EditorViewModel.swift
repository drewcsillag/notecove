//
//  EditorViewModel.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import Foundation
import WebKit

/// View model for the TipTap editor
@MainActor
class EditorViewModel: ObservableObject {
    @Published var noteTitle: String = "Untitled"
    @Published var isLoading: Bool = true
    @Published var editorReady: Bool = false

    var lastDocumentState: Data?

    private let noteId: String
    private let storageId: String
    private let bridge: CRDTBridge
    private let database: DatabaseManager
    private weak var webView: WKWebView?

    init(noteId: String, storageId: String, bridge: CRDTBridge, database: DatabaseManager) {
        self.noteId = noteId
        self.storageId = storageId
        self.bridge = bridge
        self.database = database
    }

    /// Set the web view reference
    func setWebView(_ webView: WKWebView) {
        self.webView = webView
    }

    /// Load the note into the editor
    func loadNote() async {
        isLoading = true

        do {
            // Get the note's CRDT state
            let state = try bridge.getDocumentState(noteId: noteId)

            // Convert to base64 for JavaScript
            let base64 = state.base64EncodedString()

            // Load note in editor
            await callJavaScript(function: "loadNote", args: [noteId, base64])

            // Extract title for display
            let title = try bridge.extractTitle(stateData: state)
            self.noteTitle = title.isEmpty ? "Untitled" : title

        } catch {
            print("[EditorViewModel] Error loading note: \(error)")
            // Load empty note
            await callJavaScript(function: "loadNote", args: [noteId, ""])
        }
    }

    /// Handle content changes from the editor
    func handleContentChanged(noteId: String, title: String, isEmpty: Bool) async {
        // Update title in UI
        self.noteTitle = title.isEmpty ? "Untitled" : title

        // Update title in database
        do {
            try database.updateNote(
                id: noteId,
                title: self.noteTitle,
                folderId: nil
            )
        } catch {
            print("[EditorViewModel] Error updating title: \(error)")
        }
    }

    /// Handle CRDT updates from the editor
    func handleUpdate(_ updateData: Data) async {
        do {
            // Apply update to CRDT bridge
            try bridge.applyUpdate(noteId: noteId, updateData: updateData)

            // Get updated state
            let state = try bridge.getDocumentState(noteId: noteId)

            // Extract and update title
            let title = try bridge.extractTitle(stateData: state)
            await handleContentChanged(noteId: noteId, title: title, isEmpty: title.isEmpty)

        } catch {
            print("[EditorViewModel] Error handling update: \(error)")
        }
    }

    /// Execute an editor command
    func executeCommand(_ command: String, params: [String: Any] = [:]) async {
        await callJavaScript(function: "executeCommand", args: [command, params])
    }

    /// Call JavaScript function
    private func callJavaScript(function: String, args: [Any]) async {
        guard let webView = webView else {
            print("[EditorViewModel] WebView not set")
            return
        }

        // Build JavaScript call
        var jsArgs: [String] = []
        for arg in args {
            if let str = arg as? String {
                jsArgs.append("'\(str.replacingOccurrences(of: "'", with: "\\'"))'")
            } else if let dict = arg as? [String: Any] {
                if let jsonData = try? JSONSerialization.data(withJSONObject: dict),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    jsArgs.append(jsonString)
                }
            } else {
                jsArgs.append("\(arg)")
            }
        }

        let script = "\(function)(\(jsArgs.joined(separator: ", ")))"

        do {
            _ = try await webView.evaluateJavaScript(script)
        } catch {
            print("[EditorViewModel] JavaScript error: \(error)")
        }
    }
}
