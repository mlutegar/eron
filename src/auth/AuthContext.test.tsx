import { describe, expect, it, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import type { ReactNode } from "react";

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("AuthContext", () => {
  beforeEach(() => localStorage.clear());

  it("inicia deslogado", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.authenticated).toBe(false);
  });

  it("loga com credencial padrao e desloga", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => {
      expect(result.current.login("admin", "iazan")).toBe(true);
    });
    expect(result.current.authenticated).toBe(true);
    act(() => result.current.logout());
    expect(result.current.authenticated).toBe(false);
  });

  it("rejeita credencial errada", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => {
      expect(result.current.login("x", "y")).toBe(false);
    });
    expect(result.current.authenticated).toBe(false);
  });
});
