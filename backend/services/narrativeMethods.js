const NARRATIVE_METHODS = [
  {
    id: 'story_grid_scene',
    name: 'Story Grid scene analysis',
    level: 'scene',
    bestFor: ['scene function', 'dramatic turn', 'conflict clarity', 'revision'],
    checks: [
      'inciting incident',
      'progressive complication',
      'crisis choice',
      'climax',
      'resolution and changed value'
    ],
    promptGuidance: 'Use as a scene diagnostic lens. Ask what changes by the end of the scene and whether the character faces a meaningful choice.',
    limitations: 'Do not force every quiet scene into action spectacle; emotional and relational turns can count.'
  },
  {
    id: 'save_the_cat_global_beats',
    name: 'Save the Cat global beats',
    level: 'book',
    bestFor: ['commercial pacing', 'act turns', 'midpoint', 'ending payoff'],
    checks: [
      'opening image',
      'theme stated',
      'act two break',
      'midpoint shift',
      'all is lost',
      'finale payoff'
    ],
    promptGuidance: 'Use as a flexible pacing map for the whole book, not as a mandatory formula.',
    limitations: 'Some literary, experimental, or episodic projects may need a looser structure.'
  },
  {
    id: 'snowflake',
    name: 'Snowflake expansion and reverse engineering',
    level: 'book',
    bestFor: ['vague premise', 'outline building', 'draft recovery', 'focus'],
    checks: [
      'one sentence summary',
      'one paragraph expansion',
      'character expansion',
      'conflict expansion',
      'outline expansion'
    ],
    promptGuidance: 'Use forward to grow an idea or backward to extract the real spine from a messy draft.',
    limitations: 'Avoid flattening voice, surprise, or discovery writing into an over-rigid outline.'
  },
  {
    id: 'mice_quotient',
    name: 'MICE Quotient',
    level: 'promise',
    bestFor: ['story promise', 'opening and closing logic', 'genre fit'],
    checks: [
      'Milieu promise',
      'Inquiry question',
      'Character transformation',
      'Event disruption and restoration'
    ],
    promptGuidance: 'Identify which promise opens first and which must close last for reader satisfaction.',
    limitations: 'Stories can combine MICE threads; choose a dominant promise instead of treating all as equal.'
  },
  {
    id: 'try_fail_cycles',
    name: 'Try/Fail cycles',
    level: 'pacing',
    bestFor: ['sagging middle', 'escalation', 'active protagonist', 'thriller pacing'],
    checks: [
      'attempt',
      'interesting failure',
      'risk increase',
      'strategy change',
      'new complication'
    ],
    promptGuidance: 'Use to test whether the protagonist changes tactics and pays a cost as the middle escalates.',
    limitations: 'Not every failure must be external; emotional, social, and moral failures can carry the cycle.'
  },
  {
    id: 'character_arc',
    name: 'Character arc',
    level: 'character',
    bestFor: ['agency', 'motivation', 'want versus need', 'transformation'],
    checks: [
      'external want',
      'internal need',
      'wound or lie',
      'active decisions',
      'meaningful change'
    ],
    promptGuidance: 'Use to connect plot pressure to internal transformation and protagonist agency.',
    limitations: 'Flat-arc protagonists can work when the world changes around their stable conviction.'
  },
  {
    id: 'pov_voice',
    name: 'POV and voice',
    level: 'prose',
    bestFor: ['narrative distance', 'tone', 'reader immersion', 'voice consistency'],
    checks: [
      'point of view stability',
      'narrative distance',
      'voice specificity',
      'interiority',
      'sensory texture'
    ],
    promptGuidance: 'Use to diagnose whether the prose sounds intentional for the audience and genre.',
    limitations: 'Voice standards vary strongly by genre and target audience.'
  },
  {
    id: 'dialogue_tension',
    name: 'Dialogue and tension',
    level: 'scene',
    bestFor: ['subtext', 'exposition', 'relationship conflict', 'scene energy'],
    checks: [
      'subtext',
      'competing goals',
      'exposition load',
      'voice distinction',
      'power shift'
    ],
    promptGuidance: 'Use to turn information exchange into conflict, discovery, or relationship movement.',
    limitations: 'Some scenes need clarity over sparring; do not add banter where the tone calls for restraint.'
  },
  {
    id: 'continuity',
    name: 'Continuity',
    level: 'book',
    bestFor: ['facts', 'timeline', 'lore rules', 'clues', 'character consistency'],
    checks: [
      'names and ages',
      'timeline order',
      'location consistency',
      'world rules',
      'clue setup and payoff'
    ],
    promptGuidance: 'Use to find contradictions and missing setups before line editing or export.',
    limitations: 'Continuity can only be as good as the available summaries and manuscript context.'
  }
];

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function scoreMethod(method, signals) {
  const text = normalizeText([
    signals.genre,
    signals.subgenre,
    signals.targetAudience,
    signals.tone,
    signals.projectStyle,
    signals.stage,
    ...(signals.detectedProblems || [])
  ].join(' '));

  let score = 0;
  const reasons = [];

  const add = (points, reason) => {
    score += points;
    reasons.push(reason);
  };

  if (method.id === 'mice_quotient' && /(misterio|mystery|investiga|pergunta|segredo|revelacao|fantasia|world|mundo)/.test(text)) {
    add(4, 'A promessa da historia depende de pergunta, mundo ou fechamento claro.');
  }
  if (method.id === 'try_fail_cycles' && /(thriller|acao|aventura|meio|ritmo|arrastado|suspense)/.test(text)) {
    add(4, 'O projeto precisa de escalada e tentativas com falha interessante.');
  }
  if (method.id === 'character_arc' && /(drama|romance|emocional|personagem|jovens adultos|ya|transformacao)/.test(text)) {
    add(4, 'A conexao do leitor depende de desejo, necessidade e transformacao.');
  }
  if (method.id === 'story_grid_scene' && /(cena|draft|rascunho|capitulo|revision|revisao)/.test(text)) {
    add(3, 'Ha material de cena suficiente para diagnosticar viradas dramaticas.');
  }
  if (method.id === 'save_the_cat_global_beats' && /(comercial|thriller|romance|fantasia|estrutura|final|virada)/.test(text)) {
    add(3, 'A estrutura global e o payoff precisam de uma lente de ritmo.');
  }
  if (method.id === 'snowflake' && /(ideia|vaga|premissa|sinopse|foco|outline|rascunho)/.test(text)) {
    add(3, 'A historia precisa revelar ou fortalecer sua frase central.');
  }
  if (method.id === 'pov_voice' && /(voz|pov|ponto de vista|prosa|tom|juvenil|adulto)/.test(text)) {
    add(3, 'Tom, voz e distancia narrativa afetam diretamente a promessa ao publico.');
  }
  if (method.id === 'dialogue_tension' && /(dialogo|exposicao|tensao|relacao)/.test(text)) {
    add(2, 'Dialogo e relacoes podem carregar conflito e subtexto.');
  }
  if (method.id === 'continuity' && /(continuidade|lore|pista|regras|serie|fantasia|misterio)/.test(text)) {
    add(3, 'O projeto depende de fatos, pistas ou regras consistentes.');
  }

  if (score === 0 && ['mice_quotient', 'character_arc', 'story_grid_scene'].includes(method.id)) {
    add(1, 'Lente editorial ampla util para diagnostico inicial.');
  }

  return { method, score, reasons };
}

function selectNarrativeMethods(signals = {}) {
  const ranked = NARRATIVE_METHODS
    .map(method => scoreMethod(method, signals))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.method.name.localeCompare(right.method.name));

  const selected = ranked.slice(0, 5).map(item => ({
    id: item.method.id,
    name: item.method.name,
    level: item.method.level,
    reason: item.reasons[0],
    checks: item.method.checks
  }));

  return {
    primaryLens: selected[0]?.name || 'MICE Quotient',
    secondaryLens: selected[1]?.name || 'Character arc',
    sceneLens: selected.find(item => item.level === 'scene')?.name || 'Story Grid scene analysis',
    pacingLens: selected.find(item => item.id === 'try_fail_cycles')?.name || 'Try/Fail cycles',
    reason: selected.length > 0
      ? selected.map(item => item.reason).join(' ')
      : 'A historia precisa de diagnostico inicial de promessa, personagem e cena.',
    selected
  };
}

function getNarrativeMethods() {
  return NARRATIVE_METHODS.map(method => ({ ...method }));
}

module.exports = {
  getNarrativeMethods,
  selectNarrativeMethods
};
