import { describe, it, expect } from "vitest";
import { formatTimestamp, formatElapsed, formatDelta } from "../src/terminalUi";

describe("formatTimestamp", () => {
  it("formats a date object", () => {
    const date = new Date("2026-01-15T14:30:00Z");
    const result = formatTimestamp(date);
    expect(result).toContain("Jan");
    expect(result).toContain("2026");
  });

  it("formats a date string", () => {
    const result = formatTimestamp("2026-06-01T10:00:00Z");
    expect(result).toContain("Jun");
    expect(result).toContain("2026");
  });

  it("removes comma from formatted output", () => {
    const result = formatTimestamp(new Date("2026-03-15T12:00:00Z"));
    expect(result).not.toContain(",");
  });
});

describe("formatElapsed", () => {
  it("returns ms for values under 1000", () => {
    expect(formatElapsed(500)).toBe("500 ms");
    expect(formatElapsed(0)).toBe("0 ms");
    expect(formatElapsed(999)).toBe("999 ms");
  });

  it("returns seconds for values under 60000", () => {
    expect(formatElapsed(1000)).toBe("1.0 s");
    expect(formatElapsed(1500)).toBe("1.5 s");
    expect(formatElapsed(10000)).toBe("10 s");
    expect(formatElapsed(59999)).toBe("60 s");
  });

  it("returns minutes and seconds for values >= 60000", () => {
    expect(formatElapsed(60000)).toBe("1m 0s");
    expect(formatElapsed(90000)).toBe("1m 30s");
    expect(formatElapsed(3600000)).toBe("60m 0s");
  });

  it("rounds seconds for the minute format", () => {
    expect(formatElapsed(61000)).toBe("1m 1s");
    expect(formatElapsed(119000)).toBe("1m 59s");
  });
});

describe("formatDelta", () => {
  it("returns gray 0 for zero", () => {
    const result = formatDelta(0);
    expect(result).toContain("0");
  });

  it("returns red +value for positive", () => {
    const result = formatDelta(5);
    expect(result).toContain("+5");
  });

  it("returns green value for negative", () => {
    const result = formatDelta(-3);
    expect(result).toContain("-3");
  });
});
