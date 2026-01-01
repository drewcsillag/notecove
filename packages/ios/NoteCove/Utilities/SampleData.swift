import Foundation

/// Sample data for development and testing
/// This will be replaced with real CRDT data in Phase 2
enum SampleData {
    /// Sample folders for UI testing
    static let folders: [Folder] = [
        Folder(id: "folder-work", name: "Work", parentId: nil, order: 0),
        Folder(id: "folder-personal", name: "Personal", parentId: nil, order: 1),
        Folder(id: "folder-projects", name: "Projects", parentId: "folder-work", order: 0),
        Folder(id: "folder-meetings", name: "Meetings", parentId: "folder-work", order: 1),
        Folder(id: "folder-travel", name: "Travel", parentId: "folder-personal", order: 0),
    ]

    /// Sample notes for UI testing
    static let notes: [Note] = [
        Note(
            id: "note-1",
            title: "Project Planning",
            preview: "Key milestones for Q1 2025:\n- Complete iOS app MVP\n- Launch beta testing...",
            folderId: "folder-projects",
            createdAt: Date().addingTimeInterval(-86400 * 7),
            modifiedAt: Date().addingTimeInterval(-3600),
            isPinned: true
        ),
        Note(
            id: "note-2",
            title: "Team Meeting Notes",
            preview: "Attendees: Alice, Bob, Charlie\n\nDiscussion points:\n1. Feature priorities...",
            folderId: "folder-meetings",
            createdAt: Date().addingTimeInterval(-86400 * 3),
            modifiedAt: Date().addingTimeInterval(-86400),
            isPinned: false
        ),
        Note(
            id: "note-3",
            title: "Trip to Japan",
            preview: "Itinerary:\n- Day 1: Arrive in Tokyo\n- Day 2: Senso-ji Temple, Akihabara...",
            folderId: "folder-travel",
            createdAt: Date().addingTimeInterval(-86400 * 30),
            modifiedAt: Date().addingTimeInterval(-86400 * 10),
            isPinned: false
        ),
        Note(
            id: "note-4",
            title: "Quick Notes",
            preview: "Random thoughts and ideas to explore later...",
            folderId: nil,
            createdAt: Date().addingTimeInterval(-86400 * 2),
            modifiedAt: Date().addingTimeInterval(-7200),
            isPinned: false
        ),
        Note(
            id: "note-5",
            title: "Code Snippets",
            preview: "```swift\nfunc greet(name: String) -> String {\n    return \"Hello, \\(name)!\"...",
            folderId: "folder-projects",
            createdAt: Date().addingTimeInterval(-86400 * 14),
            modifiedAt: Date().addingTimeInterval(-86400 * 5),
            isPinned: false
        ),
    ]

    /// Get folders organized as a tree
    static func folderTree() -> [Folder] {
        folders.filter { $0.parentId == nil }
    }

    /// Get child folders for a parent
    static func childFolders(of parentId: String) -> [Folder] {
        folders.filter { $0.parentId == parentId }.sorted { $0.order < $1.order }
    }

    /// Get notes for a folder (nil for all notes)
    static func notes(in folderId: String?) -> [Note] {
        let filtered: [Note]
        if let folderId {
            filtered = notes.filter { $0.folderId == folderId }
        } else {
            filtered = notes
        }
        // Sort: pinned first, then by modified date descending
        return filtered.sorted { note1, note2 in
            if note1.isPinned != note2.isPinned {
                return note1.isPinned
            }
            return note1.modifiedAt > note2.modifiedAt
        }
    }

    /// Sample note content (HTML-ish for TipTap rendering later)
    static let sampleNoteContent = """
    <h1>Project Planning</h1>
    <p>Key milestones for Q1 2025:</p>
    <ul>
        <li>Complete iOS app MVP</li>
        <li>Launch beta testing</li>
        <li>Gather user feedback</li>
    </ul>
    <h2>Timeline</h2>
    <p>We're targeting a <strong>March release</strong> with the following phases:</p>
    <ol>
        <li>Phase 1: Core functionality</li>
        <li>Phase 2: Read-only sync</li>
        <li>Phase 3: Editing support</li>
    </ol>
    """
}
