import SwiftUI
import WebKit

/// Note viewer/editor using WKWebView with TipTap
struct NoteEditorView: View {
    let note: Note
    @State private var htmlContent: String?
    @State private var isLoading = true
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
            loadNoteContent()
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

/// WKWebView wrapper for TipTap editor (to be implemented in Phase 3)
struct TipTapWebView: UIViewRepresentable {
    let noteId: String
    let content: String

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

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // TODO: Load TipTap editor with note content
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let parent: TipTapWebView

        init(_ parent: TipTapWebView) {
            self.parent = parent
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            // Handle messages from JavaScript
            guard let body = message.body as? [String: Any] else { return }

            if let action = body["action"] as? String {
                switch action {
                case "contentChanged":
                    // TODO: Handle content changes, update CRDT
                    break
                default:
                    break
                }
            }
        }
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
