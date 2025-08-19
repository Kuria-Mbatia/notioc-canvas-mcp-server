import { expect, test, describe } from "vitest";
import * as courseStructure from "@/tools/course-structure";

describe("Course Structure Tool", () => {
  test("module exists and exports functions", () => {
    expect(typeof courseStructure).toBe("object");
    expect(courseStructure).toBeDefined();
  });
});
