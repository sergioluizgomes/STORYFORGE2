# Formato de Importação de Projeto (JSON)

Este documento descreve a estrutura do arquivo JSON utilizado para importar projetos completos no StoryForge.

## Estrutura Geral

O arquivo JSON deve conter três chaves principais na raiz:

```json
{
  "project": { ... },
  "bible": { ... },
  "scenes": [ ... ]
}
```

---

## 1. Objeto `project`

Contém os metadados e configurações iniciais do projeto.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `name` | String | Sim | Nome do projeto. |
| `style` | String | Não | Estilo narrativo (ex: "Space Opera", "Thriller"). Padrão: "General". |
| `language` | String | Não | Idioma do projeto (ex: "Português Brasileiro"). |
| `premise` | String | Não | A premissa ou "verdade a ser provada" da história. |
| `imageStyle` | String | Não | Nome ou ID do estilo de imagem a ser usado. |
| `initialChapterStructure` | Array | Não | Estrutura planejada de capítulos. |

### Exemplo de `initialChapterStructure`:
```json
[
  {
    "number": 1,
    "type": "NORMAL",
    "description": "Introdução do herói e seu mundo normal."
  },
  {
    "number": 2,
    "type": "ACTION",
    "description": "O incidente incitante."
  }
]
```

---

## 2. Objeto `bible`

Contém o "Story Bible" gerado ou definido, incluindo personagens, cenários e a estrutura detalhada da trama.

**A estrutura é hierárquica:** `chapters` → `beats` → `scenes` (referenciadas por `beatId`).

| Campo | Tipo | Descrição |
|---|---|---|
| `summary` | String | Resumo geral da história. |
| `premise` | String | Premissa expandida. |
| `theCrucible` | String | Descrição do "Crucible" (o conflito inevitável). |
| `characters` | Array | Lista de personagens. |
| `settings` | Array | Lista de cenários/locais. |
| `chapters` | Array | **Hierarquia principal:** cada capítulo contém seus `beats[]`. |

**Nota:** Não use uma lista separada `bible.beats[]`. Os beats devem estar sempre dentro de seus respectivos capítulos.

### Estrutura de `characters`:
```json
{
  "name": "John Doe",
  "role": "Protagonista",
  "archetype": "Hero",
  "description": "Um detetive cansado...",
  "rulingPassion": "Justiça a qualquer custo",
  "theWound": "Perdeu o parceiro no passado",
  "visualDescription": "Alto, casaco cinza..."
}
```

### Estrutura de `chapters` (dentro da bíblia):

**Hierarquia:** Cada capítulo contém seus beats, e cada beat é referenciado por cenas no array `scenes[]`.

```json
{
  "chapterNumber": 1,
  "title": "O Início",
  "type": "NORMAL",
  "aiSummary": "Resumo do que acontece...",
  "beats": [
    {
      "id": 101,
      "title": "Beat 1",
      "description": "Descrição da ação neste beat.",
      "type": "Action"
    },
    {
      "id": 102,
      "title": "Beat 2",
      "description": "Continuação...",
      "type": "Mystery"
    }
  ]
}
```

**Importante:** 
- Use IDs únicos para beats (ex: 101, 102 para capítulo 1; 201, 202 para capítulo 2)
- Os beats devem estar SEMPRE dentro de seus capítulos, não em uma lista separada
- Cada beat pode ter múltiplas scenes associadas no array `scenes[]`

---

## 3. Array `scenes`

Contém o texto gerado para cada cena. **Cada cena está vinculada a um beat específico através do `beatId`.**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `beatId` | Number | Sim | ID do beat correspondente em `bible.chapters[].beats[]`. |
| `chapterNumber` | Number | Sim | Número do capítulo (redundante mas útil para consultas). |
| `title` | String | Não | Título da cena (geralmente igual ao título do beat). |
| `content` | String | Sim | O texto completo da cena (prosa). |
| `summary` | String | Não | Resumo do conteúdo gerado. |

**Hierarquia de Navegação:**
```
Project → Bible → Chapters[] → Beats[] ← Scenes[] (referência via beatId)
```

