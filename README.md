# Torre de Controle GRF

Painel de monitoramento ligado ao Google Sheets e ao GPS Eclipse.

## Escopo desta correção

- nenhuma alteração no HTML/CSS ou na estrutura visual do painel;
- Campos, Angra e rotas da Região dos Lagos com limite correto na virada do dia;
- saídas da noite anterior comparadas com a data operacional completa;
- consulta GPS de 18h do dia anterior até 23h59 do dia operacional;
- saída confirmada pela cerca operacional da base GRF em Três Rios;
- Histórico espelhado por linha da Programação, com `ID Viagem` oculto;
- alterações manuais, inserções e exclusões refletidas no Histórico;
- backup automático antes da primeira migração do Histórico;
- chegada por geolocalização confirmada por parada ou permanência, sem considerar velocidade ausente como zero.

## Ativação no Google Apps Script

O Apps Script é vinculado à planilha e não é implantado automaticamente pelo GitHub.

1. Abra **Extensões > Apps Script** na planilha.
2. Substitua o conteúdo atual pelo arquivo `Code.gs` deste repositório e salve.
3. Execute `configurarPlanilha()` uma vez e autorize.
   - três colunas técnicas serão criadas no final da Programação e ficarão ocultas;
   - antes da migração será criada uma aba `Histórico_backup_AAAAMMDD_HHMMSS`;
   - o Histórico atual será reorganizado com os campos corretos.
4. Execute `instalarGatilhos()` uma vez e autorize.
   - atualização do GPS a cada 5 minutos;
   - sincronização após edições manuais;
   - sincronização após inclusão ou exclusão de linhas/colunas.
5. Em **Implantar > Gerenciar implantações**, edite a implantação atual, selecione **Nova versão** e implante. Isso mantém a mesma URL consumida pelo painel.
6. Execute `atualizarStatusFrota()` e confira Campos, Angra e Cabo Frio.

Se a aba Histórico for limpa manualmente, execute `reconstruirHistorico()`.
A atualização normal também reconstrói o Histórico antes de consultar o GPS,
mesmo quando o portal de rastreamento estiver indisponível.

## Testes locais

```bash
node test_logic.js
node --check < Code.gs
```

Os testes cobrem horários antes/depois da meia-noite, aliases de rotas e normalização de preenchimento manual.
