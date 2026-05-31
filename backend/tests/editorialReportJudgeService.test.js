const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildEditorialReportJudgeContext,
  buildEditorialReportJudgePrompt,
  parseEditorialReportJudgeResponse,
  judgeEditorialReportForProject,
} = require('../services/editorialReportJudgeService');

function longText(prefix, count = 900) {
  return Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(' ');
}

function baseProject() {
  return {
    _id: 'project-1',
    name: 'A Casa no Vento',
    style: 'Fantasia urbana',
    language: 'Português Brasileiro',
    targetWordCount: 42000,
    premise: 'Uma jovem precisa escolher entre salvar a cidade e revelar sua origem.',
  };
}

function baseBookBrief() {
  return {
    _id: 'brief-secret',
    projectId: 'project-1',
    genre: 'Fantasia',
    subgenre: 'Fantasia urbana',
    targetAudience: 'Jovens adultos',
    tone: 'Tenso e esperançoso',
    narrativeVoice: 'Terceira pessoa limitada',
    corePromise: 'Uma investigação mágica com transformação pessoal.',
    protagonistWant: 'Provar que consegue proteger o bairro.',
    protagonistNeed: 'Aceitar ajuda e confiar na própria identidade.',
    centralConflict: 'O inimigo controla as memórias da cidade.',
    readerAppeal: ['mistério', 'magia brasileira'],
    mustInclude: ['bairro antigo'],
    mustAvoid: ['violência gráfica'],
  };
}

function baseBible() {
  return {
    summary: 'A protagonista investiga apagamentos de memória.',
    premise: 'Identidade é uma escolha ativa.',
    characters: [{ name: 'Lia', role: 'protagonist', motivation: 'Proteger a avó.' }],
    chapters: [{ chapterNumber: 1, title: 'O primeiro apagamento', beats: [{ id: 1, title: 'A pista' }] }],
  };
}

function baseScenes() {
  return [
    {
      _id: 'scene-1',
      title: 'A pista',
      chapterNumber: 1,
      beatId: 1,
      summary: 'Lia encontra o bilhete.',
      content: `${longText('opening', 500)} SECRET_FULL_MANUSCRIPT_MARKER ${longText('closing', 500)}`,
      wordCount: 1001,
    },
  ];
}

function baseEditorialReport(overrides = {}) {
  return {
    _id: 'report-1',
    projectId: 'project-1',
    source: 'ai_editorial',
    overallScore: 64,
    publishable: false,
    summary: 'A história tem promessa clara, mas precisa de decisões macro.',
    scores: { structureScore: 62, characterScore: 68 },
    editorialPasses: [
      {
        id: 'structural_editor',
        name: 'Structural Editor',
        score: 62,
        summary: 'O midpoint ainda não muda a direção da trama.',
        findings: [{ code: 'MIDPOINT_WEAK', severity: 'high', message: 'A virada central não força nova estratégia.' }],
      },
    ],
    findings: [
      {
        code: 'PROTAGONIST_PASSIVE',
        category: 'character',
        severity: 'high',
        message: 'A protagonista reage mais do que escolhe.',
        evidence: 'A pista chega sem busca ativa.',
        suggestions: ['Fazer Lia escolher o risco.'],
        sceneId: 'scene-1',
      },
    ],
    openQuestions: [{ question: 'O segredo de Lia deve ser público no clímax?', whyItMatters: 'Define payoff emocional.' }],
    revisionPlan: {
      macro: [{ priority: 'high', title: 'Fortalecer midpoint', reason: 'A trama precisa virar.', actions: ['Adicionar perda'] }],
      sceneLevel: [{ priority: 'medium', sceneId: 'scene-1', issue: 'Conflito baixo', recommendedAction: 'rewrite' }],
    },
    metadata: { contextTruncated: false, sceneCount: 1, includedSceneCount: 1, totalWordCount: 1001 },
    ...overrides,
  };
}

function validJudgeResponse(overrides = {}) {
  return {
    scores: {
      overallUsefulness: 4,
      specificity: 3,
      clarity: 4,
      priorityAccuracy: 2,
      easeOfUse: 4,
      bookBriefRespect: 5,
      genrePromiseUnderstanding: 4,
      openQuestionQuality: 3,
      revisionPlanQuality: 2,
    },
    averageScore: 3.4,
    bestFinding: {
      code: 'PROTAGONIST_PASSIVE',
      whyItWorks: 'Cita evidência da cena 1 e discute agência.',
    },
    worstFinding: {
      code: 'VOICE_GENERIC',
      whyItFails: 'Não cita trecho nem cena específica.',
    },
    mostUsefulSuggestion: 'Fazer Lia escolher um risco concreto.',
    genericOrWrongSuggestion: 'Aumentar tensão sem dizer onde.',
    helpfulQuestion: 'Qual risco Lia escolhe assumir?',
    unhelpfulQuestion: 'A história está boa?',
    calibrationAdvice: ['Forçar evidência por cena em findings high/critical.'],
    readyForRewriteStudio: false,
    recommendedNextStep: 'calibrate_editorial_prompt',
    summary: 'O relatório é útil, mas prioriza mal a revisão.',
    ...overrides,
  };
}

