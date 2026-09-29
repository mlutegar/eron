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

  it("loga com credencial padrao e desloga", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      expect((await result.current.login("admin", "iazan")).ok).toBe(true);
    });
    expect(result.current.authenticated).toBe(true);
    expect(result.current.usuario).toBe("admin");
    act(() => result.current.logout());
    expect(result.current.authenticated).toBe(false);
  });

  it("rejeita credencial errada", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      const r = await result.current.login("x", "y");
      expect(r.ok).toBe(false);
    });
    expect(result.current.authenticated).toBe(false);
  });

  it("um 401 do backend derruba a sessao", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login("admin", "iazan");
    });
    expect(result.current.authenticated).toBe(true);
    act(() => {
      window.dispatchEvent(new Event("iazan:unauthorized"));
    });
    expect(result.current.authenticated).toBe(false);
  });
});
