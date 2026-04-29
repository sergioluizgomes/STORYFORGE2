import React, { useState } from 'react';
import { FileCheck, Hash, Edit2 } from 'lucide-react';
import SceneEditModal from './SceneEditModal';

export default function SceneDetail({ scene, projectId, bible, onUpdate }) {
  const [showEditModal, setShowEditModal] = useState(false);

  if (!scene) return null;

  const handleSave = (updatedScene) => {
    setShowEditModal(false);
    if (onUpdate) onUpdate();
  };

  return (
    <>
      <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-sm text-gray-400 mb-1">Cena</div>
          <h2 className="text-3xl font-bold text-white mb-2">{scene.title || 'Sem título'}</h2>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm flex items-center gap-1">
              <Hash size={14} />
              Beat {scene.beatId}
            </span>
            {scene.chapterNumber && (
              <span className="text-gray-400 text-sm">
                Capítulo {scene.chapterNumber}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowEditModal(true)}
          className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
          title="Editar"
        >
          <Edit2 size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Status</div>
          <div className="text-white font-medium">
            {scene.content && scene.content.trim() ? (
              <span className="text-green-400">✓ Com conteúdo</span>
            ) : (
              <span className="text-gray-500">○ Vazio</span>
            )}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Tamanho</div>
          <div className="text-white font-medium">
            {scene.content ? `${scene.content.length} caracteres` : 'N/A'}
          </div>
        </div>
      </div>

      {scene.summary && (
        <div className="bg-gray-800 p-5 rounded-lg border-l-4 border-pink-500">
          <h3 className="text-sm font-semibold text-pink-400 uppercase tracking-wide mb-3">
            Resumo
          </h3>
          <p className="text-gray-300 leading-relaxed">{scene.summary}</p>
        </div>
      )}

      {scene.content && scene.content.trim() ? (
        <div className="bg-gray-800 p-5 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Conteúdo
          </h3>
          <div className="prose prose-invert max-w-none">
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {scene.content}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-900/20 border border-yellow-700/30 p-5 rounded-lg">
          <p className="text-yellow-400 text-sm">
            ⚠️ Esta cena ainda não possui conteúdo escrito.
          </p>
        </div>
      )}
    </div>

    {showEditModal && (
      <SceneEditModal
        scene={scene}
        projectId={projectId}
        bible={bible}
        onClose={() => setShowEditModal(false)}
        onSave={handleSave}
      />
    )}
  </>
  );
}
