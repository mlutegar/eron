import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Activate } from "./Activate";

function setup() {
  return render(
    <MemoryRouter>
      <Activate />
    </MemoryRouter>,
  );
}

describe("Activate", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("mostra a contagem de pendentes e o botao Ativar", async () => {
    setup();
    expect(screen.getByRole("button", { name: /Ativar/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/pendente\(s\) para processar/)).toBeInTheDocument());
  });

  it("ao ativar, executa o robo e mostra o log subiu/nao subiu", async () => {
    setup();
    await waitFor(() => expect(screen.getByText(/pendente\(s\) para processar/)).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /Ativar/ }));

    await waitFor(
      () => {
        expect(screen.getByRole("heading", { name: "Resultado" })).toBeInTheDocument();
        // Mercado Central nao tem empresa no Zen -> deve aparecer como falha.
        expect(screen.getByText(/nao mapeado no Zen/)).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });
});
