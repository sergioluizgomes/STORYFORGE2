const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSanitizedStoryContext,
  pickApprovedFields,
  selectNarrativeMethods,
  suggestBookBriefForProject
} = require('../services/storyDirectionService');

function createQuery(value) {
  return {
    sort() {
      return this;
    },
    limit() {
      return Promise.resolve(value);
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    }
  };
}

test('method selector chooses mystery and character lenses without AI', () => {
  const selection = selectNarrativeMethods({
    genre: 'fantasia urbana',
    subgenre: 'misterio sobrenatural',
    targetAudience: 'jovens adultos',
    tone: 'sombrio emocional',
    detectedProblems: ['meio arrastado', 'protagonista reativa']
  });

  const selectedIds = selection.selected.map(method => method.id);
  assert.ok(selectedIds.includes('mice_quotient'));
  assert.ok(selectedIds.includes('character_arc'));
  assert.ok(selectedIds.includes('try_fail_cycles'));
  assert.equal(typeof selection.primaryLens, 'string');
});

test('sanitized story context truncates manuscript content before AI', () => {
  const fullScene = 'segredo '.repeat(200);
  const context = buildSanitizedStoryContext({
    project: {
      name: 'Projeto',
      style: 'misterio',
      language: 'Portugues Brasileiro',
      premise: 'premissa '.repeat(200),
      targetWordCount: 50000
    },
    bookBrief: {
      genre: 'Misterio',
      corePromise: 'resolver um segredo familiar'
    },
    bible: {
      summary: 'resumo '.repeat(300),
      characters: [{ name: 'Lia', role: 'protagonista', motivation: 'salvar o irmao', description: 'desc '.repeat(100) }],
      chapters: [{ chapterNumber: 1, title: 'Inicio', beats: [{ id: 1, title: 'Chamado', description: 'beat '.repeat(100) }] }]
    },
    scenes: [{ beatId: 1, chapterNumber: 1, title: 'Cena', content: fullScene, summary: 'sumario curto', wordCount: 200 }]
  });

  assert.ok(context.project.premise.length < 705);
  assert.ok(context.bible.summary.length < 1210);
  assert.ok(context.scenes[0].excerpt.length < 270);
  assert.notEqual(context.scenes[0].excerpt, fullScene);
});

test('mocked AI response is normalized into open questions and direction options', async () => {
  let saved = false;
  let promptSent = '';
  const project = {
    _id: { toString: () => 'project-id' },
    name: 'Livro',
    style: 'thriller de misterio',
    language: 'Portugues Brasileiro',
    premise: 'Uma jovem investiga uma divida sobrenatural.'
  };

  const result = await suggestBookBriefForProject('project-id', {
    Project: {
      findById: async () => project
    },
    Bible: {
      findOne: async () => ({
        summary: 'Resumo controlado',
        premise: 'Premissa controlada',
        characters: [],
        settings: [],
        chapters: []
      })
    },
    Scene: {
      find: () => createQuery([
        {
          beatId: 1,
          chapterNumber: 1,
          title: 'Cena 1',
          content: 'conteudo que deve ser resumido '.repeat(80),
          summary: 'A protagonista encontra uma pista.',
          status: 'draft',
          wordCount: 320
        }
      ])
    },
    bookBriefService: {
      getBookBriefByProjectId: async () => null,
      upsertBookBriefForProject: async () => {
        saved = true;
      }
    },
    generateStructured: async ({ prompt, schema, schemaName }) => {
      promptSent = prompt;
      assert.equal(schemaName, 'ai book brief suggestion');
      assert.equal(schema.type, 'object');
      return {
        data: {
          suggestedBookBrief: {
            genre: 'fantasia urbana',
            targetAudience: 'jovens adultos',
            corePromise: 'Uma jovem descobre uma divida sobrenatural.',
            centralConflict: 'Salvar o irmao sem repetir os erros da mae.',
            readerAppeal: ['misterio', 'segredos familiares']
          },
          confidence: 0.82,
          storyDiagnosis: {
            premise: 'Promessa clara de misterio familiar.',
            strengths: ['Conflito familiar forte'],
            weaknesses: ['Antagonista indefinida'],
            missingDecisions: ['Definir tipo de final']
          },
          recommendedMethods: [{ id: 'mice_quotient', name: 'MICE Quotient', reason: 'Promessa de pergunta.', priority: 'high' }],
          openQuestions: [{
            id: 'ending',
            question: 'O final deve ser tragico ou esperancoso?',
            whyItMatters: 'Define promessa emocional.',
            options: ['tragico', 'esperancoso'],
            recommendedOption: 'esperancoso',
            impact: 'high',
            scope: 'book'
          }],
          directionOptions: [{
            title: 'Misterio sombrio',
            description: 'Aumenta pistas e falsas suspeitas.',
            tonalImpact: 'mais tenso',
            plotImpact: 'mais investigativo',
            characterImpact: 'mais agencia',
            commercialImpact: 'melhor promessa de misterio',
            risks: ['exigir controle de pistas']
          }],
          risks: [{ issue: 'Antagonista vaga', severity: 'high', mitigation: 'definir antagonista cedo' }]
        }
      };
    }
  });

  assert.equal(saved, false);
  assert.equal(result.suggestedBookBrief.genre, 'fantasia urbana');
  assert.equal(result.openQuestions.length, 1);
  assert.equal(result.directionOptions.length, 1);
  assert.match(promptSent, /Sanitized project context/);
});

test('approved fields apply only explicit BookBrief fields', () => {
  const picked = pickApprovedFields({
    suggestedBookBrief: {
      genre: 'Misterio',
      centralConflict: 'Escolher entre familia e verdade',
      unsafeField: 'nao deve entrar'
    }
  }, ['genre', 'unsafeField', 'centralConflict']);

  assert.deepEqual(picked, {
    genre: 'Misterio',
    centralConflict: 'Escolher entre familia e verdade'
  });
});

test('AI BookBrief logs summarize counts and do not echo full prompts or scenes', async () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args);
  const secretScene = 'MANUSCRITO_COMPLETO_SECRETO '.repeat(60);

  try {
    await suggestBookBriefForProject('project-id', {
      Project: {
        findById: async () => ({
          _id: { toString: () => 'project-id' },
          name: 'Projeto',
          style: 'misterio'
        })
      },
      Bible: {
        findOne: async () => null
      },
      Scene: {
        find: () => createQuery([{ beatId: 1, content: secretScene, summary: 'resumo seguro' }])
      },
      bookBriefService: {
        getBookBriefByProjectId: async () => null
      },
      generateStructured: async () => ({
        data: {
          suggestedBookBrief: {
            genre: 'Misterio',
            targetAudience: 'Adulto',
            corePromise: 'Resolver uma pergunta.',
            centralConflict: 'Verdade contra seguranca.'
          },
          confidence: 70,
          storyDiagnosis: { premise: 'Premissa', strengths: [], weaknesses: [], missingDecisions: [] },
          recommendedMethods: [],
          openQuestions: [],
          directionOptions: [],
          risks: []
        }
      })
    });
  } finally {
    console.log = originalLog;
  }

  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /suggestion_generated/);
  assert.doesNotMatch(serializedLogs, /MANUSCRITO_COMPLETO_SECRETO/);
});
