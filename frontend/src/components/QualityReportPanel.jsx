import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AlertCircle, BrainCircuit, CheckCircle, Copy, FileText, Gavel, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { buildApiUrl } from '../lib/api';

const SCORE_LABELS = [
  ['structureScore', 'Structure'],
  ['characterScore', 'Character'],
  ['sceneScore', 'Scene'],
  ['continuityScore', 'Continuity'],
  ['voiceScore', 'Voice'],
  ['genrePromiseScore', 'Genre Promise'],
  ['proseScore', 'Prose'],
  ['pacingScore', 'Pacing'],
  ['bookBriefAlignmentScore', 'Book Brief Alignment'],
  ['revisionReadinessScore', 'Revision Readiness'],
  ['technicalReadinessScore', 'Technical Readiness'],
];

const METADATA_LABELS = [
  ['sceneCount', 'Scenes'],
  ['totalWordCount', 'Total Words'],
  ['averageSceneWordCount', 'Average Scene Words'],
  ['chapterCount', 'Chapters'],
  ['beatCoverage', 'Beat Coverage'],
  ['bookBriefExists', 'Book Brief'],
  ['generatedAt', 'Generated At'],
];

const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  warning: 2,
  medium: 3,
  low: 4,
  info: 5,
};

const SEVERITY_STYLES = {
  critical: 'border-red-800/60 bg-red-950/20 text-red-200',
  high: 'border-red-800/60 bg-red-950/20 text-red-200',
  warning: 'border-yellow-800/60 bg-yellow-950/20 text-yellow-200',
  medium: 'border-yellow-800/60 bg-yellow-950/20 text-yellow-200',
  low: 'border-cyan-800/60 bg-cyan-950/20 text-cyan-200',
  info: 'border-cyan-800/60 bg-cyan-950/20 text-cyan-200',
};

const PRIORITY_STYLES = {
  high: 'bg-red-900/50 text-red-200',
  medium: 'bg-yellow-900/50 text-yellow-200',
  low: 'bg-cyan-900/50 text-cyan-200',
};

const JUDGE_SCORE_LABELS = [
  ['overallUsefulness', 'Overall Usefulness'],
  ['specificity', 'Specificity'],
  ['clarity', 'Clarity'],
  ['priorityAccuracy', 'Priority Accuracy'],
  ['easeOfUse', 'Ease of Use'],
  ['bookBriefRespect', 'Book Brief Respect'],
  ['genrePromiseUnderstanding', 'Genre Promise'],
  ['openQuestionQuality', 'Open Questions'],
  ['revisionPlanQuality', 'Revision Plan'],
];

const NEXT_STEP_LABELS = {
  calibrate_editorial_prompt: 'Calibrate editorial prompt',
  test_with_larger_project: 'Test with a larger project',
  ready_for_rewrite_studio: 'Ready for Rewrite Studio',
};

function getQualityReport(responseData) {
  return responseData?.qualityReport || null;
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : '0';
}

function formatScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function formatDate(value) {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleString();
}

function formatMetadataValue(key, value) {
  if (key === 'generatedAt') return formatDate(value);
  if (key === 'bookBriefExists') return value ? 'Configured' : 'Not configured';
  if (key === 'beatCoverage') {
    const expected = Number(value?.expectedBeats);
    const covered = Number(value?.coveredBeats);
    const ratio = Number(value?.ratio);

    if (!Number.isFinite(expected) || expected === 0) return 'No beats tracked';

    const percent = Number.isFinite(ratio) ? ` (${Math.round(ratio * 100)}%)` : '';
    return `${Number.isFinite(covered) ? covered : 0}/${expected}${percent}`;
  }

  return formatNumber(value);
}

