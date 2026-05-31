# SETUP.md

Guia de preparacao local do StoryForge.

## Requisitos

- Node.js compativel com o frontend Vite e o backend Express.
- npm.
- Acesso as variaveis de ambiente necessarias para recursos externos, mantidas fora do repositorio.

## Estrutura

- `backend/`: API Node/Express e integracoes de IA, banco, arquivos e exportacao.
- `frontend/`: aplicacao React/Vite.
- `docs/`: documentacao operacional e de governanca.

## Instalacao

Instale as dependencias de cada aplicacao separadamente:

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

## Configuracao

Crie arquivos locais de ambiente conforme necessario, sem commitar segredos. Use os arquivos `.env.example` como modelo:

- `backend/.env.example`
- `frontend/.env.example`

Valores sensiveis como chaves de IA, tokens, credenciais de banco e connection strings devem ficar somente em `.env` local ou no gerenciador de segredos do ambiente.

Arquivos reais como `backend/.env`, `frontend/.env`, `.env.local` e `.env.*.local` devem permanecer locais. Nunca copie valores reais para `.env.example`, documentacao, testes, screenshots ou logs.

## Configuracao de ambiente validada

O backend valida a configuracao de ambiente no startup. A validacao normaliza `NODE_ENV`, `PORT`, `MONGODB_URI`, CORS, provedores de IA, `PUBLIC_BASE_URL` e o diretorio de uploads.

Em producao, configuracoes criticas ausentes ou inseguras impedem o startup, incluindo porta invalida, `MONGODB_URI` ausente, `CORS_ORIGIN` ausente, wildcard em CORS ou credenciais com wildcard. Em desenvolvimento, o backend mantem defaults locais seguros quando possivel e registra warnings sem imprimir valores reais.

Chaves de IA continuam opcionais conforme o provider usado. Se um provider selecionado estiver sem chave ou modelo necessario, o backend registra apenas o nome da variavel e o tipo do problema, sem exibir chave, token, connection string ou valor sensivel.

Testes automatizados nao exigem `.env` real; use fixtures locais e variaveis de exemplo. Para resolver erro de configuracao em producao, ajuste a variavel indicada no ambiente de deploy ou no gerenciador de segredos, sem commitar valores reais.

## CORS

O backend aceita configuracao de CORS por ambiente com `CORS_ORIGIN` e `CORS_ALLOW_CREDENTIALS`.

Em desenvolvimento, se `CORS_ORIGIN` nao estiver definido, o backend permite origens locais comuns do Vite e do React, como `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:3000` e `http://127.0.0.1:3000`.

Em producao, configure `CORS_ORIGIN` com as origens reais autorizadas. Multiplas origens podem ser separadas por virgula:

```env
CORS_ORIGIN=https://app.example.com,https://admin.example.com
CORS_ALLOW_CREDENTIALS=false
```

Producao nao deve ficar aberta para qualquer origem de navegador. Nao commite valores reais de ambiente, dominios internos sensiveis ou segredos em arquivos de exemplo, documentacao, testes ou logs.

## Desenvolvimento

Backend:

```powershell
cd backend
npm run dev
```

## Arquivos de upload

O backend serve arquivos publicos gerados pelo app a partir de `backend/uploads`.

A rota publica de uploads aceita somente nomes simples de arquivo, sem subpastas ou caminhos absolutos, e bloqueia tentativas de traversal codificadas ou nao codificadas. As extensoes publicas permitidas sao:

```text
.png, .jpg, .jpeg, .webp, .gif, .pdf, .docx, .epub
```

Arquivos internos como `.env`, logs, scripts, HTML e arquivos temporarios nao devem ser servidos pela rota publica. Downloads de antologias tambem devem permanecer dentro de `backend/uploads`.

## Publishability Gate

O endpoint `GET /api/projects/:id/publishability` executa uma checagem calculada de prontidao tecnica do projeto. Ele nao chama IA, nao gera arquivos e nao altera dados do projeto.

Essa checagem valida pre-condicoes como cenas existentes, conteudo preenchido, cobertura de beats, word count em relacao ao alvo e prontidao minima para exportacao.

## BookBrief

BookBrief e um contrato editorial associado ao projeto. Ele pode ser consultado em `GET /api/projects/:id/book-brief`, criado ou atualizado em `PUT /api/projects/:id/book-brief` e removido em `DELETE /api/projects/:id/book-brief`.

Nesta fase, BookBrief nao chama IA, nao altera geracao de conteudo e nao e obrigatorio para projetos existentes.

## QualityReport

O endpoint `POST /api/projects/:id/quality-report` gera e salva um QualityReport inicial para o projeto. O relatorio mais recente pode ser consultado em `GET /api/projects/:id/quality-report/latest`.

Nesta fase, QualityReport executa avaliacao heuristica. Ele nao chama IA, nao reescreve cenas, nao gera arquivos e nao substitui o Publishability Gate.

## PublishingPackage

O endpoint `POST /api/projects/:id/publishing-package` gera um pacote comercial heuristico e editavel para o projeto. O pacote mais recente pode ser consultado em `GET /api/projects/:id/publishing-package/latest`.

Nesta fase, PublishingPackage nao chama IA, nao publica em plataformas, nao faz integracao com KDP, Apple Books ou Draft2Digital e nao garante aprovacao. Ele serve como checklist e rascunho comercial editavel com metadados, avisos de compliance e materiais iniciais de lancamento.

## CostLedger

CostLedger registra custos estimados e metadados seguros de chamadas de IA por projeto. Ele nao chama IA por si so e nao bloqueia a geracao se o registro falhar.

O endpoint `GET /api/projects/:id/costs` retorna resumo e entradas recentes, enquanto `GET /api/projects/:id/costs/summary` retorna apenas o resumo. `estimatedCost` pode ser `null` quando tokens ou precos nao estiverem disponiveis. Esses valores sao estimativas operacionais e nao devem ser tratados como faturamento oficial.

Frontend:

```powershell
cd frontend
npm run dev
```

## Validacao

Comandos atualmente declarados:

```powershell
cd backend
npm test

cd ..\frontend
npm run build
npm run lint
```

O backend usa o test runner nativo do Node.js. Testes automatizados devem ser locais e deterministicos, sem chamadas reais a banco, IA, internet ou APIs externas.

Para validar somente o frontend:

```powershell
cd frontend
npm run build
npm run lint
```

## Politica de testes com IA

Testes automatizados nao devem chamar IA real nem APIs pagas. Use mocks, fakes ou fixtures locais para simular provedores externos.

Testes de integracao com servicos reais, quando existirem, devem ser opcionais, documentados e desabilitados por padrao.
