import { describe, expect, it } from "vitest";
import { brl, relativeFromNow } from "./format";

describe("brl", () => {
  it("formata em reais", () => {
    expect(brl(10)).toContain("10,00");
    expect(brl(1840.5)).toContain("1.840,50");
  });
});

describe("relativeFromNow", () => {
  it("retorna traco quando null", () => {
    expect(relativeFromNow(null)).toBe("—");
  });
  it("retorna 'agora' para instante recente", () => {
    expect(relativeFromNow(Date.now())).toBe("agora");
  });
  it("retorna minutos para 5 min atras", () => {
    expect(relativeFromNow(Date.now() - 5 * 60_000)).toBe("ha 5 min");
  });
});
