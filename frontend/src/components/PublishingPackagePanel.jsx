import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle, Clipboard, Loader2, PackageCheck, RefreshCw } from 'lucide-react';
import { buildApiUrl } from '../lib/api';

const METADATA_LABELS = [
  ['publishabilityScore', 'Publishability Score'],
  ['qualityScore', 'Quality Score'],
  ['generatedAt', 'Generated At'],
  ['bookBriefExists', 'Book Brief'],
  ['qualityReportId', 'Quality Report ID'],
  ['sceneCount', 'Scenes'],
  ['totalWordCount', 'Total Words'],
];

function getPublishingPackage(responseData) {
  return responseData?.publishingPackage || null;
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return 'Not available';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : 'Not available';
  return String(value);
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  if (!text || !navigator?.clipboard) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-lg transition"
    >
      <Clipboard size={14} />
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function TextBlock({ title, children, copyText }) {
  if (!children) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">{title}</h3>
        <CopyButton text={copyText || children} />
      </div>
      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{children}</p>
    </div>
  );
}

function TagsList({ title, items }) {
  const list = normalizeList(items);
  if (!list.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {list.map((item, index) => (
          <span key={`${title}-${item}-${index}`} className="px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-sm text-gray-200">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function Checklist({ title, items }) {
  const list = normalizeList(items);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">{title}</h3>
      {list.length > 0 ? (
        <ul className="space-y-3">
          {list.map((item, index) => (
            <li key={`${title}-${item.label || index}`} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {item.status && (
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-gray-800 text-gray-300">
                    {item.status}
                  </span>
                )}
                <p className="font-bold text-gray-200">{item.label || String(item)}</p>
              </div>
              {item.note && <p className="text-xs text-gray-500">{item.note}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No checklist items were returned.</p>
      )}
    </div>
  );
}

function ComplianceWarnings({ warnings }) {
  const list = normalizeList(warnings);

  return (
    <div className="border border-yellow-800/60 bg-yellow-950/20 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-200 mb-4">Compliance Warnings</h3>
      {list.length > 0 ? (
        <div className="space-y-3">
          {list.map((warning, index) => {
            const isObject = warning && typeof warning === 'object';
            const code = isObject ? warning.code : '';
            const severity = isObject ? warning.severity : '';
            const message = isObject ? warning.message : warning;

            return (
              <div key={`${code || 'warning'}-${index}`} className="border border-yellow-800/50 rounded-lg p-4 bg-black/20">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {severity && (
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-yellow-900/50 text-yellow-100">
                      {severity}
                    </span>
                  )}
                  {code && <span className="font-mono text-xs text-yellow-300/80">{code}</span>}
                </div>
                <p className="text-sm text-yellow-100">{message || 'Review this warning before publication.'}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-yellow-100/70">No compliance warnings were returned.</p>
      )}
    </div>
  );
}

function SimpleList({ title, items }) {
  const list = normalizeList(items);
  if (!list.length) return null;

  return (
    <div>
      <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">{title}</p>
      <ul className="space-y-2">
        {list.map((item, index) => (
          <li key={`${title}-${index}`} className="text-sm text-gray-300 leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonetizationStrategy({ strategy }) {
  if (!strategy || Object.keys(strategy).length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Monetization Strategy</h3>
      <div className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Mode</p>
          <p className="text-sm text-gray-200">{formatValue(strategy.mode)}</p>
        </div>
        {strategy.rationale && (
          <div>
            <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Rationale</p>
            <p className="text-sm text-gray-300 leading-relaxed">{strategy.rationale}</p>
          </div>
        )}
        <SimpleList title="Suggested Channels" items={strategy.suggestedChannels} />
        <SimpleList title="Next Steps" items={strategy.nextSteps} />
        <SimpleList title="Risks" items={strategy.risks} />
      </div>
    </div>
  );
}

function LaunchEmail({ value }) {
  if (!value) return null;

  const subject = typeof value === 'object' ? value.subject : '';
  const body = typeof value === 'object' ? value.body || value.template : value;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Launch Email</h3>
        <CopyButton text={[subject, body].filter(Boolean).join('\n\n')} />
      </div>
      {subject && (
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Subject</p>
          <p className="text-sm font-semibold text-gray-200">{subject}</p>
        </div>
      )}
      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  );
}

function AdCopy({ items }) {
  const list = normalizeList(items);
  if (!list.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Ad Copy</h3>
      <div className="grid md:grid-cols-2 gap-3">
        {list.map((item, index) => (
          <div key={`ad-copy-${index}`} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
            <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Variation {index + 1}</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {typeof item === 'object' ? item.body || item.copy || item.text : item}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function APlusContent({ content }) {
  const modules = normalizeList(content?.modules);
  if (!modules.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">A+ Content</h3>
      <div className="space-y-3">
        {modules.map((module, index) => (
          <div key={`${module.type || 'module'}-${index}`} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-gray-800 text-gray-300">
                {module.type || `module ${index + 1}`}
              </span>
            </div>
            {module.headline && <p className="font-bold text-gray-100 mb-2">{module.headline}</p>}
            {module.body && <p className="text-sm text-gray-300 leading-relaxed mb-3">{module.body}</p>}
            {module.imagePrompt && (
              <p className="text-xs text-gray-500 mb-2">
                <span className="font-bold text-gray-400">Image prompt:</span> {module.imagePrompt}
              </p>
            )}
            {module.altText && (
              <p className="text-xs text-gray-500">
                <span className="font-bold text-gray-400">Alt text:</span> {module.altText}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ generating, onGenerate }) {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
        <PackageCheck className="text-gray-500 mx-auto mb-4" size={44} />
        <h2 className="text-xl font-bold text-white mb-2">No publishing package generated yet.</h2>
        <p className="text-gray-400 mb-5">
          Generate a deterministic commercial draft with metadata, checklists, warnings, and launch materials.
        </p>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-cyan-900/30 disabled:opacity-50"
        >
          {generating ? <Loader2 className="animate-spin" size={16} /> : <PackageCheck size={16} />}
          {generating ? 'Generating publishing package...' : 'Generate Publishing Package'}
        </button>
      </div>
    </div>
  );
}

export default function PublishingPackagePanel({ projectId }) {
  const [publishingPackage, setPublishingPackage] = useState(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadLatestPackage = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.get(buildApiUrl(`/projects/${projectId}/publishing-package/latest`));
      const nextPackage = getPublishingPackage(response.data);
      setExists(Boolean(response.data?.exists && nextPackage));
      setPublishingPackage(nextPackage);
    } catch {
      setError('Publishing package is not available right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadLatestPackage();
  }, [loadLatestPackage]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(buildApiUrl(`/projects/${projectId}/publishing-package`));
      const nextPackage = getPublishingPackage(response.data);
      setExists(Boolean(nextPackage));
      setPublishingPackage(nextPackage);
      setSuccess('Publishing package generated.');
    } catch {
      setError('Could not generate the publishing package. Please try again in a moment.');
    } finally {
      setGenerating(false);
    }
  };

  const metadata = publishingPackage?.metadata || {};
  const warningCount = normalizeList(publishingPackage?.complianceWarnings).length;
  const generatedAt = metadata.generatedAt || publishingPackage?.createdAt;
  const headerFields = useMemo(() => ([
    ['Status', publishingPackage?.status],
    ['Source', publishingPackage?.source],
    ['Version', publishingPackage?.version],
    ['Title', publishingPackage?.title],
    ['Subtitle', publishingPackage?.subtitle],
    ['Pen Name', publishingPackage?.penName],
    ['Language', publishingPackage?.language],
    ['Generated', generatedAt],
  ]), [publishingPackage, generatedAt]);

  if (loading && !publishingPackage) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
          <Loader2 className="animate-spin text-cyan-400 mx-auto mb-4" size={40} />
          <p className="text-gray-400">Loading publishing package...</p>
        </div>
      </div>
    );
  }

  if (!exists && !publishingPackage) {
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
        <EmptyState generating={generating} onGenerate={handleGenerate} />
      </>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <PackageCheck size={32} className="text-cyan-400" />
            Publishing Package
          </h2>
          <p className="text-gray-400">Heuristic commercial draft for marketplace review and launch preparation.</p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            onClick={loadLatestPackage}
            disabled={loading || generating}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Refresh
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || generating}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-cyan-900/30 disabled:opacity-50"
          >
            {generating ? <Loader2 className="animate-spin" size={16} /> : <PackageCheck size={16} />}
            {generating ? 'Generating publishing package...' : 'Generate Publishing Package'}
          </button>
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

      <div className="grid md:grid-cols-[1fr_180px] gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {headerFields.map(([label, value]) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">{label}</p>
                <p className="text-sm font-semibold text-gray-200">{label === 'Generated' ? formatDate(value) : formatValue(value)}</p>
              </div>
            ))}
          </div>
          {publishingPackage?.readinessSummary && (
            <p className="text-sm text-gray-300 mt-5 leading-relaxed">{publishingPackage.readinessSummary}</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Warnings</p>
          <p className="text-4xl font-black text-white">{warningCount}</p>
          <p className="text-sm text-gray-500">compliance items</p>
        </div>
      </div>

      <TextBlock title="Short Description" copyText={publishingPackage?.descriptionShort}>
        {publishingPackage?.descriptionShort}
      </TextBlock>
      <TextBlock title="Long Description" copyText={publishingPackage?.descriptionLong}>
        {publishingPackage?.descriptionLong}
      </TextBlock>

      <div className="grid md:grid-cols-2 gap-4">
        <TagsList title="Keywords" items={publishingPackage?.keywords} />
        <TagsList title="Categories" items={publishingPackage?.categories} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <TextBlock title="AI Disclosure" copyText={publishingPackage?.aiDisclosure}>
          {publishingPackage?.aiDisclosure}
        </TextBlock>
        <TextBlock title="Author Bio" copyText={publishingPackage?.authorBio}>
          {publishingPackage?.authorBio}
        </TextBlock>
      </div>

      <TextBlock title="Copyright Page" copyText={publishingPackage?.copyrightPage}>
        {publishingPackage?.copyrightPage}
      </TextBlock>

      <div className="grid lg:grid-cols-3 gap-4">
        <Checklist title="KDP Checklist" items={publishingPackage?.kdpChecklist} />
        <Checklist title="Apple Checklist" items={publishingPackage?.appleChecklist} />
        <Checklist title="Draft2Digital Checklist" items={publishingPackage?.draft2DigitalChecklist} />
      </div>

      <ComplianceWarnings warnings={publishingPackage?.complianceWarnings} />
      <MonetizationStrategy strategy={publishingPackage?.monetizationStrategy} />
      <LaunchEmail value={publishingPackage?.launchEmail} />
      <AdCopy items={publishingPackage?.adCopy} />
      <APlusContent content={publishingPackage?.aPlusContent} />

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Metadata</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {METADATA_LABELS.map(([key, label]) => (
            <div key={key} className="border border-gray-700 rounded-lg p-4 bg-gray-950/60">
              <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">{label}</p>
              <p className="text-sm font-semibold text-gray-200">
                {key === 'generatedAt' ? formatDate(metadata[key]) : formatValue(metadata[key])}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
