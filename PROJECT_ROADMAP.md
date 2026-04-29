# PROJECT_ROADMAP.md

Roadmap de melhorias controladas para o StoryForge. Este documento organiza fases de trabalho; ele nao altera prioridade final, escopo de produto ou compromisso de entrega sem validacao posterior.

## Principios

- Proteger o comportamento existente antes de expandir funcionalidades.
- Reduzir risco operacional em seguranca, testes, filas e custos.
- Entregar melhorias em fases pequenas, com validacao clara.
- Evitar chamadas reais de IA em testes automatizados.
- Preservar compatibilidade com projetos, manuscritos, briefings e exportacoes ja existentes.

## Fases

### 1. Hotfixes

- Corrigir erros criticos que bloqueiam uso basico.
- Estabilizar fluxos de importacao, geracao, edicao e exportacao.
- Registrar regressao esperada antes de cada correcao.

### 2. Seguranca

- Revisar uso de variaveis de ambiente, chaves e logs.
- Garantir que erros nao exponham dados sensiveis.
- Mapear superficies de entrada: uploads, prompts, projetos, exportacoes e APIs.

### 3. Testes

- Criar base de testes para backend e frontend.
- Isolar provedores de IA por mocks/fakes.
- Adicionar testes de regressao para bugs ja conhecidos.
- Definir comandos oficiais de validacao local e CI.

### 4. Fila duravel

- Introduzir controle persistente de tarefas longas.
- Permitir retomada, reprocessamento e observabilidade de jobs.
- Registrar estados de execucao, falha e retry.

### 5. BookBrief

- Estruturar briefing do livro como contrato reutilizavel.
- Validar campos obrigatorios e consistencia editorial.
- Preparar base para geracao guiada por objetivos narrativos.

### 6. Series Engine

- Modelar continuidade entre livros de uma serie.
- Controlar arcos, personagens, tom, cronologia e regras do universo.
- Reaproveitar contexto sem inflar custo ou prompts de forma descontrolada.

### 7. Continuidade

- Criar verificacoes de consistencia entre capitulos, cenas e versoes.
- Detectar contradicoes de personagem, local, tempo e eventos.
- Separar alertas editoriais de bloqueios reais.

### 8. QualityReport

- Gerar relatorios de qualidade narrativa e tecnica.
- Avaliar estrutura, ritmo, clareza, consistencia e completude.
- Produzir achados acionaveis para revisao humana.

### 9. PublishingPackage

- Consolidar exportacoes prontas para publicacao.
- Padronizar metadados, formatos, assets e documentos auxiliares.
- Validar pacote antes de download ou envio.

### 10. CostLedger

- Registrar custos estimados e reais de chamadas de IA.
- Associar consumo a projeto, tarefa, provedor e etapa editorial.
- Criar alertas e limites configuraveis.

### 11. MarketReport

- Produzir analises de mercado com fontes e data de coleta.
- Separar inferencia editorial de fatos verificados.
- Registrar incerteza e evitar recomendacoes sem base rastreavel.

### 12. Publishability Gate

- Definir criterios minimos antes de considerar um projeto publicavel.
- Combinar verificacoes tecnicas, editoriais, metadados e pacote final.
- Bloquear publicacao apenas quando houver falha objetiva.

### 13. Batch editorial

- Processar multiplos projetos, capitulos ou tarefas editoriais em lote.
- Controlar progresso, erros parciais, retry e cancelamento.
- Preservar rastreabilidade de cada item processado.

