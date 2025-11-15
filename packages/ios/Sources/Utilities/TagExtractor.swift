//
//  TagExtractor.swift
//  NoteCove
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import Foundation

/// Utility for extracting hashtags from note content
///
/// Matches the tag extraction logic from desktop:
/// - Pattern: #[a-zA-Z][a-zA-Z0-9_]*
/// - Tags are case-insensitive (normalized to lowercase)
/// - Maximum tag length: 50 characters
public struct TagExtractor {
    /// Maximum length for a tag
    public static let maxTagLength = 50

    /// Regular expression pattern for matching hashtags
    /// Must start with # followed by a letter, then letters/numbers/underscores
    private static let hashtagPattern = #"#[a-zA-Z][a-zA-Z0-9_]*"#

    /// Extract all hashtags from text content
    ///
    /// - Parameter text: The text to extract tags from
    /// - Returns: Array of unique tag names (lowercase, without # prefix)
    public static func extractTags(from text: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: hashtagPattern, options: []) else {
            print("[TagExtractor] Failed to create regex pattern")
            return []
        }

        let range = NSRange(text.startIndex..., in: text)
        let matches = regex.matches(in: text, options: [], range: range)

        var tags = Set<String>()

        for match in matches {
            guard let matchRange = Range(match.range, in: text) else {
                continue
            }

            var tag = String(text[matchRange])

            // Remove # prefix
            tag = String(tag.dropFirst())

            // Convert to lowercase
            tag = tag.lowercased()

            // Enforce max length
            if tag.count > maxTagLength {
                tag = String(tag.prefix(maxTagLength))
            }

            tags.insert(tag)
        }

        return Array(tags).sorted()
    }
}
