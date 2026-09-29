import { PageHeader } from "../components/PageHeader";
import { DataTable, type Column } from "../components/DataTable";
import { ErrorState } from "../components/Loading";
import { TableSkeleton } from "../components/Skeleton";
import { useAsync } from "../lib/useAsync";
import { getClientMap } from "../api/client";
import type { ClientMapping as ClientMappingType } from "../types/api";

const cols: Column<ClientMappingType>[] = [
  { key: "cnpj", header: "CNPJ", cell: (r) => r.cnpj, mono: true },
  { key: "ca", header: "Cliente na Conta Azul", cell: (r) => r.clienteContaAzul },
  {
    key: "zen",
    header: "Empresa no Zen",
    cell: (r) => r.empresaZen ?? <span className="text-warn">nao encontrada</span>,
  },
  {
    key: "sit",
    header: "Situacao",
    cell: (r) =>
      r.situacao === "MAPEADO" ? (
        <span className="text-flow">Mapeado</span>
      ) : (
        <span className="text-warn">Pendente</span>
      ),
  },
];

export function ClientMapping() {
  const { data, loading, error, refetch } = useAsync(getClientMap);
  const pendentes = data?.filter((c) => c.situacao === "PENDENTE").length ?? 0;

  return (
    <div>
      <PageHeader
        title="Mapeamento de clientes"
        subtitle="Correspondencia entre CNPJs da Conta Azul e empresas cadastradas no Zen."
      />

      {pendentes > 0 && (
        <div className="mb-4 rounded-lg border border-warn/30 bg-warn/5 px-4 py-2.5 text-sm text-warn">
          {pendentes} cliente(s) sem empresa correspondente no Zen. Boletos desses CNPJs vao para
          quarentena ate o cadastro.
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={5} />
      ) : error || !data ? (
        <ErrorState message={error ?? "Sem dados."} onRetry={refetch} />
      ) : (
        <DataTable
          columns={cols}
          rows={data}
          rowKey={(r) => r.cnpj}
          empty="Nenhum cliente mapeado ainda."
        />
      )}
    </div>
  );
}
