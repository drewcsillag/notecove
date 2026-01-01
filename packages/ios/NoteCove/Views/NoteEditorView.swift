import SwiftUI
import WebKit

/// Note viewer/editor using WKWebView with TipTap
struct NoteEditorView: View {
    let note: Note
    @State private var htmlContent: String?
    @State private var yjsStateBase64: String?
    @State private var isLoading = true
    @State private var isEditing = false
    @State private var errorMessage: String?

    @ObservedObject private var storageManager = StorageDirectoryManager.shared

    var body: some View {
        VStack(spacing: 0) {
            if isLoading {
                ProgressView("Loading note...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = errorMessage {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text(error)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if isEditing {
                TipTapWebView(
                    noteId: note.id,
                    yjsStateBase64: yjsStateBase64,
                    htmlContent: htmlContent,
                    onContentChanged: { noteId, json in
                        print("[NoteEditorView] Content changed for \(noteId)")
                        // TODO: Phase 3.2 - Save changes to CRDT
                    },
                    onReady: {
                        print("[NoteEditorView] Editor ready")
                    },
                    onError: { error in
                        print("[NoteEditorView] Editor error: \(error)")
                        errorMessage = error
                        isEditing = false
                    }
                )
            } else if let html = htmlContent {
                ReadOnlyNoteWebView(htmlContent: html, noteTitle: note.title)
            } else {
                PlaceholderEditorView(note: note)
            }
        }
        .navigationTitle(note.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                // Edit/Done toggle
                if storageManager.activeDirectory != nil && htmlContent != nil {
                    Button(action: toggleEditMode) {
                        Label(
                            isEditing ? "Done" : "Edit",
                            systemImage: isEditing ? "checkmark" : "pencil"
                        )
                    }
                }

                Button(action: {}) {
                    Label("Pin", systemImage: note.isPinned ? "pin.fill" : "pin")
                }

                Menu {
                    Button(action: {}) {
                        Label("Move to Folder", systemImage: "folder")
                    }
                    Button(action: {}) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                    Divider()
                    Button(role: .destructive, action: {}) {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Label("More", systemImage: "ellipsis.circle")
                }
            }
        }
        .onAppear {
            loadNoteContent()
        }
        .onChange(of: note.id) { _, _ in
            // Close previous note if editing
            if isEditing {
                CRDTManager.shared.closeNote(noteId: note.id)
            }
            isEditing = false
            loadNoteContent()
        }
        .onDisappear {
            // Close note when view disappears
            if isEditing {
                CRDTManager.shared.closeNote(noteId: note.id)
            }
        }
    }

    private func toggleEditMode() {
        if isEditing {
            // Switch to read-only mode
            CRDTManager.shared.closeNote(noteId: note.id)
            isEditing = false
            // Reload HTML to show any changes
            loadNoteContent()
        } else {
            // Switch to edit mode - load Yjs state
            loadNoteForEditing()
        }
    }

    private func loadNoteContent() {
        // Check if we have an active storage directory
        guard storageManager.activeDirectory != nil else {
            // No SD - show placeholder
            isLoading = false
            htmlContent = nil
            return
        }

        isLoading = true
        errorMessage = nil

        Task { @MainActor in
            do {
                let crdtManager = CRDTManager.shared

                if !crdtManager.isInitialized {
                    try crdtManager.initialize()
                }

                let html = try crdtManager.loadNoteContentAsHTML(noteId: note.id)
                htmlContent = html
                isLoading = false
            } catch {
                print("[NoteEditorView] Error loading note content: \(error)")
                errorMessage = "Could not load note content"
                isLoading = false
            }
        }
    }

    private func loadNoteForEditing() {
        guard storageManager.activeDirectory != nil else {
            return
        }

        Task { @MainActor in
            do {
                let crdtManager = CRDTManager.shared

                if !crdtManager.isInitialized {
                    try crdtManager.initialize()
                }

                let state = try crdtManager.loadNoteStateForEditor(noteId: note.id)
                yjsStateBase64 = state
                isEditing = true
            } catch {
                print("[NoteEditorView] Error loading note for editing: \(error)")
                errorMessage = "Could not open note for editing"
            }
        }
    }
}

/// Placeholder view until TipTap WebView is implemented
struct PlaceholderEditorView: View {
    let note: Note

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(note.title)
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text(note.preview)
                    .font(.body)

                Divider()

                Text("Note content will be rendered here using TipTap WebView")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .italic()

                Spacer()
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// Read-only WKWebView wrapper for displaying note HTML content
struct ReadOnlyNoteWebView: UIViewRepresentable {
    let htmlContent: String
    let noteTitle: String

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()

