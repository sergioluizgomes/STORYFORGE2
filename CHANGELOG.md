# CHANGELOG.md

Todas as mudancas notaveis deste projeto devem ser registradas aqui.

O formato segue uma adaptacao de "Keep a Changelog", com secoes por data e tipo de mudanca.

## [Unreleased]

### Added

- Documentacao inicial de governanca para agentes e contribuidores.
- Roadmap de fases controladas para evolucao do StoryForge.
- Checklist de PR para padronizar revisao, validacao e riscos.
- Guia de setup local para backend e frontend.
- Baseline tecnico com Git inicializado, exemplos de `.env`, protecao de arquivos sensiveis e testes minimos no backend.
- Utilitarios puros de estrutura narrativa para localizar capitulos por beat e alocar orcamento de palavras por beat.
- Validacao centralizada de configuracao de ambiente no backend.
- Adicionado Publishability Gate tecnico basico para avaliar se projetos tem cenas, conteudo, cobertura de beats, word count e pre-condicoes minimas de exportacao.
- Adicionada secao no frontend para exibir o Publishability Gate tecnico do projeto.
- Adicionado BookBrief basico no backend para registrar genero, publico-alvo, tom, idioma, metas de tamanho, disclosure de IA e estrategia inicial de monetizacao por projeto.
- Adicionada interface no frontend para visualizar e editar BookBrief por projeto.
- Adicionado QualityReport inicial com avaliacao heuristica de estrutura, completude, word count, ritmo basico, artefatos de texto, aderencia ao BookBrief e prontidao tecnica.
- Adicionada aba Quality no frontend para exibir o QualityReport mais recente e gerar novo relatorio heuristico.
- Adicionado PublishingPackage backend inicial para gerar pacote comercial heuristico com metadados, checklists, compliance warnings, estrategia de monetizacao e materiais editaveis de lancamento.
- Adicionada aba Publishing no frontend para exibir o PublishingPackage mais recente e gerar novo pacote comercial heuristico.
- Adicionado CostLedger backend inicial para registrar chamadas de IA por projeto, tokens, duracao, provider, modelo, etapa e custo estimado quando disponivel.
- Adicionada primeira camada do Quality Engine com AI BookBrief Suggestion, Story Method Selector, perguntas abertas e opcoes de direcao narrativa sem salvar automaticamente.
- Adicionada Sala da Historia no frontend para gerar sugestoes de BookBrief por IA, visualizar metodos narrativos, perguntas abertas e opcoes de direcao sem aplicar mudancas automaticamente.
- Adicionado AI Editorial QualityReport com passes editoriais de estrutura, personagem, cena, continuidade, voz, promessa de genero e plano de revisao.
- Adicionado AI Editorial Report Judge para avaliar a utilidade, especificidade e prioridade do relatorio editorial antes de avancar para reescrita.
- Adicionado Quality Validation Run para consolidar Readiness, QualityReport heuristico, AI Editorial Review e Editorial Judge em um relatorio Markdown copiavel para acompanhamento gerencial.

### Changed

- Script `npm test` do backend agora executa o test runner nativo do Node.js.
- Reduzidos logs sensiveis em fluxos de importacao e geracao para evitar exposicao de manuscritos, prompts, respostas de IA e payloads.
- CORS agora e configuravel por ambiente e nao fica aberto por padrao em producao.
- Melhorada a seguranca da rota de uploads para bloquear path traversal, validar extensoes e definir headers seguros.
- Publishability Gate agora considera BookBrief para AI disclosure, revisao humana e targetWordCount quando disponivel.
- Prompts de geracao agora usam BookBrief quando disponivel para orientar idioma, genero, publico-alvo, tom, voz narrativa e diretrizes editoriais.
- BookBrief agora aceita campos narrativos centrais como promessa, desejo, necessidade, conflito e apelo ao leitor para orientar a qualidade da historia.
- Interface de BookBrief agora exibe campos narrativos centrais como promessa, desejo, necessidade, conflito e apelo ao leitor.
- Aba Quality agora permite gerar e visualizar revisao editorial com IA, alem do relatorio heuristico.

### Fixed

- Corrigida a importação JSON de projetos para parsear o arquivo antes de criar o payload com idempotencyKey.
- Cenas geradas agora recebem chapterNumber quando associadas a beats de capítulos.
- Corrigida a ordenação e os títulos de cenas na exportação DOCX.
- Corrigido o agrupamento e a ordenação de cenas na exportação EPUB.
- Corrigido o cálculo de orçamento de palavras por beat para evitar capítulos maiores que o planejado.
