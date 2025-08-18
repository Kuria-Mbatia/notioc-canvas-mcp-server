import { expect, test, describe } from "vitest";
import { findBestMatch } from "@/lib/search";

describe("search", () => {
  describe("findBestMatch", () => {
    const testItems = [
      { id: 1, name: "Introduction to Computer Science", course_code: "CS101", description: "Basic programming concepts" },
      { id: 2, name: "Advanced Data Structures", course_code: "CS201", description: "Trees, graphs, and algorithms" },
      { id: 3, name: "Web Development", course_code: "CS301", description: "HTML, CSS, JavaScript" },
      { id: 4, name: "Machine Learning", course_code: "CS401", description: "AI and neural networks" },
      { id: 5, name: "Database Systems", course_code: "CS202", description: "SQL and database design" },
    ];

    test("should find exact match by name", () => {
      const result = findBestMatch("Web Development", testItems, ["name"]);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Web Development");
      expect(result?.course_code).toBe("CS301");
    });

    test("should find exact match by course code", () => {
      const result = findBestMatch("CS401", testItems, ["course_code"]);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Machine Learning");
      expect(result?.course_code).toBe("CS401");
    });

    test("should find fuzzy match with partial string", () => {
      const result = findBestMatch("data struct", testItems, ["name"]);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Advanced Data Structures");
    });

    test("should search across multiple keys", () => {
      const result = findBestMatch("neural", testItems, ["name", "description"]);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Machine Learning");
    });

    test("should handle case insensitive search", () => {
      const result = findBestMatch("COMPUTER SCIENCE", testItems, ["name"]);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Introduction to Computer Science");
    });

    test("should return null for no match", () => {
      const result = findBestMatch("Quantum Physics", testItems, ["name"]);
      
      expect(result).toBeNull();
    });

    test("should return null for empty query", () => {
      const result = findBestMatch("", testItems, ["name"]);
      
      expect(result).toBeNull();
    });

    test("should return null for empty items array", () => {
      const result = findBestMatch("test", [], ["name"]);
      
      expect(result).toBeNull();
    });

    test("should handle items without specified keys", () => {
      const itemsWithoutName = [
        { id: 1, title: "Test Item", description: "A test" },
        { id: 2, title: "Another Item", description: "Another test" },
      ];
      
      const result = findBestMatch("Test", itemsWithoutName, ["name"]);
      
      expect(result).toBeNull();
    });

    test("should find match with typos using fuzzy search", () => {
      const result = findBestMatch("machien lerning", testItems, ["name"]);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Machine Learning");
    });

    test("should prioritize better matches", () => {
      const itemsWithSimilarNames = [
        { id: 1, name: "Introduction to Programming", category: "beginner" },
        { id: 2, name: "Advanced Programming", category: "advanced" },
        { id: 3, name: "Programming Fundamentals", category: "beginner" },
      ];
      
      const result = findBestMatch("Programming", itemsWithSimilarNames, ["name"]);
      
      expect(result).not.toBeNull();
      // Should match one of the items that has "Programming" in the name
      expect(result?.name).toContain("Programming");
    });

    test("should work with different object structures", () => {
      const files = [
        { filename: "document.pdf", size: 1024, type: "pdf" },
        { filename: "presentation.pptx", size: 2048, type: "powerpoint" },
        { filename: "spreadsheet.xlsx", size: 512, type: "excel" },
      ];
      
      const result = findBestMatch("presentation", files, ["filename"]);
      
      expect(result).not.toBeNull();
      expect(result?.filename).toBe("presentation.pptx");
    });

    test("should handle special characters in search", () => {
      const itemsWithSpecialChars = [
        { name: "C++ Programming", language: "cpp" },
        { name: "C# Development", language: "csharp" },
        { name: "JavaScript & Node.js", language: "javascript" },
      ];
      
      const result = findBestMatch("C++", itemsWithSpecialChars, ["name"]);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe("C++ Programming");
    });

    test("should respect fuzzy search threshold", () => {
      // Test with a very different string that should not match
      const result = findBestMatch("xyzzyx", testItems, ["name"]);
      
      expect(result).toBeNull();
    });

    test("should work with single item array", () => {
      const singleItem = [{ name: "Single Course", code: "SC001" }];
      
      const result = findBestMatch("Single", singleItem, ["name"]);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Single Course");
    });

    test("should handle undefined/null values in items", () => {
      const itemsWithNulls = [
        { id: 1, name: "Valid Item", description: "Has description" },
        { id: 2, name: null, description: "No name" },
        { id: 3, name: "Another Valid", description: null },
      ];
      
      const result = findBestMatch("Valid", itemsWithNulls, ["name"]);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Valid Item");
    });

    test("should work with nested object keys", () => {
      const itemsWithNested = [
        { id: 1, details: { title: "Nested Title", author: "John Doe" } },
        { id: 2, details: { title: "Another Title", author: "Jane Smith" } },
      ];
      
      const result = findBestMatch("Nested", itemsWithNested, ["details.title"]);
      
      expect(result).not.toBeNull();
      expect(result?.details.title).toBe("Nested Title");
    });

    test("should handle numeric values in search keys", () => {
      const itemsWithNumbers = [
        { name: "Course 101", level: 101, credits: 3 },
        { name: "Course 201", level: 201, credits: 4 },
        { name: "Course 301", level: 301, credits: 3 },
      ];
      
      const result = findBestMatch("201", itemsWithNumbers, ["name", "level"]);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Course 201");
    });
  });
});
