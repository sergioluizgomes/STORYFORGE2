# BATCH_FORMAT.md — Geração de Projetos em Lote

Este documento descreve o formato JSON usado para criar múltiplos projetos de uma só vez no StoryForge, utilizando a página **Lote de Projetos** (`/batch`).

---

## Estrutura Geral

O JSON de entrada deve ser um **array** de objetos. Cada objeto representa um projeto a ser criado e gerado automaticamente.

```json
[
  { ... projeto 1 ... },
  { ... projeto 2 ... },
  { ... projeto N ... }
]
```

Os projetos são processados **sequencialmente**: o projeto 2 só começa depois que o projeto 1 finalizar completamente (análise + bíblia + cenas). O processamento ocorre no servidor — você pode fechar o browser sem interromper a geração.

---

## Campos de Cada Projeto

| Campo              | Tipo     | Obrigatório | Descrição |
|--------------------|----------|-------------|-----------|
| `name`             | string   | **Sim**     | Nome do projeto. Aparecerá no Dashboard. |
| `sourceText`       | string   | **Sim**     | Texto fonte completo. É a matéria-prima para análise e geração da bíblia. |
| `language`         | string   | Não         | Idioma do projeto. Padrão: `"Português Brasileiro"`. |
| `narrativeStyle`   | string   | Não         | Nome exato do estilo narrativo cadastrado no sistema (ex: `"Thriller Psicológico"`). |
| `imageStyle`       | string   | Não         | Nome exato do estilo de imagem cadastrado no sistema (ex: `"Cinematográfico"`). |
| `premise`          | string   | Não         | A verdade central que a história deve provar. Orienta o tom e a conclusão. |
| `chapters`         | array    | Não         | Estrutura de capítulos. Se omitido, o sistema define automaticamente. |
| `aiProvider`       | string   | Não         | Provider de IA: `"gemini"` ou `"lm-studio"`. Usa o padrão do sistema se omitido. |
| `aiModel`          | string   | Não         | Modelo específico dentro do provider (ex: `"gemini-2.5-pro-preview-05-06"`). |

---

## Estrutura de Capítulos (`chapters`)

Cada item do array `chapters` representa um capítulo da história:

```json
{
  "number":      1,
  "type":        "NORMAL",
  "description": "Intenção do usuário para este capítulo (opcional)"
}
```

| Campo         | Tipo    | Obrigatório | Descrição |
|---------------|---------|-------------|-----------|
| `number`      | number  | **Sim**     | Número do capítulo (deve ser sequencial começando em 1). |
| `type`        | string  | **Sim**     | Tipo do capítulo (ver tabela abaixo). |
| `description` | string  | Não         | Intenção narrativa para este capítulo. O AI usará como orientação. |

### Tipos de Capítulo

| Tipo          | Palavras alvo  | Quando usar |
|---------------|----------------|-------------|
| `NORMAL`      | 2.500 – 4.000  | Desenvolvimento padrão de enredo e personagens. Ritmo equilibrado. |
| `ACTION`      | 1.800 – 3.000  | Ação intensa, confronto físico, set pieces. Frases curtas e ritmo acelerado. |
| `REVELATION`  | 3.500 – 5.500  | Revelações, viradas de trama, momentos de anagnorisis (descoberta). Ritmo mais lento. |
| `FINAL`       | 3.000 – 6.000  | Clímax e resolução. Apostas máximas, conclusão que prova a premissa. |

> **Heurística automática** (quando `chapters` é omitido): capítulo do meio vira `REVELATION`, último vira `FINAL`, demais são `NORMAL`. O número de capítulos padrão é 12.

---

## Idiomas (`language`)

O campo `language` é uma string livre passada diretamente ao modelo de IA. Use a grafia correta do idioma desejado. Exemplos testados e recomendados:

| Valor                     | Idioma gerado        |
|---------------------------|----------------------|
| `"Português Brasileiro"`  | Português do Brasil  |
| `"Português Europeu"`     | Português de Portugal |
| `"English"`               | Inglês (EUA)         |
| `"British English"`       | Inglês britânico     |
| `"Español"`               | Espanhol             |
| `"Español Latinoamericano"` | Espanhol latino-americano |
| `"Français"`              | Francês              |
| `"Deutsch"`               | Alemão               |
| `"Italiano"`              | Italiano             |
| `"日本語"`                 | Japonês              |

