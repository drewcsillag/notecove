import SwiftUI
import WebKit

/// Note viewer/editor using WKWebView with TipTap
struct NoteEditorView: View {
    let note: Note

    var body: some View {
        VStack(spacing: 0) {
            // Placeholder for TipTap WebView
            // TODO: Implement actual TipTap integration in Phase 2
            PlaceholderEditorView(note: note)
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

/// WKWebView wrapper for TipTap editor (to be implemented in Phase 2)
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
