# 1 · Visão Geral

← volta para [[Painel]]

## Objetivo
Publicar automaticamente os boletos emitidos na Conta Azul (Conta PJ Conta Azul IP,
intermediado por IUGU) diretamente no módulo e-Doc do Questor Zen, eliminando o
trabalho manual de download → renomeação → upload → notificação.

## Problema atual
O escritório emite dezenas de boletos/mês (R$ 225k+/mês em contas a receber). Hoje,
para cada boleto: entra na CA, baixa o PDF, loga no Zen do cliente certo, cria
documento tipo "Boleto", faz upload e notifica. ~3–5 min por boleto → 2,5 a 5 h/mês
perdidas, com risco de erro (cliente errado, boleto esquecido, arquivo mal nomeado).

## Solução
Serviço automatizado que, a cada 15 minutos, detecta novos boletos na CA e publica
no Zen do cliente correspondente, sem intervenção humana. Um dashboard mostra a
operação (ver [[Frontend]]).

## Próximo
→ [[Arquitetura]]
