import { describe, it, expect } from "vitest";
import {
  base_version,
  compare_prerelease,
  format_prerelease,
  is_prerelease,
  split_prerelease,
} from "../src/lib/versioning/prerelease.ts";

describe("format_prerelease", () => {
  it("builds a pre-release string", () => {
    expect(format_prerelease("1.2.3", "rc", "3")).toBe("1.2.3-rc.3");
    expect(format_prerelease("2025.1.2", "preview", "a1b2c3d")).toBe("2025.1.2-preview.a1b2c3d");
  });

  it("rejects an invalid channel", () => {
    expect(() => format_prerelease("1.2.3", "RC", "3")).toThrow("Invalid pre-release channel");
    expect(() => format_prerelease("1.2.3", "1alpha", "3")).toThrow("Invalid pre-release channel");
  });

  it("rejects an invalid id", () => {
    expect(() => format_prerelease("1.2.3", "rc", "a_b")).toThrow("Invalid pre-release id");
    expect(() => format_prerelease("1.2.3", "rc", "A1")).toThrow("Invalid pre-release id");
  });
});

describe("split_prerelease / base_version / is_prerelease", () => {
  it("splits a well-formed pre-release", () => {
    expect(split_prerelease("1.2.3-rc.3")).toEqual({
      base: "1.2.3",
      suffix: { channel: "rc", id: "3" },
    });
  });

  it("treats a plain version as base-only", () => {
    expect(split_prerelease("1.2.3")).toEqual({ base: "1.2.3", suffix: null });
  });

  it("does not split a malformed suffix", () => {
    expect(split_prerelease("1.2.3-RC.1")).toEqual({ base: "1.2.3-RC.1", suffix: null });
    expect(split_prerelease("1.2.3-1")).toEqual({ base: "1.2.3-1", suffix: null });
  });

  it("base_version strips the suffix", () => {
    expect(base_version("1.2.3-rc.3")).toBe("1.2.3");
    expect(base_version("1.2.3")).toBe("1.2.3");
  });

  it("is_prerelease detects the suffix", () => {
    expect(is_prerelease("1.2.3-rc.3")).toBe(true);
    expect(is_prerelease("1.2.3")).toBe(false);
  });
});

describe("compare_prerelease", () => {
  const s = (channel: string, id: string) => ({ channel, id });

  it("ranks no-suffix above suffix", () => {
    expect(compare_prerelease(null, s("rc", "0"))).toBe(1);
    expect(compare_prerelease(s("rc", "0"), null)).toBe(-1);
    expect(compare_prerelease(null, null)).toBe(0);
  });

  it("orders by channel then id", () => {
    expect(compare_prerelease(s("alpha", "0"), s("beta", "0"))).toBe(-1);
    expect(compare_prerelease(s("rc", "1"), s("rc", "2"))).toBe(-1);
    expect(compare_prerelease(s("rc", "10"), s("rc", "2"))).toBe(1); // numeric, not lexical
    expect(compare_prerelease(s("rc", "3"), s("rc", "3"))).toBe(0);
  });
});
