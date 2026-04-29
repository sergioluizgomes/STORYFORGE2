const CHAPTER_TYPES = {
    NORMAL: {
        name: "Capítulo Normal",
        wordCount: { min: 2500, max: 4000 },
        description: "Desenvolvimento equilibrado de enredo e personagem.",
        promptInstruction: "Mantenha um ritmo moderado. Foque na evolução do personagem (pole-to-pole growth) e no avanço da trama. Certifique-se de que os personagens revelem suas facetas através de ações e diálogos."
    },
    ACTION: {
        name: "Ação / Set Piece",
        wordCount: { min: 1800, max: 3000 },
        description: "Alto risco, ritmo acelerado, foco físico.",
        promptInstruction: "Use frases mais curtas e verbos ativos. O foco é o conflito externo e o perigo imediato. Aumente a tensão a cada parágrafo (Rising Action). O herói deve estar em perigo físico real."
    },
    REVELATION: {
        name: "Revelação / Virada",
        wordCount: { min: 3500, max: 5500 },
        description: "Momento de respirar, explicar, reviravoltas.",
        promptInstruction: "Diminua o ritmo. Foque em diálogos, reações emocionais e processamento de informações. É o momento de 'Anagnorisis' (descoberta). Revele segredos ou novas informações que mudem a direção da trama."
    },
    FINAL: {
        name: "Capítulo Final / Clímax",
        wordCount: { min: 3000, max: 6000 },
        description: "Crescendo, impacto emocional, gancho.",
        promptInstruction: "Construa para um clímax. As apostas devem ser máximas. O herói deve enfrentar seu maior medo ou o antagonista (The Evil One). O final deve provar a premissa da história."
    }
};

const ARCHETYPES = [
    "Herói (The Hero)",
    "Mentor (The Wise One)",
    "Guardião do Limiar (Threshold Guardian)",
    "Arauto (The Herald)",
    "Camaleão (Shapeshifter)",
    "Sombra (The Shadow / The Evil One)",
    "Pícaro (The Trickster)",
    "Aliado (The Ally)"
];

const MYTHIC_STAGES = [
    "Mundo do Dia Comum",
    "O Chamado à Aventura",
    "A Recusa do Chamado",
    "Encontro com o Mentor",
    "A Travessia do Limiar",
    "Testes, Aliados e Inimigos",
    "A Aproximação da Caverna Oculta",
    "A Provação Suprema (Ordeal)",
    "A Recompensa (Seizing the Sword)",
    "O Caminho de Volta",
    "A Ressurreição (Clímax)",
    "O Retorno com o Elixir"
];

module.exports = {
    CHAPTER_TYPES,
    ARCHETYPES,
    MYTHIC_STAGES
};
