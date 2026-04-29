import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import useProjectStructure from '../hooks/useProjectStructure';
import TreeView from '../components/ProjectStructure/TreeView';
import DetailPanel from '../components/ProjectStructure/DetailPanel';

export default function ProjectStructure() {
  const { id } = useParams();
  const {
    project,
    bible,
    scenes,
    loading,
    error,
    selectedItem,
    expandedNodes,
    toggleNode,
    selectItem,
    getScenesForBeat,
    getStats,
    reload
  } = useProjectStructure(id);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-400 mx-auto mb-4" size={48} />
          <p className="text-gray-400">Carregando estrutura do projeto...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md">
          <AlertCircle className="text-red-400 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold text-white mb-2">Erro ao carregar projeto</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar aos Projetos
          </Link>
        </div>
      </div>
    );
  }

  const stats = getStats();

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to={`/project/${id}`}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Voltar</span>
          </Link>
          <div className="h-6 w-px bg-gray-700" />
          <div>
            <h1 className="text-xl font-bold text-white">
              {project?.name || 'Projeto'}
            </h1>
            <p className="text-xs text-gray-400">Visualização Hierárquica</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-sm">
            <div className="text-gray-400">
              <span className="text-green-400 font-bold">{stats.charactersCount}</span> personagens
            </div>
            <div className="text-gray-400">
              <span className="text-yellow-400 font-bold">{stats.settingsCount}</span> cenários
            </div>
            <div className="text-gray-400">
              <span className="text-orange-400 font-bold">{stats.chaptersCount}</span> capítulos
            </div>
            <div className="text-gray-400">
              <span className="text-cyan-400 font-bold">{stats.beatsCount}</span> beats
            </div>
            <div className="text-gray-400">
              <span className="text-pink-400 font-bold">{stats.scenesWithContent}</span>/{stats.scenesCount} cenas
            </div>
          </div>

          <button
            onClick={reload}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-all"
            title="Recarregar"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {/* Main Content: Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: TreeView (30%) */}
        <div className="w-[30%] min-w-[300px] max-w-[400px] border-r border-gray-700">
          <TreeView
            project={project}
            bible={bible}
            scenes={scenes}
            selectedItem={selectedItem}
            expandedNodes={expandedNodes}
            onToggle={toggleNode}
            onSelect={selectItem}
            getScenesForBeat={getScenesForBeat}
          />
        </div>

        {/* Right: DetailPanel (70%) */}
        <div className="flex-1">
          <DetailPanel
            selectedItem={selectedItem}
            getScenesForBeat={getScenesForBeat}
            projectId={id}
            bible={bible}
            onUpdate={reload}
          />
        </div>
      </div>
    </div>
  );
}
