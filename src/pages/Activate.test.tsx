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

  it("mostra a contagem de pendentes e o botao Enviar agora", async () => {
    setup();
    expect(screen.getByRole("button", { name: /Enviar agora/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/aguardando envio/)).toBeInTheDocument());
  });

  it("ao clicar em Enviar agora, executa e mostra enviados e nao enviados", async () => {
    setup();
    await waitFor(() => expect(screen.getByText(/aguardando envio/)).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /Enviar agora/ }));

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

describe("Activate — configuracao do envio", () => {
  beforeEach(() => localStorage.clear());

  it("mostra os 3 passos com tudo desligado por padrao", async () => {
    setup();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Configuracao do envio" })).toBeInTheDocument());
    const chave = screen.getByRole("switch", { name: "Enviar boletos ao Zen" });
    const auto = screen.getByRole("switch", { name: "Envio automatico" });
    expect(chave).not.toBeChecked();
    expect(auto).not.toBeChecked();
    expect(chave).toBeDisabled(); // so depois da data de inicio
    expect(auto).toBeDisabled(); // so depois do passo 2
    expect(screen.getByLabelText("Data de inicio")).toBeInTheDocument();
  });

  it("traduz os bloqueios do backend para o operador", async () => {
    const { friendlyError } = await import("./Activate");
    expect(friendlyError(new Error("Erro 503 ao acessar /run — ENVIO_DESABILITADO: x"))).toMatch(/Enviar boletos ao Zen/);
    expect(friendlyError(new Error("Erro 503 ao acessar /run — SEM_DATA_CORTE: x"))).toMatch(/data de inicio/);
    expect(friendlyError(new Error("Erro 409 ao acessar /run — EXECUCAO_EM_ANDAMENTO"))).toMatch(/em andamento/);
  });
});
