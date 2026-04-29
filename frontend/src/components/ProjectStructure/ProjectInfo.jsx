import React, { useState } from 'react';
import { BookOpen, Calendar, Globe, Palette, Tag, Edit2, Save, X } from 'lucide-react';
import axios from 'axios';
import { buildApiUrl } from '../../lib/api';

export default function ProjectInfo({ project, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [saving, setSaving] = useState(false);

  if (!project) return null;

  const startEdit = () => {
    setEditedData({
      name: project.name,
      style: project.style,
      language: project.language,
      premise: project.premise,
      imageStyle: project.imageStyle
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditedData({});
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await axios.put(buildApiUrl(`/projects/${project._id}`), editedData);
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Erro ao atualizar projeto: ' + (error.response?.data?.error || error.message));
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
            <h2 className="text-3xl font-bold text-white mb-2">{project.name}</h2>
          )}
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <BookOpen size={16} />
            <span>Projeto</span>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Tag size={16} />
            <span className="text-xs uppercase tracking-wide">Estilo Narrativo</span>
          </div>
          {isEditing ? (
            <input
              type="text"
              value={editedData.style}
              onChange={(e) => setEditedData({...editedData, style: e.target.value})}
              className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 w-full"
            />
          ) : (
            <p className="text-white font-medium">{project.style || 'Não definido'}</p>
          )}
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Globe size={16} />
            <span className="text-xs uppercase tracking-wide">Idioma</span>
          </div>
          {isEditing ? (
            <input
              type="text"
              value={editedData.language}
              onChange={(e) => setEditedData({...editedData, language: e.target.value})}
              className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 w-full"
            />
          ) : (
            <p className="text-white font-medium">{project.language || 'Não definido'}</p>
          )}
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Palette size={16} />
            <span className="text-xs uppercase tracking-wide">Estilo de Imagem</span>
          </div>
          {isEditing ? (
            <input
              type="text"
              value={editedData.imageStyle}
              onChange={(e) => setEditedData({...editedData, imageStyle: e.target.value})}
              className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 w-full"
            />
          ) : (
            <p className="text-white font-medium">{project.imageStyle || 'Não definido'}</p>
          )}
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Calendar size={16} />
            <span className="text-xs uppercase tracking-wide">Criado em</span>
          </div>
          <p className="text-white font-medium">
            {project.createdAt ? new Date(project.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
          </p>
        </div>
      </div>

      {project.premise && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Premissa
          </h3>
          {isEditing ? (
            <textarea
              value={editedData.premise}
              onChange={(e) => setEditedData({...editedData, premise: e.target.value})}
              className="bg-gray-700 text-gray-300 border border-gray-600 rounded px-3 py-2 w-full min-h-[100px]"
            />
          ) : (
            <p className="text-gray-300 leading-relaxed">{project.premise}</p>
          )}
        </div>
      )}

      {project.initialChapterStructure && project.initialChapterStructure.length > 0 && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Estrutura Inicial de Capítulos
          </h3>
          <div className="space-y-2">
            {project.initialChapterStructure.map((ch, idx) => (
              <div key={idx} className="flex gap-3 p-2 bg-gray-700/50 rounded">
                <span className="text-blue-400 font-bold">Cap {ch.number}</span>
                <span className="text-purple-400 text-xs uppercase px-2 py-0.5 bg-purple-900/30 rounded">
                  {ch.type}
                </span>
                <span className="text-gray-300 text-sm">{ch.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
