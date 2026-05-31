# StoryForge

StoryForge e uma plataforma para planejamento, geracao, revisao e empacotamento editorial de livros com apoio de IA. O repositorio concentra um backend em Node.js/Express, um frontend em React/Vite e um conjunto de fluxos voltados a criacao de projetos narrativos, cenas, coletaneas, batches editoriais e materiais de publicacao.

O objetivo do projeto e oferecer uma base operacional para quem precisa transformar uma ideia editorial em um projeto acompanhavel, com contexto narrativo, analises de qualidade, custos estimados de IA e exportacoes em formatos prontos para trabalho editorial.

## Visao Geral

- Criacao e gerenciamento de projetos literarios.
- Geracao assistida de bible, personagens, locais, beats, capitulos e cenas.
- Suporte a workflows editoriais complementares, como BookBrief, QualityReport, Quality Validation Run e PublishingPackage.
- Processamento em lote para multiplos projetos.
- Suporte a coletaneas e exportacoes.
- Registro de custos estimados de chamadas de IA por projeto.
- Frontend web para operacao do fluxo e backend API para regras de negocio, persistencia e integracoes.

## Estado Atual

O StoryForge esta em evolucao ativa. O repositorio ja inclui funcionalidades operacionais para criacao de projetos, geracao de conteudo, analise heuristica e alguns fluxos com IA, mas tambem registra fases futuras no roadmap para robustez operacional, filas duraveis, continuidade, market intelligence e amadurecimento do quality engine.

Para o direcionamento atual do produto, consulte [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) e [CHANGELOG.md](CHANGELOG.md).

## Principais Recursos

### Projetos e estrutura narrativa

- Cadastro, listagem, atualizacao e exclusao de projetos.
- Importacao de projetos.
- Estruturacao narrativa por beats, capitulos e cenas.
- Analise de capitulos e consolidacao de resultados por projeto.

### Geracao assistida por IA

- Geracao de bible de projeto.
- Sugestoes de personagens, locais e detalhes de beats.
- Geracao de imagens para elementos narrativos em fluxos suportados.
- Geracao de cenas e capitulos.
- Seletores de provider e modelos de texto configuraveis por ambiente.

### Camada editorial

- Publishability Gate tecnico para checagem de prontidao.
- BookBrief como contrato editorial editavel por projeto.
- QualityReport heuristico.
- AI Editorial QualityReport.
- Editorial Judge para avaliar utilidade e prioridade de achados editoriais.
- Quality Validation Run para consolidar relatorios de prontidao e qualidade.

### Publicacao e operacao

- PublishingPackage para rascunho comercial e checklist de lancamento.
- Exportacao de arquivos em DOCX, EPUB e PDF em fluxos suportados.
- Registro de custos estimados com CostLedger.
- Lote de projetos para execucao de tarefas em batch.
- Suporte a coletaneas com preview e download.

## Arquitetura

```text
frontend/  -> aplicacao React/Vite para operacao do produto
backend/   -> API Express, persistencia MongoDB, servicos editoriais e integracoes de IA
docs/      -> documentacao operacional, setup e checklists
```

### Backend

Stack principal:

- Node.js
- Express
- MongoDB com Mongoose
- Integracoes com Gemini, LM Studio e DeepSeek
- Geracao de arquivos com DOCX, EPUB e PDF

Superficies principais da API:

- `/api/projects`
- `/api/generate`
- `/api/scenes`
- `/api/batch`
- `/api/export`
- `/api/hybrid`
- `/api/styles`
- `/api/narrative-styles`
- `/api/logs`
- `/uploads/:filename`

### Frontend

Stack principal:

- React 19
- Vite
- React Router
- Tailwind CSS
- Axios

Fluxos visiveis na interface atual incluem dashboard de projetos, criacao de novo projeto, visualizacao de projeto, estrutura narrativa, lote de projetos, criacao de coletaneas e lista de coletaneas.

## Requisitos

- Node.js compativel com Vite 7 e o backend Express.
- npm.
- MongoDB acessivel localmente ou por ambiente configurado.
- Chaves e configuracoes de provider de IA apenas quando esses fluxos forem usados.

## Instalacao

Instale backend e frontend separadamente:

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

## Configuracao de Ambiente

O projeto usa arquivos `.env.example` como referencia:

- `backend/.env.example`
- `frontend/.env.example`

Crie os arquivos locais correspondentes sem commitar segredos.

### Backend

