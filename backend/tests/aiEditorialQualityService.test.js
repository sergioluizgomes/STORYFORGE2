const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildEditorialQualityContext,
  buildEditorialQualityPrompt,
  parseEditorialQualityResponse,
  generateAIEditorialQualityReportForProject,
} = require('../services/aiEditorialQualityService');

function longText(prefix, count = 1200) {
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
    contentGuidelines: {
      violenceLevel: 'moderate',
      sensitiveTopics: ['luto'],
    },
    notes: 'private note should not leak',
  };
}

function baseBible() {
  return {
    _id: 'bible-secret',
    summary: 'A protagonista investiga apagamentos de memória.',
    premise: 'Identidade é uma escolha ativa.',
    theCrucible: 'A cidade fecha as saídas à noite.',
    characters: [
      {
        name: 'Lia',
        role: 'protagonist',
        archetype: 'investigator',
        motivation: 'Proteger a avó.',
        description: longText('char', 120),
        relationships: [{ characterName: 'Nara', type: 'mentor', tension: 'segredos omitidos' }],
      },
    ],
    settings: [{ name: 'Bairro das Torres', type: 'bairro', description: longText('setting', 120) }],
    chapters: [
      {
        chapterNumber: 1,
        title: 'O primeiro apagamento',
        aiSummary: 'Lia descobre uma pista.',
        beats: [{ id: 1, title: 'A pista', description: 'Um bilhete aparece.' }],
      },
    ],
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
    ...Array.from({ length: 35 }, (_, index) => ({
      _id: `scene-extra-${index}`,
      title: `Extra ${index}`,
      chapterNumber: 2,
      beatId: index + 2,
      content: longText(`extra${index}`, 100),
      wordCount: 100,
    })),
  ];
}

function baseHeuristicReport() {
  return {
    overallScore: 72,
    publishable: false,
    summary: 'Heuristic report found pacing warnings.',
    scores: { structureScore: 70 },
    findings: [
      {
        code: 'QUALITY_SCENE_TOO_SHORT',
        category: 'pacing',
        severity: 'warning',
        message: 'Scene is very short.',
      },
    ],
  };
}

function validAiResponse() {
  return {
    overallScore: 64,
    publishable: false,
    summary: 'A história tem promessa clara, mas precisa de decisões macro.',
    scores: {
      structureScore: 62,
      characterScore: 68,
      sceneScore: 58,
      continuityScore: 72,
      voiceScore: 70,
      genrePromiseScore: 66,
      bookBriefAlignmentScore: 74,
      revisionReadinessScore: 55,
    },
    editorialPasses: [
      {
        id: 'structural_editor',
        name: 'Structural Editor',
        score: 62,
        summary: 'O midpoint ainda não muda a direção da trama.',
        findings: [
          {
            code: 'MIDPOINT_WEAK',
            severity: 'high',
            message: 'A virada central não força nova estratégia.',
            evidence: 'Cena 1 termina sem consequência clara.',
            suggestions: ['Criar custo imediato.'],
            requiresAuthorDecision: true,
            question: 'Qual perda a protagonista aceita aqui?',
          },
        ],
      },
    ],
    findings: [
      {
        code: 'PROTAGONIST_PASSIVE',
        category: 'character',
        severity: 'high',
        message: 'A protagonista reage mais do que escolhe.',
        evidence: 'A pista chega sem busca ativa.',
        impact: 'Reduz agência.',
        suggestions: ['Fazer Lia escolher o risco.'],
        chapterNumber: 1,
        beatId: 1,
        sceneId: 'scene-1',
        requiresAuthorDecision: true,
        question: 'Qual risco Lia escolhe assumir?',
      },
    ],
    openQuestions: [
      {
        question: 'O segredo de Lia deve ser público no clímax?',
        whyItMatters: 'Define payoff emocional.',
        options: ['Revelar', 'Manter oculto'],
        recommendedOption: 'Revelar',
        impact: 'high',
        affectedArea: 'climax',
      },
    ],
    revisionPlan: {
      macro: [{ priority: 'high', title: 'Fortalecer midpoint', reason: 'A trama precisa virar.', actions: ['Adicionar perda'] }],
      sceneLevel: [{ priority: 'medium', chapterNumber: 1, sceneId: 'scene-1', issue: 'Conflito baixo', recommendedAction: 'rewrite' }],
      lineLevel: [{ priority: 'low', issue: 'Exposição direta', action: 'Converter em ação' }],
      authorDecisions: [{ question: 'Revelar segredo?', options: ['Sim', 'Não'], recommendedOption: 'Sim' }],
    },
    recommendedMethods: [{ id: 'character_arc', name: 'Character arc', reason: 'Want/need guiam revisão.' }],
    metadata: { contextTruncated: false },
  };
}

