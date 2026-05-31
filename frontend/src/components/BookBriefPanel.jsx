import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle, Loader2, RefreshCw, RotateCcw, Save, Trash2 } from 'lucide-react';
import { buildApiUrl } from '../lib/api';

const DEFAULT_FORM = {
  genre: '',
  subgenre: '',
  targetAudience: '',
  language: 'Português Brasileiro',
  tone: '',
  narrativeVoice: '',
  corePromise: '',
  protagonistWant: '',
  protagonistNeed: '',
  centralConflict: '',
  readerAppeal: '',
  targetWordCount: '',
  targetChapterCount: '',
  monetizationMode: 'undecided',
  seriesName: '',
  bookNumber: '',
  aiDisclosure: 'not_configured',
  humanReviewStatus: 'not_tracked',
  violenceLevel: '',
  romanceLevel: '',
  profanityLevel: '',
  sexualContentLevel: '',
  sensitiveTopics: '',
  mustInclude: '',
  mustAvoid: '',
  comparableTitles: '',
  keywords: '',
  notes: '',
};

const TEXT_FIELDS = [
  ['genre', 'Genre'],
  ['subgenre', 'Subgenre'],
  ['targetAudience', 'Target Audience'],
  ['language', 'Language'],
  ['tone', 'Tone'],
  ['narrativeVoice', 'Narrative Voice'],
  ['monetizationMode', 'Monetization Mode'],
  ['seriesName', 'Series Name'],
  ['aiDisclosure', 'AI Disclosure'],
  ['humanReviewStatus', 'Human Review Status'],
];

const NUMBER_FIELDS = [
  ['targetWordCount', 'Target Word Count'],
  ['targetChapterCount', 'Target Chapter Count'],
  ['bookNumber', 'Book Number'],
];

const NARRATIVE_CORE_FIELDS = [
  ['corePromise', 'Core Promise'],
  ['protagonistWant', 'Protagonist Want'],
  ['protagonistNeed', 'Protagonist Need'],
  ['centralConflict', 'Central Conflict'],
];

const CONTENT_FIELDS = [
  ['violenceLevel', 'Violence Level'],
  ['romanceLevel', 'Romance Level'],
  ['profanityLevel', 'Profanity Level'],
  ['sexualContentLevel', 'Sexual Content Level'],
];

const ARRAY_FIELDS = [
  ['mustInclude', 'Must Include'],
  ['mustAvoid', 'Must Avoid'],
  ['comparableTitles', 'Comparable Titles'],
  ['keywords', 'Keywords'],
  ['sensitiveTopics', 'Sensitive Topics'],
];

function arrayToLines(value) {
  return Array.isArray(value) ? value.join('\n') : '';
}

function linesToArray(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function numberOrEmpty(value) {
  return value === null || value === undefined ? '' : String(value);
}

function briefToForm(bookBrief) {
  if (!bookBrief) return { ...DEFAULT_FORM };

  const contentGuidelines = bookBrief.contentGuidelines || {};

  return {
    genre: bookBrief.genre || '',
    subgenre: bookBrief.subgenre || '',
    targetAudience: bookBrief.targetAudience || '',
    language: bookBrief.language || DEFAULT_FORM.language,
    tone: bookBrief.tone || '',
    narrativeVoice: bookBrief.narrativeVoice || '',
    corePromise: bookBrief.corePromise || '',
    protagonistWant: bookBrief.protagonistWant || '',
    protagonistNeed: bookBrief.protagonistNeed || '',
    centralConflict: bookBrief.centralConflict || '',
    readerAppeal: arrayToLines(bookBrief.readerAppeal),
    targetWordCount: numberOrEmpty(bookBrief.targetWordCount),
    targetChapterCount: numberOrEmpty(bookBrief.targetChapterCount),
    monetizationMode: bookBrief.monetizationMode || DEFAULT_FORM.monetizationMode,
    seriesName: bookBrief.seriesName || '',
    bookNumber: numberOrEmpty(bookBrief.bookNumber),
    aiDisclosure: bookBrief.aiDisclosure || DEFAULT_FORM.aiDisclosure,
    humanReviewStatus: bookBrief.humanReviewStatus || DEFAULT_FORM.humanReviewStatus,
    violenceLevel: contentGuidelines.violenceLevel || '',
    romanceLevel: contentGuidelines.romanceLevel || '',
    profanityLevel: contentGuidelines.profanityLevel || '',
    sexualContentLevel: contentGuidelines.sexualContentLevel || '',
    sensitiveTopics: arrayToLines(contentGuidelines.sensitiveTopics),
    mustInclude: arrayToLines(bookBrief.mustInclude),
    mustAvoid: arrayToLines(bookBrief.mustAvoid),
    comparableTitles: arrayToLines(bookBrief.comparableTitles),
    keywords: arrayToLines(bookBrief.keywords),
    notes: bookBrief.notes || '',
  };
}

function trimOrEmpty(value) {
  return String(value || '').trim();
}

function positiveNumberOrUndefined(value) {
  const trimmed = trimOrEmpty(value);
  if (!trimmed) return undefined;
  return Number(trimmed);
}

function validateForm(form) {
  for (const [field, label] of NUMBER_FIELDS) {
    const trimmed = trimOrEmpty(form[field]);
    if (!trimmed) continue;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return `${label} must be a positive number.`;
    }
  }

  return '';
}

