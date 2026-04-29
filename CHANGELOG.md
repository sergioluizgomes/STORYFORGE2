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

### Changed

- Script `npm test` do backend agora executa o test runner nativo do Node.js.

### Fixed

- Corrigida a importação JSON de projetos para parsear o arquivo antes de criar o payload com idempotencyKey.
- Cenas geradas agora recebem chapterNumber quando associadas a beats de capítulos.
- Corrigida a ordenação e os títulos de cenas na exportação DOCX.
