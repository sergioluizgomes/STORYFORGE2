# AGENTS.md

Diretrizes para agentes e contribuidores trabalhando no StoryForge.

## Escopo

Este documento vale para todo o repositorio. Regras mais especificas podem ser adicionadas em subpastas quando houver necessidades locais, mas nao devem enfraquecer estas diretrizes.

## Regras de desenvolvimento

- Preserve a arquitetura existente do projeto antes de introduzir novos padroes.
- Mantenha mudancas pequenas, revisaveis e ligadas a uma tarefa clara.
- Evite refatoracoes oportunistas junto com correcoes ou novas funcionalidades.
- Documente decisoes que afetem fluxo editorial, geracao de conteudo, persistencia, custos ou seguranca.
- Nunca altere contrato de API, formato de dados, prompts, filas ou saidas exportadas sem registrar impacto e estrategia de compatibilidade.
- Prefira nomes explicitos e fluxos legiveis a abstracoes prematuras.

## Segredos e chaves

- Nunca exponha chaves, tokens, credenciais, connection strings ou valores de `.env` em codigo, testes, logs, screenshots, fixtures ou documentacao publica.
- Use variaveis de ambiente para configuracao sensivel.
- Se uma chave for acidentalmente exposta, trate como comprometida: remova do repositorio, registre o incidente e rotacione a credencial fora do codigo.

## Testes

- Toda mudanca funcional deve vir acompanhada de testes proporcionais ao risco.
- Antes de abrir PR, execute os testes e validacoes disponiveis para a area alterada.
- Se ainda nao houver cobertura automatizada adequada, registre a lacuna no PR e inclua uma verificacao manual objetiva.
- Bugs corrigidos devem ganhar teste de regressao sempre que tecnicamente viavel.

## IA em testes

- Testes automatizados nao devem chamar provedores reais de IA, APIs pagas ou servicos externos nao controlados.
- Use mocks, fakes, fixtures e adaptadores locais para simular respostas de IA.
- Testes nao devem depender de aleatoriedade nao controlada, rede externa, saldo de conta, rate limit ou disponibilidade de fornecedor.
- Qualquer teste de integracao com IA real deve ser opt-in, isolado, documentado e desabilitado por padrao.

## Padrao de resumo de PR

Todo PR deve incluir:

```md
## Resumo
- O que mudou.
- Por que mudou.

## Validacao
- Testes automatizados executados.
- Verificacoes manuais, quando aplicavel.

## Riscos e rollback
- Riscos conhecidos.
- Como reverter ou mitigar rapidamente.

## Compatibilidade
- Impactos em API, dados, prompts, filas, exportacoes ou UI.
- Estrategia para manter compatibilidade com o comportamento existente.
```

## Tratamento de erros

- Erros esperados devem retornar mensagens claras, acionaveis e sem vazar detalhes sensiveis.
- Logs devem conter contexto suficiente para diagnostico, sem incluir conteudo confidencial, chaves, manuscritos completos ou dados de usuario desnecessarios.
- Falhas de IA, fila, banco, arquivo ou exportacao devem ser tratadas de forma previsivel, com status coerente e possibilidade de nova tentativa quando fizer sentido.
- Nao silencie excecoes. Quando uma falha for recuperavel, registre a causa e o caminho de recuperacao.
- Diferencie erro de validacao, erro operacional temporario e erro interno.

## Compatibilidade com o projeto existente

- Mantenha os scripts, rotas, modelos, nomes de campos e formatos ja usados, salvo quando a tarefa exigir mudanca explicita.
- Ao evoluir contratos, prefira mudancas aditivas e migracoes graduais.
- Nao remova dependencias, endpoints, campos ou telas sem confirmar que nao ha consumidores.
- Preserve compatibilidade entre `backend` e `frontend`; mudancas em um lado devem considerar o outro.
- Antes de alterar comportamento editorial ou geracao de arquivos, compare com exemplos existentes e registre diferencas relevantes.

