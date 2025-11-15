//
//  TagExtractorTests.swift
//  NoteCove Tests
//
//  Created by NoteCove Contributors
//  Copyright © 2025 NoteCove Contributors. All rights reserved.
//

import XCTest
@testable import NoteCove

final class TagExtractorTests: XCTestCase {
    func testExtractSingleTag() {
        let text = "This is a note with #tag1 in it"
        let tags = TagExtractor.extractTags(from: text)
        XCTAssertEqual(tags, ["tag1"])
    }

    func testExtractMultipleTags() {
        let text = "Note with #tag1 and #tag2 and #tag3"
        let tags = TagExtractor.extractTags(from: text)
        XCTAssertEqual(tags.sorted(), ["tag1", "tag2", "tag3"])
    }

    func testExtractTagsWithUnderscores() {
        let text = "#tag_with_underscores and #another_tag"
        let tags = TagExtractor.extractTags(from: text)
        XCTAssertEqual(tags.sorted(), ["another_tag", "tag_with_underscores"])
    }

    func testExtractTagsWithNumbers() {
        let text = "#tag123 and #123tag and #tag1tag2"
        let tags = TagExtractor.extractTags(from: text)
        // #123tag should NOT match (must start with letter)
        XCTAssertEqual(tags.sorted(), ["tag123", "tag1tag2"])
    }

    func testCaseInsensitive() {
        let text = "#TAG1 and #Tag1 and #tag1"
        let tags = TagExtractor.extractTags(from: text)
        // All should be normalized to lowercase and deduplicated
        XCTAssertEqual(tags, ["tag1"])
    }

    func testMaxLengthEnforcement() {
        let longTag = String(repeating: "a", count: 60)
        let text = "#\(longTag)"
        let tags = TagExtractor.extractTags(from: text)
        XCTAssertEqual(tags.count, 1)
        XCTAssertEqual(tags[0].count, 50) // Should be truncated to 50
    }

    func testNoTags() {
        let text = "This is a note without any tags"
        let tags = TagExtractor.extractTags(from: text)
        XCTAssertEqual(tags, [])
    }

    func testHashtagMustStartWithLetter() {
        let text = "#1invalid #valid #_invalid #-invalid"
        let tags = TagExtractor.extractTags(from: text)
        XCTAssertEqual(tags, ["valid"])
    }

    func testMultilineText() {
        let text = """
        First line with #tag1
        Second line with #tag2
        Third line with #tag3
        """
        let tags = TagExtractor.extractTags(from: text)
        XCTAssertEqual(tags.sorted(), ["tag1", "tag2", "tag3"])
    }

    func testDuplicateTags() {
        let text = "Note with #tag1 and #tag1 and #TAG1"
        let tags = TagExtractor.extractTags(from: text)
        // Should only return unique tags (case-insensitive)
        XCTAssertEqual(tags, ["tag1"])
    }

    func testTagsInDifferentContexts() {
        let text = "#tag1 in the beginning, middle #tag2 text, and #tag3 at the end"
        let tags = TagExtractor.extractTags(from: text)
        XCTAssertEqual(tags.sorted(), ["tag1", "tag2", "tag3"])
    }

    func testEmptyString() {
        let text = ""
        let tags = TagExtractor.extractTags(from: text)
        XCTAssertEqual(tags, [])
    }

    func testHashtagWithPunctuation() {
        let text = "#tag1, #tag2. #tag3! #tag4?"
        let tags = TagExtractor.extractTags(from: text)
        XCTAssertEqual(tags.sorted(), ["tag1", "tag2", "tag3", "tag4"])
    }
}
