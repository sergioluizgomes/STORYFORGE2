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

## Desenvolvimento

Backend:

```powershell
cd backend
npm run dev
```

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