function formToPayload(form) {
  return {
    genre: trimOrEmpty(form.genre),
    subgenre: trimOrEmpty(form.subgenre),
    targetAudience: trimOrEmpty(form.targetAudience),
    language: trimOrEmpty(form.language),
    tone: trimOrEmpty(form.tone),
    narrativeVoice: trimOrEmpty(form.narrativeVoice),
    corePromise: trimOrEmpty(form.corePromise),
    protagonistWant: trimOrEmpty(form.protagonistWant),
    protagonistNeed: trimOrEmpty(form.protagonistNeed),
    centralConflict: trimOrEmpty(form.centralConflict),
    readerAppeal: linesToArray(form.readerAppeal),
    targetWordCount: positiveNumberOrUndefined(form.targetWordCount),
    targetChapterCount: positiveNumberOrUndefined(form.targetChapterCount),
    monetizationMode: trimOrEmpty(form.monetizationMode),
    seriesName: trimOrEmpty(form.seriesName),
    bookNumber: positiveNumberOrUndefined(form.bookNumber),
    aiDisclosure: trimOrEmpty(form.aiDisclosure),
    humanReviewStatus: trimOrEmpty(form.humanReviewStatus),
    contentGuidelines: {
      violenceLevel: trimOrEmpty(form.violenceLevel),
      romanceLevel: trimOrEmpty(form.romanceLevel),
      profanityLevel: trimOrEmpty(form.profanityLevel),
      sexualContentLevel: trimOrEmpty(form.sexualContentLevel),
      sensitiveTopics: linesToArray(form.sensitiveTopics),
    },
    mustInclude: linesToArray(form.mustInclude),
    mustAvoid: linesToArray(form.mustAvoid),
    comparableTitles: linesToArray(form.comparableTitles),
    keywords: linesToArray(form.keywords),
    notes: trimOrEmpty(form.notes),
  };
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-300 mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function TextInput({ label, value, onChange, type = 'text' }) {
  return (
    <Field label={label}>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition"
      />
    </Field>
  );
}

function TextArea({ label, value, onChange, rows = 5, helper }) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition resize-y leading-relaxed"
      />
      {helper && <p className="text-xs text-gray-500 mt-2">{helper}</p>}
    </Field>
  );
}

