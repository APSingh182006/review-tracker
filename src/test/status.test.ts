import { describe, it, expect } from "vitest";
import { groupStatus } from "@/lib/status";

describe("groupStatus", () => {
  it("0/5 reviews is Not Started", () => expect(groupStatus(0, false)).toBe("not_started"));
  it("1-4 reviews is In Progress", () => expect(groupStatus(3, false)).toBe("in_progress"));
  it("5/5 without final submission is In Progress", () => expect(groupStatus(5, false)).toBe("in_progress"));
  it("5/5 with final submission is Completed", () => expect(groupStatus(5, true)).toBe("completed"));
});
