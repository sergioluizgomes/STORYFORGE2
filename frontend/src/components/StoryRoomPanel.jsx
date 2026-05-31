import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle, Clipboard, Loader2, Sparkles } from 'lucide-react';
import { buildApiUrl } from '../lib/api';

const SUGGESTED_FIELDS = [
  ['genre', 'Genre'],
  ['subgenre', 'Subgenre'],
  ['targetAudience', 'Target Audience'],
  ['language', 'Language'],
  ['tone', 'Tone'],
  ['narrativeVoice', 'Narrative Voice'],
  ['corePromise', 'Core Promise'],
  ['protagonistWant', 'Protagonist Want'],
  ['protagonistNeed', 'Protagonist Need'],
  ['centralConflict', 'Central Conflict'],
  ['readerAppeal', 'Reader Appeal'],
  ['mustInclude', 'Must Include'],
  ['mustAvoid', 'Must Avoid'],
  ['monetizationMode', 'Monetization Mode'],
  ['targetWordCount', 'Target Word Count'],
  ['targetChapterCount', 'Target Chapter Count'],
];

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function renderValue(value) {
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1 text-sm text-gray-200">
        {value.map((item, index) => (
          <li key={`${item}-${index}`} className="leading-relaxed">- {item}</li>
        ))}
      </ul>
    );
  }

  return <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{String(value)}</p>;
}

function TextList({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-gray-500">No items returned.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="text-sm text-gray-300 leading-relaxed">- {item}</li>
      ))}
    </ul>
  );
}

function Section({ title, children }) {
  return (
    <section className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">{title}</h3>
      {children}
    </section>
  );
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1 text-xs font-semibold text-gray-300">
      {children}
    </span>
  );
}

