import { describe, it, expect } from "vitest";
import { formatDuration, friendlyError, localDateStr, defaultDate } from "./utils";

describe("formatDuration", () => {
  it("formats seconds under an hour as mm:ss", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(600)).toBe("10:00");
    expect(formatDuration(3599)).toBe("59:59");
  });

  it("formats seconds over an hour as h:mm:ss", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(7322)).toBe("2:02:02");
  });

  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0:00");
  });
});

describe("friendlyError", () => {
  it("maps token-expired message", () => {
    expect(friendlyError("Token expired")).toBe("Session expired. Please sign in again.");
  });

  it("maps rate limit message", () => {
    expect(friendlyError("429 Too Many Requests")).toBe("Rate limit reached. Please try again in 15 minutes.");
  });

  it("maps database error", () => {
    expect(friendlyError("postgres connection refused")).toBe("Database connection error. Please try again later.");
  });

  it("maps network error", () => {
    expect(friendlyError("Failed to fetch")).toBe("Network error. Check your connection and try again.");
  });

  it("returns original message for unknown errors", () => {
    expect(friendlyError("something weird happened")).toBe("something weird happened");
  });
});

describe("localDateStr", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(localDateStr(new Date(2024, 0, 5))).toBe("2024-01-05");
    expect(localDateStr(new Date(2024, 11, 31))).toBe("2024-12-31");
  });
});

describe("defaultDate", () => {
  it("returns Jan 1 of the current year", () => {
    const year = new Date().getFullYear();
    expect(defaultDate()).toBe(`${year}-01-01`);
  });
});
