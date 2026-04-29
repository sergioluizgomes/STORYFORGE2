import React, { useState } from 'react';
import { Edit3, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { buildApiUrl, buildBackendUrl } from '../../lib/api';

export default function BeatEditModal({ beat, beatIndex, projectId, onClose, onSave }) {
  const [editingBeat, setEditingBeat] = useState({ ...beat, index: beatIndex });
  const [beatEditTab, setBeatEditTab] = useState('info');
  const [beatBgPrompt, setBeatBgPrompt] = useState('');
  const [generatingBeatBg, setGeneratingBeatBg] = useState(false);
  const [generatingBeatImage, setGeneratingBeatImage] = useState(false);

  const handleGenerateBeatDetails = async () => {
    if (!editingBeat) return;
    setGeneratingBeatBg(true);
    try {
      const res = await axios.post(buildApiUrl('/generate/beat-details'), {
        projectId,
        beat: editingBeat,
        instruction: beatBgPrompt
      });
      setEditingBeat(prev => ({
        ...prev,
        description: res.data.description,
        visualDescription: res.data.visualDescription
      }));
    } catch (error) {
      console.error('Beat detail generation error:', error);
      alert('Failed to generate beat details');
    } finally {
      setGeneratingBeatBg(false);
    }
  };

  const handleGenerateBeatImage = async () => {
    if (!editingBeat?.visualDescription) {
      alert('Add a visual description first!');
      return;
    }
    setGeneratingBeatImage(true);
    try {
      const res = await axios.post(buildApiUrl('/generate/image'), {
        prompt: `Cinematic Shot: ${editingBeat.visualDescription}`,
        projectId
      });
      setEditingBeat(prev => ({ ...prev, imageUrl: res.data.imageUrl }));
    } catch (error) {
      console.error(error);
      alert('Image generation failed');
    } finally {
      setGeneratingBeatImage(false);
    }
  };

  const handleSave = async () => {
    try {
      const target = editingBeat.id ?? editingBeat.index;
      const res = await axios.put(
        buildApiUrl(`/generate/bible/${projectId}/beat/${target}`),
        editingBeat
      );
      if (onSave) onSave(res.data);
      onClose();
    } catch (error) {
      console.error(error);
      alert('Failed to save beat: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-gray-900 w-full max-w-5xl rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Edit3 size={20} className="text-purple-400" />
              Edit Beat: {editingBeat.title}
            </h2>
            <div className="flex bg-gray-950 rounded-lg p-1 gap-1 border border-gray-700">
              <button
                onClick={() => setBeatEditTab('info')}
                className={`px-3 py-1 rounded text-xs font-bold transition ${
                  beatEditTab === 'info' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Basic Info
              </button>
              <button
                onClick={() => setBeatEditTab('description')}
                className={`px-3 py-1 rounded text-xs font-bold transition ${
                  beatEditTab === 'description' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Description
              </button>
              <button
                onClick={() => setBeatEditTab('visual')}
                className={`px-3 py-1 rounded text-xs font-bold transition ${
                  beatEditTab === 'visual' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Visual Details
              </button>
              <button
                onClick={() => setBeatEditTab('image')}
                className={`px-3 py-1 rounded text-xs font-bold transition ${
                  beatEditTab === 'image' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Image
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            Close
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {beatEditTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs font-bold uppercase mb-1">Title</label>
                  <input
                    type="text"
                    value={editingBeat.title}
                    onChange={(e) => setEditingBeat(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-bold uppercase mb-1">Type</label>
                  <input
                    type="text"
                    value={editingBeat.type || 'Beat'}
                    onChange={(e) => setEditingBeat(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              <div className="bg-purple-900/10 border border-purple-800/30 p-4 rounded-xl space-y-3 mt-6">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                  <Sparkles size={16} /> AI Enhance Description & Visuals
                </div>
                <p className="text-xs text-gray-400">
                  Provide context to enhance the narrative beat description and generate visual concepts.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add instruction (e.g. Make the conflict more emotional)"
                    value={beatBgPrompt}
                    onChange={(e) => setBeatBgPrompt(e.target.value)}
                    className="flex-1 bg-gray-950 border border-purple-900/30 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  <button
                    onClick={handleGenerateBeatDetails}
                    disabled={generatingBeatBg}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2 shrink-0"
                  >
                    {generatingBeatBg ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    Enhance All
                  </button>
                </div>
              </div>
            </div>
          )}

          {beatEditTab === 'description' && (
            <div className="flex flex-col h-full">
              <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Beat Description</label>
              <textarea
                value={editingBeat.description || ''}
                onChange={(e) => setEditingBeat(prev => ({ ...prev, description: e.target.value }))}
                rows={14}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm leading-relaxed flex-1"
              />
            </div>
          )}

          {beatEditTab === 'visual' && (
            <div className="flex flex-col h-full">
              <label className="block text-gray-400 text-xs font-bold uppercase text-purple-300 mb-2">
                Visual Description (AI Image Gen Ready)
              </label>
              <textarea
                value={editingBeat.visualDescription || ''}
                onChange={(e) => setEditingBeat(prev => ({ ...prev, visualDescription: e.target.value }))}
                placeholder="Detailed visual description for the scene..."
                rows={12}
                className="w-full bg-gray-950 border border-purple-900/40 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm leading-relaxed mb-4 flex-1"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleGenerateBeatImage}
                  disabled={generatingBeatImage}
                  className="px-6 py-2 bg-pink-600 hover:bg-pink-700 rounded-lg text-white font-bold transition flex items-center gap-2 shadow-lg shadow-pink-900/20 disabled:opacity-50"
                >
                  {generatingBeatImage ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  Generate Concept Image
                </button>
              </div>
            </div>
          )}

          {beatEditTab === 'image' && (
            <div className="h-full flex flex-col">
              <div className="w-full h-[60vh] bg-black/40 rounded-xl overflow-hidden border border-gray-700 relative flex items-center justify-center">
                {editingBeat.imageUrl ? (
                  <img
                    src={buildBackendUrl(editingBeat.imageUrl)}
                    alt={editingBeat.title}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    <div className="mb-4 flex justify-center">
                      <Sparkles size={48} className="opacity-20" />
                    </div>
                    <p>No concept art generated yet.</p>
                    <p className="text-sm mt-2 opacity-60">Go to "Visual Details" and click Generate.</p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleGenerateBeatImage}
                  disabled={generatingBeatImage}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  {generatingBeatImage ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm font-bold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm font-bold transition shadow-lg shadow-green-900/20"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