function StatusBadge({ publishable }) {
  const className = publishable
    ? 'bg-green-950/30 border-green-700/60 text-green-200'
    : 'bg-yellow-950/30 border-yellow-700/60 text-yellow-200';

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${className}`}>
      {publishable ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {publishable ? 'Publishable' : 'Needs review'}
    </span>
  );
}

function EmptyState({ generating, generatingEditorial, onGenerate, onGenerateEditorial }) {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
        <ShieldCheck className="text-gray-500 mx-auto mb-4" size={44} />
        <h2 className="text-xl font-bold text-white mb-2">No quality report generated yet.</h2>
        <p className="text-gray-400 mb-5">
          Generate a deterministic heuristic report for structure, completeness, text artifacts, and readiness.
        </p>
        <button
          onClick={onGenerate}
          disabled={generating || generatingEditorial}
          className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-cyan-900/30 disabled:opacity-50"
        >
          {generating ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
          {generating ? 'Generating quality report...' : 'Generate Quality Report'}
        </button>
        <button
          onClick={onGenerateEditorial}
          disabled={generating || generatingEditorial}
          className="ml-3 inline-flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-violet-900/30 disabled:opacity-50"
        >
          {generatingEditorial ? <Loader2 className="animate-spin" size={16} /> : <BrainCircuit size={16} />}
          {generatingEditorial ? 'Generating editorial review...' : 'Generate AI Editorial Review'}
        </button>
      </div>
    </div>
  );
}

function FindingsList({ findings }) {
  if (!findings.length) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">Findings</h3>
        <p className="text-sm text-gray-500">No findings were returned.</p>
      </div>
    );
  }

  const sortedFindings = [...findings].sort((left, right) => {
    const leftOrder = SEVERITY_ORDER[left.severity] ?? 3;
    const rightOrder = SEVERITY_ORDER[right.severity] ?? 3;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left.category || '').localeCompare(String(right.category || ''));
  });

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Findings</h3>
      <div className="space-y-3">
        {sortedFindings.map((finding, index) => {
          const style = SEVERITY_STYLES[finding.severity] || 'border-gray-700 bg-gray-950/60 text-gray-300';
          const refs = [
            finding.chapterNumber ? `Chapter ${finding.chapterNumber}` : '',
            finding.beatId ? `Beat ${finding.beatId}` : '',
            finding.sceneId ? `Scene ${finding.sceneId}` : '',
          ].filter(Boolean);

          return (
            <div key={`${finding.code || 'finding'}-${index}`} className={`border rounded-xl p-4 ${style}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-black/20">
                  {finding.severity || 'info'}
                </span>
                <span className="font-mono text-xs text-gray-400">{finding.code || 'QUALITY_FINDING'}</span>
                {finding.category && <span className="text-xs text-gray-400">{finding.category}</span>}
              </div>
              <p className="text-sm text-gray-200">{finding.message || 'Review this quality finding.'}</p>
              {finding.evidence && <p className="text-xs text-gray-400 mt-2">Evidence: {finding.evidence}</p>}
              {finding.impact && <p className="text-xs text-gray-400 mt-2">Impact: {finding.impact}</p>}
              {Array.isArray(finding.suggestions) && finding.suggestions.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-gray-300 list-disc list-inside">
                  {finding.suggestions.map((suggestion, suggestionIndex) => (
                    <li key={`${finding.code || 'finding'}-suggestion-${suggestionIndex}`}>{suggestion}</li>
                  ))}
                </ul>
              )}
              {finding.question && <p className="text-xs text-gray-300 mt-2">Question: {finding.question}</p>}
              {refs.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">{refs.join(' | ')}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecommendationsList({ recommendations }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Recommendations</h3>
      {recommendations.length > 0 ? (
        <div className="space-y-3">
          {recommendations.map((recommendation, index) => (
            <div key={`${recommendation.code || 'recommendation'}-${index}`} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${PRIORITY_STYLES[recommendation.priority] || PRIORITY_STYLES.medium}`}>
                  {recommendation.priority || 'medium'}
                </span>
                <span className="font-mono text-xs text-gray-500">{recommendation.code || 'QUALITY_RECOMMENDATION'}</span>
              </div>
              <p className="text-sm text-gray-300">{recommendation.message || 'Review this recommendation.'}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No recommendations were returned.</p>
      )}
    </div>
  );
}

function EditorialPasses({ passes }) {
  if (!passes.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Editorial Passes</h3>
      <div className="space-y-4">
        {passes.map((pass, index) => (
          <div key={pass.id || `pass-${index}`} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <h4 className="font-bold text-white">{pass.name || 'Editorial Pass'}</h4>
              <span className="text-sm font-black text-cyan-200">{formatScore(pass.score)}/100</span>
            </div>
            <p className="text-sm text-gray-300 mb-3">{pass.summary || 'No pass summary provided.'}</p>
            {Array.isArray(pass.findings) && pass.findings.length > 0 && (
              <div className="space-y-2">
                {pass.findings.map((finding, findingIndex) => (
                  <div key={`${pass.id || index}-finding-${findingIndex}`} className="border border-gray-800 rounded-lg p-3 bg-black/20">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${SEVERITY_STYLES[finding.severity] || SEVERITY_STYLES.info}`}>
                        {finding.severity || 'info'}
                      </span>
                      <span className="font-mono text-xs text-gray-500">{finding.code || 'AI_EDITORIAL_FINDING'}</span>
                    </div>
                    <p className="text-sm text-gray-300">{finding.message || 'Review this finding.'}</p>
                    {finding.evidence && <p className="text-xs text-gray-500 mt-1">Evidence: {finding.evidence}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OpenQuestions({ questions }) {
  if (!questions.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Open Questions</h3>
      <div className="space-y-3">
        {questions.map((question, index) => (
          <div key={`question-${index}`} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
            <p className="font-bold text-white">{question.question}</p>
            {question.whyItMatters && <p className="text-sm text-gray-400 mt-2">{question.whyItMatters}</p>}
            {Array.isArray(question.options) && question.options.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {question.options.map((option, optionIndex) => (
                  <span key={`question-${index}-option-${optionIndex}`} className="px-2 py-1 rounded-full bg-gray-800 text-xs text-gray-300">
                    {option}
                  </span>
                ))}
              </div>
            )}
            {question.recommendedOption && <p className="text-xs text-cyan-200 mt-3">Recommended: {question.recommendedOption}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function RevisionPlanSection({ title, items, renderItem }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">{title}</h4>
      <div className="space-y-3">{items.map(renderItem)}</div>
    </div>
  );
}

function RevisionPlan({ plan }) {
  if (!plan || typeof plan !== 'object') return null;
  const hasPlan = ['macro', 'sceneLevel', 'lineLevel', 'authorDecisions'].some(key => Array.isArray(plan[key]) && plan[key].length > 0);
  if (!hasPlan) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Revision Plan</h3>
      <RevisionPlanSection
        title="Macro Revisions"
        items={plan.macro}
        renderItem={(item, index) => (
          <div key={`macro-${index}`} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium}`}>{item.priority || 'medium'}</span>
            <p className="font-bold text-white mt-2">{item.title}</p>
            {item.reason && <p className="text-sm text-gray-400 mt-1">{item.reason}</p>}
            {Array.isArray(item.actions) && item.actions.length > 0 && <p className="text-sm text-gray-300 mt-2">{item.actions.join(' | ')}</p>}
          </div>
        )}
      />
      <RevisionPlanSection
        title="Scene-Level Revisions"
        items={plan.sceneLevel}
        renderItem={(item, index) => (
          <div key={`scene-plan-${index}`} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium}`}>{item.priority || 'medium'}</span>
            <p className="text-sm text-gray-300 mt-2">{item.issue}</p>
            <p className="text-xs text-gray-500 mt-1">
              {[item.chapterNumber ? `Chapter ${item.chapterNumber}` : '', item.sceneId ? `Scene ${item.sceneId}` : '', item.recommendedAction].filter(Boolean).join(' | ')}
            </p>
          </div>
        )}
      />
      <RevisionPlanSection
        title="Line-Level Revisions"
        items={plan.lineLevel}
        renderItem={(item, index) => (
          <div key={`line-plan-${index}`} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.low}`}>{item.priority || 'low'}</span>
            <p className="text-sm text-gray-300 mt-2">{item.issue}</p>
            {item.action && <p className="text-xs text-gray-500 mt-1">{item.action}</p>}
          </div>
        )}
      />
      <RevisionPlanSection
        title="Author Decisions"
        items={plan.authorDecisions}
        renderItem={(item, index) => (
          <div key={`decision-${index}`} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
            <p className="font-bold text-white">{item.question}</p>
            {Array.isArray(item.options) && item.options.length > 0 && <p className="text-sm text-gray-400 mt-2">{item.options.join(' | ')}</p>}
            {item.recommendedOption && <p className="text-xs text-cyan-200 mt-2">Recommended: {item.recommendedOption}</p>}
          </div>
        )}
      />
    </div>
  );
}

function RecommendedMethods({ methods }) {
  if (!methods.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Recommended Methods</h3>
      <div className="grid md:grid-cols-2 gap-3">
        {methods.map((method, index) => (
          <div key={method.id || `method-${index}`} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
            <p className="font-bold text-white">{method.name || method.id}</p>
            {method.reason && <p className="text-sm text-gray-400 mt-2">{method.reason}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditorialJudgePanel({ evaluation }) {
  if (!evaluation) return null;

  const scores = evaluation.scores || {};

  return (
    <div className="bg-gray-900 border border-violet-700/50 rounded-xl p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-violet-200 mb-2 flex items-center gap-2">
            <Gavel size={16} />
            Editorial Report Judge
          </h3>
          <p className="text-sm text-gray-300">{evaluation.summary || 'The editorial report was evaluated.'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500">Average</p>
          <p className="text-3xl font-black text-white">{Number(evaluation.averageScore || 0).toFixed(1)}</p>
          <p className="text-xs text-gray-500">/5</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {JUDGE_SCORE_LABELS.map(([key, label]) => (
          <div key={key} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-gray-200">{label}</p>
            <p className="text-lg font-black text-white">{scores[key] || 0}/5</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Best Finding</p>
          <p className="font-mono text-xs text-violet-200 mb-2">{evaluation.bestFinding?.code || 'Not identified'}</p>
          <p className="text-sm text-gray-300">{evaluation.bestFinding?.whyItWorks || 'No explanation provided.'}</p>
        </div>
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Weakest Finding</p>
          <p className="font-mono text-xs text-yellow-200 mb-2">{evaluation.worstFinding?.code || 'Not identified'}</p>
          <p className="text-sm text-gray-300">{evaluation.worstFinding?.whyItFails || 'No explanation provided.'}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Most Useful Suggestion</p>
          <p className="text-sm text-gray-300">{evaluation.mostUsefulSuggestion || 'No suggestion identified.'}</p>
        </div>
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Generic or Wrong Suggestion</p>
          <p className="text-sm text-gray-300">{evaluation.genericOrWrongSuggestion || 'No weak suggestion identified.'}</p>
        </div>
      </div>

      {Array.isArray(evaluation.calibrationAdvice) && evaluation.calibrationAdvice.length > 0 && (
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-3">Calibration Advice</p>
          <ul className="space-y-2 text-sm text-gray-300 list-disc list-inside">
            {evaluation.calibrationAdvice.map((advice, index) => (
              <li key={`calibration-${index}`}>{advice}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${evaluation.readyForRewriteStudio ? 'border-green-700/60 bg-green-950/30 text-green-200' : 'border-yellow-700/60 bg-yellow-950/30 text-yellow-200'}`}>
          {evaluation.readyForRewriteStudio ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {evaluation.readyForRewriteStudio ? 'Ready for Rewrite Studio' : 'Needs another review round'}
        </span>
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800 text-xs font-bold text-gray-300">
          Next: {NEXT_STEP_LABELS[evaluation.recommendedNextStep] || evaluation.recommendedNextStep || 'Not specified'}
        </span>
      </div>
    </div>
  );
}

function QualityValidationRunSection({
  validationRun,
  running,
  copied,
  onRun,
  onCopy,
}) {
  const markdown = validationRun?.markdownReport || '';
  const scores = validationRun?.scores || {};
  const readiness = validationRun?.readiness || {};
  const metadata = validationRun?.metadata || {};

  return (
    <div className="bg-gray-900 border border-cyan-700/50 rounded-xl p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-200 mb-2 flex items-center gap-2">
            <FileText size={16} />
            Quality Validation Run
          </h3>
          <p className="text-sm text-gray-300">
            Consolidated readiness, heuristic quality, AI editorial review, and judge results as a manager-ready Markdown report.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onRun}
            disabled={running}
            className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-cyan-900/30 disabled:opacity-50"
          >
            {running ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
            {running ? 'Running validation...' : 'Run Full Editorial Validation'}
          </button>
          <button
            onClick={onCopy}
            disabled={!markdown || running}
            className="inline-flex items-center gap-2 px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
          >
            <Copy size={16} />
            {copied ? 'Copied' : 'Copy Manager Report'}
          </button>
        </div>
      </div>

      {validationRun ? (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
              <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Judge Average</p>
              <p className="text-2xl font-bold text-white">{scores.averageJudgeScore ?? 'N/A'}/5</p>
            </div>
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
              <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Editorial Score</p>
              <p className="text-2xl font-bold text-white">{scores.editorialOverallScore ?? 'N/A'}/100</p>
            </div>
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
              <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Ready for Rewrite</p>
              <p className="text-2xl font-bold text-white">{readiness.readyForRewriteStudio ? 'Yes' : 'No'}</p>
            </div>
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
              <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Scenes</p>
              <p className="text-2xl font-bold text-white">{metadata.sceneCount ?? 0}</p>
            </div>
          </div>

          <div className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
            <p className="text-sm text-gray-300">{validationRun.summary || 'Validation report is ready to copy.'}</p>
            <p className="text-xs text-gray-500 mt-2">Created: {formatDate(validationRun.createdAt || metadata.generatedAt)}</p>
          </div>

          <textarea
            readOnly
            value={markdown}
            className="w-full h-72 bg-gray-950 border border-gray-700 rounded-lg p-4 text-sm text-gray-200 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-cyan-700"
            aria-label="Manager Markdown Report"
          />
        </>
      ) : (
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
          <p className="text-sm text-gray-500">No validation run has been generated yet.</p>
        </div>
      )}
    </div>
  );
}

export default function QualityReportPanel({ projectId }) {
  const [report, setReport] = useState(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingEditorial, setGeneratingEditorial] = useState(false);
  const [judgingEditorial, setJudgingEditorial] = useState(false);
  const [validationRun, setValidationRun] = useState(null);
  const [runningValidation, setRunningValidation] = useState(false);
  const [copiedValidation, setCopiedValidation] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadLatestReport = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.get(buildApiUrl(`/projects/${projectId}/quality-report/latest`));
      const nextReport = getQualityReport(response.data);
      setExists(Boolean(response.data?.exists && nextReport));
      setReport(nextReport);
    } catch {
      setError('Quality report is not available right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadLatestValidationRun = useCallback(async () => {
    try {
      const response = await axios.get(buildApiUrl(`/projects/${projectId}/quality-validation-run/latest`));
      setValidationRun(response.data?.exists ? response.data.validationRun : null);
    } catch {
      setValidationRun(null);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLatestReport();
    loadLatestValidationRun();
  }, [loadLatestReport, loadLatestValidationRun]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(buildApiUrl(`/projects/${projectId}/quality-report`));
      const nextReport = getQualityReport(response.data);
      setExists(Boolean(nextReport));
      setReport(nextReport);
      setSuccess('Quality report generated.');
    } catch {
      setError('Could not generate the quality report. Please try again in a moment.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateEditorial = async () => {
    setGeneratingEditorial(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(buildApiUrl(`/projects/${projectId}/quality-report/ai-editorial`));
      const nextReport = getQualityReport(response.data);
      setExists(Boolean(nextReport));
      setReport(nextReport);
      setSuccess('AI editorial review generated.');
    } catch {
      setError('Could not generate the AI editorial review. Please try again in a moment.');
    } finally {
      setGeneratingEditorial(false);
    }
  };

  const handleJudgeEditorial = async () => {
    if (!report?.id) return;

    setJudgingEditorial(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(buildApiUrl(`/projects/${projectId}/quality-report/${report.id}/judge`));
      setReport(currentReport => ({
        ...currentReport,
        editorialJudge: response.data?.editorialJudge || null,
      }));
      setSuccess('Editorial report judged.');
    } catch {
      setError('Could not judge the editorial report. Please try again in a moment.');
    } finally {
      setJudgingEditorial(false);
    }
  };

  const handleRunValidation = async () => {
    setRunningValidation(true);
    setCopiedValidation(false);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(buildApiUrl(`/projects/${projectId}/quality-validation-run`), {
        regenerateHeuristic: true,
        regenerateEditorial: true,
        regenerateJudge: true,
      });
      setValidationRun(response.data?.validationRun || null);
      if (response.data?.validationRun?.reportIds?.aiEditorialQualityReportId) {
        await loadLatestReport();
      }
      setSuccess('Quality validation report generated.');
    } catch {
      setError('Could not run the full editorial validation. Please try again in a moment.');
    } finally {
      setRunningValidation(false);
    }
  };

  const handleCopyValidationReport = async () => {
    const markdown = validationRun?.markdownReport || '';
    if (!markdown) return;

    setCopiedValidation(false);
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }

      await navigator.clipboard.writeText(markdown);
      setCopiedValidation(true);
      setSuccess('Manager report copied.');
    } catch {
      setError('Clipboard copy is not available here. Select the Markdown text area and copy it manually.');
    }
  };

  const findings = useMemo(() => report?.findings || [], [report]);
  const recommendations = useMemo(() => report?.recommendations || [], [report]);
  const editorialPasses = useMemo(() => report?.editorialPasses || [], [report]);
  const openQuestions = useMemo(() => report?.openQuestions || [], [report]);
  const recommendedMethods = useMemo(() => report?.recommendedMethods || [], [report]);
  const metadata = report?.metadata || {};
  const editorialJudge = report?.editorialJudge || null;
  const canJudgeEditorial = report?.source === 'ai_editorial' && Boolean(report?.id);
  const generatedAt = metadata.generatedAt || report?.createdAt;
  const findingCount = findings.length;
  const scoreLabels = useMemo(() => (
    SCORE_LABELS.filter(([key]) => Object.prototype.hasOwnProperty.call(report?.scores || {}, key))
  ), [report]);

  if (loading && !report) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
          <Loader2 className="animate-spin text-cyan-400 mx-auto mb-4" size={40} />
          <p className="text-gray-400">Loading quality report...</p>
        </div>
      </div>
    );
  }

  if (!exists && !report) {
    return (
      <>
        {error && (
          <div className="p-8 max-w-5xl mx-auto pb-0">
            <div className="border border-red-800/60 bg-red-950/20 rounded-xl p-4 text-sm text-red-200 flex items-start gap-3">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <span>{error}</span>
            </div>
          </div>
        )}
        <EmptyState
          generating={generating}
          generatingEditorial={generatingEditorial}
          onGenerate={handleGenerate}
          onGenerateEditorial={handleGenerateEditorial}
        />
        <div className="px-8 pb-8 max-w-5xl mx-auto">
          <QualityValidationRunSection
            validationRun={validationRun}
            running={runningValidation}
            copied={copiedValidation}
            onRun={handleRunValidation}
            onCopy={handleCopyValidationReport}
          />
        </div>
      </>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <ShieldCheck size={32} className="text-cyan-400" />
            Quality Report
          </h2>
          <p className="text-gray-400">Quality triage and editorial review for the current manuscript snapshot.</p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            onClick={loadLatestReport}
            disabled={loading || generating || generatingEditorial || judgingEditorial || runningValidation}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Refresh
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || generating || generatingEditorial || judgingEditorial || runningValidation}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-cyan-900/30 disabled:opacity-50"
          >
            {generating ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
            {generating ? 'Generating quality report...' : 'Generate Quality Report'}
          </button>
          <button
            onClick={handleGenerateEditorial}
            disabled={loading || generating || generatingEditorial || judgingEditorial || runningValidation}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-violet-900/30 disabled:opacity-50"
          >
            {generatingEditorial ? <Loader2 className="animate-spin" size={16} /> : <BrainCircuit size={16} />}
            {generatingEditorial ? 'Generating editorial review...' : 'Generate AI Editorial Review'}
          </button>
          {canJudgeEditorial && (
            <button
              onClick={handleJudgeEditorial}
              disabled={loading || generating || generatingEditorial || judgingEditorial || runningValidation}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-violet-900/30 disabled:opacity-50"
            >
              {judgingEditorial ? <Loader2 className="animate-spin" size={16} /> : <Gavel size={16} />}
              {judgingEditorial ? 'Judging report...' : 'Judge Editorial Report'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="border border-red-800/60 bg-red-950/20 rounded-xl p-4 text-sm text-red-200 flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="border border-green-800/60 bg-green-950/20 rounded-xl p-4 text-sm text-green-200 flex items-start gap-3">
          <CheckCircle className="shrink-0 mt-0.5" size={18} />
          <span>{success}</span>
        </div>
      )}

      <QualityValidationRunSection
        validationRun={validationRun}
        running={runningValidation}
        copied={copiedValidation}
        onRun={handleRunValidation}
        onCopy={handleCopyValidationReport}
      />

      <div className="grid md:grid-cols-[1fr_180px] gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <StatusBadge publishable={report?.publishable} />
            <span className="text-xs uppercase tracking-wider font-bold px-3 py-1 rounded-full bg-gray-800 text-gray-300">
              Source: {report?.source || 'heuristic'}
            </span>
          </div>
          <p className="text-sm text-gray-300">{report?.summary || 'No summary provided.'}</p>
          <p className="text-xs text-gray-500 mt-3">Created: {formatDate(generatedAt)}</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Score</p>
          <p className="text-4xl font-black text-white">{formatScore(report?.overallScore)}</p>
          <p className="text-sm text-gray-500">/100</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Scenes</p>
          <p className="text-2xl font-bold text-white">{formatNumber(metadata.sceneCount)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Words</p>
          <p className="text-2xl font-bold text-white">{formatNumber(metadata.totalWordCount)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Findings</p>
          <p className="text-2xl font-bold text-white">{formatNumber(findingCount)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Book Brief</p>
          <p className="text-2xl font-bold text-white">{metadata.bookBriefExists ? 'Yes' : 'No'}</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Category Scores</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {(scoreLabels.length > 0 ? scoreLabels : SCORE_LABELS).map(([key, label]) => (
            <div key={key} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60 flex items-center justify-between gap-4">
              <p className="font-bold text-gray-200">{label}</p>
              <p className="text-lg font-black text-white">{formatScore(report?.scores?.[key])}/100</p>
            </div>
          ))}
        </div>
      </div>

      <EditorialPasses passes={editorialPasses} />
      <EditorialJudgePanel evaluation={editorialJudge} />
      <RevisionPlan plan={report?.revisionPlan} />
      <OpenQuestions questions={openQuestions} />
      <RecommendedMethods methods={recommendedMethods} />
      <FindingsList findings={findings} />
      <RecommendationsList recommendations={recommendations} />

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Metadata</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {METADATA_LABELS.map(([key, label]) => (
            <div key={key} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
              <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">{label}</p>
              <p className="text-sm font-semibold text-gray-200">{formatMetadataValue(key, metadata[key])}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
