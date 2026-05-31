import React from 'react';
import { AlertCircle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';

const CHECK_LABELS = {
  project: 'Project',
  projectTitle: 'Project title',
  bible: 'Story Bible',
  scenes: 'Scenes',
  sceneContent: 'Scene content',
  wordCount: 'Word count',
  sceneOrder: 'Scene order',
  beatCoverage: 'Beat coverage',
  chapterNumbers: 'Chapter numbers',
  aiDisclosure: 'AI disclosure',
  humanReview: 'Human review',
  exportReadiness: 'Export readiness',
};

function formatCheckName(key) {
  if (CHECK_LABELS[key]) return CHECK_LABELS[key];
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

function formatValue(value) {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (value === null || value === undefined) return 'none';
  return String(value);
}

function checkDetails(check) {
  return Object.entries(check)
    .filter(([key]) => key !== 'status')
    .map(([key, value]) => `${formatCheckName(key)}: ${formatValue(value)}`)
    .join(' | ');
}

function IssueList({ title, emptyText, issues, tone }) {
  const isCritical = tone === 'critical';
  const color = isCritical ? 'border-red-800/60 bg-red-950/20' : 'border-yellow-800/60 bg-yellow-950/20';
  const textColor = isCritical ? 'text-red-200' : 'text-yellow-200';

  return (
    <div className={`border ${color} rounded-xl p-5`}>
      <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 ${textColor}`}>{title}</h3>
      {issues?.length > 0 ? (
        <ul className="space-y-3">
          {issues.map((issue, index) => (
            <li key={`${issue.code || title}-${index}`} className="text-sm text-gray-300">
              <span className="font-mono text-xs text-gray-500 mr-2">{issue.code || 'CHECK'}</span>
              {issue.message || 'Review this item before publishing.'}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">{emptyText}</p>
      )}
    </div>
  );
}

export default function PublishabilityPanel({ data, loading, error, onRefresh }) {
  if (loading && !data) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
          <Loader2 className="animate-spin text-cyan-400 mx-auto mb-4" size={40} />
          <p className="text-gray-400">Checking publishability...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-gray-900 border border-red-800/60 rounded-xl p-8 text-center">
          <AlertCircle className="text-red-400 mx-auto mb-4" size={40} />
          <h2 className="text-xl font-bold text-white mb-2">Publishability check unavailable</h2>
          <p className="text-gray-400 mb-5">{error}</p>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Refresh Check
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
          <AlertCircle className="text-gray-500 mx-auto mb-4" size={40} />
          <p className="text-gray-400">No publishability data is available for this project yet.</p>
        </div>
      </div>
    );
  }

  const checks = Object.entries(data.checks || {});
  const score = Number.isFinite(Number(data.score)) ? Number(data.score) : 0;
  const statusClasses = data.publishable
    ? 'bg-green-950/30 border-green-700/60 text-green-200'
    : 'bg-red-950/30 border-red-700/60 text-red-200';

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            {data.publishable ? (
              <CheckCircle size={32} className="text-green-400" />
            ) : (
              <AlertCircle size={32} className="text-red-400" />
            )}
            Publishability Check
          </h2>
          <p className="text-gray-400">Technical readiness for export and publication review.</p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          Refresh Check
        </button>
      </div>

      {error && (
        <div className="border border-yellow-800/60 bg-yellow-950/20 rounded-xl p-4 text-sm text-yellow-200">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-[1fr_180px] gap-4">
        <div className={`border rounded-xl p-6 ${statusClasses}`}>
          <p className="text-xs uppercase tracking-wider font-bold mb-2">Status</p>
          <p className="text-2xl font-bold">
            {data.publishable ? 'Technically publishable' : 'Not publishable yet'}
          </p>
          <p className="text-sm mt-3 text-gray-300">{data.summary || 'No summary provided.'}</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Score</p>
          <p className="text-4xl font-black text-white">{score}</p>
          <p className="text-sm text-gray-500">/100</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <IssueList
          title="Critical failures"
          emptyText="No critical failures."
          issues={data.criticalFailures || []}
          tone="critical"
        />
        <IssueList
          title="Warnings"
          emptyText="No warnings."
          issues={data.warnings || []}
          tone="warning"
        />
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Checks</h3>
        {checks.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-3">
            {checks.map(([key, check]) => {
              const status = check?.status || 'unknown';
              const detail = checkDetails(check || {});
              const badgeClass = status === 'passed'
                ? 'bg-green-900/50 text-green-300'
                : status === 'warning'
                  ? 'bg-yellow-900/50 text-yellow-300'
                  : 'bg-red-900/50 text-red-300';

              return (
                <div key={key} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="font-bold text-gray-200">{formatCheckName(key)}</p>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${badgeClass}`}>
                      {status}
                    </span>
                  </div>
                  {detail && <p className="text-xs text-gray-500">{detail}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No checks were returned.</p>
        )}
      </div>
    </div>
  );
}