export default function BookBriefPanel({ projectId }) {
  const [exists, setExists] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [savedForm, setSavedForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const hasLocalChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  );

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setSuccess('');
  };

  const loadBookBrief = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.get(buildApiUrl(`/projects/${projectId}/book-brief`));
      const nextExists = Boolean(response.data?.exists);
      const nextForm = briefToForm(response.data?.bookBrief);
      setExists(nextExists);
      setForm(nextForm);
      setSavedForm(nextForm);
    } catch {
      setError('Book Brief is not available right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadBookBrief();
  }, [loadBookBrief]);

  const handleReset = () => {
    setForm(savedForm);
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      setSuccess('');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.put(
        buildApiUrl(`/projects/${projectId}/book-brief`),
        formToPayload(form)
      );
      const nextForm = briefToForm(response.data?.bookBrief);
      setExists(true);
      setForm(nextForm);
      setSavedForm(nextForm);
      setSuccess('Book Brief saved.');
    } catch {
      setError('Could not save the Book Brief. Review the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm('Remove this Book Brief from the project?');
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    setSuccess('');

    try {
      await axios.delete(buildApiUrl(`/projects/${projectId}/book-brief`));
      const nextForm = { ...DEFAULT_FORM };
      setExists(false);
      setForm(nextForm);
      setSavedForm(nextForm);
      setSuccess('Book Brief removed.');
    } catch {
      setError('Could not remove the Book Brief. Please try again in a moment.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
          <Loader2 className="animate-spin text-cyan-400 mx-auto mb-4" size={40} />
          <p className="text-gray-400">Loading Book Brief...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Book Brief</h2>
          <p className="text-gray-400">Editorial and commercial direction for this project.</p>
        </div>
        <button
          onClick={loadBookBrief}
          disabled={loading || saving || deleting}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {!exists && (
        <div className="border border-cyan-800/60 bg-cyan-950/20 rounded-xl p-4 text-sm text-cyan-100">
          This project does not have a Book Brief yet. Defaults are ready below so you can create one.
        </div>
      )}

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

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl space-y-8">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Core Direction</h3>
          <div className="grid md:grid-cols-2 gap-5">
            {TEXT_FIELDS.map(([field, label]) => (
              <TextInput
                key={field}
                label={label}
                value={form[field]}
                onChange={(value) => updateField(field, value)}
              />
            ))}
            {NUMBER_FIELDS.map(([field, label]) => (
              <TextInput
                key={field}
                label={label}
                type="number"
                value={form[field]}
                onChange={(value) => updateField(field, value)}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Narrative Core</h3>
          <div className="grid md:grid-cols-2 gap-5">
            {NARRATIVE_CORE_FIELDS.map(([field, label]) => (
              <TextArea
                key={field}
                label={label}
                value={form[field]}
                onChange={(value) => updateField(field, value)}
                rows={4}
              />
            ))}
          </div>
          <div className="mt-5">
            <TextArea
              label="Reader Appeal"
              value={form.readerAppeal}
              onChange={(value) => updateField('readerAppeal', value)}
              rows={4}
              helper="One reader appeal per line."
            />
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Content Guidelines</h3>
          <div className="grid md:grid-cols-2 gap-5">
            {CONTENT_FIELDS.map(([field, label]) => (
              <TextInput
                key={field}
                label={label}
                value={form[field]}
                onChange={(value) => updateField(field, value)}
              />
            ))}
          </div>
          <div className="mt-5">
            <TextArea
              label="Sensitive Topics"
              value={form.sensitiveTopics}
              onChange={(value) => updateField('sensitiveTopics', value)}
              rows={4}
              helper="One topic per line."
            />
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Lists</h3>
          <div className="grid md:grid-cols-2 gap-5">
            {ARRAY_FIELDS.filter(([field]) => field !== 'sensitiveTopics').map(([field, label]) => (
              <TextArea
                key={field}
                label={label}
                value={form[field]}
                onChange={(value) => updateField(field, value)}
                helper="One entry per line. Empty lines are ignored."
              />
            ))}
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6">
          <TextArea
            label="Notes"
            value={form.notes}
            onChange={(value) => updateField('notes', value)}
            rows={8}
          />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-gray-700">
          <div className="text-xs text-gray-500">
            {hasLocalChanges ? 'Unsaved local changes.' : 'No unsaved changes.'}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleReset}
              disabled={!hasLocalChanges || saving || deleting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
            >
              <RotateCcw size={16} />
              Reset
            </button>
            {exists && (
              <button
                onClick={handleDelete}
                disabled={saving || deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-900/70 hover:bg-red-800 text-red-100 text-sm font-bold rounded-lg transition disabled:opacity-50"
              >
                {deleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Remove Brief
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-cyan-900/30 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              {exists ? 'Save Book Brief' : 'Create Book Brief'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
