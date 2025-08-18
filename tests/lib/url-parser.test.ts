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
});

describe("isCanvasUrl", () => {
  test("identifies canvas like URL", () => {
    const url = "https://psu.instructure.com/courses/78901";
    const result = isCanvasUrl(url);

    expect(result).toBe(true);
  });

  test("identifies non-canvas like URL", () => {
    const url = "https://www.google.com/";
    const result = isCanvasUrl(url);

    expect(result).toBe(false);
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
});