**Exemplo:** Para encontrar todas as cenas do Capítulo 1, Beat 101:
- Navegue até `bible.chapters[0].beats[0]` (beat com `id: 101`)
- Busque em `scenes[]` todas as entradas com `beatId: 101`

---

## Exemplo Completo (Template)

```json
{
  "project": {
    "name": "A Vingança de Cyber-Noir",
    "style": "Cyberpunk Noir",
    "language": "Português Brasileiro",
    "premise": "A tecnologia não pode curar uma alma quebrada.",
    "initialChapterStructure": [
      { "number": 1, "type": "NORMAL", "description": "Apresentação" }
    ]
  },
  "bible": {
    "summary": "Um detetive investiga um assassinato em Neo-Tokyo.",
    "theCrucible": "Ele deve escolher entre a lei e a vingança.",
    "characters": [
      {
        "name": "Kael",
        "role": "Protagonista",
        "archetype": "Hard-boiled Detective",
        "rulingPassion": "Verdade",
        "theWound": "Perdeu seu parceiro para corrupção corporativa",
        "description": "Ciborgue detetive com implantes obsoletos.",
        "visualDescription": "Olhos cibernéticos azuis, cicatrizes de cirurgias mal-feitas."
      }
    ],
    "settings": [
      {
        "name": "Neo-Tokyo Lower District",
        "description": "Ruas encharcadas de chuva ácida, neon e miséria."
      }
    ],
    "chapters": [
      {
        "chapterNumber": 1,
        "title": "A Chuva Ácida",
        "type": "NORMAL",
        "aiSummary": "Kael é chamado para investigar um corpo no distrito industrial.",
        "beats": [
          {
            "id": 101,
            "title": "Kael acorda",
            "description": "Kael acorda com uma ressaca digital e recebe a chamada.",
            "type": "Action"
          },
          {
            "id": 102,
            "title": "A cena do crime",
            "description": "Kael chega ao local e encontra pistas perturbadoras.",
            "type": "Mystery"
          }
        ]
      },
      {
        "chapterNumber": 2,
        "title": "Conexões Sombrias",
        "type": "THRILLER",
        "aiSummary": "A investigação leva Kael a territórios perigosos.",
        "beats": [
          {
            "id": 201,
            "title": "Interrogatório",
            "description": "Kael interroga uma testemunha relutante.",
            "type": "Thriller"
          }
        ]
      }
    ]
  },
  "scenes": [
    {
      "beatId": 101,
      "chapterNumber": 1,
      "title": "Kael acorda",
      "content": "A luz neon piscava através das persianas metálicas. Kael abriu os olhos cibernéticos, a visão ainda embaçada pelos resíduos de analgésicos digitais. O comunicador zuniu. Mais um corpo."
    },
    {
      "beatId": 102,
      "chapterNumber": 1,
      "title": "A cena do crime",
      "content": "O corpo estava estranhamente intacto. Muito intacto. Nenhum ferimento visível, mas os implantes neurais tinham sido queimados de dentro para fora..."
    },
    {
      "beatId": 201,
      "chapterNumber": 2,
      "title": "Interrogatório",
      "content": "A testemunha suava sob a luz fria do interrogatório. Kael sabia que ela estava mentindo. A questão era: para quem?"
    }
  ]
}
```

---

## Resumo da Hierarquia

```
PROJECT (metadados)
  │
  └── BIBLE (contexto narrativo)
        ├── characters[] (personagens)
        ├── settings[] (cenários)
        └── chapters[] (capítulos)
              └── beats[] (momentos narrativos)
                    ↑
                    │ (referenciado via beatId)
                    │
SCENES[] (conteúdo escrito)
```

**Regras importantes:**
1. Beats devem estar SEMPRE dentro de `chapters[]`, nunca em lista separada
2. Cada beat tem um `id` único (recomendado: 101-105 para cap 1, 201-205 para cap 2, etc.)
3. Scenes referenciam beats através do `beatId`
4. Um beat pode ter múltiplas scenes (cenas)
