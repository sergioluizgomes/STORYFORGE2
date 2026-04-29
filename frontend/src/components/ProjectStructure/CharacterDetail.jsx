import React, { useState } from 'react';
import { User, Heart, AlertCircle, Eye, Edit2, Save, X } from 'lucide-react';
import axios from 'axios';
import { buildApiUrl } from '../../lib/api';

export default function CharacterDetail({ character, projectId, characterIndex, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [saving, setSaving] = useState(false);

  if (!character) return null;

  const startEdit = () => {
    setEditedData({ ...character });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditedData({});
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await axios.put(buildApiUrl(`/generate/bible/${projectId}/character/${characterIndex}`), editedData);
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating character:', error);
      alert('Erro ao atualizar personagem: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editedData.name}
              onChange={(e) => setEditedData({...editedData, name: e.target.value})}
              className="text-3xl font-bold bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 w-full mb-2"
            />
          ) : (
            <h2 className="text-3xl font-bold text-white mb-2">{character.name}</h2>
          )}
          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <input
                  type="text"
                  value={editedData.role}
                  onChange={(e) => setEditedData({...editedData, role: e.target.value})}
                  className="px-3 py-1 bg-gray-800 text-green-400 text-sm rounded-full border border-green-700/50"
                  placeholder="Role"
                />
                <input
                  type="text"
                  value={editedData.archetype || ''}
                  onChange={(e) => setEditedData({...editedData, archetype: e.target.value})}
                  className="px-3 py-1 bg-gray-800 text-purple-400 text-sm rounded-full border border-purple-700/50"
                  placeholder="Archetype"
                />
              </>
            ) : (
              <>
                <span className="px-3 py-1 bg-green-900/30 text-green-400 text-sm rounded-full border border-green-700/50">
                  {character.role || 'Personagem'}
                </span>
                {character.archetype && (
                  <span className="px-3 py-1 bg-purple-900/30 text-purple-400 text-sm rounded-full border border-purple-700/50">
                    {character.archetype}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <button
              onClick={startEdit}
              className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
              title="Editar"
            >
              <Edit2 size={18} />
            </button>
          ) : (
            <>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="p-2 text-green-400 hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50"
                title="Salvar"
              >
                <Save size={18} />
              </button>
              <button
                onClick={cancelEdit}
                className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                title="Cancelar"
              >
                <X size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {character.description && (
        <div className="bg-gray-800 p-5 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <User size={16} />
            Descrição
          </h3>
          {isEditing ? (
            <textarea
              value={editedData.description}
              onChange={(e) => setEditedData({...editedData, description: e.target.value})}
              className="bg-gray-700 text-gray-300 border border-gray-600 rounded px-3 py-2 w-full min-h-[100px]"
            />
          ) : (
            <p className="text-gray-300 leading-relaxed">{character.description}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {character.rulingPassion && (
          <div className="bg-gradient-to-br from-red-900/20 to-red-800/5 p-5 rounded-lg border border-red-700/30">
            <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Heart size={16} />
              Paixão Dominante
            </h3>
            {isEditing ? (
              <textarea
                value={editedData.rulingPassion}
                onChange={(e) => setEditedData({...editedData, rulingPassion: e.target.value})}
                className="bg-gray-700 text-gray-300 border border-gray-600 rounded px-3 py-2 w-full min-h-[80px]"
              />
            ) : (
              <p className="text-gray-300 leading-relaxed">{character.rulingPassion}</p>
            )}
          </div>
        )}

        {character.theWound && (
          <div className="bg-gradient-to-br from-orange-900/20 to-orange-800/5 p-5 rounded-lg border border-orange-700/30">
            <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <AlertCircle size={16} />
              A Ferida
            </h3>
            {isEditing ? (
              <textarea
                value={editedData.theWound}
                onChange={(e) => setEditedData({...editedData, theWound: e.target.value})}
                className="bg-gray-700 text-gray-300 border border-gray-600 rounded px-3 py-2 w-full min-h-[80px]"
              />
            ) : (
              <p className="text-gray-300 leading-relaxed">{character.theWound}</p>
            )}
          </div>
        )}
      </div>

      {character.visualDescription && (
        <div className="bg-gray-800 p-5 rounded-lg border-l-4 border-blue-500">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Eye size={16} />
            Descrição Visual
          </h3>
          {isEditing ? (
            <textarea
              value={editedData.visualDescription}
              onChange={(e) => setEditedData({...editedData, visualDescription: e.target.value})}
              className="bg-gray-700 text-gray-300 border border-gray-600 rounded px-3 py-2 w-full min-h-[80px]"
            />
          ) : (
            <p className="text-gray-300 leading-relaxed italic">{character.visualDescription}</p>
          )}
        </div>
      )}

      {character.imageUrl && (
        <div className="bg-gray-800 p-3 rounded-lg">
          <img 
            src={character.imageUrl} 
            alt={character.name} 
            className="w-full max-w-md rounded-lg shadow-xl"
          />
        </div>
      )}
    </div>
  );
}