        // Disable JavaScript for read-only view (security)
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.backgroundColor = .systemBackground

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let styledHTML = wrapWithStyles(htmlContent)
        webView.loadHTMLString(styledHTML, baseURL: nil)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    /// Wrap HTML content with CSS styles for proper rendering
    private func wrapWithStyles(_ content: String) -> String {
        """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <style>
                :root {
                    color-scheme: light dark;
                }
                * {
                    box-sizing: border-box;
                }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 16px;
                    line-height: 1.6;
                    color: var(--text-color, #1a1a1a);
                    background-color: var(--bg-color, #ffffff);
                    padding: 16px;
                    margin: 0;
                    -webkit-text-size-adjust: 100%;
                }
                @media (prefers-color-scheme: dark) {
                    body {
                        --text-color: #f0f0f0;
                        --bg-color: #1c1c1e;
                        --code-bg: #2c2c2e;
                        --blockquote-border: #48484a;
                        --link-color: #0a84ff;
                        --task-border: #48484a;
                    }
                }
                @media (prefers-color-scheme: light) {
                    body {
                        --text-color: #1a1a1a;
                        --bg-color: #ffffff;
                        --code-bg: #f5f5f5;
                        --blockquote-border: #e0e0e0;
                        --link-color: #007aff;
                        --task-border: #e0e0e0;
                    }
                }
                h1 { font-size: 2em; margin: 0.67em 0; font-weight: 700; }
                h2 { font-size: 1.5em; margin: 0.75em 0; font-weight: 600; }
                h3 { font-size: 1.17em; margin: 0.83em 0; font-weight: 600; }
                h4, h5, h6 { font-size: 1em; margin: 1em 0; font-weight: 600; }
                p { margin: 1em 0; }
                a { color: var(--link-color); text-decoration: none; }
                strong { font-weight: 600; }
                em { font-style: italic; }
                code {
                    font-family: 'SF Mono', Menlo, Monaco, monospace;
                    font-size: 0.9em;
                    background-color: var(--code-bg);
                    padding: 0.2em 0.4em;
                    border-radius: 4px;
                }
                pre {
                    background-color: var(--code-bg);
                    padding: 12px 16px;
                    border-radius: 8px;
                    overflow-x: auto;
                    margin: 1em 0;
                }
                pre code {
                    background: none;
                    padding: 0;
                    font-size: 0.85em;
                }
                blockquote {
                    margin: 1em 0;
                    padding: 0.5em 0 0.5em 1em;
                    border-left: 4px solid var(--blockquote-border);
                    color: inherit;
                    opacity: 0.9;
                }
                ul, ol {
                    margin: 1em 0;
                    padding-left: 1.5em;
                }
                li { margin: 0.25em 0; }
                ul.task-list {
                    list-style: none;
                    padding-left: 0;
                }
                .task-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    margin: 0.5em 0;
                }
                .task-checkbox {
                    width: 18px;
                    height: 18px;
                    border: 2px solid var(--task-border);
                    border-radius: 4px;
                    flex-shrink: 0;
                    margin-top: 2px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .task-checkbox.checked {
                    background-color: var(--link-color);
                    border-color: var(--link-color);
                }
                .task-checkbox.checked::after {
                    content: '✓';
                    color: white;
                    font-size: 12px;
                    font-weight: bold;
                }
                .task-content.completed {
                    text-decoration: line-through;
                    opacity: 0.7;
                }
                hr {
                    border: none;
                    border-top: 1px solid var(--blockquote-border);
                    margin: 2em 0;
                }
                img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 8px;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 1em 0;
                }
                th, td {
                    border: 1px solid var(--blockquote-border);
                    padding: 8px 12px;
                    text-align: left;
                }
                th {
                    background-color: var(--code-bg);
                    font-weight: 600;
                }
                s, strike { text-decoration: line-through; }
                u { text-decoration: underline; }
                mark {
                    background-color: #fff3b0;
                    padding: 0.1em 0.2em;
                    border-radius: 2px;
                }
                @media (prefers-color-scheme: dark) {
                    mark { background-color: #665c00; color: #fff; }
                }
                sup { vertical-align: super; font-size: 0.8em; }
                sub { vertical-align: sub; font-size: 0.8em; }
            </style>
        </head>
        <body>
            \(content)
        </body>
        </html>
        """
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        let parent: ReadOnlyNoteWebView

        init(_ parent: ReadOnlyNoteWebView) {
            self.parent = parent
        }

        @MainActor
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
            // Allow initial load, but open external links in Safari
            if navigationAction.navigationType == .linkActivated, let url = navigationAction.request.url {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}

/// WKWebView wrapper for TipTap editor
struct TipTapWebView: UIViewRepresentable {
    let noteId: String
    let yjsStateBase64: String?
    let htmlContent: String?
    let onContentChanged: ((String, Any) -> Void)?
    let onReady: (() -> Void)?
    let onError: ((String) -> Void)?

    init(
        noteId: String,
        yjsStateBase64: String? = nil,
        htmlContent: String? = nil,
        onContentChanged: ((String, Any) -> Void)? = nil,
        onReady: (() -> Void)? = nil,
        onError: ((String) -> Void)? = nil
    ) {
        self.noteId = noteId
        self.yjsStateBase64 = yjsStateBase64
        self.htmlContent = htmlContent
        self.onContentChanged = onContentChanged
        self.onReady = onReady
        self.onError = onError
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()

        // Enable JavaScript
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        // Set up message handlers for Swift ↔ JavaScript communication
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "noteCove")
        configuration.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.backgroundColor = .systemBackground

        // Store webView reference in coordinator
        context.coordinator.webView = webView

        // Load the editor HTML from bundle
        if let htmlURL = Bundle.main.url(forResource: "ios-editor", withExtension: "html") {
            webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        } else {
            print("[TipTapWebView] Error: Could not find ios-editor.html in bundle")
            onError?("Editor resources not found")
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Content is loaded when editor signals ready
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let parent: TipTapWebView
        weak var webView: WKWebView?
        private var hasLoadedContent = false

        init(_ parent: TipTapWebView) {
            self.parent = parent
        }

        @MainActor
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  let action = body["action"] as? String else { return }

            switch action {
            case "ready":
                print("[TipTapWebView] Editor ready")
                parent.onReady?()
                loadContent()

            case "loaded":
                print("[TipTapWebView] Note loaded: \(body["noteId"] ?? "unknown")")
                hasLoadedContent = true

            case "contentChanged":
                guard let noteId = body["noteId"] as? String,
                      let json = body["json"] else { return }
                parent.onContentChanged?(noteId, json)

            case "selectionChanged":
                // Could expose formatting state to toolbar in future
                break

            case "focused":
                print("[TipTapWebView] Editor focused")

            case "blurred":
                print("[TipTapWebView] Editor blurred")

            case "error":
                let errorMessage = body["message"] as? String ?? "Unknown error"
                print("[TipTapWebView] Error: \(errorMessage)")
                parent.onError?(errorMessage)

            default:
                print("[TipTapWebView] Unknown action: \(action)")
            }
        }

        private func loadContent() {
            guard !hasLoadedContent else { return }

            // Prefer Yjs state if available, otherwise use HTML
            if let yjsState = parent.yjsStateBase64, !yjsState.isEmpty {
                callJS("NoteCoveEditor.loadFromYjs('\(parent.noteId)', '\(yjsState)')")
            } else if let html = parent.htmlContent {
                // Escape the HTML for JavaScript
                let escapedHTML = html
                    .replacingOccurrences(of: "\\", with: "\\\\")
                    .replacingOccurrences(of: "'", with: "\\'")
                    .replacingOccurrences(of: "\n", with: "\\n")
                    .replacingOccurrences(of: "\r", with: "\\r")
                callJS("NoteCoveEditor.loadFromHTML('\(parent.noteId)', '\(escapedHTML)')")
            } else {
                // New document
                callJS("NoteCoveEditor.newDocument('\(parent.noteId)')")
            }
        }

        private func callJS(_ script: String) {
            webView?.evaluateJavaScript(script) { result, error in
                if let error = error {
                    print("[TipTapWebView] JS error: \(error.localizedDescription)")
                }
            }
        }

        // MARK: - WKNavigationDelegate

        @MainActor
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            print("[TipTapWebView] Page loaded")
        }

        @MainActor
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            print("[TipTapWebView] Navigation failed: \(error.localizedDescription)")
            parent.onError?("Failed to load editor")
        }
    }

