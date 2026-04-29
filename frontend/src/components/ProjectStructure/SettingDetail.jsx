import React, { useState } from 'react';
import { MapPin, Edit2, Save, X } from 'lucide-react';
import axios from 'axios';
import { buildApiUrl } from '../../lib/api';

export default function SettingDetail({ setting, projectId, settingIndex, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [saving, setSaving] = useState(false);

  if (!setting) return null;

  const startEdit = () => {
    setEditedData({ ...setting });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditedData({});
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await axios.put(buildApiUrl(`/generate/bible/${projectId}/location/${settingIndex}`), editedData);
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating setting:', error);
      alert('Erro ao atualizar cenário: ' + (error.response?.data?.error || error.message));
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
            <h2 className="text-3xl font-bold text-white mb-2">{setting.name}</h2>
          )}
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <MapPin size={16} />
            <span>Cenário</span>
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

      {setting.description && (
        <div className="bg-gray-800 p-5 rounded-lg border-l-4 border-yellow-500">
          <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide mb-3">
            Descrição
          </h3>
          {isEditing ? (
            <textarea
              value={editedData.description}
              onChange={(e) => setEditedData({...editedData, description: e.target.value})}
              className="bg-gray-700 text-gray-300 border border-gray-600 rounded px-3 py-2 w-full min-h-[100px]"
            />
          ) : (
            <p className="text-gray-300 leading-relaxed">{setting.description}</p>
          )}
        </div>
      )}

      {setting.imageUrl && (
        <div className="bg-gray-800 p-3 rounded-lg">
          <img 
            src={setting.imageUrl} 
            alt={setting.name} 
            className="w-full rounded-lg shadow-xl"
          />
        </div>
      )}
    </div>
  );
}