Variaveis disponiveis no exemplo atual:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/story-generator
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
CORS_ALLOW_CREDENTIALS=false
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=
TEXT_AI_PROVIDER=
TEXT_AI_MODEL=
LM_STUDIO_BASE_URL=
LM_STUDIO_DEFAULT_MODEL=
LM_STUDIO_API_KEY=
EDITORIAL_JUDGE_PROVIDER=
EDITORIAL_JUDGE_MODEL=
PUBLIC_BASE_URL=
UPLOAD_DIR=uploads
```

Comportamento relevante:

- O backend valida configuracao no startup.
- Em desenvolvimento, varios defaults locais seguros sao aplicados quando possivel.
- Em producao, configuracoes criticas ausentes ou inseguras bloqueiam o startup.
- O provider de texto padrao e Gemini quando `TEXT_AI_PROVIDER` nao e definido ou nao e reconhecido.
- LM Studio e DeepSeek podem ser usados conforme configuracao de ambiente.

### Frontend

O frontend expoe a variavel:

```env
VITE_API_BASE_URL=
```

Se nao houver proxy ou configuracao adicional no ambiente, aponte essa variavel para a URL do backend.

## Como Rodar Localmente

### Backend

```powershell
cd backend
npm run dev
```

O backend sobe por padrao na porta `3000` quando `PORT` nao e alterada.

### Frontend

```powershell
cd frontend
npm run dev
```

O Vite normalmente roda em `http://localhost:5173` no ambiente local.

## Validacao

Comandos disponiveis hoje no repositorio:

```powershell
cd backend
npm test

cd ..\frontend
npm run build
npm run lint
```

O backend usa o test runner nativo do Node.js. A politica do projeto e manter testes locais e deterministicos, sem chamadas reais a provedores de IA, APIs pagas ou servicos externos nao controlados.

## API e Fluxos Relevantes

Alguns endpoints relevantes para integracao e operacao:

- `GET /` retorna um health check simples da API.
- `GET /api/projects` lista projetos.
- `POST /api/projects` cria projetos.
- `POST /api/projects/import` importa projetos.
- `GET /api/projects/:id/publishability` calcula prontidao tecnica do projeto.
- `POST /api/projects/:id/quality-report` gera relatorio heuristico.
- `POST /api/projects/:id/quality-report/ai-editorial` executa revisao editorial com IA.
- `POST /api/projects/:id/quality-validation-run` consolida sinais de qualidade e prontidao.
- `GET /api/projects/:id/book-brief` consulta BookBrief.
- `PUT /api/projects/:id/book-brief` cria ou atualiza BookBrief.
- `POST /api/projects/:id/publishing-package` gera o pacote comercial inicial.
- `GET /api/projects/:id/costs` consulta custos estimados registrados.
- `POST /api/scenes/generate` gera cenas.
- `POST /api/scenes/generate-chapter` gera capitulos.
- `POST /api/export/docx/:projectId` exporta DOCX.
- `POST /api/export/epub/:projectId` exporta EPUB.

Para detalhes operacionais adicionais, consulte o codigo em `backend/routes/` e a documentacao de setup em [docs/SETUP.md](docs/SETUP.md).

## Seguranca e Boas Praticas

- Nunca commite chaves, tokens, connection strings ou segredos reais.
- A rota publica de uploads aceita apenas nomes seguros de arquivo e extensoes permitidas.
- Logs e erros devem evitar exposicao de conteudo sensivel, manuscritos completos, prompts e respostas de IA.
- Testes automatizados nao devem consumir IA real nem servicos pagos.

As diretrizes de contribuicao e operacao dos agentes estao em [AGENTS.md](AGENTS.md).

## Documentacao Disponivel

- [docs/SETUP.md](docs/SETUP.md): instalacao, ambiente, CORS, uploads e validacao.
- [docs/PR_CHECKLIST.md](docs/PR_CHECKLIST.md): padrao de validacao e riscos para PRs.
- [docs/QUALITY_ENGINE_TEST_PLAN.md](docs/QUALITY_ENGINE_TEST_PLAN.md): orientacoes para testes da camada de qualidade.
- [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md): fases planejadas de evolucao.
- [CHANGELOG.md](CHANGELOG.md): historico de mudancas relevantes.
- [BATCH_FORMAT.md](BATCH_FORMAT.md): formato de lote.
- [IMPORT_FORMAT.md](IMPORT_FORMAT.md): formato de importacao.

## Publico-alvo

StoryForge faz mais sentido para:

- estudios e operacoes editoriais que precisam padronizar fluxo de criacao com IA;
- autores independentes com pipeline proprio de planejamento, geracao e revisao;
- times internos que desejam experimentar tooling narrativo com controle de contexto, qualidade e exportacao.

## Observacoes Importantes

- Nem todo fluxo do produto depende de IA; varias checagens e estruturas sao heuristicas e locais.
- Alguns recursos descritos no roadmap ainda representam direcao futura, nao garantia de disponibilidade imediata.
- O README descreve o estado atual observado neste repositorio e pode evoluir junto com a API e a interface.

## Licenca

Este repositorio ainda nao declara uma licenca publica na raiz. Se o projeto for aberto para distribuicao externa, defina a licenca explicitamente antes de uso ou redistribuicao por terceiros.