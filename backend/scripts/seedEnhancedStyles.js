const mongoose = require('mongoose');
const NarrativeStyle = require('../models/NarrativeStyle');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const enhancedStyles = [
    {
        name: "Lovecraftian Horror",
        description: "Horror cósmico e seres ancestrais incompreensíveis que desafiam a compreensão humana.",
        instruction: "Concentre-se na desolação, loucura e insignificância da humanidade diante do cosmos. Use adjetivos que evoquem umidade, viscosidade e decadência arquitetônica ancestral. Nunca descreva completamente os monstros — foque no impacto psicológico. O horror verdadeiro mora no que não pode ser compreendido, não no que pode ser visto.",

        bibleInstructions: "Construa personagens racionais e educados cuja sanidade será destruída progressivamente. Ambientes devem parecer antigos, apodrecidos e geometricamente errados. O horror verdadeiro está sempre além da compreensão humana. A história deve fazer o leitor sentir que a realidade é uma ilusão frágil. Inclua diários, anotações acadêmicas e pesquisa arqueológica como elementos centrais da narrativa.",

        sceneInstructions: "Construa tensão lentamente por meio de pavor acumulativo. Use frases longas e complexas que espelhem o estado mental deteriorado do protagonista. Foque em detalhes sensoriais que sugiram erros fundamentais: ângulos antinaturais, texturas perturbadoras, sons que não deveriam existir, cheiros impossíveis. Mostre deterioração psicológica por meio de pensamentos fragmentados, fixações obsessivas em detalhes insignificantes e memórias que se tornam não confiáveis. A cena deve terminar com o personagem mais próximo do abismo do que quando começou.",

        characterInstructions: "Os personagens devem começar céticos e racionais — scholars, arqueólogos, médicos, cientistas. Mostre a descida à loucura através de: anotações obsessivas, memórias fragmentadas, sintomas físicos (tremores, suores frios, insônia, tontura), alucinações que parecem mais reais do que a realidade. O backstory deve tornar a queda mais trágica — um homem respeitável perdendo tudo que construiu. Inclua o momento em que o personagem para de negar o impossível.",

        locationInstructions: "Locais devem parecer errados em um nível fundamental. Descreva: geometria não-euclidiana com ângulos que dobram sobre si mesmos, materiais antigos que precedem a civilização humana, umidade e decadência pervasivas, silêncio antinatural quebrado por sons distantes e inexplicáveis, atmosfera opressiva que distorce a percepção do tempo. Use todos os sentidos — especialmente olfato (fedor de mar profundo, fungos antigos, ar que não circula há séculos) e tato (superfícies que pulsam levemente, pedras quentes demais ou frias demais).",

        beatInstructions: "Cada beat deve: (1) introduzir um detalhe perturbador específico que não pode ser explicado racionalmente, (2) mostrar a reação interna do protagonista oscillando entre negação e aceitação, (3) avançar a deterioração mental um passo mensurável. Beats iniciais: estranheza sutil, quase explicável. Beats médios: evidências inegáveis do impossível que forçam reconstrução da realidade. Beats tardios: confronto direto com o horror cósmico. Resolução: sobrevivência com dano psicológico permanente, ou loucura completa. NUNCA resolva o mistério de forma satisfatória — o desconhecido deve permanecer.",

        craftPrinciples: {
            pacing: "Combustão lenta com pavor acelerado. Construção atmosférica longa e densa, revelações chocantes e repentinas, depois retorno ao horror rastejante. Cada cena deve durar tempo suficiente para o leitor sentir o peso do lugar e do momento.",
            characterDepth: "Foque na deterioração psicológica como arco central. Mostre a vida interior através de: pensamentos acelerados que tentam racionalizar o irracional, alucinações sensoriais que o personagem tenta ignorar, memórias tornando-se não confiáveis, sintomas físicos de estresse extremo. O personagem deve tentar manter sua racionalidade até o último momento possível.",
            showDontTell: "Nunca escreva 'ele estava com medo.' Em vez disso: 'Suas mãos traçaram os ângulos impossíveis e ele recuou — não do perigo, mas da certeza de que sua mente estava criando algo que não deveria existir.' Mostre o horror através do que o personagem não consegue fazer: não consegue dormir, não consegue comer, não consegue parar de pensar no detalhe errado.",
            dialogueStyle: "Esparso e progressivamente fragmentado. Personagens lutam para articular o impossível — frases incompletas, reticências, vocabulário arcaico quando descrevem coisas antigas. O silêncio e o que não é dito importam mais do que o que é falado. Evite diálogos de exposição — os personagens sabem que palavras são inadequadas.",
            sensoryFocus: ["umidade e viscosidade", "pedra antiga e apodrecida", "sons antinaturais e distantes", "texturas que pulsam levemente", "cheiro de profundidade marinha e fungos milenares", "temperatura errada", "luz que não ilumina direito"],
            innerLifeRatio: 0.55,
            toneGuidelines: "Vocabulário erudito e arcaico que se fragmenta progressivamente em horror. Tom acadêmico que se quebra. Use adjetivos específicos: eldritch, ciclópico, blasfemo, não-euclidiano. O narrador deve soar como alguém que está tentando manter a compostura enquanto documenta o que não pode ser documentado."
        },

        structureRules: {
            incitingIncidentTiming: "nos primeiros 15% — descoberta de algo antigo/errado que não deveria existir",
            jeopardyProgression: "exponencial — cada revelação torna os horrores anteriores triviais em comparação",
            crisisPoint: "85-90% — confronto direto com o horror cósmico, sanidade no limite extremo",
            resolutionStyle: "sobrevivência pírica ou loucura completa — nenhuma vitória verdadeira é possível; o cosmos permanece indiferente",
            protagonistCount: 1
        },

        examples: {
            good: [
                "Seus dedos traçaram o baixo-relevo e ele recuou — a pedra parecia pulsar com um calor orgânico que não tinha lugar em rocha morta. Tentou racionalizar: expansão térmica, quizá. Mas seus pulmões recusaram-se a expandir completamente, como se o ar do cômodo tivesse se tornado algo mais espesso.",
                "A geometria da câmara desafiava a compreensão — ângulos que se dobravam sobre si mesmos, criando espaços que não podiam existir e ainda assim existiam inegavelmente. Ele se descobriu incapaz de olhar para qualquer canto por mais de um segundo. Seu cérebro simplesmente recusava o que seus olhos transmitiam.",
                "A terceira noite sem dormir, as anotações em seu diário começaram a perder a letra cuidadosa de académico e tornaram-se garranchos febris. Ele não conseguia mais reconstruir quando tinha escrito o que. As páginas cheiravam a maresia, embora a cidade ficasse a trezentos quilômetros do mar."
            ],
            bad: [
                "O monstro era assustador e ele estava com medo.",
                "Ele ficou louco por causa do que viu.",
                "O horror cósmico era muito aterrorizante e incompreensível."
            ]
        }
    },
    {
        name: "Space Opera",
        description: "Aventuras épicas no espaço profundo, com viagens interestelares, civilizações alienígenas e batalhas espaciais de escala monumental.",
        instruction: "Foque na grandiosidade cósmica, civilizações alienígenas diversas, tecnologia avançada e batalhas dramáticas no espaço. O tom deve ser heroico e aventureiro, com senso genuíno de maravilha diante do universo. Mostre a escala através de detalhes específicos e concretos.",

        bibleInstructions: "Construa heróis maiores que a vida, com códigos morais claros mas testados. Cenários devem abranger múltiplos planetas e sistemas estelares. Inclua espécies alienígenas diversas com culturas, línguas e motivações distintas. Tecnologia deve ser avançada mas compreensível através do uso. Os conflitos devem ter consequências galácticas reais.",

        sceneInstructions: "Balance ação com admiração. Descreva a vastidão do espaço e a diversidade dos mundos alienígenas com detalhes sensoriais concretos. Use ritmo dinâmico para batalhas espaciais e momentos mais calmos para desenvolvimento de personagens. Mostre a escala por meio de comparações específicas: tamanho das naves, distâncias percorridas, populações afetadas. A adrenaline das batalhas deve contrastar com a solidão silenciosa do espaço profundo.",

        characterInstructions: "Heróis devem ser competentes mas imperfeitos — mostram dúvida, cometem erros, carregam perdas. Inclua membros de tripulação com habilidades especializadas e vozes distintas. A camaradagem e lealdade devem ser conquistadas em momentos de crise, não presumidas. Personagens alienígenas devem ter perspectivas genuinamente diferentes dos humanos, não apenas aparências estranhas. Mostre como cada personagem carrega o peso das escolhas que a guerra estelar exige.",

        locationInstructions: "Descreva mundos alienígenas com ecossistemas únicos, arquitetura que reflete a biologia e cultura de seus habitantes, e atmosferas que nunca são simplesmente 'como a Terra mas diferentes.' Estações espaciais devem parecer vividas e funcionais — com cafeterias barulhentas, manutenção nas madrugadas, tensão diplomática nos corredores. Naves estelares devem ter personalidades próprias, cheiros próprios (óleo de máquina, ar reciclado, comida de cinco culturas diferentes). O espaço em si é silencioso, frio e absolutamente indiferente.",

        beatInstructions: "Estruture cada beat com três camadas: (1) a ação imediata — a batalha, a descoberta, a fuga — descrita com detalhes técnicos precisos; (2) a carga emocional — o que está em jogo para os personagens específicos neste momento; (3) a implicação maior — como este beat muda o destino de planetas ou civilizações. Inclua momentos de descoberta maravilhosa, traição que redefine alianças, e triunfo que cobra seu preço. A escalada deve ser: perigo pessoal → ameaça planetária → destino galáctico.",

        craftPrinciples: {
            pacing: "Ritmo acelerado com set pieces épicas. Balance sequências de ação com momentos contemplativos — a grandiosidade do cosmos exige pausas para admiração genuína. Alternâncias de ritmo criam contraste emocional poderoso.",
            characterDepth: "Mostre heroísmo através de ações e escolhas difíceis, não através de discursos. Inclua dúvidas e medos reais sob exteriores confiantes. Um herói que admite ter medo humaniza a épica. As perdas devem deixar marcas visíveis.",
            showDontTell: "Demonstre tecnologia e culturas alienígenas através do uso, não da exposição. Mostre a escala através de comparações específicas: 'a nave tinha dois quilômetros de comprimento — mais longa do que a cidade onde ele cresceu.' Reações de personagens comunicam grandiosidade melhor do que descrições.",
            dialogueStyle: "Diálogos claros e propositais. Misture jargão técnico com carga emocional. Vozes distintas para diferentes espécies — não apenas sotaques, mas estrutura de pensamento diferente. Tripulações diversas têm formas diferentes de expressar lealdade e medo.",
            sensoryFocus: ["vastidão silenciosa do espaço", "ambientes alienígenas de cores impossíveis", "vibração de motores warp", "ar reciclado de nave", "luz de múltiplos sóis", "gravidade artificial falhando", "comunicações com estática de parsecs"],
            innerLifeRatio: 0.3,
            toneGuidelines: "Heroico e otimista apesar dos perigos. Senso genuíno de maravilha com o universo. Prosa clara com imagens vívidas. O cosmos deve parecer simultaneamente aterrorizante e magnificente."
        },

        structureRules: {
            incitingIncidentTiming: "nos primeiros 10% — chamado à aventura ou ameaça emergindo das sombras do espaço",
            jeopardyProgression: "escala crescente — perigo pessoal para ameaça planetária para extinção galáctica",
            crisisPoint: "80-85% — tudo parece perdido, galáxia à beira do colapso",
            resolutionStyle: "vitória triunfante mas custosa — heróis salvam o dia, mas o preço é real e permanente",
            protagonistCount: 2
        },

        examples: {
            good: [
                "O Dreadnought emergiu do hiperespaço, seu casco abrangendo três quilômetros de liga reluzente — maior do que qualquer cidade que ela tinha visto. Pela primeira vez em dez anos de serviço, a Capitã Vora sentiu algo próximo do medo.",
                "A atmosfera alienígena chacoalhou a nave — nuvens de amônia em cores que seus olhos lutavam para processar, algo entre púrpura e um conceito que o português não tinha palavra para nomear. Lá fora, criaturas do tamanho de edifícios nadavam na tempestade, completamente indiferentes à nave e às guerras dos humanos.",
                "A reunião do Conselho Galáctico durou seis horas. Nenhum acordo. Vinte e três civilizações, cada uma convicta de que somente sua espécie entendia o que estava em jogo. Enquanto eles debatiam, os sistemas de borda continuavam a apagar."
            ],
            bad: [
                "A nave espacial era muito grande e impressionante.",
                "Eles viajaram pelo espaço até outro planeta.",
                "Os alienígenas eram diferentes dos humanos de várias maneiras."
            ]
        }
    },
    {
        name: "Cyberpunk",
        description: "Alta tecnologia e vida degradada. Cenários futuristas onde corporações dominam e a identidade humana é mercadoria.",
        instruction: "Enfatize a estética neon, a decadência social, o poder corporativo opressor e a resistência individual. O cenário deve parecer úmido, gritante e sufocante. A tecnologia está em todo lugar mas corrói tudo que toca — especialmente a humanidade.",

        bibleInstructions: "Construa anti-heróis que sobrevivem dentro de um sistema corrupto, não campeões que o destroem. Cenários são distopias urbanas com desigualdade extrema de riqueza — andares superiores em luz solar perpétua, nível da rua em eterna penumbra de néon. Tecnologia é ubíqua e corruptora. Temas centrais: identidade, humanidade, o que nos torna pessoas, resistência a sistemas que nos reduzem a dados. A corporação é sempre o antagonista real, mesmo quando o vilão visível é um indivíduo.",

        sceneInstructions: "Use prosa afiada e pontuada. Enfatize luzes de néon, ruas molhadas de chuva e interfaces tecnológicas que sangram nos corpos das pessoas. Mostre o contraste brutal entre o luxo corporativo e a sujeira do nível da rua com detalhes concretos — não genéricos. Inclua detalhes técnicos de hacking e augmentação que pareçam reais, não mágicos. Cada cena deve sentir que a cidade é uma entidade viva que quer consumir seus habitantes.",

        characterInstructions: "Personagens devem ser moralmente cinzas, sobrevivendo em um sistema que os desumaniza. Mostre o custo da augmentação — físico (rejeição, dor fantasma, manutenção cara) e psicológico (onde termina a máquina e começa a pessoa?). Inclua vício, dívida e desespero ao lado de habilidade e determinação. Ninguém escolheu esta vida — foi o que sobrou depois que as escolhas melhores desapareceram.",

        locationInstructions: "Descreva megacidades de néon com arcologias corporativas e favelas expandidas em seus pés. Zonas corporativas são estéreis e controladas — ar condicionado, câmeras, sorrisos de RP treinados. Nível da rua é caótico e perigoso — vendedores de comida ao lado de cambistas de augmentações ilegais, crianças correndo entre as pernas de trabalhadoras de sexo que carregam implantes de defesa visíveis. Enfatize chuva, smog e luz artificial. O céu natural raramente é visível.",

        beatInstructions: "Estruture cada beat em torno de um job ou missão que revela mais da conspiração corporativa. (1) A tarefa parece simples — entrada, execução, saída. (2) Algo corre errado e revela uma camada mais profunda de podridão. (3) O personagem deve fazer uma escolha que o compromete moralmente ou ameaça sua sobrevivência. Escalada: sobrevivência pessoal → descoberta da conspiração → escolha entre resistência e acomodação. Mostre o custo humano de cada tecnologia e cada decisão de poder.",

        craftPrinciples: {
            pacing: "Frenético e fragmentado. Cortes rápidos entre ação e introspecção, espelhando a superestimulação do cenário. Mas permita momentos de pausa melancólica que mostram o vazio atrás da adrenalina.",
            characterDepth: "Explore a fronteira entre humano e máquina como questão filosófica real, não apenas estética. Mostre a vulnerabilidade sob exteriores cínicos — o momento em que a armadura cede revela o personagem verdadeiro. Que lembranças não augmentadas o personagem ainda carrega?",
            showDontTell: "Demonstre tecnologia através do uso — nunca explique como funciona, mostre o que faz ao corpo e à mente. Mostre decadência social através do ambiente e das interações: o que as pessoas aceitam como normal diz tudo. 'Ela pagou o aluguel em dados biométricos e não pensou duas vezes sobre isso.'",
            dialogueStyle: "Gíria de rua misturada com jargão técnico. Cínico e afiado. Subtexto e duplos sentidos — na rua, o que não é dito salva vidas. Vozes corporativas são polidas e vazias, carregando ameaça velada.",
            sensoryFocus: ["néon refletido em asfalto úmido", "cheiro de chuva ácida e comida de rua", "interfaces neurais que coçam nas têmporas", "vibração de servidores atrás das paredes", "plástico queimado e ozônio", "calor de corpos em espaços superlotados"],
            innerLifeRatio: 0.4,
            toneGuidelines: "Cínico mas não desesperançado. Realismo gritante com momentos de transcendência — a beleza que existe apesar de tudo. Atmosfera tech noir. A humanidade persiste nas rachaduras do sistema."
        },

        structureRules: {
            incitingIncidentTiming: "nos primeiros 10% — proposta de trabalho que parece simples, ou crise pessoal que força uma decisão perigosa",
            jeopardyProgression: "pessoal para sistêmico — sobrevivência individual revelando conspiração corporativa",
            crisisPoint: "80-85% — traição ou sistema voltado contra o protagonista, custo moral máximo",
            resolutionStyle: "amargo-doce — vitória pequena contra um sistema vasto, custo pessoal real; o sistema continua, mas algo mudou",
            protagonistCount: 1
        },

        examples: {
            good: [
                "Kanjis de néon refletiam nas poças, fragmentando-se enquanto suas botas respingavam. O jack neural atrás da orelha coçava — dor fantasma do wetware que não era totalmente compatível com seu sistema nervoso. Dois anos desde a augmentação e seu corpo ainda recusava aceitar que parte dele era máquina.",
                "A torre corporativa se erguia acima da linha de smog, seus andares superiores banhados em luz solar que a rua nunca veria. Em algum lugar lá em cima, num escritório com vista para nuvens, alguém tinha decidido que o distrito 7 precisava ser 'revitalizado.' Cinquenta mil despejos chamados de progresso.",
                "Ela hackeou o sistema enquanto fingia dormir na cabine do metrô. Dedos se movendo em microgestos sobre o teclado holográfico projetado no interior dos seus óculos. A parte mais difícil não era o código — era não se mover enquanto o segurança passava."
            ],
            bad: [
                "A cidade futurista era cheia de tecnologia e crime.",
                "Ele hackeou o sistema de computadores facilmente.",
                "O futuro era muito dark e cyberpunk."
            ]
        }
    },
    {
        name: "High Fantasy",
        description: "Épicos em mundos secundários com magia, criaturas míticas e legendas ancestrais que determinam o destino do mundo.",
        instruction: "Use linguagem elevada e formal. Enfatize sistemas de magia com regras e custos reais, cenários medievais-inspirados com história profunda e forças morais claras mas nunca simples. O peso do destino deve ser tangível — ser o Escolhido é um fardo, não um presente.",

        bibleInstructions: "Construa heróis em jornadas épicas com propósito moral claro. Cenários devem incluir reinos com histórias de séculos, florestas ancestrais que guardam segredos, reinos mágicos com leis próprias. A magia deve ter regras específicas e custos reais — cada feitiço cobra algo de quem o lança. Inclua profecias e lore ancestral como elementos vivos da narrativa, não apenas decoração. O bem e o mal devem ter nuances — o Senhor das Trevas tem razões compreensíveis, os heróis cometem erros reais.",

        sceneInstructions: "Use prosa elevada e formal mas fluida. Descreva a magia com admiração genuína e especificidade de sistema — mostre como funciona, o que custa, o que não pode fazer. Mostre a beleza e o perigo do mundo fantástico com detalhes sensoriais ricos. Inclua momentos de heroísmo genuíno e sacrifício real — não gestos vazios, mas escolhas que custam algo concreto. O mundo deve parecer maior do que a história que está sendo contada.",

        characterInstructions: "Heróis devem encarnar virtudes mas enfrentar testes morais reais — não apenas batalhas físicas, mas dilemas onde nenhuma escolha é completamente certa. Inclua mentores com sabedoria limitada, companheiros com lealdades próprias e antagonistas dignos de respeito. Mostre o crescimento da inocência para a sabedoria através de perdas reais. A honra, o dever e o sacrifício devem ser escolhas ativas, não reflexos automáticos.",

        locationInstructions: "Descreva castelos com história sangrenta e gloriosa, florestas antigas que têm memória própria, montanhas místicas onde o tempo funciona diferente, cidades mágicas onde cada pedra foi colocada com propósito. Cada localização deve ter história e significado na narrativa maior. Enfatize beleza natural magnificente e maravilha mágica, mas também o perigo genuíno que espreita nas margens.",

        beatInstructions: "Siga a estrutura da jornada do herói mas evite os clichês óbvios: (1) Chamado à aventura — mostrar o que o protagonista está deixando para trás, não apenas o que está ganhando; (2) Provas e aliados — cada aliado revela algo sobre quem o protagonista está se tornando; (3) A caverna mais profunda — o momento de escolha que define caráter; (4) Retorno transformado — o mundo mudou, mas o protagonista mudou mais. O clímax deve resolver a ameaça externa mas deixar uma questão interna em aberto.",

        craftPrinciples: {
            pacing: "Escopo épico com ritmo medido. Permita tempo para world-building e desenvolvimento de personagem entre ação. Batalhas devem ser viscerais e ter consequências. As cenas mais lentas são onde o mundo respira e o personagem cresce.",
            characterDepth: "Mostre nobreza interior e dúvida profunda. Explore o peso do destino e o custo do heroísmo. O Escolhido não quer ser Escolhido — essa relutância autêntica é o que o torna real.",
            showDontTell: "Demonstre magia através do uso e das consequências — nunca apenas descreva o efeito, mostre o custo. Mostre culturas através de costumes e conflitos específicos. 'Elfos são longevos' não diz nada; 'ela tinha visto trinta gerações humanas nascerem e morrerem e ainda não conseguia deixar de se apegar a cada uma delas' diz tudo.",
            dialogueStyle: "Formal e elevado, com construções arcaicas usadas com parcimônia e propósito. Vozes distintas para diferentes culturas e raças — um anão e um elfo não apenas têm sotaques diferentes, têm formas diferentes de ver o tempo e o valor das coisas.",
            sensoryFocus: ["energia mágica que aquece ou esfria a pele", "beleza natural impossível", "arquitetura ancestral com história nas pedras", "cheiro de magia como ozônio ou primavera ou morte", "criaturas míticas que distorcem o ar ao redor delas"],
            innerLifeRatio: 0.35,
            toneGuidelines: "Épico e mítico. Senso de história ancestral e destino inevitável. Temas morais claros sem serem simplistas. A grandiosidade do mundo deve refletir a grandiosidade das escolhas que os personagens precisam fazer."
        },

        structureRules: {
            incitingIncidentTiming: "nos primeiros 15% — chamado à aventura ou evento que ameaça o equilíbrio do mundo",
            jeopardyProgression: "pessoal para cósmico — busca individual para destino do mundo",
            crisisPoint: "85-90% — hora mais escura antes da batalha final, tudo parece perdido",
            resolutionStyle: "triunfante mas custoso — o mal derrotado, sacrifícios feitos, o mundo transformado de forma irreversível",
            protagonistCount: 1
        },

        examples: {
            good: [
                "A Trama cintilou ao redor de seus dedos, fios de luz prateada respondendo à sua vontade. Mas cada feitiço cobrava de sua força vital, deixando-a mais oca por dentro. Ela tinha lançado três feitiços hoje. Sentia como se tivesse envelhecido um ano.",
                "A floresta ancestral lembrava quando elfos caminhavam sob seus galhos. Agora ela observava a jovem humana com olhos de seiva âmbar, julgando — mas não com crueldade. Com a paciência de quem tem tempo suficiente para esperar que as coisas se revelem.",
                "O Senhor das Sombras não era louco. Essa era a parte mais aterrorizante. Cada argumento que ele fez pela destruição do velho mundo tinha uma lógica fria e impecável. Ela deveria ter rebatido com sabedoria. Em vez disso, descobriu que entendia."
            ],
            bad: [
                "Ela lançou um poderoso feitiço mágico.",
                "O senhor das trevas maligno ameaçou o reino.",
                "O herói tinha poderes especiais e salvar o mundo."
            ]
        }
    },
    {
        name: "Noir Mystery",
        description: "Histórias de detetive sombrias e melancólicas em ambientes urbanos corrompidos onde a verdade tem um preço.",
        instruction: "Adote um tom cínico e melancólico. Foque em sombras, ambiguidade moral, monólogos internos densos e diálogos afiados de hard-boiled. O ambiente deve refletir a podridão moral que o protagonista navega. Todo mundo mente — a questão é descobrir qual mentira importa.",

        bibleInstructions: "Construa um detetive desgastado com um código de honra num mundo sem honra. Cenários devem ser urbanos e moralmente cinzas — não existe inocente nesta cidade, apenas graus diferentes de culpa. Cada personagem tem segredos e motivos ocultos. A investigação deve revelar que o crime aparente é apenas a superfície de uma podridão sistêmica mais profunda. O antagonista real raramente é quem parece ser.",

        sceneInstructions: "Use primeira pessoa ou terceira pessoa próxima com voz interna forte e poética. Enfatize sombras, chuva e fumaça com descrições concretas que criam atmosfera sem ser prolixas. Inclua observações afiadas e comentários cínicos sobre a natureza humana. Mostre complexidade moral — não existem heróis ou vilões puros. Cada cena deve revelar uma camada nova de mentira.",

        characterInstructions: "O protagonista deve ser falho mas com princípios — com feridas específicas do passado que informam o cinismo presente. A vulnerabilidade deve estar sempre presente sob a dureza exterior, emergindo em momentos precisos. Outros personagens devem ter camadas — motivos aparentes escondendo verdades mais profundas. A femme fatale tem razões reais. O oficial corrupto tem uma família que ama. Ninguém é simples.",

        locationInstructions: "Descreva ruas encharcadas de chuva, bares enfumaçados com luz amarela e bancos de madeira gasta, escritórios miseráveis com venezianas quebradas, mansões opulentas que cheiram a podridão sob o verniz. Use iluminação — sombras e contrastes duros. Enfatize decadência urbana e podridão moral. Os lugares devem sentir que têm memória, que guardam segredos nas paredes.",

        beatInstructions: "Estruture em torno de investigação que revela corrupção mais profunda a cada clue: (1) O caso parece simples — mas há algo que não encaixa, um detalhe pequeno que o protagonista não consegue ignorar; (2) Cada pista complica em vez de simplificar, revelando mais camadas de mentira; (3) O clímax revela a verdade e força o protagonista a escolher entre seus princípios e sua sobrevivência. A resolução deve ser moralmente complexa — a justiça é incompleta, mas algo foi recuperado.",

        craftPrinciples: {
            pacing: "Investigação metódica pontuada por violência súbita. Momentos reflexivos entre a ação — o detetive processando, reconstruindo, duvidando. O ritmo espelha o processo de pensamento: lento quando acumula evidências, explosivo quando tudo converge.",
            characterDepth: "Monólogo interno rico que revela a distância entre o que o personagem mostra e o que sente. Trauma passado informando cinismo presente de forma específica — não vague 'ele tinha visto coisas,' mas quais coisas, que marcas deixaram. Vulnerabilidade emergindo em momentos precisos muda a textura de toda a cena.",
            showDontTell: "Revele caráter através de ações e escolhas em situações moralmente cinzas. Mostre corrupção através de detalhes específicos que o narrador nota mas não comenta — o leitor entende. 'O prefeito tinha fotos de família na parede e um envelope de dinheiro na gaveta. Ambos pareciam reais.'",
            dialogueStyle: "Afiado, ágil e carregado de subtexto. Metáforas hard-boiled que revelam a visão de mundo do narrador. Todo mundo mente ou omite — o que não é dito importa tanto quanto o que é dito. Humor sombrio como mecanismo de defesa.",
            sensoryFocus: ["sombras e halos de luz fraca", "chuva no asfalto e nas janelas", "fumaça de cigarro e whisky barato", "sons urbanos noturnos — sirenes distantes, passos", "cheiro de dinheiro velho e arrependimento"],
            innerLifeRatio: 0.5,
            toneGuidelines: "Cínico mas não niilista — o protagonista ainda se importa, isso é sua maldição. Melancólico com humor sombrio. Observações poéticas sobre a natureza humana misturadas com dureza pragmática."
        },

        structureRules: {
            incitingIncidentTiming: "nos primeiros 10% — um caso que parece simples mas tem algo errado desde o início",
            jeopardyProgression: "pessoal para sistêmico — caso simples revelando teia de corrupção",
            crisisPoint: "80-85% — a verdade revelada, o protagonista deve escolher entre princípios e sobrevivência",
            resolutionStyle: "amargo-doce — caso resolvido mas justiça incompleta; o detetive pagou um preço; a cidade continua igual",
            protagonistCount: 1
        },

        examples: {
            good: [
                "A mulher entrou no meu escritório como se trouxesse a tempestade consigo. Nesta cidade, era geralmente o que era. Sentei-me mais direito e fingi que meu aluguel estava em dia.",
                "A chuva batia na janela como se tivesse uma queixa. Eu entendia o sentimento — este caso tinha se tornado pessoal, e pessoal significava que alguém ia se machucar. Provavelmente eu.",
                "Ele sorriu e disse que não sabia de nada. Era um sorriso bom, ensaiado, o tipo que políticos e mentirosos usam. A diferença entre os dois raramente era suficiente para justificar uma distinção."
            ],
            bad: [
                "O detetive investigou o misterioso crime.",
                "Ela era bela e suspeita.",
                "Havia muita corrupção na cidade corrompida."
            ]
        }
    },
    {
        name: "Steampunk",
        description: "Era vitoriana reimaginada com tecnologia a vapor e engrenagens, onde o progresso mecânico encontra os valores e conflitos da sociedade do século XIX.",
        instruction: "Inclua engrenagens de latão, veículos a vapor e normas sociais vitorianas entrelaçadas com maquinário futurista. A atmosfera deve ser industriosa e ornamental. Mostre a tensão entre o maravilhoso do progresso tecnológico e as estruturas sociais que ele pode tanto libertar quanto reforçar.",

        bibleInstructions: "Construa inventores, capitães de dirigíveis e rebeldes contra a opressão industrial. Cenários mesclam elegância vitoriana com inovação mecânica onde tudo é visível — engrenagens, vapor, latão. A tecnologia é bela e mecânica, não mágica: você pode vê-la funcionar, ouvi-la, cheirá-la. As tensões de classe são centrais — quem tem acesso à tecnologia e quem opera as máquinas que a produzem são questões políticas reais.",

        sceneInstructions: "Descreva detalhes mecânicos com especificidade sensorial — vapor sibilante, engrenagens clicando, válvulas de latão com incrustações ornamentais. Balance a formalidade vitoriana com a realidade industrial. Mostre tensões de classe e o maravilhamento tecnológico em simultâneo. Uma invenção pode ser tanto libertação para uns e opressão para outros, dependendo de quem a controla.",

        characterInstructions: "Misture sensibilidades vitorianas com atitudes modernas em tensão dramática. Inclua inventores geniais (mas negligentes de suas responsabilidades sociais), aristocratas que abraçam ou resistem ao progresso, trabalhadores das fábricas que constroem o mundo dos ricos com suas próprias mãos, e rebeldes que usam a tecnologia contra aqueles que a criaram para dominar. Mostre como a tecnologia afeta estruturas sociais e identidade pessoal.",

        locationInstructions: "Descreva cidades de latão e vapor com dirigíveis cortando o céu enluvado de fumaça, docks de aeronaves movimentados como portos marítimos, oficinas mecânicas cheirando a óleo e metal quente, salões vitorianos onde aristocratas discutem política enquanto autômatos servem chá. Enfatize a maquinaria visível, a estética industrial e as divisões de classe expressas arquitetonicamente — os andares baixos para quem trabalha, os altos para quem lucra.",

        beatInstructions: "Estruture em torno de uma invenção ou descoberta que desafia a ordem social existente: (1) A invenção surge com promessa brilhante, mas revela implicações que o inventor não antecipou; (2) Os poderes estabelecidos reagem para controlar ou suprimir o que ameaça seu domínio; (3) Os protagonistas devem escolher entre o conforto do sistema e a possibilidade de mudança real. Inclua falhas mecânicas com consequências dramáticas e triunfos que chegam por meio de engenhosidade, não de força bruta.",

        craftPrinciples: {
            pacing: "Medido com explosões de ação mecânica. Tempo para descrições técnicas que revelam o mundo e manobras sociais que revelam os personagens. O ritmo deve sentir como o movimento de uma máquina bem lubrificada: previsível mas impressionante.",
            characterDepth: "Explore a tensão entre propriedade e progresso, entre obrigação social e convicção pessoal. Mostre como a tecnologia empodera ou aprisiona dependendo de quem a controla. Um personagem pode ser ao mesmo tempo libertado por sua invenção e aprisionado pelas consequências do que criou.",
            showDontTell: "Demonstre tecnologia através de descrições mecânicas detalhadas que revelam caráter — como alguém constrói ou usa uma máquina diz algo sobre quem são. Mostre classe através de ambiente e interação: quem usa luvas brancas e quem tem mãos negras de graxa.",
            dialogueStyle: "Formalidade vitoriana em tensão com as sensibilidades modernas dos personagens. Jargão técnico específico misturado com cortesias sociais. Subtext de classe nas interações — quem se curva para quem, quem finge não ver.",
            sensoryFocus: ["vapor e fumaça", "latão e cobre polidos", "sons mecânicos de engrenagens e válvulas", "cheiro de óleo de máquina e carvão", "calor das caldeiras", "vibração constante de motores a vapor"],
            innerLifeRatio: 0.3,
            toneGuidelines: "Aventureiro com atmosfera industrial. Otimista sobre o potencial da tecnologia, crítico das estruturas sociais que a cercam. A beleza da máquina e o custo humano de construí-la devem coexistir na mesma cena."
        },

        structureRules: {
            incitingIncidentTiming: "nos primeiros 15% — invenção ou descoberta que perturba o equilíbrio existente",
            jeopardyProgression: "pessoal para social — projeto individual revelando conflito de classe",
            crisisPoint: "80-85% — falha mecânica ou confronto social que força uma escolha definitiva",
            resolutionStyle: "progressivo — tecnologia e mudança social avançam juntos, mas o preço do progresso é pago por pessoas reais",
            protagonistCount: 2
        },

        examples: {
            good: [
                "Os motores do dirigível tossiam vapor, pistões de latão martelando em ritmo enquanto ela ajustava as válvulas de pressão com precisão de artesã. Vinte anos construindo máquinas para os ricos. Era hora de construir algo para si mesma.",
                "Seu braço mecânico zumbia suavemente, engrenagens clicando sob o revestimento de latão ornamental — lembrança do acidente na fábrica que tinha levado sua carne mas lhe dado precisão que nenhuma mão humana igualaria. Lord Ashworth tinha dito que era uma melhoria. Ela nunca tinha conseguido decidir se isso era um insulto ou uma ironia.",
                "A reunião da Sociedade de Inventores durou três horas. Nenhum deles perguntou sequer uma vez sobre os trabalhadores que montariam suas criações."
            ],
            bad: [
                "A máquina steampunk era legal e vitoriana.",
                "Eles voaram num dirigível a vapor.",
                "A tecnologia a vapor era muito impressionante."
            ]
        }
    },
    {
        name: "Grimdark Fantasy",
        description: "Fantasia violenta e amoral onde a sobrevivência é a única vitória real e toda escolha tem um custo.",
        instruction: "O tom deve ser sombrio e niilista com lampejos de humanidade que tornam a escuridão mais suportável. Personagens são profundamente falhos e o heroísmo tradicional está ausente. Foque na realidade brutal da guerra, corrupção e sobrevivência. Mostre pessoas comuns fazendo coisas terríveis por razões compreensíveis.",

        bibleInstructions: "Construa personagens moralmente cinzas num mundo brutal. Não existem heróis ou vilões claros — todo mundo serve aos seus próprios interesses e chama isso de necessidade. Cenários devem ser devastados pela guerra, corrompidos pelo poder, e esteticamente opostos ao fantasy épico tradicional. A magia tem custos terríveis e é usada para fins terríveis. A honra é um luxo que os mortos não podem pagar.",

        sceneInstructions: "Não se esquive da violência e de suas consequências — mostre o depois da batalha tão claramente quanto a batalha em si. Mostre compromissos morais e escolhas de sobrevivência com a mesma honestidade. Sem armadura de enredo — personagens podem fracassar e morrer quando faz sentido narrativo. Enfatize o custo de cada ação. A quietude após a violência é tão importante quanto a violência.",

        characterInstructions: "Personagens devem ser complexos e falhos de formas específicas — não apenas 'moralmente cinzas' de forma abstrata, mas com traumas específicos que explicam suas escolhas. Mostre como as circunstâncias forçam compromissos morais: pessoas boas fazendo coisas terríveis, pessoas más tendo momentos de humanidade genuína. Ninguém é puramente bom ou mau — e isso é mais assustador do que um vilão simples.",

        locationInstructions: "Descreva paisagens devastadas pela guerra com detalhes específicos — não 'campos de batalha genéricos', mas lugares específicos com histórias específicas de destruição. Cidades corrompidas onde o poder se manifesta em arquitetura que intimida. Wilderness perigosa onde a natureza é indiferente às guerras humanas. Beleza existe, mas é rara e sempre coexiste com horror.",

        beatInstructions: "Estruture em torno de compromissos morais escalantes onde cada escolha corrói mais a linha entre o que o personagem era e o que está se tornando: (1) Uma necessidade força uma escolha terrível que parece justificável; (2) As consequências dessa escolha forçam uma escolha ainda mais terrível; (3) O clímax oferece apenas opções ruins — sobrevivência ou princípio, e o custo de ambos é real. Mostre o peso acumulativo das escolhas no corpo e no espírito dos personagens.",

        craftPrinciples: {
            pacing: "Brutal e implacável. Momentos de quietude são tensos, não pacíficos — o personagem sabe que a violência vai voltar. A violência é súbita e tem consequências que duram. As cenas mais lentas devem sentir como o silêncio antes de uma tempestade.",
            characterDepth: "Mostre trauma e dano moral como elementos centrais, não periféricos. Explore como pessoas boas fazem coisas terríveis e carregam isso. Sem redenção fácil — o peso do que foi feito não desaparece com um ato nobre.",
            showDontTell: "Mostre violência e suas consequências físicas e psicológicas específicas. Demonstre complexidade moral através de escolhas impossíveis, não de reflexões filosóficas. 'Ele tinha parado de contar os mortos — os seus ou os deles, mal importava mais' diz mais do que um parágrafo de análise.",
            dialogueStyle: "Áspero e pragmático. Humor de galhofa como mecanismo de sobrevivência. Subtexto de ameaça e desespero. Personagens que já viram demais não fazem discursos — dizem o necessário e calam.",
            sensoryFocus: ["lama e sangue misturados", "frio e fome como estado permanente", "cheiro de morte que não sai da roupa", "exaustão que se torna a única sensação familiar", "momentos de calor humano brutalmente contrastados"],
            innerLifeRatio: 0.4,
            toneGuidelines: "Sombrio mas não sem esperança — a esperança que existe aqui é pequena, humana, específica. Inflexível sobre a natureza humana. Humor negro que nasce da dor. A humanidade persiste mesmo nos piores momentos."
        },

        structureRules: {
            incitingIncidentTiming: "nos primeiros 10% — disrupção violenta ou escolha impossível que define os termos do que vem depois",
            jeopardyProgression: "constante — a sobrevivência está sempre em risco, os compromissos morais escalam sem pausa",
            crisisPoint: "85-90% — escolha moral final sem opção boa",
            resolutionStyle: "pírico ou trágico — sobrevivência a custo terrível, ou fracasso nobre que não muda nada",
            protagonistCount: 2
        },

        examples: {
            good: [
                "A lama sugava suas botas, misturada com sangue da carnificina da manhã. Ele tinha parado de contar os mortos — os seus ou os deles, mal importava mais. O importante era que ele ainda estava em pé.",
                "Ela limpou a lâmina tentando não pensar no rosto do garoto. Sobreviver significava fazer coisas que a assombrariam, se ela vivesse tempo suficiente para ser assombrada.",
                "O general tinha prometido que seria a última batalha. Três batalhas atrás, ele tinha prometido a mesma coisa. Mas desta vez as pessoas que juraram que não voltariam para mais uma — desta vez ele era uma delas. E ainda assim estava de pé, equipamento pesado, esperando o sinal."
            ],
            bad: [
                "O mundo dark e sombrio era brutal.",
                "Ele precisava fazer escolhas difíceis para sobreviver.",
                "A fantasia grimdark era muito violenta e amoral."
            ]
        }
    },
    {
        name: "Psychological Thriller",
        description: "Suspense construído sobre os estados mentais e emocionais dos personagens, onde a maior ameaça vem de dentro.",
        instruction: "Foque em narradores não confiáveis, tensão interna e pistas sutis que redefinem tudo que veio antes. O ambiente deve refletir o estado mental deteriorado do protagonista. A verdade deve ser sempre incerta — cada resposta abre três novas perguntas.",

        bibleInstructions: "Construa protagonistas com percepções fraturadas — trauma, doença mental, dissociação, ou simplesmente a capacidade humana de ver o que queremos ver. O cenário deve ser familiar mas progressivamente errado. A realidade deve ser questionável em cada cena. Todo personagem pode ser mentiroso — incluindo o narrador. O maior horror está em não poder confiar na própria mente.",

        sceneInstructions: "Use perspectiva próxima para mostrar percepção distorcida de forma que o leitor experencie a incerteza junto com o personagem. Inclua contradições e detalhes não confiáveis que o leitor provavelmente vai reler mais tarde. Construa tensão através de pressão psicológica — o silêncio que dura um segundo demais, o sorriso que não alcança os olhos, a memória que não está completamente certa. Mostre a realidade se fragmentando através de comportamento e percepção, não de declarações explícitas.",

        characterInstructions: "O protagonista deve ter trauma ou condição mental específica que afeta sua percepção de forma concreta e consistente. Mostre paranoia, obsessão ou dissociação através de comportamentos observáveis e pensamentos internos específicos. Outros personagens devem ser genuinamente ambíguos — o leitor nunca deve ter certeza de suas intenções. Inclua o momento em que o protagonista percebe que não pode confiar na própria memória.",

        locationInstructions: "Descreva lugares familiares tornando-se estranhos — a casa própria que de repente não parece certa, o vizinho que sempre foi amigável mas hoje há algo levemente diferente. Use iluminação e perspectiva para criar desconforto. Mostre como o estado mental do protagonista colore o ambiente — os mesmos objetos parecem diferentes em estados diferentes de paranoia.",

        beatInstructions: "Estruture em torno de paranoia escalante e revelações que redefiniem tudo: (1) Um detalhe perturbador que poderia ser coincidência — mas não parece; (2) Acumulação de evidências que cada interpretação plausível mas contradiz a anterior; (3) Uma revelação que torna necessário reler tudo desde o início com novos olhos. O clímax deve revelar a verdade — mas a interpretação deve permanecer incerta. Questione: e se a revelação também for parte da distorção?",

        craftPrinciples: {
            pacing: "Combustão lenta com tensão crescente. Os momentos mais quietos são os mais perturbadores. Revelações súbitas reformulam todo o entendimento. O ritmo espelha a mente do protagonista: às vezes acelerado e obsessivo, às vezes bizarramente calmo diante do que deveria ser assustador.",
            characterDepth: "Mergulho profundo numa psique fraturada. Mostre interpretações concorrentes da realidade de forma que o leitor nunca tenha certeza de qual é verdadeira. O monólogo interno não confiável é a ferramenta central — mostrar a brecha entre o que o narrador diz sentir e o que suas ações sugerem.",
            showDontTell: "Demonstre o estado mental através de percepção e comportamento específico, nunca através de declarações. 'Ela estava paranoica' não funciona; 'ela verificou a fechadura sete vezes, depois oito, então percebeu que não conseguia lembrar se tinha verificado, então verificou de novo' funciona. A paranoia mora nos detalhes e nos rituais.",
            dialogueStyle: "Carregado de subtexto e ambiguidade. O que é dito versus o que é querido dizer. Gaslighting e manipulação que o leitor pode não reconhecer de imediato. O protagonista interpreta tudo através do filtro da paranoia — mostrando a lacuna entre o que foi dito e o que foi ouvido.",
            sensoryFocus: ["detalhes familiares levemente errados", "sons que podem ser reais ou não", "sensações físicas de ansiedade — coração acelerado, mãos frias", "o silêncio que dura demais", "olhares que podem significar nada ou tudo"],
            innerLifeRatio: 0.6,
            toneGuidelines: "Perturbador e claustrofóbico. Questione tudo. Atmosfera paranoica construída por acumulação de detalhes, nunca por declaração. O leitor deve sentir a incerteza na pele."
        },

        structureRules: {
            incitingIncidentTiming: "nos primeiros 15% — evento que aciona paranoia ou revela instabilidade existente",
            jeopardyProgression: "interna — sanidade e percepção progressivamente comprometidas",
            crisisPoint: "85-90% — realidade completamente incerta, confiança impossível",
            resolutionStyle: "ambíguo — verdade revelada mas interpretação incerta; o leitor deve decidir o que é real",
            protagonistCount: 1
        },

        examples: {
            good: [
                "O padrão do papel de parede se movia quando ela não estava olhando diretamente para ele. Ou sempre tinha sido assim? Ela não conseguia lembrar, e isso a assustava mais do que o próprio padrão.",
                "O sorriso dele era o mesmo de ontem. Exatamente o mesmo — mesmo ângulo, mesma duração. Ninguém sorri exatamente igual duas vezes seguidas. A menos que esteja praticando.",
                "Ela tinha certeza de que tinha trancado a porta. Tanta certeza que nem foi verificar. Mas três horas depois, quando o medo ficou insuportável e ela foi até lá — a porta estava destrancada, e ela não sabia mais se isso provava algo ou não provava nada."
            ],
            bad: [
                "Ela estava enlouquecendo e não podia confiar em ninguém.",
                "A realidade era confusa e incerta.",
                "O thriller psicológico tinha muito suspense psicológico."
            ]
        }
    },
    {
        name: "Urban Fantasy",
        description: "Elementos mágicos existindo dentro de cenários urbanos modernos e realistas, onde criaturas sobrenaturais vivem entre os humanos.",
        instruction: "Misture o mundano com o mágico de forma que ambos pareçam igualmente reais. Sociedades ocultas e seres sobrenaturais vivendo entre humanos em cidades contemporâneas. O desafio central é manter a máscara — o sobrenatural deve permanecer oculto da maioria dos humanos, e esse equilíbrio é sempre frágil.",

        bibleInstructions: "Construa uma mascarada — magia escondida do mundo comum, com infraestrutura mágica secreta nas cidades. Personagens navegam obrigações mundanas e mágicas simultaneamente: o vampiro que também tem que pagar aluguel, a bruxa que gerencia suas habilidades entre reuniões de trabalho. Inclua tanto tecnologia contemporânea quanto magia ancestral, mostrando como coexistem. Os conflitos centrais devem ameaçar o equilíbrio entre o mundo visível e o oculto.",

        sceneInstructions: "Justaponha a vida moderna cotidiana com elementos mágicos de forma que ambos sejam tratados com a mesma seriedade. Mostre a tensão de manter sigilo — o custo constante de viver em dois mundos. Inclua tecnologia contemporânea ao lado de magia ancestral. Balance ação rápida de thriller com world-building mágico. Cada cena deve conter pelo menos um elemento mundano e um elemento mágico em tensão.",

        characterInstructions: "Personagens devem ter vidas duplas — cobertura mundana e realidade mágica — e o custo psicológico de manter essa divisão deve ser visível. Mostre o custo do sigilo e lealdades divididas. Inclua relacionamentos tanto com humanos comuns (que não sabem nada) quanto com criaturas sobrenaturais (que têm suas próprias políticas e lealdades). O isolamento de guardar segredos que ninguém pode conhecer é tema central.",

        locationInstructions: "Descreva cidades reais com camadas mágicas ocultas. O clube noturno que é corte de vampiros. A estação de metrô que conecta ao reino das fadas. A banca de jornal cujo dono vende itens mágicos para quem sabe pedir. A arquitetura moderna esconde poder ancestral. Mostre como os lugares mundanos têm histórias sobrenaturais que a maioria das pessoas nunca vai saber.",

        beatInstructions: "Estruture em torno de ameaça à mascarada ou conflito entre facções mágicas: (1) Uma violação do equilíbrio — algo mágico ameaça se revelar, ou facções mágicas em conflito estão prestes a derramar para o mundo mundano; (2) O protagonista deve conter o dano enquanto mantém o segredo; (3) Resolução que preserva o equilíbrio mas muda algo permanentemente. Mostre consequências tanto no mundo mundano quanto no mágico.",

        craftPrinciples: {
            pacing: "Ritmo de thriller contemporâneo com complicações mágicas. Ação rápida equilibrada com world-building orgânico — o leitor aprende o sistema mágico através da ação, não da exposição.",
            characterDepth: "Explore a identidade dividida entre mundos. Mostre o isolamento de guardar segredos que ninguém pode conhecer. Sensibilidades modernas com fardos mágicos. O humor sarcástico como mecanismo de sobrevivência para o que seria do contrário insuportável.",
            showDontTell: "Demonstre magia através do uso em contextos modernos — como um espaço de Photoshop sobrenatural. Mostre a mascarada através de precauções específicas que os personagens tomam. 'Ela pediu o café com uma mão enquanto esboçava uma proteção com a outra, o barista não percebendo nada.'",
            dialogueStyle: "Contemporâneo e natural. Misture gíria moderna com terminologia mágica de forma que ambas pareçam igualmente naturais. Vozes distintas para diferentes espécies sobrenaturais — não apenas sotaques diferentes, mas formas diferentes de processar o tempo e a mortalidade.",
            sensoryFocus: ["energia mágica em ambientes modernos", "iluminação urbana noturna que esconde e revela", "sentidos sobrenaturais percebendo o que humanos ignoram", "o contraste entre mundano e impossível na mesma cena"],
            innerLifeRatio: 0.35,
            toneGuidelines: "Contemporâneo com senso de admiração. Humor sarcástico ao lado de perigo real. Gritante urbano encontra mistério mágico. O sobrenatural nunca deve perder seu senso de alteridade apenas por ser familiar."
        },

        structureRules: {
            incitingIncidentTiming: "nos primeiros 10% — ameaça mágica ou violação da mascarada",
            jeopardyProgression: "pessoal para catastrófico — perigo individual para colapso da mascarada",
            crisisPoint: "80-85% — mascarada ameaçada, os dois mundos em risco",
            resolutionStyle: "equilibrado — ameaça derrotada, mascarada mantida, crescimento pessoal real",
            protagonistCount: 1
        },

        examples: {
            good: [
                "O vagão estava vazio exceto por ela e a coisa fingindo ser humana. Seu glamour piscava sob as luzes fluorescentes, revelando articulações a mais nos dedos. Ela fingiu não perceber — denunciar era sempre mais problema do que valia.",
                "Ela pediu seu café com uma mão enquanto esboçava uma proteção com a outra, o barista completamente alheio ao encantamento que alguém tinha deixado na máquina de espresso. Trabalho mundano de bruxa: ninguém agradecia, ninguém pagava, mas era melhor do que a alternativa.",
                "O endereço que o fantasma tinha dado ficava num edifício demolido há vinte anos. Ela suspirou. Os mortos nunca conseguiam lidar com o fato de que o mundo continuava sem eles."
            ],
            bad: [
                "Magia existia secretamente na cidade moderna.",
                "Ela usava seus poderes mágicos enquanto vivia uma vida normal.",
                "Os seres sobrenaturais viviam entre humanos de forma oculta."
            ]
        }
    },
    {
        name: "Hard Sci-Fi",
        description: "Ficção científica caracterizada por precisão científica e lógica rigorosa — tecnologia com limitações reais, consequências realistas e personagens que resolvem problemas através do conhecimento.",
        instruction: "Priorize detalhe técnico, consistência lógica e as consequências reais do avanço científico. O tom é analítico e ancorado na física, biologia ou engenharia. Resolva problemas através de ciência real, não de soluções mágicas. A ingenuidade humana é o herói real.",

        bibleInstructions: "Construa personagens cientificamente alfabetizados resolvendo problemas através do conhecimento e da engenhosidade — não de sorte ou habilidade sobrenatural. Cenários devem seguir a física conhecida: sem viagem mais rápida que a luz, sem comunicação instantânea a distâncias interestelares. Tecnologia deve ter limitações realistas e consequências. Inclua o peso real de exploração espacial — o custo, o tempo, o isolamento. A ciência deve ser verificável em linhas gerais.",

        sceneInstructions: "Inclua detalhes técnicos precisos que sejam acessíveis através do contexto — o leitor deve entender o problema sem precisar de um PhD. Mostre a resolução de problemas através da ciência de forma que o processo seja tão interessante quanto o resultado. Descreva as restrições realistas da tecnologia — o que não pode ser feito é tão importante quanto o que pode. Balance a exposição técnica com a história — explique através do uso e da necessidade, nunca através de palestras.",

        characterInstructions: "Personagens devem ser profissionais competentes com expertise específica — não 'engenheira gênio' genérica, mas alguém com conhecimento de sistemas específicos, com limitações específicas no que sabe. Mostre expertise através da forma como resolvem problemas e comunicam com colegas. Inclua reações realistas a ambientes espaciais, alienígenas ou tecnologias futuras. A adaptação e a ingenuidade sob pressão são os arcos de personagem centrais.",

        locationInstructions: "Descreva estações espaciais, naves de geração ou mundos alienígenas com precisão científica — suporte de vida, gravidade, radiação, temperatura como variáveis reais que afetam os personagens. Mostre a hostilidade real do espaço e dos ambientes alienígenas através de seus efeitos sobre corpos humanos. A ciência deve estar presente nos detalhes sensoriais: o som diferente em atmosferas diferentes, a sensação de gravidade menor, o cansaço de radiação.",

        beatInstructions: "Estruture em torno de problemas científicos com restrições realistas: (1) Um problema emerge com parâmetros específicos e mensuráveis — não 'o reator vai explodir' mas 'temos 4 minutos a 0,3 atmosferas antes que a espuma de selagem não consiga mais polimerizar'; (2) Tentativas de resolução que falham por razões lógicas, revelando novos parâmetros do problema; (3) Solução elegante que usa recursos disponíveis de forma inesperada. A tensão vem das restrições reais, não de obstáculos artificiais.",

        craftPrinciples: {
            pacing: "Medido, permitindo resolução técnica de problemas com detalhe suficiente para o leitor acompanhar. Tensão emerge das restrições realistas e dos recursos limitados, não da contagem regressiva artificial. Momentos de descoberta genuína devem ter peso adequado.",
            characterDepth: "Mostre inteligência e expertise através da forma como os personagens pensam sobre problemas — o processo importa. Explore implicações éticas da tecnologia: não apenas 'isso é possível' mas 'isso deveria ser feito'. Decisões racionais sob pressão revelam caráter tanto quanto crises emocionais.",
            showDontTell: "Demonstre tecnologia através do uso e das limitações — nunca através de exposição. Mostre a ciência através da resolução de problemas, não de palestras. 'O reator pode gerar 3,2 gigawatts' não diz nada; 'eles tinham poder suficiente para a vida útil ou para os motores, mas não para ambos, e tinham quatro horas para decidir' cria tensão real.",
            dialogueStyle: "Técnico mas acessível. Comunicação profissional entre especialistas — jargão que faz sentido em contexto, não para impressionar. Explique através da discussão entre personagens que têm necessidade real de comunicar, não através de monólogos expositivos.",
            sensoryFocus: ["detalhes técnicos específicos de sistemas", "perigos ambientais reais — radiação, vácuo, temperatura", "fenômenos científicos observáveis", "o corpo humano respondendo a ambientes não-terrestres", "sons que viajam diferente em atmosferas diferentes"],
            innerLifeRatio: 0.25,
            toneGuidelines: "Analítico e reflexivo. Senso de admiração ancorado na realidade — o universo real é suficientemente maravilhoso sem precisar de magia. Otimista sobre a ingenuidade humana. A ciência como atividade humana — com todos os dilemas éticos que isso implica."
        },

        structureRules: {
            incitingIncidentTiming: "nos primeiros 15% — problema científico ou descoberta com implicações enormes",
            jeopardyProgression: "escalada lógica — o problema se multiplica através de consequências realistas",
            crisisPoint: "85-90% — teste final de ingenuidade e conhecimento com os recursos disponíveis",
            resolutionStyle: "conquistada pela ciência — problema resolvido através de meios realistas e lógicos, não de golpe de sorte",
            protagonistCount: 2
        },

        examples: {
            good: [
                "A brecha no casco tinha três centímetros — pequena o suficiente para que a espuma de selagem devesse ter resolvido. Mas a 0,3 atmosferas, a espuma não conseguia polimerizar rápido o suficiente. Tinham talvez quatro minutos. Martinez começou a calcular em voz alta — não por hábito, mas porque precisava que alguém verificasse seu raciocínio.",
                "A rotação do planeta estava travada tidalmente, um rosto sempre voltado para a estrela. A zona do terminador, onde o dia encontrava a noite, era a única faixa habitável — uma ribbon estreita de crepúsculo perpétuo. Nela, a temperatura variava apenas doze graus ao longo de um ano inteiro. Era o lugar mais estável que a humanidade jamais tinha encontrado. E era completamente vazio.",
                "O sinal chegou com um atraso de quarenta e dois minutos. Qualquer resposta demoraria outro tanto. A conversa com a Terra era como trocar cartas com alguém que estava morrendo devagar — você enviava palavras e só descobria se tinham chegado a tempo muito depois."
            ],
            bad: [
                "Eles usaram ciência avançada para resolver o problema.",
                "A nave espacial viajou mais rápido que a luz.",
                "O cientista gênio resolveu o problema com sua inteligência."
            ]
        }
    },
    {
        name: "Realismo Mágico",
        description: "O sobrenatural e o cotidiano coexistem de forma completamente natural, sem surpresa nem explicação — o extraordinário é tratado com a mesma normalidade que o trivial.",
        instruction: "Integre elementos mágicos à realidade de forma que pareçam absolutamente naturais e inevitáveis. Nenhum personagem deve se surpreender com o sobrenatural — ele faz parte da textura do mundo com a mesma normalidade que a chuva ou a morte. Inspire-se em García Márquez, Jorge Amado e Guimarães Rosa: o mágico é o real.",

        bibleInstructions: "Construa um mundo onde o sobrenatural e o cotidiano são a mesma coisa. A avó que conversa com os mortos não é especial — é apenas alguém com esse dom, como outros têm ouvido para música. O passado coexiste com o presente fisicamente. As memórias coletivas têm peso material. Os sentimentos das pessoas afetam o clima e os objetos. Construa a história em torno de famílias, comunidades e sua relação com o tempo — o presente carregando o peso de gerações. Inclua história política e social como pano de fundo que condiciona o destino dos personagens.",

        sceneInstructions: "Descreva eventos sobrenaturais com o mesmo tom neutro e concreto de eventos mundanos — na mesma frase, com o mesmo peso. 'Ela foi ao mercado, depois visitou sua mãe morta que ainda morava no mesmo quarto, depois voltou para jantar.' O extraordinário não merece mais ênfase que o ordinário. Use linguagem sensorial rica e concreta. O tempo deve fluir de forma não-linear, com passado e presente coexistindo. A beleza da prosa deve ser tão importante quanto a trama.",

        characterInstructions: "Personagens devem aceitar o sobrenatural como parte da vida sem drama. Seus problemas devem ser simultaneamente muito humanos (amor, perda, ambição, inveja) e marcados pelo peso do destino. Inclua vidas que se estendem por décadas ou gerações. Personagens femininos frequentemente são depositários de sabedoria e poder que a sociedade patriarcal ignora. O trauma histórico — político, colonial, familiar — deve estar presente no DNA dos personagens.",

        locationInstructions: "Descreva lugares onde o tempo é espesso e visível — o presente carregando camadas do passado que ainda existem fisicamente. Pequenas cidades com grandes histórias. Casas que guardam memórias como objetos físicos. Natureza que responde ao estado emocional de seus habitantes. Inclua a geografia específica da América Latina — tropical, exuberante, úmida, com cheiro de terra molhada e flores que desafiam a morte.",

        beatInstructions: "Estruture em torno de ciclos familiares e históricos que se repetem com variações: (1) Estabeleça o peso do passado — o que aconteceu antes condiciona o que acontece agora, e os personagens sabem disso; (2) O evento sobrenatural emerge de forma completamente natural, como uma consequência lógica do que veio antes; (3) A resolução não é derrota do sobrenatural, mas integração — os personagens encontram sua relação com o que não pode ser explicado. O tempo circular é estrutura, não gimmick.",

        craftPrinciples: {
            pacing: "Lento e contemplativo, com a vastidão de anos e gerações sentida na prosa. Digressões sobre o passado são parte da estrutura, não interrupções. O presente e o passado coexistem no mesmo parágrafo com a naturalidade de duas pessoas na mesma sala.",
            characterDepth: "Personagens carregam o peso de suas histórias familiares e históricas — o que seus avós fizeram é tão presente quanto o que fizeram ontem. Mostre como o tempo se dobra sobre si mesmo nas vidas das pessoas. A sabedoria popular e o senso comum têm tanto peso quanto a lógica racional.",
            showDontTell: "O sobrenatural deve aparecer sem marcação especial — sem ênfase, sem pausa dramática. 'Ela varreu o chão da cozinha enquanto seu pai morto bebia café à mesa, como sempre fazia nas manhãs frias.' A normalidade do extraordinário é o efeito central.",
            dialogueStyle: "Natural e oral, com a musicalidade da fala cotidiana. Provérbios e sabedoria popular integrados à conversa. Narrativa que às vezes inclui o narrador coletivo — 'nós' da comunidade que observa e julga. O tempo verbal pode ser fluido.",
            sensoryFocus: ["calor úmido tropical", "cheiro de terra molhada e flores tropicais", "cor e luz de lugares com sol intenso", "sons de comunidades vivas — música, vozes, animais", "o peso físico da memória e do passado"],
            innerLifeRatio: 0.4,
            toneGuidelines: "Contemplativo e poético. O sobrenatural com a normalidade do cotidiano. Melancolia com beleza. O absurdo como expressão da condição humana. Humor que nasce da distância entre o que as pessoas esperam e o que a vida oferece."
        },

        structureRules: {
            incitingIncidentTiming: "difuso — o incidente que deflagra a história frequentemente já aconteceu antes do início; a história é sobre suas consequências se desdobrando",
            jeopardyProgression: "temporal e familiar — o perigo é a repetição de padrões históricos, não eventos externos",
            crisisPoint: "o momento de reconhecimento — quando um personagem percebe que está repetindo o erro de seu pai, ou que o destino que tentou escapar está se cumprindo",
            resolutionStyle: "cíclico ou trágico — o padrão se repete com variação, ou um personagem finalmente rompe o ciclo a um custo imenso",
            protagonistCount: 1
        },

        examples: {
            good: [
                "Naquela manhã em que choveu por quatro dias consecutivos, o coronel Buendía recebeu a visita de seu próprio fantasma vinte anos mais jovem, que veio apenas para lembrar que havia esquecido o nome do primeiro homem que matara. Era o tipo de visita que perturbava mais do que as dos vivos.",
                "Sua avó tinha morrido três vezes sem convencer ninguém de que estava definitivamente morta. Continuava aparecendo na cozinha nas manhãs de quarta-feira para fazer o bolo de fubá que os vivos nunca tinham aprendido a fazer direito.",
                "A guerra civil terminou num sábado, e no domingo a cidade já tinha esquecido — não da forma que as pessoas fingem esquecer, mas da forma que a água esquece a pedra quando para de cair."
            ],
            bad: [
                "A magia aconteceu de forma surpreendente e todos ficaram espantados.",
                "Era um mundo mágico onde coisas sobrenaturais ocorriam.",
                "Ela tinha poderes mágicos que usava para resolver seus problemas."
            ]
        }
    },
    {
        name: "Thriller de Ação",
        description: "Tensão constante, ritmo acelerado e personagens competentes enfrentando ameaças de alto risco com consequências reais.",
        instruction: "Mantenha a tensão constante e o ritmo acelerado. Personagens são competentes e treinados, mas enfrentam adversários igualmente capazes. As apostas devem ser altas e as consequências reais. Cada cena deve mover a história adiante. A ação deve ser coreografada com precisão técnica suficiente para parecer real.",

        bibleInstructions: "Construa um protagonista com expertise específica — agente, policial, militar, especialista em segurança — com habilidades concretas e limitações reais. O antagonista deve ser igualmente capaz, com recursos e motivações claras. A ameaça deve ter escala suficiente para justificar o conflito — não apenas pessoal, mas com implicações que afetam terceiros. Inclua sistemas e instituições reais como parte do campo de jogo.",

        sceneInstructions: "Cenas de ação devem ser técnicas, concretas e espacialmente claras — o leitor precisa saber onde cada pessoa está a cada momento. Use frases curtas durante ação intensa; frases mais longas durante planejamento e tensão acumulada. Mostre o custo físico e mental de situações de alto estresse. Cada cena de ação deve revelar algo sobre o personagem além da competência técnica. O perigo deve ser credível — personagens podem ser feridos, podem falhar.",

        characterInstructions: "O protagonista deve ser competente mas não invencível — tem limitações físicas, emocionais e de informação que o colocam em desvantagem real. Mostre o custo de trabalho de alto risco: relacionamentos, saúde, sono. O antagonista deve ter lógica interna consistente — não é malvado por ser malvado, tem objetivos que fazem sentido em seus próprios termos.",

        locationInstructions: "Descreva locais com suficiente detalhe tático para que o leitor visualize claramente as possibilidades e limitações — saídas, cobertura, linhas de visão. Ambientes devem criar oportunidades e obstáculos específicos para a ação. O ambiente é personagem, não apenas cenário.",

        beatInstructions: "Estruture cada beat com: (1) objetivo específico — o que o protagonista está tentando conseguir agora; (2) obstáculo específico — o que está impedindo; (3) resposta — como o protagonista adapta. Cada beat deve resolver um problema e criar outro. O ritmo deve acelerar progressivamente com as apostas crescentes. Permita que personagens falhem em alguns beats.",

        craftPrinciples: {
            pacing: "Acelerado e implacável. Frases curtas durante ação. Alternâncias entre adrenalina e respiração — momentos de planejamento que criam contraste. Mas nunca deixe o pé completamente no freio.",
            characterDepth: "Competência técnica revelando caráter: como o protagonista pensa sob pressão extrema diz mais do que qualquer diálogo de exposição. Vulnerabilidades reais em contextos de alta competência criam tensão genuína.",
            showDontTell: "'Ele tinha três segundos antes que o atirador reposicionasse' — não explique a mecânica, mostre o problema e a resposta. Competência se mostra através da velocidade de avaliação de situações, não de discursos.",
            dialogueStyle: "Conciso e direto. Profissionais sob pressão não fazem discursos — trocam informação essencial. Humor seco como válvula de pressão em momentos de falsa segurança.",
            sensoryFocus: ["adrenalina e tensão muscular", "sons táticos — passos, mecânica de arma, silêncio estratégico", "detalhes espaciais de ambientes de risco", "o peso do cansaço e da lesão acumulados", "tempo subjetivo dilatado durante ação de alto risco"],
            innerLifeRatio: 0.25,
            toneGuidelines: "Tenso e urgente. Competência sem arrogância. Consequências reais para ações reais. O protagonista não é invulnerável."
        },

        structureRules: {
            incitingIncidentTiming: "nos primeiros 10% — ameaça de alto risco emerge ou missão recebe parâmetros que tornam tudo mais complicado",
            jeopardyProgression: "escalada de apostas — perigo pessoal para ameaça ampla; recursos e opções diminuem enquanto as apostas crescem",
            crisisPoint: "80-85% — os recursos estão esgotados, o adversário tem vantagem, a solução óbvia não está disponível",
            resolutionStyle: "resolução ativa — protagonista utiliza expertise e improviso para virar a situação; vitória custosa mas genuína",
            protagonistCount: 1
        },

        examples: {
            good: [
                "Ele tinha três segundos antes que o atirador reposicionasse. Dois para cruzar o corredor. Um para avaliar o próximo ângulo de cobertura. Sua mente mapeava a geometria do edifício mais rápido do que conseguia articular — anos de treinamento tornados instinto. Começou a se mover antes de terminar de calcular.",
                "A missão tinha mudado duas vezes em seis horas. Primeiro era extração. Depois era contenção. Agora ele estava num telhado sem comunicação com a base, com um alvo que não era mais um alvo e uma janela de vinte minutos que estava fechando. Adaptação. Era o único plano que restava.",
                "Ela não tinha sentido a bala. Só percebeu que estava ferida quando tentou levantar o braço esquerdo e ele não subiu. Anotação mental: terminar o trabalho, depois sangrar."
            ],
            bad: [
                "O agente secreto completou a missão perigosa com facilidade.",
                "Havia muita ação e tensão durante a missão.",
                "Ele era muito habilidoso e derrotou todos os inimigos."
            ]
        }
    },
    {
        name: "Ficção Histórica",
        description: "Narrativas situadas em períodos históricos específicos, onde os detalhes da época são tão importantes quanto os personagens — o passado vivido como presente.",
        instruction: "Recrie um período histórico específico com autenticidade sensorial e social — não apenas datas e eventos, mas como era sentir, cheirar, pensar e viver naquele tempo. Os personagens devem ser produtos de sua época. O grande evento histórico deve existir como pano de fundo que condiciona as vidas privadas.",

        bibleInstructions: "Construa um mundo historicamente específico onde os detalhes materiais e sociais da época são fundamentais. Inclua tanto a história 'grande' — eventos políticos, guerras, movimentos sociais — quanto a história 'pequena' — como as pessoas viviam no dia a dia. Personagens devem refletir as possibilidades e impossibilidades de seu tempo: o que era impensável no período deve parecer impensável para eles.",

        sceneInstructions: "Recrie o período através de detalhes sensoriais específicos — não genericamente 'medieval' mas qual região, qual clima, quais materiais estavam disponíveis. Mostre como as estruturas sociais do período afetam cada interação. A linguagem deve sugerir a época sem ser incompreensível. Evite anacronismos flagrantes de vocabulário e de mentalidade.",

        characterInstructions: "Personagens devem ser autênticos ao período — com os preconceitos e valores de sua época, não como pessoas modernas projetadas no passado. A resistência aos valores do período deve ter um custo real e específico. Inclua personagens de diferentes posições sociais e mostre como a estrutura de classes, gênero e raça do período condiciona o que cada um pode ver, fazer e pensar.",

        locationInstructions: "Descreva lugares com os materiais e tecnologias específicos do período. Cidades com a densidade, cheiro e som de seu tempo — sem sistemas de esgoto moderno, com iluminação a velas ou gás, com transportes que determinam o ritmo da vida. A distância entre lugares deve ser sentida em tempo e esforço.",

        beatInstructions: "Estruture com eventos históricos reais como pano de fundo que cria pressão: (1) A vida privada dos personagens é condicionada por forças históricas maiores; (2) Momentos de crise onde a história grande invade a vida pequena e força escolhas; (3) Resolução que mostra o custo e o ganho de agir num momento histórico específico. A resolução deve ser historicamente plausível.",

        craftPrinciples: {
            pacing: "Determinado pelo ritmo da época — mais lento que o contemporâneo, com a vastidão de espaço e tempo que separava as pessoas. Não imponha urgência moderna a situações que o período viveria com mais calma.",
            characterDepth: "Autenticidade histórica requer mostrar os limites do horizonte mental do período. Ao mesmo tempo, mostrar a humanidade universal que atravessa os séculos. A tensão entre o condicionamento histórico e a individualidade é o coração do drama.",
            showDontTell: "Demonstre o período através de detalhes materiais específicos. Mostre as estruturas sociais através de como as pessoas se tratam. 'Ela não ergueu os olhos' comunica uma hierarquia inteira sem precisar de explicação.",
            dialogueStyle: "Sugestivo da época sem ser incompreensível. Use vocabulário e construções que evocam o período sem exigir notas de rodapé. Distinções de classe devem estar presentes na forma como diferentes personagens se expressam.",
            sensoryFocus: ["materiais e tecnologias específicos da época", "cheiros de um mundo sem saneamento moderno", "sons de transporte e vida antes da motorização", "texturas de tecidos e ferramentas do período", "ritmo do tempo determinado pela luz natural e as estações"],
            innerLifeRatio: 0.4,
            toneGuidelines: "Imersivo e específico. O passado como lugar com suas próprias lógicas e valores. Evitar tanto a nostalgia romantizada quanto o julgamento anacrônico. O período deve parecer completamente real, não um palco."
        },

        structureRules: {
            incitingIncidentTiming: "nos primeiros 15% — evento histórico ou pessoal que coloca o protagonista em curso de colisão com seu tempo",
            jeopardyProgression: "histórica e pessoal — as forças do período ameaçam tanto as aspirações pessoais quanto a sobrevivência",
            crisisPoint: "85-90% — o grande evento histórico colide diretamente com a vida privada, exigindo escolha definitiva",
            resolutionStyle: "historicamente plausível — a resolução deve respeitar o que era possível no período; nem utópica nem totalmente pessimista",
            protagonistCount: 1
        },

        examples: {
            good: [
                "A carta levou três semanas para chegar do Rio a São Paulo. Quando a leu, seu irmão já estava morto há dez dias. Naquele março de 1888, as notícias chegavam sempre como epitáfios.",
                "O corset a comprimia da mesma forma que as expectativas — ela havia aprendido a ignorar ambos. O que não se podia ignorar era a conversa que escutou entre seu pai e o coronel: eles tinham decidido seu futuro como quem negocia gado.",
                "A abolição foi decretada numa quinta-feira. Na sexta, os antigos escravizados da fazenda ainda estavam lá. Não havia para onde ir. A liberdade, descobriram, era um território sem mapas."
            ],
            bad: [
                "Era o período histórico e as pessoas viviam de forma diferente.",
                "A protagonista era uma mulher corajosa à frente de seu tempo.",
                "Os eventos históricos aconteceram como na história real."
            ]
        }
    },
    {
        name: "Drama Literário",
        description: "Ficção focada na profundidade psicológica dos personagens, nas relações humanas e nos grandes temas da existência — amor, perda, identidade, mortalidade.",
        instruction: "Priorize a profundidade psicológica e emocional sobre a trama externa. A prosa deve ser trabalhada como objeto estético. O ordinário deve revelar o extraordinário. Temas devem emergir da especificidade das situações, nunca serem declarados explicitamente.",

        bibleInstructions: "Construa personagens com vidas internas complexas e contraditórias — que não sabem o que querem, ou sabem mas não conseguem agir, ou agem mas pelos motivos errados. Relações entre personagens devem ter história, poder e ambiguidade. A trama deve ser mínima — o que move a história é a mudança interna dos personagens, não eventos externos. Temas emergem da especificidade das situações.",

        sceneInstructions: "Cada cena deve operar em múltiplos níveis: o que acontece (trama), o que cada personagem está sentindo mas não dizendo (subtexto), e o que a cena significa no contexto maior (tema). Uma cena pode ser 'sobre' uma conversa de jantar enquanto na verdade é sobre o fim de um casamento. Gestos e objetos concretos revelam estados interiores.",

        characterInstructions: "Personagens devem ser contraditórios de formas humanas específicas — amam e ressentem a mesma pessoa, desejam o que sabem ser errado, agem contra seus próprios interesses. Mostre personagens em momentos de percepção — quando algo que sempre estava lá finalmente é visto. Essas epifanias devem ser ganhas pela narrativa.",

        locationInstructions: "Lugares como extensões do estado emocional dos personagens — não decoração mas significado. A casa de infância com seus cheiros específicos. O lugar onde uma relação foi destruída. Objetos que carregam história emocional. Descreva o concreto com precisão para que o simbólico emerja organicamente.",

        beatInstructions: "Cada beat deve mudar algo no estado interno dos personagens ou nas suas relações: (1) Uma percepção que sempre esteve disponível finalmente emerge; (2) Uma escolha pequena com peso imenso — o que uma pessoa decide não dizer; (3) Consequência que revela algo sobre quem o personagem realmente é. Evite cenas de revelação explícitas — prefira o acúmulo de pequenos momentos.",

        craftPrinciples: {
            pacing: "Deliberado e reflexivo. Permita que cenas respirem. A pausa e o silêncio têm tanto peso quanto a ação. O ritmo deve ser determinado pela vida emocional dos personagens.",
            characterDepth: "O centro gravitacional da obra. Contradição interna é humanidade — personagens que sabem o que deveriam fazer e não fazem. Epifanias pequenas têm mais poder do que grandes revelações.",
            showDontTell: "'Ela amarrava os sapatos do filho pela última vez' contém um romance inteiro. Nunca descreva emoções diretamente — descreva o que os personagens fazem com as mãos, o que notam no ambiente, o que evitam olhar.",
            dialogueStyle: "Carregado de subtexto — o que não é dito tem mais peso. Personagens que falam sobre uma coisa enquanto estão realmente falando sobre outra. Silêncios que precisam ser descritos. Diálogos que terminam antes de chegar onde deveriam.",
            sensoryFocus: ["detalhes cotidianos com carga emocional específica", "cheiros associados a memórias", "luz em momentos específicos do dia", "objetos com história emocional", "o corpo como registro do estado interior"],
            innerLifeRatio: 0.6,
            toneGuidelines: "Contemplativo e preciso. A emoção não é declarada — é evocada através do concreto. Humor que nasce do reconhecimento da condição humana. A vida ordinária revelando o extraordinário."
        },

        structureRules: {
            incitingIncidentTiming: "difuso — frequentemente um evento aparentemente pequeno com peso imenso para aquele personagem específico",
            jeopardyProgression: "interna — o perigo é a perda de algo essencial: uma relação, uma ilusão, uma versão de si mesmo",
            crisisPoint: "o momento de percepção — quando o personagem não pode mais não ver o que sempre esteve lá",
            resolutionStyle: "transformação ou fracasso em transformar — o personagem muda ou confirma que não pode mudar; ambos são válidos se verdadeiros",
            protagonistCount: 1
        },

        examples: {
            good: [
                "Ela notou que havia parado de mencionar seu nome em conversas. Não foi uma decisão — foi um apagamento gradual, como uma fotografia que desbota à luz. Só percebeu quando alguém perguntou e ela ficou em silêncio por um segundo a mais do necessário.",
                "O jantar de aniversário dela durou três horas. Ninguém disse nada importante. Mas na hora que ele estava lavando os pratos — ela já tinha ido dormir sem se despedir — ele entendeu que algo tinha terminado. Não conseguiu nomear o quê.",
                "A casa da infância tinha encolhido. Não fisicamente — ela sabia que era ela que tinha crescido. Mas havia algo perturbador na possibilidade de que um lugar que parecera imenso fosse, afinal, apenas um lugar."
            ],
            bad: [
                "Os personagens tinham sentimentos complexos e profundos.",
                "Era uma história sobre amor e perda e identidade.",
                "O protagonista passou por uma jornada de autoconhecimento."
            ]
        }
    },
    {
        name: "Horror Visceral",
        description: "Horror baseado em ameaças concretas e físicas — criaturas, perigo real e o medo primitivo do corpo e da morte.",
        instruction: "Construa medo através de ameaças físicas concretas e suas consequências corporais. O horror deve ser imediato, sensorial e tangível. A ameaça pode ser sobrenatural ou humana, mas suas consequências são sempre físicas e reais. A morte é possível e permanente. O horror deve ser ganho — nunca gratuito.",

        bibleInstructions: "Construa um cenário onde uma ameaça concreta coloca personagens específicos em perigo imediato e crescente. A ameaça deve ter lógica interna consistente — regras sobre o que pode e não pode fazer. Estabeleça personagens com identidade suficiente para que o leitor se importe com sua sobrevivência antes do perigo começar.",

        sceneInstructions: "Descreva ameaças e suas consequências com detalhes físicos concretos — sem eufemismos mas também sem gratuidade. O que o medo faz ao corpo: respiração, frequência cardíaca, perda de controle fino de movimentos. Construa tensão através da antecipação — o que está por vir é frequentemente mais aterrorizante do que o que aconteceu.",

        characterInstructions: "Personagens devem ter instintos de sobrevivência realistas — às vezes se paralisam, às vezes tomam decisões ruins por pânico, às vezes encontram reservas de coragem inesperadas. Mostre o custo físico do medo e da fuga. Evite o personagem que age de forma inexplicável apenas para avançar o plot — as decisões ruins devem fazer sentido emocional.",

        locationInstructions: "Descrições de localização devem ser táticas — o que oferece proteção, o que limita o movimento, o que esconde a ameaça. Claustrofobia versus espaço aberto como ferramentas de tensão diferentes. Lugares conhecidos tornando-se perigosos são mais assustadores do que cenários exóticos. A escuridão como personagem — o que não pode ser visto ameaça mais do que o que é mostrado.",

        beatInstructions: "Estruture cada beat de horror com: (1) Estabelecimento do que está em jogo — quem pode ser perdido; (2) A ameaça se aproximando — sinais, sons, indícios de perigo iminente; (3) Confronto ou fuga com consequências físicas reais. A tensão deve sair do ápice e se recompor para o próximo beat. Permita períodos de falsa segurança que o leitor não acredita completamente.",

        craftPrinciples: {
            pacing: "Variado estrategicamente — tensão crescente, ápice de terror, descida relativa antes do próximo ciclo. Momentos de calma nunca devem parecer completamente seguros. Frases longas durante antecipação, frases curtas durante o horror.",
            characterDepth: "Reações autênticas ao medo — pânico, paralisia, decisões ruins, coragem inesperada — revelam personagem. Mostre o custo físico e psicológico do trauma ao longo da narrativa.",
            showDontTell: "O medo mora na antecipação — descreva o que o personagem está sentindo no corpo antes de descrever o que está vendo. Os detalhes errados são mais perturbadores do que os detalhes óbvios.",
            dialogueStyle: "Comprimido e urgente durante ação. Diálogo de crise tem a brevidade do essencial. Nos momentos de falsa segurança, diálogos que revelam personalidade antes de mais horror.",
            sensoryFocus: ["o que o medo faz ao corpo — coração, respiração, tremor", "sons antes de visão — passos, respiração, algo se movendo", "cheiros associados à ameaça", "textura e temperatura do ambiente como indicadores de perigo", "a qualidade da escuridão e o que pode conter"],
            innerLifeRatio: 0.35,
            toneGuidelines: "Tenso e visceral. O horror deve ser ganho através da especificidade, não do acúmulo de elementos estereotipados. O medo primitivo do corpo e da morte como força motriz."
        },

        structureRules: {
            incitingIncidentTiming: "nos primeiros 10% — a ameaça emerge ou os personagens são colocados em perigo imediato",
            jeopardyProgression: "constante e crescente — os recursos dos personagens diminuem enquanto a ameaça escala",
            crisisPoint: "85-90% — confronto final com a ameaça em condições de máxima desvantagem",
            resolutionStyle: "sobrevivência custosa — alguns podem morrer, os que sobrevivem carregam o peso; ou tragédia com impacto emocional genuíno",
            protagonistCount: 2
        },

        examples: {
            good: [
                "Ela não conseguia controlar a respiração — sabia que estava fazendo barulho demais mas seus pulmões recusavam obedecer. Dez segundos de silêncio total. Então, do corredor: o som de algo pesado se movendo com cuidado. Aprendendo.",
                "O flashlight iluminou o cômodo e ela teve tempo para processar em dois tempos: primeiro, o alívio de não estar lá; segundo, o que estava no chão onde Marco devia ter estado.",
                "Correr era a resposta errada — ela sabia disso. Movimento atrairia atenção. Mas o corpo não pediu permissão para começar a correr, e sua mente ficou para trás tentando alcançar."
            ],
            bad: [
                "O monstro assustador os perseguiu de forma assustadora.",
                "Havia muito horror e suspense durante a história de horror.",
                "Eles tinham muito medo da criatura sobrenatural."
            ]
        }
    }
];

async function seedEnhancedStyles() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/story-generator');
        console.log('Connected to MongoDB');

        await NarrativeStyle.deleteMany({});
        await NarrativeStyle.insertMany(enhancedStyles);
        console.log(`Successfully seeded ${enhancedStyles.length} enhanced narrative styles`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error seeding enhanced narrative styles:', error);
        process.exit(1);
    }
}

seedEnhancedStyles();