export default function StoryRoomPanel({ projectId }) {
  const [suggestion, setSuggestion] = useState(null);
  const [selectedFields, setSelectedFields] = useState({});
  const [notes, setNotes] = useState({});
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const suggestedBookBrief = useMemo(
    () => suggestion?.suggestedBookBrief || {},
    [suggestion]
  );
  const availableSuggestedFields = useMemo(
    () => SUGGESTED_FIELDS.filter(([field]) => hasValue(suggestedBookBrief[field])),
    [suggestedBookBrief]
  );
  const selectedFieldNames = useMemo(
    () => Object.keys(selectedFields).filter((field) => selectedFields[field]),
    [selectedFields]
  );

  const generateSuggestion = async () => {
    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(buildApiUrl(`/projects/${projectId}/book-brief/ai-suggest`));
      const nextSuggestion = response.data || null;
      setSuggestion(nextSuggestion);
      const nextSelected = {};
      for (const [field] of SUGGESTED_FIELDS) {
        if (hasValue(nextSuggestion?.suggestedBookBrief?.[field])) {
          nextSelected[field] = true;
        }
      }
      setSelectedFields(nextSelected);
      setSuccess('Story suggestions generated. Review and approve only what you want to apply.');
    } catch {
      setError('Could not generate story suggestions right now. Please try again in a moment.');
    } finally {
      setGenerating(false);
    }
  };

  const toggleField = (field) => {
    setSelectedFields((current) => ({ ...current, [field]: !current[field] }));
    setError('');
    setSuccess('');
  };

  const applySelectedFields = async () => {
    if (selectedFieldNames.length === 0) {
      setError('Select at least one suggested field before applying it to the Book Brief.');
      setSuccess('');
      return;
    }

    const approvedSuggestion = {};
    for (const field of selectedFieldNames) {
      if (hasValue(suggestedBookBrief[field])) {
        approvedSuggestion[field] = suggestedBookBrief[field];
      }
    }

    setApplying(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.put(
        buildApiUrl(`/projects/${projectId}/book-brief/apply-ai-suggestion`),
        {
          suggestion: { suggestedBookBrief: approvedSuggestion },
          approvedFields: Object.keys(approvedSuggestion),
        }
      );
      const appliedFields = response.data?.appliedFields || Object.keys(approvedSuggestion);
      setSuccess(`Applied ${appliedFields.length} field${appliedFields.length === 1 ? '' : 's'} to the Book Brief.`);
    } catch {
      setError('Could not apply the selected fields. Review the selection and try again.');
    } finally {
      setApplying(false);
    }
  };

  const methodList = suggestion?.recommendedMethods?.length
    ? suggestion.recommendedMethods
    : suggestion?.methodSelection?.selected || [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Story Room</h2>
          <p className="text-gray-400 max-w-3xl">
            Ask the editorial AI for story direction, then choose which Book Brief fields are worth applying.
          </p>
        </div>
        <button
          onClick={generateSuggestion}
          disabled={generating || applying}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-cyan-900/30 disabled:opacity-50"
        >
          {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          Generate Story Suggestions
        </button>
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

      {!suggestion && !generating && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
          <Sparkles className="text-cyan-400 mx-auto mb-4" size={40} />
          <p className="text-white font-semibold mb-2">No story suggestion has been generated yet.</p>
          <p className="text-gray-400 text-sm">The AI will analyze the project only after you click the button above.</p>
        </div>
      )}

      {generating && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
          <Loader2 className="animate-spin text-cyan-400 mx-auto mb-4" size={40} />
          <p className="text-gray-300">The editorial AI is reviewing the story direction...</p>
        </div>
      )}

      {suggestion && (
        <div className="space-y-6">
          <Section title="Suggested Book Brief">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <Badge>Confidence: {Math.round(Number(suggestion.confidence || 0) * 100)}%</Badge>
              <Badge>{selectedFieldNames.length} selected</Badge>
            </div>

            {availableSuggestedFields.length === 0 ? (
              <p className="text-sm text-gray-500">No Book Brief fields were suggested.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {availableSuggestedFields.map(([field, label]) => (
                  <label
                    key={field}
                    className="block bg-gray-950 border border-gray-800 rounded-lg p-4 hover:border-cyan-800/70 transition"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedFields[field])}
                        onChange={() => toggleField(field)}
                        className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-900 text-cyan-500 focus:ring-cyan-500"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2">{label}</div>
                        {renderValue(suggestedBookBrief[field])}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-gray-800 pt-5">
              <p className="text-xs text-gray-500">Only selected fields will be sent and applied to the Book Brief.</p>
              <button
                onClick={applySelectedFields}
                disabled={applying || selectedFieldNames.length === 0}
                className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
              >
                {applying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Apply selected to BookBrief
              </button>
            </div>
          </Section>

          <Section title="Story Diagnosis">
            <div className="space-y-5">
              {suggestion.storyDiagnosis?.premise && (
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">Premise</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">{suggestion.storyDiagnosis.premise}</p>
                </div>
              )}
              <div className="grid md:grid-cols-3 gap-5">
                <div>
                  <h4 className="text-sm font-semibold text-green-300 mb-2">Strengths</h4>
                  <TextList items={suggestion.storyDiagnosis?.strengths} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-amber-300 mb-2">Weaknesses</h4>
                  <TextList items={suggestion.storyDiagnosis?.weaknesses} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-cyan-300 mb-2">Missing Decisions</h4>
                  <TextList items={suggestion.storyDiagnosis?.missingDecisions} />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Recommended Narrative Methods">
            {methodList.length === 0 ? (
              <p className="text-sm text-gray-500">No methods returned.</p>
            ) : (
              <div className="grid lg:grid-cols-2 gap-4">
                {methodList.map((method, index) => (
                  <div key={method.id || `${method.name}-${index}`} className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <h4 className="text-white font-semibold">{method.name}</h4>
                      {method.priority && <Badge>{method.priority}</Badge>}
                      {method.level && <Badge>{method.level}</Badge>}
                    </div>
                    {method.reason && <p className="text-sm text-gray-300 leading-relaxed mb-3">{method.reason}</p>}
                    {Array.isArray(method.bestFor) && method.bestFor.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Best For</div>
                        <TextList items={method.bestFor} />
                      </div>
                    )}
                    {Array.isArray(method.checks) && method.checks.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Checks</div>
                        <TextList items={method.checks} />
                      </div>
                    )}
                    {method.limitations && (
                      <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-800 pt-3">{method.limitations}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Open Questions">
            {Array.isArray(suggestion.openQuestions) && suggestion.openQuestions.length > 0 ? (
              <div className="space-y-4">
                {suggestion.openQuestions.map((question, index) => (
                  <div key={question.id || index} className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Clipboard className="text-cyan-400 shrink-0 mt-0.5" size={18} />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-white font-semibold mb-2">{question.question}</h4>
                        {question.whyItMatters && <p className="text-sm text-gray-400 leading-relaxed mb-3">{question.whyItMatters}</p>}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Options</div>
                            <TextList items={question.options} />
                          </div>
                          <div className="space-y-3">
                            {question.recommendedOption && (
                              <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Recommended</div>
                                <p className="text-sm text-cyan-200">{question.recommendedOption}</p>
                              </div>
                            )}
                            {question.impact && <Badge>Impact: {question.impact}</Badge>}
                            {question.scope && <Badge>Scope: {question.scope}</Badge>}
                          </div>
                        </div>
                        <textarea
                          value={notes[question.id || index] || ''}
                          onChange={(event) => setNotes((current) => ({ ...current, [question.id || index]: event.target.value }))}
                          rows={3}
                          placeholder="Local note for this decision"
                          className="mt-4 w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none transition resize-y"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No open questions returned.</p>
            )}
          </Section>

          <Section title="Direction Options">
            {Array.isArray(suggestion.directionOptions) && suggestion.directionOptions.length > 0 ? (
              <div className="grid lg:grid-cols-2 gap-4">
                {suggestion.directionOptions.map((option, index) => (
                  <div key={`${option.title}-${index}`} className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                    <h4 className="text-white font-semibold mb-2">{option.title}</h4>
                    <p className="text-sm text-gray-300 leading-relaxed mb-4">{option.description}</p>
                    <div className="space-y-3 text-sm">
                      {option.tonalImpact && <p><span className="text-gray-500 font-semibold">Tonal:</span> <span className="text-gray-300">{option.tonalImpact}</span></p>}
                      {option.plotImpact && <p><span className="text-gray-500 font-semibold">Plot:</span> <span className="text-gray-300">{option.plotImpact}</span></p>}
                      {option.characterImpact && <p><span className="text-gray-500 font-semibold">Character:</span> <span className="text-gray-300">{option.characterImpact}</span></p>}
                      {option.commercialImpact && <p><span className="text-gray-500 font-semibold">Commercial:</span> <span className="text-gray-300">{option.commercialImpact}</span></p>}
                    </div>
                    {Array.isArray(option.risks) && option.risks.length > 0 && (
                      <div className="mt-4 border-t border-gray-800 pt-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">Risks</div>
                        <TextList items={option.risks} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No direction options returned.</p>
            )}
          </Section>

          <Section title="Risks">
            {Array.isArray(suggestion.risks) && suggestion.risks.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {suggestion.risks.map((risk, index) => (
                  <div key={`${risk.issue}-${index}`} className="bg-amber-950/20 border border-amber-800/40 rounded-lg p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="text-amber-100 font-semibold">{risk.issue}</h4>
                      {risk.severity && <Badge>{risk.severity}</Badge>}
                    </div>
                    {risk.mitigation && <p className="text-sm text-amber-100/80 leading-relaxed">{risk.mitigation}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No risks returned.</p>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
