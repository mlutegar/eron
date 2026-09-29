import { describe, expect, it } from "vitest";
import { OverviewSchema } from "./types.js";
import { store } from "./store.js";

describe("store", () => {
  it("overview conforme o contrato (schema Zod)", () => {
    const parsed = OverviewSchema.safeParse(store.getOverview());
    expect(parsed.success).toBe(true);
  });

  it("valorMes soma apenas boletos sincronizados do mes de referencia", () => {
    // Ref = 2026-09: CBR-1591 (10) + CBR-1592 (1840.5) + CBR-1588 (980) = 2830.5
    expect(store.getOverview().counts.valorMes).toBeCloseTo(2830.5, 2);
  });

  it("reprocess remove o item da quarentena", () => {
    const antes = store.getQuarantine().length;
    const depois = store.reprocess("Q-2001");
    expect(depois.length).toBe(antes - 1);
  });

  it("markSyncRun atualiza ultima/proxima com o intervalo", () => {
    const now = new Date("2026-09-28T12:00:00-03:00");
    store.markSyncRun(now);
    const h = store.getHealth();
    expect(new Date(h.ultimaSync).getTime()).toBe(now.getTime());
    expect(new Date(h.proximaSync).getTime()).toBe(now.getTime() + h.intervaloMin * 60_000);
  });

  it("runSync publica os mapeados e mantem os nao mapeados como falha", () => {
    const pendentesAntes = store.getPending().length;
    expect(pendentesAntes).toBeGreaterThan(0);

    const r = store.runSync(new Date("2026-09-28T12:00:00-03:00"));
    expect(r.total).toBe(pendentesAntes);
    expect(r.subiram + r.naoSubiram).toBe(r.total);
    expect(r.subiram).toBeGreaterThan(0);
    // Mercado Central (sem empresaZen) deve falhar.
    expect(r.itens.some((i) => !i.ok && i.boleto.cnpj === "77.888.999/0001-55")).toBe(true);
    // Valor publicado = soma dos que subiram.
    const somaOk = r.itens.filter((i) => i.ok).reduce((a, i) => a + i.boleto.valor, 0);
    expect(r.valorPublicado).toBeCloseTo(somaOk, 2);
  });

  it("runSync e idempotente: segunda execucao nao republica os ja publicados", () => {
    const r2 = store.runSync(new Date("2026-09-28T13:00:00-03:00"));
    // Apos a 1a execucao, so restam os que falham (sem empresaZen).
    expect(r2.subiram).toBe(0);
    expect(store.getLastRun()?.executadoEm).toBe(r2.executadoEm);
  });

  it("setSettings alterna o modo automatico", () => {
    expect(store.setSettings({ autoRun: true }).autoRun).toBe(true);
    expect(store.getSettings().autoRun).toBe(true);
    store.setSettings({ autoRun: false });
  });
});