test('buildEditorialQualityContext sanitizes and truncates manuscript context', () => {
  const context = buildEditorialQualityContext({
    project: baseProject(),
    bookBrief: baseBookBrief(),
    bible: baseBible(),
    scenes: baseScenes(),
    publishability: { score: 80, publishable: false, criticalFailures: [], warnings: [{}] },
    heuristicQualityReport: baseHeuristicReport(),
  });

  assert.equal(context.bookBrief.corePromise, 'Uma investigação mágica com transformação pessoal.');
  assert.equal(context.bookBrief.protagonistWant, 'Provar que consegue proteger o bairro.');
  assert.equal(context.bookBrief.protagonistNeed, 'Aceitar ajuda e confiar na própria identidade.');
  assert.equal(context.bookBrief.centralConflict, 'O inimigo controla as memórias da cidade.');
  assert.deepEqual(context.bookBrief.readerAppeal, ['mistério', 'magia brasileira']);
  assert.ok(context.scenes.length <= 30);
  assert.equal(context.metadata.contextTruncated, true);
  assert.equal(context.metadata.sceneCount, 36);
  assert.equal(context.metadata.manuscriptStage, 'partial_draft');
  assert.equal(context.scenes[0].openingExcerpt.includes('SECRET_FULL_MANUSCRIPT_MARKER'), false);
  assert.equal(JSON.stringify(context).includes('brief-secret'), false);
  assert.equal(JSON.stringify(context).includes('private note should not leak'), false);
});

test('buildEditorialQualityPrompt includes editorial pass and safety instructions', () => {
  const context = buildEditorialQualityContext({
    project: baseProject(),
    bookBrief: baseBookBrief(),
    bible: baseBible(),
    scenes: baseScenes().slice(0, 1),
    publishability: null,
    heuristicQualityReport: baseHeuristicReport(),
  });
  const prompt = buildEditorialQualityPrompt(context);

  assert.match(prompt, /Structural Editor/);
  assert.match(prompt, /Character Editor/);
  assert.match(prompt, /Scene Editor/);
  assert.match(prompt, /Return only structured JSON/);
  assert.match(prompt, /Do not rewrite scenes/);
  assert.match(prompt, /requiresAuthorDecision/);
  assert.match(prompt, /Technical\/compliance warnings must not replace editorial findings/);
  assert.match(prompt, /manuscriptStage/);
  assert.doesNotMatch(prompt, /private note should not leak/);
});

test('parseEditorialQualityResponse accepts fenced JSON and normalizes arrays', () => {
  const parsed = parseEditorialQualityResponse(`Here is the report:\n\n\`\`\`json\n${JSON.stringify(validAiResponse())}\n\`\`\``);

  assert.equal(parsed.source, 'ai_editorial');
  assert.equal(parsed.overallScore, 64);
  assert.equal(parsed.scores.characterScore, 68);
  assert.equal(parsed.editorialPasses.length, 1);
  assert.equal(parsed.findings[0].severity, 'high');
  assert.equal(parsed.openQuestions.length, 1);
  assert.equal(parsed.openQuestions[0].affectedArea, 'climax');
  assert.equal(parsed.revisionPlan.macro.length, 1);
});

test('parseEditorialQualityResponse handles missing arrays', () => {
  const parsed = parseEditorialQualityResponse({
    overallScore: 80,
    publishable: false,
    summary: 'Short report.',
    scores: {},
    editorialPasses: [],
    findings: [],
    revisionPlan: {},
  });

  assert.deepEqual(parsed.editorialPasses, []);
  assert.deepEqual(parsed.findings, []);
  assert.deepEqual(parsed.openQuestions, []);
  assert.deepEqual(parsed.revisionPlan.macro, []);
});

test('parseEditorialQualityResponse keeps compliance warnings out of main editorial findings', () => {
  const parsed = parseEditorialQualityResponse({
    overallScore: 70,
    publishable: false,
    summary: 'Needs editorial work.',
    scores: {},
    editorialPasses: [],
    findings: [
      {
        code: 'QUALITY_AI_DISCLOSURE_MISSING',
        category: 'bookBrief',
        severity: 'warning',
        message: 'BookBrief AI disclosure is not configured.',
      },
      {
        code: 'PROTAGONIST_PASSIVE',
        category: 'character',
        severity: 'high',
        message: 'The protagonist reacts instead of choosing.',
        evidence: 'The clue arrives without action.',
        impact: 'Agency is weak.',
        suggestions: ['Add a risky choice.'],
      },
    ],
    openQuestions: [],
    revisionPlan: {},
  }, { metadata: { sceneCount: 1, totalWordCount: 3745 }, project: { targetWordCount: 80000 } });

  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0].code, 'PROTAGONIST_PASSIVE');
  assert.equal(parsed.metadata.complianceWarnings.length, 1);
  assert.equal(parsed.revisionPlan.macro.length, 1);
  assert.equal(parsed.revisionPlan.sceneLevel.length, 1);
  assert.equal(parsed.metadata.manuscriptStage, 'sample');
});

