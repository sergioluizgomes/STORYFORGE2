const DEFAULT_LANGUAGE = 'Português Brasileiro';
const DEFAULT_VERSION = 'current';
const MAX_STRING_LENGTH = 1200;
const MAX_LONG_STRING_LENGTH = 5000;
const MAX_KEYWORDS = 10;
const MAX_CATEGORIES = 8;
const LOW_QUALITY_SCORE = 70;

function toPlainObject(value) {
  if (!value) return value;
  return typeof value.toObject === 'function'
    ? value.toObject({ versionKey: false })
    : value;
}

function normalizeString(value, maxLength = MAX_STRING_LENGTH) {
  if (value === undefined || value === null) return undefined;

  const normalized = String(value).replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;

  return normalized.slice(0, maxLength);
}

function dedupeList(values) {
  const seen = new Set();
  const result = [];

  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeString(value, 240);
    if (!normalized) continue;

    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function normalizeList(values, options = {}) {
  const maxItems = options.maxItems || 20;
  const maxLength = options.maxLength || 240;

  return dedupeList(values)
    .map((value) => normalizeString(value, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function getProjectTitle(project) {
  return normalizeString(project?.title || project?.name, 240) || 'Untitled Project';
}

function getLanguage(project, bookBrief) {
  return normalizeString(bookBrief?.language || project?.language, 120) || DEFAULT_LANGUAGE;
}

function normalizeStatus(value) {
  return normalizeString(value, 80)?.toLowerCase() || '';
}

function buildKeywordSuggestions(project, bookBrief) {
  return normalizeList([
    ...(Array.isArray(bookBrief?.keywords) ? bookBrief.keywords : []),
    bookBrief?.genre,
    bookBrief?.subgenre,
    bookBrief?.targetAudience,
    bookBrief?.seriesName,
    project?.style,
    project?.language,
  ], { maxItems: MAX_KEYWORDS });
}

function buildCategorySuggestions(project, bookBrief) {
  return normalizeList([
    bookBrief?.genre ? `Suggested genre: ${bookBrief.genre}` : null,
    bookBrief?.subgenre ? `Suggested subgenre: ${bookBrief.subgenre}` : null,
    project?.style ? `Project style: ${project.style}` : null,
  ], { maxItems: MAX_CATEGORIES });
}

function checklistItem(label, note) {
  return {
    label,
    status: 'pending',
    note,
  };
}

function buildChecklist({ platform, aiDisclosure } = {}) {
  const base = [
    checklistItem('Reviewed EPUB/DOCX/PDF files', 'Confirm exported files open correctly and match the intended manuscript.'),
    checklistItem('Cover ready', 'Confirm cover file, title treatment, and platform dimensions manually.'),
    checklistItem('Description reviewed', 'Template copy must be edited and approved before publication.'),
    checklistItem('Keywords reviewed', 'Check every keyword manually against platform rules and reader expectations.'),
    checklistItem('Categories reviewed', 'Treat categories as suggestions unless mapped to official platform categories.'),
    checklistItem('AI disclosure defined', 'Confirm disclosure requirements for the selected platform before submission.'),
    checklistItem('Rights and content verified', 'Confirm rights, permissions, trademarks, and source material status.'),
    checklistItem('Human review or waiver recorded', 'Confirm editorial review status before publication.'),
    checklistItem('Price defined', 'Choose price, territories, and royalty options manually.'),
    checklistItem('Sample or preview checked', 'Open the platform preview and verify formatting before release.'),
  ];

  if (platform === 'apple' && normalizeStatus(aiDisclosure) === 'ai_generated') {
    base.unshift(checklistItem(
      'AI-generated content disclosed in description',
      'Apple Books may require explicit description disclosure so customers are not confused.'
    ));
  }

  if (platform === 'draft2digital') {
    return [
      checklistItem('Quality review complete', 'Review formatting, metadata, and visible store copy.'),
      checklistItem('Metadata reviewed', 'Confirm title, contributor, language, description, keywords, and categories.'),
      checklistItem('Rights confirmed', 'Confirm distribution rights for every selected channel.'),
      checklistItem('Formatting checked', 'Review generated files in a reader or preview tool.'),
      checklistItem('Human review complete or waived', 'Keep a clear record before distribution.'),
      ...base.slice(5, 8),
    ];
  }

  return base;
}

function buildMonetizationStrategy(project, bookBrief) {
  const mode = normalizeStatus(bookBrief?.monetizationMode) || 'undecided';
  const genre = normalizeString(bookBrief?.genre || project?.style, 120) || 'the current genre';
  const common = {
    mode,
    suggestedChannels: ['KDP', 'Apple Books', 'Draft2Digital'],
    nextSteps: [
      'Review metadata manually before submission.',
      'Confirm rights, disclosure, file quality, and pricing.',
      'Use this package as an editable draft, not a final platform submission.',
    ],
    risks: [
      'Template copy can sound generic without human editing.',
      'Platform rules and category availability must be checked manually.',
      'No sales or approval outcome is guaranteed.',
    ],
  };

  if (mode === 'kdp_select') {
    return {
      ...common,
      suggestedChannels: ['KDP'],
      rationale: `BookBrief indicates KDP Select as the intended mode for ${genre}. Review exclusivity and enrollment rules before choosing this path.`,
      risks: [
        'KDP Select may involve exclusivity obligations that require manual review.',
        ...common.risks,
      ],
    };
  }

  if (mode === 'wide') {
    return {
      ...common,
      rationale: `BookBrief indicates wide distribution for ${genre}, so the initial package keeps metadata portable across storefronts.`,
    };
  }

  if (mode === 'direct_sales') {
    return {
      ...common,
      suggestedChannels: ['Direct sales site', 'Email launch list', 'KDP or wide retailers as optional channels'],
      rationale: `BookBrief indicates direct sales, so the package emphasizes owned launch materials while keeping retailer metadata editable.`,
    };
  }

  return {
    ...common,
    mode: 'undecided',
    rationale: `Monetization mode is undecided. Compare KDP Select, wide distribution, and direct sales before committing.`,
  };
}

function hasCriticalQualityFinding(qualityReport) {
  return Array.isArray(qualityReport?.findings)
    && qualityReport.findings.some((finding) => normalizeStatus(finding?.severity) === 'critical');
}

function buildComplianceWarnings({ bookBrief, publishability, qualityReport } = {}) {
  const warnings = [
    'Template-generated publication copy requires human review before real publication.',
    'Rights, source material, trademarks, and platform policy compliance are not verified by this package.',
  ];
  const aiDisclosure = normalizeStatus(bookBrief?.aiDisclosure || 'not_configured');
  const humanReviewStatus = normalizeStatus(bookBrief?.humanReviewStatus || 'not_tracked');

  if (aiDisclosure === 'not_configured') {
    warnings.push('AI disclosure is not configured.');
  } else if (aiDisclosure === 'ai_generated') {
    warnings.push('AI-generated content may require disclosure on publishing platforms; include platform-specific wording where required.');
    warnings.push('For Apple Books, review whether the book description should explicitly disclose AI-generated content.');
  } else if (aiDisclosure === 'ai_assisted') {
    warnings.push('AI-assisted status is recorded; keep human review evidence before publication.');
  }

  if (humanReviewStatus === 'not_tracked' || humanReviewStatus === 'needed' || humanReviewStatus === 'in_progress') {
    warnings.push('Human review is not completed or waived.');
  }

  if (publishability && publishability.publishable === false) {
    warnings.push('Project is not technically publishable yet.');
  }

  if (qualityReport && (hasCriticalQualityFinding(qualityReport) || Number(qualityReport.overallScore) < LOW_QUALITY_SCORE)) {
    warnings.push('QualityReport indicates issues that should be reviewed before publication.');
  }

  return normalizeList(warnings, { maxItems: 20, maxLength: 500 });
}

function buildReadinessSummary({ publishability, qualityReport, complianceWarnings }) {
  const publishabilityText = publishability
    ? `Publishability Gate score: ${Number.isFinite(Number(publishability.score)) ? Math.round(Number(publishability.score)) : 'n/a'}; publishable: ${publishability.publishable === true ? 'yes' : 'no'}.`
    : 'Publishability Gate was not available.';
  const qualityText = qualityReport
    ? `QualityReport score: ${Number.isFinite(Number(qualityReport.overallScore)) ? Math.round(Number(qualityReport.overallScore)) : 'n/a'}.`
    : 'No QualityReport was available.';

  return normalizeString(`${publishabilityText} ${qualityText} ${complianceWarnings.length} publication warning(s) need review.`, 600);
}

function buildDescriptionShort({ title, project, bookBrief }) {
  const genre = normalizeString(bookBrief?.genre || project?.style, 120);
  const audience = normalizeString(bookBrief?.targetAudience, 120);
  const parts = [
    title,
    genre ? `is a ${genre} project` : 'is a fiction project',
    audience ? `for ${audience}` : null,
  ].filter(Boolean);

  return normalizeString(`${parts.join(' ')}. This editable description should be reviewed before publication.`, 600);
}

function buildDescriptionLong({ title, project, bookBrief }) {
  const genre = normalizeString(bookBrief?.genre || project?.style, 120) || 'fiction';
  const audience = normalizeString(bookBrief?.targetAudience, 120) || 'its intended readers';
  const tone = normalizeString(bookBrief?.tone, 120);
  const premise = normalizeString(project?.premise, 500);
  const lines = [
    `${title} is a ${genre} project prepared for ${audience}.`,
    tone ? `The intended tone is ${tone}.` : null,
    premise ? `Current positioning note: ${premise}` : null,
    'This is a safe editable draft for store metadata. Review the final book, claims, rights, categories, keywords, and platform rules before using it publicly.',
  ].filter(Boolean);

  return normalizeString(lines.join('\n\n'), MAX_LONG_STRING_LENGTH);
}

function buildCopyrightPage(title, penName) {
  const year = new Date().getFullYear();
  const holder = normalizeString(penName, 160) || '[Author or rights holder]';

  return normalizeString(
    `Copyright (c) ${year} ${holder}.\n\n${title}\n\nAll rights reserved. This page is an editable template and does not assert formal copyright registration. Review rights, permissions, publisher details, ISBN, edition notice, and legal requirements before publication.`,
    MAX_LONG_STRING_LENGTH
  );
}

function buildAuthorBio(penName) {
  const name = normalizeString(penName, 160) || '[Author name]';
  return normalizeString(`${name} is the author name for this publication package. Replace this placeholder with a truthful, approved author bio before publication.`, 900);
}

function buildLaunchEmail(title, genre) {
  return normalizeString(
    `Subject: ${title} is now available\n\nHello,\n\n${title} is ready for readers. This editable launch note can be customized with the final store link, format details, and a brief truthful description of the book.\n\nThank you for reading.`,
    MAX_LONG_STRING_LENGTH
  );
}

function buildAdCopy(title, bookBrief, project) {
  const genre = normalizeString(bookBrief?.genre || project?.style, 120) || 'fiction';
  const audience = normalizeString(bookBrief?.targetAudience, 120) || 'readers';

  return normalizeList([
    `${title}: a ${genre} story for ${audience}.`,
    `Start ${title}, an editable ${genre} release prepared for careful reader review.`,
    `Discover ${title}. Review the sample and decide if this ${genre} story is for you.`,
  ], { maxItems: 3, maxLength: 400 });
}

function buildAPlusContent(title, bookBrief, project) {
  const genre = normalizeString(bookBrief?.genre || project?.style, 120) || 'book';

  return {
    modules: [
      {
        type: 'standard_text',
        headline: `Inside ${title}`,
        body: `Editable module copy for the ${genre} positioning. Replace with final approved marketing language before publication.`,
        imagePrompt: `Optional concept image for ${title}, ${genre}, bookstore-safe promotional mood`,
        altText: `${title} promotional concept image`,
      },
      {
        type: 'comparison_or_features',
        headline: 'Publication notes',
        body: 'Use this space for truthful series, format, audience, or content notes after manual review.',
        imagePrompt: '',
        altText: '',
      },
    ],
  };
}

function buildMetadata({ publishability, qualityReport, bookBrief }) {
  const qualityMetadata = qualityReport?.metadata || {};
  const qualityId = qualityReport?._id || qualityReport?.id;

  return {
    publishabilityScore: Number.isFinite(Number(publishability?.score)) ? Number(publishability.score) : null,
    qualityScore: Number.isFinite(Number(qualityReport?.overallScore)) ? Number(qualityReport.overallScore) : null,
    generatedAt: new Date().toISOString(),
    bookBriefExists: Boolean(bookBrief),
    qualityReportId: qualityId ? String(qualityId) : null,
    sceneCount: Number.isFinite(Number(qualityMetadata.sceneCount)) ? Number(qualityMetadata.sceneCount) : null,
    totalWordCount: Number.isFinite(Number(qualityMetadata.totalWordCount)) ? Number(qualityMetadata.totalWordCount) : null,
  };
}

function buildStatus(complianceWarnings, publishability, qualityReport) {
  if (publishability?.publishable === false || hasCriticalQualityFinding(qualityReport)) {
    return 'needs_work';
  }

  if (complianceWarnings.length <= 2) {
    return 'ready_for_review';
  }

  return 'draft';
}

function buildPublishingPackageSnapshot({ project, bookBrief, publishability, qualityReport } = {}) {
  const safeProject = toPlainObject(project) || {};
  const safeBookBrief = toPlainObject(bookBrief);
  const safeQualityReport = toPlainObject(qualityReport);
  const title = getProjectTitle(safeProject);
  const penName = normalizeString(safeBookBrief?.penName, 160);
  const aiDisclosure = normalizeString(safeBookBrief?.aiDisclosure || 'not_configured', 80);
  const complianceWarnings = buildComplianceWarnings({
    bookBrief: safeBookBrief,
    publishability,
    qualityReport: safeQualityReport,
  });
  const genre = normalizeString(safeBookBrief?.genre || safeProject?.style, 120) || 'book';

  return {
    projectId: safeProject?._id ? String(safeProject._id) : safeProject?.id ? String(safeProject.id) : undefined,
    source: 'heuristic',
    version: DEFAULT_VERSION,
    status: buildStatus(complianceWarnings, publishability, safeQualityReport),
    title,
    subtitle: normalizeString(safeBookBrief?.subtitle, 240),
    penName,
    language: getLanguage(safeProject, safeBookBrief),
    descriptionShort: buildDescriptionShort({ title, project: safeProject, bookBrief: safeBookBrief }),
    descriptionLong: buildDescriptionLong({ title, project: safeProject, bookBrief: safeBookBrief }),
    keywords: buildKeywordSuggestions(safeProject, safeBookBrief),
    categories: buildCategorySuggestions(safeProject, safeBookBrief),
    aiDisclosure,
    copyrightPage: buildCopyrightPage(title, penName),
    authorBio: buildAuthorBio(penName),
    kdpChecklist: buildChecklist({ platform: 'kdp', aiDisclosure }),
    appleChecklist: buildChecklist({ platform: 'apple', aiDisclosure }),
    draft2DigitalChecklist: buildChecklist({ platform: 'draft2digital', aiDisclosure }),
    launchEmail: buildLaunchEmail(title, genre),
    adCopy: buildAdCopy(title, safeBookBrief, safeProject),
    aPlusContent: buildAPlusContent(title, safeBookBrief, safeProject),
    monetizationStrategy: buildMonetizationStrategy(safeProject, safeBookBrief),
    complianceWarnings,
    readinessSummary: buildReadinessSummary({ publishability, qualityReport: safeQualityReport, complianceWarnings }),
    metadata: buildMetadata({ publishability, qualityReport: safeQualityReport, bookBrief: safeBookBrief }),
  };
}

function toPublishingPackageResponse(packageDocument) {
  if (!packageDocument) return packageDocument;

  const plain = toPlainObject(packageDocument);
  return {
    id: plain._id ? String(plain._id) : plain.id,
    projectId: plain.projectId ? String(plain.projectId) : plain.projectId,
    source: plain.source,
    version: plain.version,
    status: plain.status,
    title: plain.title,
    subtitle: plain.subtitle,
    penName: plain.penName,
    language: plain.language,
    descriptionShort: plain.descriptionShort,
    descriptionLong: plain.descriptionLong,
    keywords: plain.keywords || [],
    categories: plain.categories || [],
    aiDisclosure: plain.aiDisclosure,
    copyrightPage: plain.copyrightPage,
    authorBio: plain.authorBio,
    kdpChecklist: plain.kdpChecklist || [],
    appleChecklist: plain.appleChecklist || [],
    draft2DigitalChecklist: plain.draft2DigitalChecklist || [],
    launchEmail: plain.launchEmail,
    adCopy: plain.adCopy || [],
    aPlusContent: plain.aPlusContent || { modules: [] },
    monetizationStrategy: plain.monetizationStrategy || {},
    complianceWarnings: plain.complianceWarnings || [],
    readinessSummary: plain.readinessSummary,
    metadata: plain.metadata || {},
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

async function getLatestPublishingPackage(projectId) {
  const PublishingPackage = require('../models/PublishingPackage');
  const packageDocument = await PublishingPackage.findOne({ projectId }).sort({ createdAt: -1 });
  return toPublishingPackageResponse(packageDocument);
}

async function generatePublishingPackageForProject(projectId, options = {}) {
  const Project = require('../models/Project');
  const QualityReport = require('../models/QualityReport');
  const PublishingPackage = require('../models/PublishingPackage');
  const { getBookBriefByProjectId } = require('./bookBriefService');
  const { evaluateProjectPublishability } = require('./publishabilityService');

  const project = await Project.findById(projectId);
  if (!project) return null;

  const [bookBrief, publishability, qualityReport] = await Promise.all([
    getBookBriefByProjectId(project._id),
    evaluateProjectPublishability(project._id),
    QualityReport.findOne({ projectId: project._id }).sort({ createdAt: -1 }),
  ]);

  const snapshot = buildPublishingPackageSnapshot({
    project,
    bookBrief,
    publishability,
    qualityReport,
  });

  const packageDocument = await PublishingPackage.create({
    ...snapshot,
    projectId: project._id,
    version: options.version || snapshot.version,
  });
  const response = toPublishingPackageResponse(packageDocument);

  console.log('[PUBLISHING_PACKAGE] generated', {
    projectId: String(project._id),
    packageId: response.id,
    status: response.status,
    warningCount: response.complianceWarnings.length,
  });

  return response;
}

module.exports = {
  buildPublishingPackageSnapshot,
  generatePublishingPackageForProject,
  getLatestPublishingPackage,
  toPublishingPackageResponse,
  normalizeString,
  normalizeList,
  dedupeList,
  buildKeywordSuggestions,
  buildCategorySuggestions,
  buildComplianceWarnings,
  buildMonetizationStrategy,
  buildChecklist,
};
