import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "./useTheme";

describe("useTheme", () => {
  it("toggling in one component updates every component using the hook", () => {
    const a = renderHook(() => useTheme());
    const b = renderHook(() => useTheme());
    const start = a.result.current.theme;
    act(() => a.result.current.toggle());
    expect(a.result.current.theme).not.toBe(start);
    expect(b.result.current.theme).toBe(a.result.current.theme);
    expect(document.documentElement.classList.contains("dark")).toBe(a.result.current.theme === "dark");
  });
});