Qualquer idioma pode ser especificado — o AI irá gerar o conteúdo no idioma informado.

---

## Estilos Narrativos (`narrativeStyle`)

O valor deve corresponder **exatamente** ao nome cadastrado (case-sensitive). Estilos disponíveis no sistema:

| Nome                    | Descrição resumida |
|-------------------------|--------------------|
| `"Space Opera"`         | Aventuras épicas no espaço profundo, civilizações alienígenas, batalhas estelares. |
| `"Cyberpunk"`           | Alta tecnologia e vida degradada. Corporações, hacking, identidade vs. máquina. |
| `"High Fantasy"`        | Mundos secundários com magia, criaturas míticas e jornadas do herói. |
| `"Noir Mystery"`        | Detetive melancólico em cidade corrupta. Monólogo interno, ambiguidade moral. |
| `"Lovecraftian Horror"` | Horror cósmico, seres incompreensíveis, deterioração mental progressiva. |
| `"Steampunk"`           | Era vitoriana reimaginada com vapor e engrenagens. Industrioso e ornamentado. |
| `"Grimdark Fantasy"`    | Fantasia violenta e amoral. Personagens profundamente falhos, sem heroísmo tradicional. |
| `"Psychological Thriller"` | Suspense focado em estados mentais. Narradores não confiáveis, tensão interna. |
| `"Urban Fantasy"`       | Elementos mágicos em cenário urbano moderno. Sociedades ocultas, sobrenatural no cotidiano. |
| `"Hard Sci-Fi"`         | Ficção científica com rigor científico. Tom analítico, consequências da tecnologia. |
| `"Realismo Mágico"`     | Eventos sobrenaturais tratados como ordinários em cenário realista. |
| `"Thriller de Ação"`    | Ação intensa, ritmo frenético, protagonista competente sob pressão extrema. |
| `"Ficção Histórica"`    | Narrativa ancorada em períodos históricos reais com personagens ficcionais. |
| `"Drama Literário"`     | Foco em desenvolvimento humano, prosa densa, exploração psicológica profunda. |
| `"Horror Visceral"`     | Horror corpóreo, imagens perturbadoras, impacto físico e psicológico. |

> Para consultar os estilos diretamente do banco: `GET /api/narrative-styles`

---

## Estilos de Imagem (`imageStyle`)

Usado para geração das imagens de capa e ilustrações de cenas. O valor deve corresponder **exatamente** ao nome cadastrado (case-sensitive):

| Nome                | Estética |
|---------------------|----------|
| `"Cinematic"`       | Cinematográfico, iluminação profissional, profundidade de campo, sombras dramáticas. |
| `"Cyberpunk"`       | Neon, ruas molhadas de chuva, tons azul e magenta, alto contraste. |
| `"Anime/Manga"`     | Estilo anime, cores vibrantes, linhas limpas, cel-shading. |
| `"High Fantasy"`    | Alta fantasia épica, atmosfera mágica, detalhes dourados, luz etérea. |
| `"Oil Painting"`    | Pintura a óleo clássica, pinceladas visíveis, texturas ricas, iluminação quente. |
| `"Pencil Sketch"`   | Esboço a lápis, grafite, hachura cruzada, fundo de pergaminho. |
| `"Noir/Monochrome"` | Film noir, preto e branco, iluminação de alto contraste, atmosfera sombria. |
| `"Art Deco"`        | Art déco, padrões geométricos, cores ousadas, elegância anos 1920. |
| `"Retro Futurist"`  | Retrofuturismo anos 1950, paleta teal e laranja, sci-fi vintage. |
| `"Steampunk"`       | Engrenagens de latão e cobre, vapor, moda vitoriana, tons sépia. |
| `"Hyper Realistic"` | Hiper-realista, fotorrealista, detalhe extremo, 8k. |
| `"Vaporwave"`       | Glitch art, retro anos 80, pastel rosa e ciano, lo-fi. |
| `"Ukiyo-e"`         | Xilogravura japonesa tradicional, linhas ousadas, cores planas. |
| `"Post-Apocalyptic"` | Wasteland, pó, superfícies desgastadas, cores dessaturadas, gritty. |
| `"Watercolor"`      | Aquarela, bordas suaves, cores que sangram, textura de papel. |
| `"Gothic Horror"`   | Horror gótico, escuro e sinistro, névoa, detalhes vitorianos ornamentados. |
| `"Synthwave"`       | Synthwave, grade anos 80, pôr do sol, brilho neon, retro-digital. |
| `"Pop Art"`         | Pop art, contornos ousados, padrões de pontos, cores vibrantes de quadrinhos. |
| `"Minimalist"`      | Design minimalista, linhas limpas, formas simples, paleta limitada. |
| `"Surrealism"`      | Surrealismo, imagens oníricas, geometria impossível, vívido e estranho. |
| `"Lovecraftian"`    | Horror lovecraftiano, tons verde escuro e roxo profundo, ruínas ancestrais. |
| `"Dark Fantasy"`    | Fantasia sombria, opressivo, restos esqueléticos, torres de obsidiana. |
| `"Ink Drawing"`     | Desenho a tinta, preto e branco de alto contraste, linhas finas, pontilhismo. |
| `"Cybernoir"`       | Cyberpunk + film noir, ruas futuristas chuvosas, néon em poças, silhuetas. |
| `"Pulp Fiction"`    | Capa de revista pulp anos 1940, tipografia ousada, ação dramática, cores envelhecidas. |

