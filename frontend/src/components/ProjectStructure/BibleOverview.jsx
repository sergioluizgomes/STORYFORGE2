import React from 'react';
import { BookOpen, Target, Flame } from 'lucide-react';

export default function BibleOverview({ bible }) {
  if (!bible) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Story Bible</h2>
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <BookOpen size={16} />
          <span>Contexto Narrativo Completo</span>
        </div>
      </div>

      {bible.summary && (
        <div className="bg-gray-800 p-5 rounded-lg border-l-4 border-blue-500">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <BookOpen size={16} />
            Resumo
          </h3>
          <p className="text-gray-300 leading-relaxed">{bible.summary}</p>
        </div>
      )}

      {bible.premise && (
        <div className="bg-gray-800 p-5 rounded-lg border-l-4 border-purple-500">
          <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Target size={16} />
            Premissa
          </h3>
          <p className="text-gray-300 leading-relaxed italic">{bible.premise}</p>
        </div>
      )}

      {bible.theCrucible && (
        <div className="bg-gray-800 p-5 rounded-lg border-l-4 border-orange-500">
          <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Flame size={16} />
            The Crucible
          </h3>
          <p className="text-gray-300 leading-relaxed font-medium">{bible.theCrucible}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-900/30 to-green-800/10 p-4 rounded-lg border border-green-700/30">
          <div className="text-3xl font-bold text-green-400 mb-1">
            {bible.characters?.length || 0}
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Personagens</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/10 p-4 rounded-lg border border-yellow-700/30">
          <div className="text-3xl font-bold text-yellow-400 mb-1">
            {bible.settings?.length || 0}
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Cenários</div>
        </div>

        <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/10 p-4 rounded-lg border border-orange-700/30">
          <div className="text-3xl font-bold text-orange-400 mb-1">
            {bible.chapters?.length || 0}
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Capítulos</div>
        </div>
      </div>
    </div>
  );
}
