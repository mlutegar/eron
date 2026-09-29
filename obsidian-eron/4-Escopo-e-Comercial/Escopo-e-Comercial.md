# 4 · Escopo e Comercial

← volta para [[Painel]] · anterior [[Frontend]] · próximo [[Pendencias]]

## Incluído
- Serviço hospedado (Railway), OAuth2 CA com renovação automática
- Integração CA (endpoints validados) + Zen (e-Doc)
- Sync a cada 15 min, deduplicação, reconciliação, fila de quarentena
- Dashboard operacional (ver [[Frontend]])
- Onboarding: match por CNPJ + resolução manual de ambíguos + homologação
- Documentação (operação + técnica)

## Fora de escopo
NF-e/contratos/outros docs, cobrança de inadimplentes, emissão de boleto via API,
baixa/conciliação de pagamento, bancos externos, outros ERPs, migração histórica,
app mobile, personalização visual branded.

## Cronograma (~17 dias úteis / ~4 semanas)
| Fase | Duração |
|---|---|
| Setup infra + auth CA + Zen | 3 dias |
| Sync + download PDF + upload Zen | 4 dias |
| Dedup + quarentena + erros | 3 dias |
| Mapeamento CNPJ + onboarding | 2 dias |
| Dashboard | 2 dias |
| Testes ponta-a-ponta | 2 dias |
| Deploy + validação | 1 dia |

## Valores
- **Implantação:** R$ [preencher] — 50% início / 50% entrega
- **Hospedagem:** R$ 150/mês (Railway + Postgres + monitoramento + SSL + backup)
- **Suporte:** 12 meses incluídos (bugs, mudanças de API, WhatsApp comercial)

## Responsabilidades do cliente
Acessos (CA, Zen, OAuth), ativar WS no Zen + tipo doc "Boleto", homologar, manter
hospedagem em dia, comunicar mudanças (planos, novos CNPJs).