test('parseEditorialQualityResponse requires actionable open questions and fills fallback revision plan', () => {
  const parsed = parseEditorialQualityResponse({
    overallScore: 62,
    publishable: false,
    summary: 'Needs stronger direction.',
    scores: {},
    editorialPasses: [],
    findings: [
      {
        code: 'MUST_INCLUDE_MISSING',
        category: 'bookBrief',
        severity: 'high',
        message: 'Required diary entries are absent.',
        term: 'diary entries',
        expectedRole: 'Show rational deterioration through written records.',
        searchedIn: 'all generated scenes (4)',
        evidence: 'No scene is framed as a diary or written entry.',
        impact: 'The deterioration remains abstract.',
        suggestedFix: 'Insert two short diary entries after the first supernatural contact.',
        suggestedPlacement: 'After The Touch and before the first perceptual collapse.',
      },
    ],
    openQuestions: [
      {
        question: 'Preserve isolation or add a confidant?',
        whyItMatters: 'Defines whether pressure is internal or external.',
        options: ['Isolation', 'A confidant'],
        recommendedOption: 'Isolation',
        impact: 'high',
        affectedArea: 'character arc',
      },
      {
        question: 'Generic question without options?',
        options: ['Only one'],
      },
    ],
    revisionPlan: {},
  }, { metadata: { sceneCount: 4, totalWordCount: 3745 }, project: { targetWordCount: 80000 } });

  assert.equal(parsed.findings[0].term, 'diary entries');
  assert.equal(parsed.findings[0].suggestedFix, 'Insert two short diary entries after the first supernatural contact.');
  assert.equal(parsed.openQuestions.length, 1);
  assert.equal(parsed.openQuestions[0].recommendedOption, 'Isolation');
  assert.equal(parsed.openQuestions[0].affectedArea, 'character arc');
  assert.equal(parsed.revisionPlan.macro.length, 1);
  assert.equal(parsed.revisionPlan.sceneLevel.length, 1);
  assert.equal(parsed.revisionPlan.authorDecisions.length, 1);
});

test('generateAIEditorialQualityReportForProject uses fake provider and saves sanitized report', async () => {
  let capturedPrompt = '';
  let createPayload = null;
  const project = baseProject();
  const scenes = baseScenes().slice(0, 1);
  const fakeQuery = value => ({ sort: () => Promise.resolve(value) });

  const report = await generateAIEditorialQualityReportForProject('project-1', {
    Project: { findById: async () => project },
    Bible: { findOne: async () => baseBible() },
    Scene: { find: () => fakeQuery(scenes) },
    QualityReport: {
      findOne: () => fakeQuery(baseHeuristicReport()),
      create: async payload => {
        createPayload = payload;
        return {
          _id: 'report-1',
          createdAt: new Date('2026-04-30T12:00:00Z'),
          updatedAt: new Date('2026-04-30T12:00:00Z'),
          toObject: () => ({ _id: 'report-1', ...payload }),
        };
      },
    },
    bookBriefService: { getBookBriefByProjectId: async () => baseBookBrief() },
    evaluateProjectPublishability: async () => ({ score: 80, publishable: false, criticalFailures: [], warnings: [] }),
    generateStructured: async ({ prompt }) => {
      capturedPrompt = prompt;
      return { data: validAiResponse() };
    },
  });

  assert.equal(report.source, 'ai_editorial');
  assert.equal(createPayload.source, 'ai_editorial');
  assert.equal(createPayload.projectId, 'project-1');
  assert.equal(createPayload.editorialPasses.length, 1);
  assert.equal(createPayload.openQuestions.length, 1);
  assert.equal(createPayload.metadata.sceneCount, 1);
  assert.equal(capturedPrompt.includes('SECRET_FULL_MANUSCRIPT_MARKER'), false);
  assert.equal(JSON.stringify(createPayload.metadata).includes('SECRET_FULL_MANUSCRIPT_MARKER'), false);
});
