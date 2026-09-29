import "@testing-library/jest-dom";

// Node 26 expõe localStorage indefinido sem --localstorage-file, inclusive no jsdom do Vitest.
// Um Storage isolado por arquivo de teste mantém os testes de navegador portáveis.
const items = new Map<string, string>();
const storage: Storage = {
  get length() { return items.size; },
  clear() { items.clear(); },
  getItem(key) { return items.get(String(key)) ?? null; },
  key(index) { return [...items.keys()][index] ?? null; },
  removeItem(key) { items.delete(String(key)); },
  setItem(key, value) { items.set(String(key), String(value)); },
};
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: storage,
});
