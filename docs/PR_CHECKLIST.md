# PR_CHECKLIST.md

Use esta checklist antes de abrir ou revisar um PR no StoryForge.

## Escopo

- [ ] A mudanca esta limitada ao objetivo do PR.
- [ ] Nao ha refatoracoes ou ajustes cosmeticos sem relacao com a tarefa.
- [ ] O comportamento existente foi preservado ou a alteracao foi explicitamente documentada.
- [ ] Impactos em backend, frontend, dados, prompts, filas e exportacoes foram considerados.

## Seguranca

- [ ] Nenhuma chave, token, credencial ou valor de `.env` foi exposto.
- [ ] Logs e mensagens de erro nao vazam dados sensiveis.
- [ ] Entradas de usuario, uploads e payloads externos sao validados quando aplicavel.
- [ ] Dependencias novas foram justificadas e revisadas.

## Testes e validacao

- [ ] Testes automatizados relevantes foram adicionados ou atualizados.
- [ ] Testes nao chamam IA real, APIs pagas ou rede externa nao controlada.
- [ ] Mocks/fakes cobrem respostas de sucesso, erro e casos limite.
- [ ] Comandos de validacao foram executados e registrados no PR.
- [ ] Lacunas de teste foram descritas com verificacao manual objetiva.

## Tratamento de erros

- [ ] Erros esperados retornam mensagens claras e acionaveis.
- [ ] Falhas temporarias podem ser repetidas quando fizer sentido.
- [ ] Excecoes nao sao silenciosamente ignoradas.
- [ ] Estados de erro sao visiveis para usuario ou operador conforme o fluxo.

## Compatibilidade

- [ ] Contratos de API e formatos de dados continuam compativeis.
- [ ] Mudancas aditivas foram preferidas a quebras de contrato.
- [ ] Migracoes ou adaptacoes necessarias foram documentadas.
- [ ] Frontend e backend foram validados juntos quando a mudanca cruza camadas.

## Resumo esperado no PR

```md
## Resumo
- 

## Validacao
- 

## Riscos e rollback
- 

## Compatibilidade
- 
```

