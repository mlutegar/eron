import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable, type Column } from "./DataTable";

interface Row {
  id: string;
  cliente: string;
  status: string;
}

const cols: Column<Row>[] = [
  { key: "cliente", header: "Cliente", cell: (r) => r.cliente },
  { key: "status", header: "Status", cell: (r) => r.status },
];

const rows: Row[] = [{ id: "1", cliente: "Padaria X", status: "Sincronizado" }];

describe("DataTable", () => {
  it("renderiza a coluna Status e seu valor", () => {
    // Sem matchMedia (jsdom) o hook assume desktop → renderiza a tabela.
    render(<DataTable columns={cols} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Sincronizado")).toBeInTheDocument();
  });

  it("mostra o estado vazio quando não há linhas", () => {
    render(<DataTable columns={cols} rows={[]} rowKey={(r) => r.id} empty="Vazio" />);
    expect(screen.getByText("Vazio")).toBeInTheDocument();
  });
});