> Para consultar os estilos diretamente do banco: `GET /api/styles`

> Se um nome não for encontrado, o item do lote falhará com uma mensagem clara indicando qual estilo não existe.

---

## Exemplo Completo

```json
[
  {
    "name": "A Cidade dos Desaparecidos",
    "language": "Português Brasileiro",
    "narrativeStyle": "Thriller Psicológico",
    "imageStyle": "Cinematográfico",
    "premise": "A memória coletiva de um povo é mais forte do que qualquer censura.",
    "sourceText": "Era uma vez uma cidade esquecida pelo tempo, onde os moradores guardavam segredos que ninguém ousava contar. Os muros tinham olhos e as ruas tinham ouvidos...",
    "chapters": [
      { "number": 1, "type": "NORMAL",     "description": "Apresentar a cidade e o protagonista, estabelecer o mistério inicial" },
      { "number": 2, "type": "ACTION",     "description": "Primeira crise: o protagonista descobre a primeira pista perigosa" },
      { "number": 3, "type": "NORMAL",     "description": "Aprofundamento nas relações e no passado da cidade" },
      { "number": 4, "type": "REVELATION", "description": "Revelação sobre quem realmente controla os segredos" },
      { "number": 5, "type": "ACTION",     "description": "Perseguição e confronto com as forças antagonistas" },
      { "number": 6, "type": "FINAL",      "description": "Clímax: a verdade é revelada ao mundo, o protagonista paga o preço" }
    ]
  },
  {
    "name": "The Last Signal",
    "language": "English",
    "narrativeStyle": "Space Opera",
    "premise": "Even in the void between stars, hope finds a frequency.",
    "sourceText": "The colony ship Meridian drifted for three hundred years before anyone noticed the signal. Dr. Yael Cohen was the first to hear it — a rhythmic pulse from a dead star...",
    "chapters": [
      { "number": 1, "type": "NORMAL",     "description": "Establish the Meridian and its crew" },
      { "number": 2, "type": "ACTION",     "description": "The signal triggers a catastrophic systems failure" },
      { "number": 3, "type": "REVELATION", "description": "The signal is a warning, not an invitation" },
      { "number": 4, "type": "FINAL",      "description": "Sacrifice to save the fleet" }
    ]
  },
  {
    "name": "Três Por Quatro",
    "language": "Português Brasileiro",
    "narrativeStyle": "Drama Contemporâneo",
    "premise": "O amor verdadeiro exige coragem de ser visto.",
    "sourceText": "Mariana sempre soube que havia algo diferente em si. Não era o cabelo, nem o jeito de andar — era a forma como o mundo parecia menor quando ela fechava os olhos...",
    "aiProvider": "lm-studio",
    "aiModel": "qwen/qwen3-14b",
    "chapters": [
      { "number": 1, "type": "NORMAL",  "description": "Mariana e seu mundo cotidiano" },
      { "number": 2, "type": "NORMAL",  "description": "O encontro que muda tudo" },
      { "number": 3, "type": "FINAL",   "description": "A escolha definitiva" }
    ]
  }
]
```

