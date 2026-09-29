import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SyncLog } from "./SyncLog";

function setup() {
  return render(
    <MemoryRouter>
      <SyncLog />
    </MemoryRouter>,
  );
}

describe("SyncLog", () => {
  it("lista boletos e filtra por status Erro", async () => {
    setup();
    await waitFor(() => expect(screen.getByText(/Padaria Pao Quente/)).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Erros" }));

    await waitFor(() => {
      expect(screen.getByText(/Studio Foco Fotografia/)).toBeInTheDocument();
      expect(screen.queryByText(/Padaria Pao Quente/)).not.toBeInTheDocument();
    });
  });

  it("busca por cliente", async () => {
    setup();
    await waitFor(() => expect(screen.getByText(/Auto Pecas Veloz/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText(/Buscar/), "clinica");

    await waitFor(() => {
      expect(screen.getByText(/Clinica Vida Plena/)).toBeInTheDocument();
      expect(screen.queryByText(/Auto Pecas Veloz/)).not.toBeInTheDocument();
    });
  });
});