test('buildEditorialReportJudgeContext uses sanitized context instead of full manuscript', () => {
  const context = buildEditorialReportJudgeContext({
    project: baseProject(),
    bookBrief: baseBookBrief(),
    bible: baseBible(),
    scenes: baseScenes(),
    editorialReport: baseEditorialReport(),
  });

  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes('SECRET_FULL_MANUSCRIPT_MARKER'), false);
  assert.equal(serialized.includes('brief-secret'), false);
  assert.equal(context.editorialQualityReport.source, 'ai_editorial');
  assert.equal(context.editorialQualityReport.findings[0].code, 'PROTAGONIST_PASSIVE');
});

test('buildEditorialReportJudgePrompt includes Q2.1 criteria and safety rules', () => {
  const context = buildEditorialReportJudgeContext({
    project: baseProject(),
    bookBrief: baseBookBrief(),
    bible: baseBible(),
    scenes: baseScenes(),
    editorialReport: baseEditorialReport(),
  });
  const prompt = buildEditorialReportJudgePrompt(context);

  assert.match(prompt, /overallUsefulness/);
  assert.match(prompt, /specificity/);
  assert.match(prompt, /priorityAccuracy/);
  assert.match(prompt, /bookBriefRespect/);
  assert.match(prompt, /genrePromiseUnderstanding/);
  assert.match(prompt, /openQuestionQuality/);
  assert.match(prompt, /revisionPlanQuality/);
  assert.match(prompt, /Do not rewrite scenes/);
  assert.doesNotMatch(prompt, /SECRET_FULL_MANUSCRIPT_MARKER/);
});

test('parseEditorialReportJudgeResponse accepts fenced JSON and normalizes score range', () => {
  const response = validJudgeResponse({
    scores: {
      overallUsefulness: 7,
      specificity: 0,
      clarity: 4,
      priorityAccuracy: 2,
      easeOfUse: 4,
      bookBriefRespect: 5,
      genrePromiseUnderstanding: 4,
      openQuestionQuality: 3,
      revisionPlanQuality: 2,
    },
  });
  const parsed = parseEditorialReportJudgeResponse(`\`\`\`json\n${JSON.stringify(response)}\n\`\`\``);

  assert.equal(parsed.scores.overallUsefulness, 5);
  assert.equal(parsed.scores.specificity, 1);
  assert.equal(parsed.averageScore, 3.3);
  assert.equal(parsed.bestFinding.code, 'PROTAGONIST_PASSIVE');
});

test('parseEditorialReportJudgeResponse allows ready only when average and critical criteria are good', () => {
  const parsed = parseEditorialReportJudgeResponse(validJudgeResponse({
    scores: {
      overallUsefulness: 5,
      specificity: 5,
      clarity: 5,
      priorityAccuracy: 3,
      easeOfUse: 5,
      bookBriefRespect: 5,
      genrePromiseUnderstanding: 5,
      openQuestionQuality: 5,
      revisionPlanQuality: 5,
    },
    readyForRewriteStudio: true,
    recommendedNextStep: 'ready_for_rewrite_studio',
  }));

  assert.equal(parsed.averageScore, 4.8);
  assert.equal(parsed.readyForRewriteStudio, false);
  assert.equal(parsed.recommendedNextStep, 'test_with_larger_project');
});

test('judgeEditorialReportForProject uses fake AI provider, saves evaluation, and avoids raw logs', async () => {
  let capturedPrompt = '';
  let saved = false;
  const logLines = [];
  const originalLog = console.log;
  const originalError = console.error;
  const fakeQuery = value => ({ sort: () => Promise.resolve(value) });
  const report = {
    ...baseEditorialReport(),
    save: async function save() {
      saved = true;
      return this;
    },
  };

  console.log = (...args) => logLines.push(JSON.stringify(args));
  console.error = (...args) => logLines.push(JSON.stringify(args));

  try {
    const evaluation = await judgeEditorialReportForProject('project-1', 'report-1', {
      Project: { findById: async () => baseProject() },
      Bible: { findOne: async () => baseBible() },
      Scene: { find: () => fakeQuery(baseScenes()) },
      QualityReport: { findOne: async () => report },
      bookBriefService: { getBookBriefByProjectId: async () => baseBookBrief() },
      generateStructured: async ({ prompt }) => {
        capturedPrompt = prompt;
        return {
          data: validJudgeResponse({ summary: 'SECRET_RESPONSE_MARKER' }),
          config: { provider: 'fake', model: 'fake-judge' },
        };
      },
    });

    assert.equal(saved, true);
    assert.equal(evaluation.averageScore, 3.4);
    assert.equal(report.editorialJudge.metadata.provider, 'fake');
    assert.equal(capturedPrompt.includes('SECRET_FULL_MANUSCRIPT_MARKER'), false);
    assert.equal(logLines.join('\n').includes(capturedPrompt), false);
    assert.equal(logLines.join('\n').includes('SECRET_RESPONSE_MARKER'), false);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});