---

## Fluxo de Execução

Após submeter o lote pela interface `/batch`, o seguinte ocorre:

```
1. Backend valida todos os itens
2. Cria um BatchJob no banco de dados (retorna batchId imediatamente)
3. Para cada projeto na ordem do array:
   a. Resolve narrativeStyle e imageStyle pelo nome
   b. Cria o documento Project (status: "new")
   c. Grava o sourceText em um arquivo temporário em uploads/
   d. Executa o pipeline completo:
      ├─ Fase 1: Análise do texto fonte
      ├─ Fase 2: Geração da Bíblia (personagens, configurações, capítulos, beats)
      ├─ Fase 3: Enriquecimento de beats (descrições visuais)
      └─ Fase 4: Geração de cenas (uma por beat)
   e. Atualiza status do item: "completed" ou "failed"
4. Marca o BatchJob como finalizado
```

> A UI faz polling a cada 5 segundos em `GET /api/batch/:id` enquanto o status for `"running"`.

---

## API Endpoints

| Método   | Endpoint             | Descrição |
|----------|----------------------|-----------|
| `POST`   | `/api/batch`         | Inicia um novo lote. Corpo: array de projetos. Retorna `{ batchId }`. |
| `GET`    | `/api/batch/:id`     | Retorna o BatchJob completo com status de cada item. |
| `DELETE` | `/api/batch/:id`     | Cancela itens pendentes. Itens em execução terminam normalmente. |

### Resposta de `GET /api/batch/:id`

```json
{
  "_id": "683abc...",
  "status": "running",
  "createdAt": "2026-04-21T14:00:00.000Z",
  "startedAt": "2026-04-21T14:00:01.000Z",
  "completedAt": null,
  "items": [
    {
      "index": 0,
      "config": { "name": "Projeto 1", "..." : "..." },
      "projectId": "683def...",
      "status": "completed",
      "error": null,
      "startedAt": "2026-04-21T14:00:01.000Z",
      "completedAt": "2026-04-21T14:47:22.000Z"
    },
    {
      "index": 1,
      "config": { "name": "Projeto 2", "..." : "..." },
      "projectId": null,
      "status": "running",
      "error": null,
      "startedAt": "2026-04-21T14:47:23.000Z",
      "completedAt": null
    }
  ]
}
```

### Status possíveis do BatchJob

| Status                 | Significado |
|------------------------|-------------|
| `pending`              | Aguardando início |
| `running`              | Processando itens |
| `completed`            | Todos os itens concluídos com sucesso |
| `completed_with_errors`| Alguns itens falharam ou foram cancelados |
| `failed`               | Todos os itens falharam |
| `cancelled`            | Lote cancelado manualmente |

### Status possíveis de cada item

| Status      | Significado |
|-------------|-------------|
| `pending`   | Aguardando vez de ser processado |
| `running`   | Pipeline de geração em execução |
| `completed` | Projeto gerado com sucesso (status `ready`) |
| `failed`    | Ocorreu um erro — ver campo `error` |
| `cancelled` | Cancelado antes de iniciar |

---

## Dicas e Limitações

- **Máximo de 50 projetos por lote.** Para lotes maiores, divida em múltiplas submissões.
- **Tempo de geração**: cada projeto leva em média 15–60 minutos dependendo do número de capítulos, tamanho do texto fonte e velocidade do provider de IA.
- **`sourceText`**: não há limite rígido de tamanho, mas apenas os primeiros 30.000 caracteres são usados na análise inicial.
- **Nomes de estilo devem ser exatos** (case-sensitive). Use os endpoints de listagem para confirmar os nomes disponíveis.
- **O lote roda no servidor**: fechar o browser não interrompe a geração. Você pode retornar a `/batch` e consultar o batchId para ver o progresso.
- **Projetos gerados aparecem no Dashboard** assim que cada um for finalizado, independente dos demais.
- **Erros são isolados**: se um projeto falhar, os próximos continuam normalmente.
