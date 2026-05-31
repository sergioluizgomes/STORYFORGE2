# Quality Engine Test Plan

Roteiro para validar o AI Editorial QualityReport com uma historia curta real.

## Objetivo

Verificar se o AI Editorial QualityReport ajuda de verdade a melhorar uma historia curta antes de qualquer trabalho em reescrita automatica.

Este teste nao deve alterar cenas automaticamente, nao deve substituir julgamento editorial humano e nao deve ser usado para aprovar Rewrite Studio sozinho. A meta e calibrar o diagnostico.

## Escopo do teste

Use um projeto curto com:

- 3 a 5 cenas.
- 1 protagonista.
- 1 conflito central.
- 1 antagonista ou forca oposta clara.
- 1 BookBrief bem preenchido.
- Cenas curtas, mas completas o bastante para mostrar objetivo, conflito, virada e consequencia.

Evite testar primeiro com romance longo. Historias pequenas tornam mais facil perceber se o relatorio esta especifico ou generico.

## 1. Preparar o projeto

1. Crie um projeto curto no StoryForge.
2. Preencha o BookBrief com atencao especial a:
   - genero;
   - publico-alvo;
   - tom;
   - promessa central ao leitor;
   - desejo externo do protagonista;
   - necessidade interna do protagonista;
   - conflito central;
   - itens que devem aparecer;
   - itens que devem ser evitados.
3. Use a Story Room para revisar a direcao criativa antes das cenas.
4. Gere ou importe 3 a 5 cenas.
5. Confirme manualmente que as cenas incluem:
   - objetivo de cena;
   - conflito;
   - virada ou mudanca;
   - consequencia;
   - alguma pista de arco do protagonista.

## 2. Rodar as avaliacoes

Execute as avaliacoes nesta ordem:

1. Readiness.
2. QualityReport heuristico.
3. AI Editorial Review.

Durante o teste, confirme que o AI Editorial Review gera um novo QualityReport com source `ai_editorial` e nao altera:

- cenas;
- BookBrief;
- Bible;
- exportadores;
- PublishingPackage;
- CostLedger.

## 3. Avaliar o relatorio editorial

Leia o relatorio na aba Quality e responda:

- Os achados sao especificos?
- Os achados citam evidencia de cenas, capitulos, personagens ou BookBrief?
- As sugestoes sao acionaveis?
- As perguntas abertas ajudam a decidir a historia?
- O plano de revisao esta priorizado corretamente?
- O relatorio respeita o BookBrief?
- O relatorio entende genero, tom e promessa ao leitor?
- O relatorio identifica cenas fracas?
- O relatorio identifica protagonista passivo, se esse problema existir?
- O relatorio identifica problemas de continuidade?
- O relatorio diferencia problema estrutural, problema de cena e problema de prosa?
- O contexto truncado atrapalhou a leitura editorial?
- A interface ficou legivel ou virou informacao demais?
- O relatorio ajuda a melhorar a historia ou apenas parece bem apresentado?

## 4. Notas de calibracao

Atribua notas de 1 a 5:

| Criterio | Nota | Observacao |
| --- | --- | --- |
| Utilidade geral |  |  |
| Especificidade |  |  |
| Clareza |  |  |
| Prioridade correta |  |  |
| Facilidade de usar |  |  |
| Respeito ao BookBrief |  |  |
| Entendimento de genero/promessa |  |  |
| Qualidade das perguntas abertas |  |  |
| Qualidade do plano de revisao |  |  |

Use esta escala:

- 1: ruim ou inutil.
- 2: fraco, exige muita interpretacao.
- 3: aceitavel, mas irregular.
- 4: bom e utilizavel.
- 5: excelente, especifico e acionavel.

## 5. Registrar exemplos

Preencha depois de ler o relatorio:

| Item | Exemplo |
| --- | --- |
| Melhor achado do relatorio |  |
| Pior achado do relatorio |  |
| Sugestao mais util |  |
| Sugestao errada ou generica |  |
| Pergunta que ajudou |  |
| Pergunta inutil |  |
| Evidencia mais convincente |  |
| Evidencia fraca ou ausente |  |
| Cena que o relatorio avaliou bem |  |
| Cena que o relatorio avaliou mal |  |

## 6. Checklist de aprovacao editorial

Marque os itens que o relatorio conseguiu entregar:

- [ ] Pelo menos 5 achados especificos e uteis.
- [ ] Evidencias ligadas a cenas, capitulos, personagens ou BookBrief.
- [ ] Sugestoes acionaveis.
- [ ] Perguntas abertas relevantes.
- [ ] Plano de revisao priorizado.
- [ ] Baixa quantidade de sugestoes genericas.
- [ ] Respeito ao BookBrief.
- [ ] Entendimento de genero, tom e promessa ao leitor.
- [ ] Nenhuma reescrita automatica de cena.
- [ ] Nenhuma alteracao automatica no manuscrito.

## 7. Decisao apos o teste

Use as respostas para escolher o proximo passo:

- Se o relatorio atingir os criterios de aprovacao, Q2 pode seguir para teste com projetos um pouco maiores antes de qualquer Rewrite Studio.
- Se o relatorio for generico, confuso, longo demais ou mal priorizado, a proxima tarefa deve ser Q2.2: calibrar prompt editorial e estrutura de relatorio.
- Se o relatorio sugerir mudancas ruins ou ignorar o BookBrief, nao avance para Rewrite Studio.

## 8. Registro da sessao

Copie este bloco para cada teste manual:

```md
## Sessao de teste

- Projeto:
- Data:
- Genero:
- Publico-alvo:
- Numero de cenas:
- Word count aproximado:
- BookBrief preenchido: sim/nao
- Contexto truncado: sim/nao/nao verificado

## Notas

- Utilidade geral:
- Especificidade:
- Clareza:
- Prioridade correta:
- Facilidade de usar:
- Respeito ao BookBrief:
- Entendimento de genero/promessa:
- Qualidade das perguntas abertas:
- Qualidade do plano de revisao:

## Exemplos

- Melhor achado:
- Pior achado:
- Sugestao mais util:
- Sugestao errada ou generica:
- Pergunta que ajudou:
- Pergunta inutil:
- Evidencia mais convincente:
- Evidencia fraca ou ausente:

## Decisao

- Pronto para testar com outro livro curto?
- Precisa de calibracao Q2.2?
- Observacoes:
```
