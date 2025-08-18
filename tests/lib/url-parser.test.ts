import { expect, test, describe } from "vitest";
import { parseCanvasUrl, isCanvasUrl, extractPageSlug } from "@/lib/url-parser";

describe("extractPageSlug", () => {
  test("extracts a page URLs slug", () => {
    const url =
      "https://psu.instructure.com/courses/2422265/pages/l12-overview?module_item_id=44950494";
    const result = extractPageSlug(url);

    expect(result).toBe("l12-overview");
  });

  test("returns input if not a canvas url", () => {
    const url = "test-input";
    const result = extractPageSlug(url);

    expect(result).toBe("test-input");
  });

  test("extracts slug from URL without query parameters", () => {
    const url = "https://psu.instructure.com/courses/2422265/pages/introduction";
    const result = extractPageSlug(url);

    expect(result).toBe("introduction");
  });

  test("extracts slug with hyphens and numbers", () => {
    const url = "https://psu.instructure.com/courses/2422265/pages/week-1-assignment-instructions";
    const result = extractPageSlug(url);

    expect(result).toBe("week-1-assignment-instructions");
  });

  test("returns input for malformed URLs", () => {
    const url = "not-a-valid-url";
    const result = extractPageSlug(url);

    expect(result).toBe("not-a-valid-url");
  });

  test("returns input for empty string", () => {
    const url = "";
    const result = extractPageSlug(url);

    expect(result).toBe("");
  });
});

describe("isCanvasUrl", () => {
  test("identifies canvas like URL with instructure.com domain", () => {
    const url = "https://psu.instructure.com/courses/78901";
    const result = isCanvasUrl(url);

    expect(result).toBe(true);
  });

  test("identifies canvas like URL with /courses/ path", () => {
    const url = "https://myschool.edu/courses/12345";
    const result = isCanvasUrl(url);

    expect(result).toBe(true);
  });

  test("identifies custom Canvas domain with instructure", () => {
    const url = "https://canvas.university.instructure.com/courses/456";
    const result = isCanvasUrl(url);

    expect(result).toBe(true);
  });

  test("identifies non-canvas like URL", () => {
    const url = "https://www.google.com/";
    const result = isCanvasUrl(url);

    expect(result).toBe(false);
  });

  test("rejects URL without courses path", () => {
    const url = "https://example.com/classes/123";
    const result = isCanvasUrl(url);

    expect(result).toBe(false);
  });

  test("handles malformed URLs gracefully", () => {
    const url = "not-a-valid-url";
    const result = isCanvasUrl(url);

    expect(result).toBe(false);
  });

  test("handles empty string", () => {
    const url = "";
    const result = isCanvasUrl(url);

    expect(result).toBe(false);
  });

  test("handles URLs with different protocols", () => {
    const httpUrl = "http://psu.instructure.com/courses/123";
    const httpsUrl = "https://psu.instructure.com/courses/123";
    
    expect(isCanvasUrl(httpUrl)).toBe(true);
    expect(isCanvasUrl(httpsUrl)).toBe(true);
  });
});

describe("parseCanvasUrl", () => {
  test("extracts courseId", () => {
    const url = "https://psu.instructure.com/courses/2422265";

    const result = parseCanvasUrl(url);

    expect(result).toMatchObject({
      courseId: "2422265",
    });
  });

  test("extracts pageUrl", () => {
    const url =
      "https://psu.instructure.com/courses/2422265/pages/l12-overview?module_item_id=44950494";

    const result = parseCanvasUrl(url);

    expect(result).toMatchObject({
      pageUrl: "l12-overview",
    });
  });

  test("extracts discussionId", () => {
    const url =
      "https://psu.instructure.com/courses/2422265/discussion_topics/8765432";

    const result = parseCanvasUrl(url);

    expect(result).toMatchObject({
      discussionId: "8765432",
    });
  });

  test("extracts assignmentId", () => {
    const url =
      "https://psu.instructure.com/courses/2422265/assignments/15234567";

    const result = parseCanvasUrl(url);

    expect(result).toMatchObject({
      assignmentId: "15234567",
    });
  });

  test("extracts moduleId", () => {
    const url = "https://psu.instructure.com/courses/2422265/modules/123456";

    const result = parseCanvasUrl(url);

    expect(result).toMatchObject({
      moduleId: "123456",
    });
  });

  test("extracts moduleItemId", () => {
    const url =
      "https://psu.instructure.com/courses/2422265/pages/l12-overview?module_item_id=44950494&other_param=test";

    const result = parseCanvasUrl(url);

    expect(result).toMatchObject({
      moduleItemId: "44950494",
    });
  });

  test("extracts baseUrl", () => {
    const url =
      "https://psu.instructure.com/courses/2422265/assignments/15234567";

    const result = parseCanvasUrl(url);

    expect(result).toMatchObject({
      baseUrl: "https://psu.instructure.com",
    });
  });

  test("extracts all components from a complex Canvas page URL", () => {
    const url =
      "https://psu.instructure.com/courses/2422265/pages/l12-overview?module_item_id=44950494&other_param=test";

    const result = parseCanvasUrl(url);

    expect(result).toEqual({
      baseUrl: "https://psu.instructure.com",
      courseId: "2422265",
      pageUrl: "l12-overview",
      moduleItemId: "44950494",
    });

    // Verify that other query parameters are ignored (function only extracts module_item_id)
    expect(result.assignmentId).toBeUndefined();
    expect(result.discussionId).toBeUndefined();
    expect(result.moduleId).toBeUndefined();
  });

  test("handles malformed URLs gracefully", () => {
    const url = "not-a-valid-url";
    const result = parseCanvasUrl(url);

    expect(result).toEqual({});
  });

  test("handles empty string", () => {
    const url = "";
    const result = parseCanvasUrl(url);

    expect(result).toEqual({});
  });

  test("handles URL without course ID", () => {
    const url = "https://psu.instructure.com/dashboard";
    const result = parseCanvasUrl(url);

    expect(result).toEqual({
      baseUrl: "https://psu.instructure.com",
    });
  });

  test("extracts multiple query parameters correctly", () => {
    const url = "https://psu.instructure.com/courses/123/pages/test?module_item_id=456&other=value&another=param";
    const result = parseCanvasUrl(url);

    expect(result).toEqual({
      baseUrl: "https://psu.instructure.com",
      courseId: "123",
      pageUrl: "test",
      moduleItemId: "456",
    });
  });

  test("handles URLs with different Canvas domains", () => {
    const url = "https://canvas.university.edu/courses/789/assignments/101";
    const result = parseCanvasUrl(url);

    expect(result).toEqual({
      baseUrl: "https://canvas.university.edu",
      courseId: "789",
      assignmentId: "101",
    });
  });

  test("handles URLs with port numbers", () => {
    const url = "https://localhost:3000/courses/123/pages/test";
    const result = parseCanvasUrl(url);

    expect(result).toEqual({
      baseUrl: "https://localhost:3000",
      courseId: "123",
      pageUrl: "test",
    });
  });

  test("handles URLs with fragments", () => {
    const url = "https://psu.instructure.com/courses/123/pages/test#section1";
    const result = parseCanvasUrl(url);

    expect(result).toEqual({
      baseUrl: "https://psu.instructure.com",
      courseId: "123",
      pageUrl: "test",
    });
  });

  test("handles null module_item_id parameter", () => {
    const url = "https://psu.instructure.com/courses/123/pages/test?module_item_id=";
    const result = parseCanvasUrl(url);

    expect(result.moduleItemId).toBeUndefined();
  });
});
