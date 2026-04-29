import React from 'react';
import ProjectInfo from './ProjectInfo';
import BibleOverview from './BibleOverview';
import CharacterDetail from './CharacterDetail';
import SettingDetail from './SettingDetail';
import ChapterDetail from './ChapterDetail';
import BeatDetail from './BeatDetail';
import SceneDetail from './SceneDetail';
import { Package } from 'lucide-react';

export default function DetailPanel({ selectedItem, getScenesForBeat, projectId, bible, onUpdate }) {
  const renderContent = () => {
    switch (selectedItem.type) {
      case 'project':
        return <ProjectInfo project={selectedItem.data} onUpdate={onUpdate} />;
      
      case 'bible':
        return <BibleOverview bible={selectedItem.data} />;
      
      case 'character':
        return (
          <CharacterDetail 
            character={selectedItem.data} 
            projectId={projectId}
            characterIndex={selectedItem.id}
            onUpdate={onUpdate}
          />
        );
      
      case 'setting':
        return (
          <SettingDetail 
            setting={selectedItem.data}
            projectId={projectId}
            settingIndex={selectedItem.id}
            onUpdate={onUpdate}
          />
        );
      
      case 'chapter':
        return (
          <ChapterDetail 
            chapter={selectedItem.data}
            projectId={projectId}
            onUpdate={onUpdate}
          />
        );
      
      case 'beat':
        const beatScenes = getScenesForBeat(selectedItem.id);
        return (
          <BeatDetail 
            beat={selectedItem.data} 
            scenes={beatScenes}
            projectId={projectId}
            beatIndex={selectedItem.data.beatIndex || 0}
            onUpdate={onUpdate}
          />
        );
      
      case 'scene':
        return (
          <SceneDetail 
            scene={selectedItem.data}
            projectId={projectId}
            bible={bible}
            onUpdate={onUpdate}
          />
        );
      
      case 'characters':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Todos os Personagens</h2>
            <p className="text-gray-400">
              {selectedItem.data?.length || 0} personagens definidos.
              Selecione um personagem na árvore à esquerda para ver os detalhes.
            </p>
          </div>
        );
      
      case 'settings':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Todos os Cenários</h2>
            <p className="text-gray-400">
              {selectedItem.data?.length || 0} cenários definidos.
              Selecione um cenário na árvore à esquerda para ver os detalhes.
            </p>
          </div>
        );
      
      case 'chapters':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Todos os Capítulos</h2>
            <p className="text-gray-400">
              {selectedItem.data?.length || 0} capítulos estruturados.
              Selecione um capítulo na árvore à esquerda para ver os detalhes.
            </p>
          </div>
        );
      
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Package size={48} className="mb-4 opacity-50" />
            <p>Selecione um item na árvore para visualizar os detalhes</p>
          </div>
        );
    }
  };

  return (
    <div className="h-full overflow-auto bg-gray-900 p-6">
      {renderContent()}
    </div>
  );
}
