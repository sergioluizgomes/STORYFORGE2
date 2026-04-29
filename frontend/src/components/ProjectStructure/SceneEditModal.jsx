import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Settings, History, Save, RefreshCw, RotateCcw, Edit3, Loader2, Copy } from 'lucide-react';
import axios from 'axios';
import { buildApiUrl } from '../../lib/api';

export default function SceneEditModal({ scene, projectId, bible, onClose, onSave }) {
  const [editedScene, setEditedScene] = useState({ ...scene });
  const [editorTab, setEditorTab] = useState('content');
  const [genParams, setGenParams] = useState({
    beatTitle: '',
    beatDescription: '',
    visualDescription: '',
    instructions: ''
  });
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const copyStatusTimeoutRef = useRef(null);

  useEffect(() => {
    if (scene && bible) {
      const beat = bible.chapters
        ?.flatMap(ch => ch.beats || [])
        .find(b => b.id === scene.beatId);
      
      const currentParams = scene.currentParams || {};

      setGenParams({
        beatTitle: currentParams.beat?.title || beat?.title || '',
        beatDescription: currentParams.beat?.description || beat?.description || '',
        visualDescription: currentParams.beat?.visualDescription || beat?.visualDescription || '',
        instructions: currentParams.instructions || scene.instructions || ''
      });
    }
  }, [scene, bible]);

  useEffect(() => {
    // Fetch assembled prompt when user opens the Prompt tab
    const fetchPrompt = async () => {
      if (!scene || !bible) return;
      setPromptLoading(true);
      try {
        const body = {
          projectId,
          beatId: scene.beatId,
          params: {
            beat: {
              id: scene.beatId,
              title: genParams.beatTitle,
              description: genParams.beatDescription,
              visualDescription: genParams.visualDescription
            },
            instructions: genParams.instructions
          },
          existingContent: editedScene.content || '' // Include existing content for preview
        };

        const res = await axios.post(buildApiUrl('/scenes/prompt'), body);
        setPromptText(res.data.prompt || '');
      } catch (err) {
        console.error('Failed to fetch prompt preview', err);
        setPromptText('Error fetching prompt preview.');
      } finally {
        setPromptLoading(false);
      }
    };

    if (editorTab === 'prompt') fetchPrompt();
  }, [editorTab, scene, bible, genParams, projectId, editedScene.content]);

  useEffect(() => {
    return () => {
      if (copyStatusTimeoutRef.current) {
        clearTimeout(copyStatusTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.put(buildApiUrl(`/scenes/${editedScene._id}`), {
        content: editedScene.content
      });
      if (onSave) onSave(res.data);
      onClose();
    } catch (error) {
      console.error('Error saving scene:', error);
      alert('Erro ao salvar cena: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const scheduleCopyStatusReset = () => {
    if (copyStatusTimeoutRef.current) {
      clearTimeout(copyStatusTimeoutRef.current);
    }
    copyStatusTimeoutRef.current = setTimeout(() => setCopyStatus(''), 2500);
  };

  const handleCopyPrompt = async () => {
    if (!promptText) {
      setCopyStatus('Sem prompt para copiar.');
      scheduleCopyStatusReset();
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setCopyStatus('Clipboard indisponível aqui.');
      scheduleCopyStatusReset();
      return;
    }

    try {
      await navigator.clipboard.writeText(promptText);
      setCopyStatus('Prompt copiado!');
    } catch (err) {
      console.error('Falha ao copiar prompt', err);
      setCopyStatus('Erro ao copiar.');
    } finally {
      scheduleCopyStatusReset();
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      console.log('[SCENE MODAL] Regenerating scene for beatId:', scene.beatId, 'type:', typeof scene.beatId);
      const params = {
        beat: {
          id: scene.beatId,
          title: genParams.beatTitle,
          description: genParams.beatDescription,
          visualDescription: genParams.visualDescription
        },
        instructions: genParams.instructions
      };

      // Include existing content for revision mode
      const existingContent = editedScene.content || '';
      console.log('[SCENE MODAL] Params:', params);
      console.log('[SCENE MODAL] Existing content length:', existingContent.length, 'chars');
      
      const res = await axios.post(buildApiUrl('/scenes/generate'), {
        projectId,
        beatId: scene.beatId,
        params,
        existingContent // Send existing content for revision
      });

      console.log('[SCENE MODAL] Scene regenerated successfully');
      setEditedScene(res.data);
      setEditorTab('content');
    } catch (error) {
      console.error('[SCENE MODAL] Error regenerating scene:', error);
      console.error('[SCENE MODAL] Error details:', error.response?.data);
      alert('Erro ao regenerar cena: ' + (error.response?.data?.error || error.message));
    } finally {
      setRegenerating(false);
    }
  };

  const handleRestoreVersion = async (version) => {
    if (!confirm('Restore this version? Current content will be moved to version history.')) return;
    
    try {
      const res = await axios.post(buildApiUrl(`/scenes/${editedScene._id}/restore`), {
        versionNumber: version.versionNumber
      });
      setEditedScene(res.data);
      setEditorTab('content');
    } catch (error) {
      console.error('Error restoring version:', error);
      alert('Erro ao restaurar versão');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-gray-900 w-full max-w-5xl h-[90vh] rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen size={20} className="text-blue-400" />
              {editedScene.title || 'Scene'}
            </h2>
            <div className="flex bg-gray-900 rounded-lg p-1 gap-1">
              <button
                onClick={() => setEditorTab('content')}
                className={`px-3 py-1 rounded text-sm flex items-center gap-2 ${
                  editorTab === 'content' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <BookOpen size={14} /> Scene Text
              </button>
              <button
                onClick={() => setEditorTab('info')}
                className={`px-3 py-1 rounded text-sm flex items-center gap-2 ${
                  editorTab === 'info' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Settings size={14} /> Generation Info
              </button>
              <button
                onClick={() => setEditorTab('versions')}
                className={`px-3 py-1 rounded text-sm flex items-center gap-2 ${
                  editorTab === 'versions' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <History size={14} /> Versions
              </button>
              <button
                onClick={() => setEditorTab('prompt')}
                className={`px-3 py-1 rounded text-sm flex items-center gap-2 ${
                  editorTab === 'prompt' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Settings size={14} /> Prompt
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition"
          >
            Close
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 min-h-0 bg-gray-800 flex flex-col overflow-hidden">
          {editorTab === 'content' && (
            <div className="flex-1 flex flex-col p-6">
              <div className="flex-1 bg-gray-900/50 rounded-lg p-4 mb-4 border border-gray-700/50 overflow-hidden">
                <textarea
                  className="w-full h-full bg-transparent border-none focus:ring-0 text-gray-200 font-serif text-lg leading-loose resize-none outline-none"
                  style={{ minHeight: '100%' }}
                  value={editedScene.content || ''}
                  onChange={(e) => setEditedScene({ ...editedScene, content: e.target.value })}
                  placeholder="Scene content..."
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition flex items-center gap-2 shadow-lg shadow-green-900/20 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {editorTab === 'info' && (
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="space-y-6">
                <div className="bg-blue-900/20 border border-blue-800/50 p-4 rounded-lg">
                  <h3 className="text-blue-200 font-bold mb-2 flex items-center gap-2">
                    <Edit3 size={16} /> Generation Parameters
                  </h3>
                  <p className="text-sm text-blue-300/80">
                    Edit the context below and click Regenerate to create a new version of the scene.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-400 text-sm font-medium mb-1">Beat Title</label>
                    <input
                      type="text"
                      value={genParams.beatTitle}
                      onChange={(e) => setGenParams(prev => ({ ...prev, beatTitle: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm font-medium mb-1">
                      Beat Description (Context)
                    </label>
                    <textarea
                      value={genParams.beatDescription}
                      onChange={(e) => setGenParams(prev => ({ ...prev, beatDescription: e.target.value }))}
                      rows={4}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm font-medium mb-1">
                      Visual Description
                    </label>
                    <textarea
                      value={genParams.visualDescription}
                      onChange={(e) => setGenParams(prev => ({ ...prev, visualDescription: e.target.value }))}
                      rows={3}
                      placeholder="e.g. Rain-soaked coastal road, flickering streetlights, a warped puddle reflection..."
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm font-medium mb-1">
                      Additional Instructions
                    </label>
                    <textarea
                      value={genParams.instructions}
                      onChange={(e) => setGenParams(prev => ({ ...prev, instructions: e.target.value }))}
                      placeholder="e.g. Make the dialogue more tense."
                      rows={4}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-700 mt-6">
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {regenerating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    Regenerate Scene
                  </button>
                </div>
              </div>
            </div>
          )}

          {editorTab === 'prompt' && (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                <div className="flex flex-col gap-2 sm:items-center sm:flex-row sm:justify-between">
                  <h3 className="text-white font-bold">Assembled Prompt (Preview)</h3>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-lg transition"
                    >
                      <Copy size={14} />
                      Copiar prompt
                    </button>
                    {copyStatus && <span className="text-green-300 text-[11px]">{copyStatus}</span>}
                  </div>
                </div>
                <div className="mb-4 text-sm text-gray-300">
                  This shows the exact prompt text that will be sent to the AI when you regenerate the scene.
                </div>
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 flex flex-col">
                  {promptLoading ? (
                    <div className="min-h-[28rem] flex items-center justify-center text-gray-400 text-sm">
                      Loading prompt preview...
                    </div>
                  ) : (
                    <textarea
                      readOnly
                      value={promptText}
                      className="w-full flex-1 min-h-[28rem] bg-transparent border-none focus:ring-0 text-gray-200 text-xs font-mono resize-none outline-none"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {editorTab === 'versions' && (
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="max-w-3xl mx-auto">
                <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                  <History size={20} /> Version History
                </h3>
                <div className="space-y-4">
                  <div className="bg-gray-700/50 border border-green-500/50 rounded-lg p-4 relative">
                    <div className="absolute top-0 right-0 px-2 py-0.5 bg-green-900/80 text-green-200 text-xs rounded-bl-lg rounded-tr-lg font-bold">
                      CURRENT
                    </div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-white">Latest Version</h4>
                        <p className="text-xs text-gray-400">
                          {editedScene.generatedAt
                            ? new Date(editedScene.generatedAt).toLocaleString()
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm line-clamp-3 font-serif bg-gray-900/50 p-2 rounded">
                      {editedScene.content}
                    </p>
                  </div>

                  {editedScene.versions &&
                    [...editedScene.versions].reverse().map((ver, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-gray-300">
                                Version {ver.versionNumber || '?'}
                              </h4>
                              {ver.params?.instructions && (
                                <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-400">
                                  Has Instructions
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {new Date(ver.generatedAt).toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRestoreVersion(ver)}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white text-xs rounded transition flex items-center gap-1.5"
                          >
                            <RotateCcw size={12} /> Restore
                          </button>
                        </div>
                        <p className="text-gray-400 text-sm line-clamp-2 font-serif bg-gray-900/30 p-2 rounded">
                          {ver.content}
                        </p>
                      </div>
                    ))}

                  {(!editedScene.versions || editedScene.versions.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      <History size={32} className="mx-auto mb-2 opacity-30" />
                      <p>No previous versions available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
