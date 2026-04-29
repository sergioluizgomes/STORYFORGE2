import React, { useState } from 'react';
import { Zap, FileCheck, Edit2 } from 'lucide-react';
import BeatEditModal from './BeatEditModal';

export default function BeatDetail({ beat, scenes, projectId, onUpdate, beatIndex }) {
  const [showEditModal, setShowEditModal] = useState(false);

  if (!beat) return null;

  const beatScenes = scenes || [];

  const handleSave = () => {
    setShowEditModal(false);
    if (onUpdate) onUpdate();
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-sm text-gray-400 mb-1">Beat #{beat.id}</div>
            <h2 className="text-3xl font-bold text-white mb-2">{beat.title}</h2>
            <div className="flex items-center gap-3">
              {beat.type && (
                <span className="px-3 py-1 bg-cyan-900/30 text-cyan-400 text-sm rounded-full border border-cyan-700/50">
                  {beat.type}
                </span>
              )}
              <span className="text-gray-400 text-sm">
                {beatScenes.length} {beatScenes.length === 1 ? 'cena' : 'cenas'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
            title="Editar Beat"
          >
            <Edit2 size={18} />
          </button>
        </div>

      {beat.description && (
        <div className="bg-gray-800 p-5 rounded-lg border-l-4 border-cyan-500">
          <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide mb-3">
            Descrição
          </h3>
          <p className="text-gray-300 leading-relaxed">{beat.description}</p>
        </div>
      )}

      {beat.visualDescription && (
        <div className="bg-gray-800 p-5 rounded-lg border-l-4 border-purple-500">
          <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wide mb-3">
            Descrição Visual
          </h3>
          <p className="text-gray-300 leading-relaxed italic">{beat.visualDescription}</p>
        </div>
      )}

      {beatScenes.length > 0 && (
        <div className="bg-gray-800 p-5 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <FileCheck size={16} />
            Cenas Associadas
          </h3>
          <div className="space-y-3">
            {beatScenes.map((scene, idx) => (
              <div 
                key={scene._id} 
                className="p-4 bg-gray-700/50 rounded-lg border border-gray-600/30 hover:border-pink-500/50 transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <FileCheck size={16} className="text-pink-400" />
                  <h4 className="text-white font-semibold flex-1">
                    {scene.title || `Cena ${idx + 1}`}
                  </h4>
                  {!scene.content || !scene.content.trim() ? (
                    <span className="text-xs px-2 py-1 bg-gray-600/50 text-gray-400 rounded italic">
                      vazio
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded">
                      {scene.content.length} caracteres
                    </span>
                  )}
                </div>
                {scene.content && scene.content.trim() && (
                  <p className="text-gray-400 text-sm line-clamp-3 leading-relaxed">
                    {scene.content.substring(0, 200)}...
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {beatScenes.length === 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700/30 p-5 rounded-lg">
          <p className="text-yellow-400 text-sm">
            ⚠️ Este beat ainda não possui cenas associadas.
          </p>
        </div>
      )}
      </div>

      {showEditModal && (
        <BeatEditModal
          beat={beat}
          beatIndex={beatIndex}
          projectId={projectId}
          onClose={() => setShowEditModal(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
}