    // MARK: - Editor Commands (for toolbar integration)

    static func toggleBold(in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.toggleBold()", completionHandler: nil)
    }

    static func toggleItalic(in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.toggleItalic()", completionHandler: nil)
    }

    static func toggleUnderline(in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.toggleUnderline()", completionHandler: nil)
    }

    static func toggleStrike(in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.toggleStrike()", completionHandler: nil)
    }

    static func toggleCode(in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.toggleCode()", completionHandler: nil)
    }

    static func toggleBulletList(in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.toggleBulletList()", completionHandler: nil)
    }

    static func toggleOrderedList(in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.toggleOrderedList()", completionHandler: nil)
    }

    static func toggleTaskList(in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.toggleTaskList()", completionHandler: nil)
    }

    static func toggleBlockquote(in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.toggleBlockquote()", completionHandler: nil)
    }

    static func toggleCodeBlock(in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.toggleCodeBlock()", completionHandler: nil)
    }

    static func setHeading(level: Int, in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.toggleHeading(\(level))", completionHandler: nil)
    }

    static func setParagraph(in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.setParagraph()", completionHandler: nil)
    }

    static func undo(in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.undo()", completionHandler: nil)
    }

    static func redo(in webView: WKWebView?) {
        webView?.evaluateJavaScript("NoteCoveEditor.redo()", completionHandler: nil)
    }
}

#Preview {
    NavigationStack {
        NoteEditorView(note: Note(
            id: "preview",
            title: "Sample Note",
            preview: "This is a sample note for preview purposes.",
            folderId: nil,
            createdAt: Date(),
            modifiedAt: Date(),
            isPinned: false
        ))
    }
}
