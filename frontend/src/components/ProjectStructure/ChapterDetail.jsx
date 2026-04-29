import React, { useState } from 'react';
import { FileText, Zap, Sparkles, Loader2, Wand2, FileSearch, BookOpen, ClipboardList, Download } from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildApiUrl } from '../../lib/api';

export default function ChapterDetail({ chapter, projectId, onUpdate }) {
  const [generating, setGenerating] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('content'); // 'content' or 'analysis'

  if (!chapter) return null;

  const handleGenerateAllScenes = async () => {
    if (!confirm(`Gerar todas as ${chapter.beats?.length || 0} cenas do capítulo "${chapter.title}"? Isso pode levar alguns minutos.`)) {
      return;
    }

    setGenerating(true);
    try {
      const res = await axios.post(buildApiUrl('/scenes/generate-chapter'), {
        projectId,
        chapterNumber: chapter.chapterNumber
      });

      alert(`✓ ${res.data.count} cenas foram geradas com sucesso!`);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error generating chapter scenes:', error);
      alert('Erro ao gerar as cenas do capítulo: ' + (error.response?.data?.error || error.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleEnhanceAllBeats = async () => {
    if (!confirm(`Gerar enhanced (descrição + visual) para todos os ${chapter.beats?.length || 0} beats do capítulo "${chapter.title}"? Isso pode levar alguns minutos.`)) {
      return;
    }

    setEnhancing(true);
    try {
      const res = await axios.post(buildApiUrl('/generate/chapter-beats-enhanced'), {
        projectId,
        chapterNumber: chapter.chapterNumber,
        instruction: '' // Could add a prompt input if needed
      });

      alert(`✓ ${res.data.count} beats foram aprimorados com sucesso!`);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error enhancing chapter beats:', error);
      alert('Erro ao aprimorar os beats do capítulo: ' + (error.response?.data?.error || error.message));
    } finally {
      setEnhancing(false);
    }
  };

  const handleAnalyzeChapter = async () => {
    setAnalyzing(true);
    try {
      const res = await axios.post(buildApiUrl(`/projects/${projectId}/analyze-chapter`), {
        chapterNumber: chapter.chapterNumber
      });

      // Update will be triggered by parent component
      if (onUpdate) onUpdate();
      
      // Switch to analysis tab after generation
      setActiveTab('analysis');
    } catch (error) {
      console.error('Error analyzing chapter:', error);
      alert('Erro ao analisar o capítulo: ' + (error.response?.data?.error || error.message));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExportAnalysisPdf = () => {
    if (!chapter.analysis) {
      alert('O capítulo ainda não possui uma análise editorial.');
      return;
    }

    const url = buildApiUrl(`/projects/${projectId}/chapters/${chapter.chapterNumber}/analysis/export-pdf`);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-gray-400 mb-1">Capítulo {chapter.chapterNumber}</div>
        <h2 className="text-3xl font-bold text-white mb-2">{chapter.title}</h2>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-orange-900/30 text-orange-400 text-sm rounded-full border border-orange-700/50">
            {chapter.type || 'NORMAL'}
          </span>
          <span className="text-gray-400 text-sm">
            {chapter.beats?.length || 0} beats
          </span>
          {chapter.analysis && chapter.analysisDate && (
            <span className="text-emerald-400 text-sm flex items-center gap-1">
              <FileSearch size={14} />
              Analisado em {new Date(chapter.analysisDate).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('content')}
            className={`px-4 py-3 font-medium transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'content'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <BookOpen size={18} />
            Conteúdo
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-3 font-medium transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'analysis'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <ClipboardList size={18} />
            Análise Editorial
            {!chapter.analysis && <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">Nova</span>}
          </button>
        </div>
      </div>

      {/* Tab Content: Content */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          {/* Generate All Scenes Button */}
          {chapter.beats && chapter.beats.length > 0 && (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-5 rounded-lg border border-purple-500/30">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-400" />
                  Geração Automática de Cenas
                </h3>
                <p className="text-gray-400 text-sm">
                  Gerar automaticamente todas as {chapter.beats.length} cenas deste capítulo de uma só vez.
                </p>
              </div>
              <button
                onClick={handleGenerateAllScenes}
                disabled={generating}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap"
              >
                {generating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Gerar Todas as Cenas
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-r from-cyan-900/30 to-teal-900/30 p-5 rounded-lg border border-cyan-500/30">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                  <Wand2 size={18} className="text-cyan-400" />
                  Aprimorar Todos os Beats
                </h3>
                <p className="text-gray-400 text-sm">
                  Gerar descrições aprimoradas e descrições visuais para todos os {chapter.beats.length} beats deste capítulo.
                </p>
              </div>
              <button
                onClick={handleEnhanceAllBeats}
                disabled={enhancing}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap"
              >
                {enhancing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Aprimorando...
                  </>
                ) : (
                  <>
                    <Wand2 size={18} />
                    Aprimorar Todos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {chapter.aiSummary && (
        <div className="bg-gray-800 p-5 rounded-lg border-l-4 border-orange-500">
          <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide mb-3">
            Resumo
          </h3>
          <p className="text-gray-300 leading-relaxed">{chapter.aiSummary}</p>
        </div>
      )}

      {chapter.beats && chapter.beats.length > 0 && (
        <div className="bg-gray-800 p-5 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Zap size={16} />
            Beats deste Capítulo
          </h3>
          <div className="space-y-3">
            {chapter.beats.map((beat, idx) => (
              <div 
                key={beat.id} 
                className="p-4 bg-gray-700/50 rounded-lg border border-gray-600/30 hover:border-cyan-500/50 transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-cyan-400 font-mono text-sm">#{beat.id}</span>
                  <h4 className="text-white font-semibold flex-1">{beat.title}</h4>
                  {beat.type && (
                    <span className="text-xs px-2 py-1 bg-cyan-900/30 text-cyan-400 rounded uppercase">
                      {beat.type}
                    </span>
                  )}
                </div>
                {beat.description && (
                  <p className="text-gray-400 text-sm leading-relaxed">{beat.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
        </div>
      )}

      {/* Tab Content: Analysis */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {!chapter.analysis ? (
            <div className="bg-gradient-to-r from-emerald-900/30 to-green-900/30 p-8 rounded-lg border border-emerald-500/30">
              <div className="flex flex-col items-center text-center gap-4">
                <FileSearch size={48} className="text-emerald-400" />
                <div>
                  <h3 className="text-white font-semibold text-xl mb-2">
                    Análise Editorial do Capítulo
                  </h3>
                  <p className="text-gray-400 mb-6 max-w-2xl">
                    Gere um relatório completo com análise detalhada, pontos fortes, sugestões de melhoria e ideias criativas. 
                    A análise considera o estilo narrativo e a bíblia do projeto.
                  </p>
                  <button
                    onClick={handleAnalyzeChapter}
                    disabled={analyzing}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center gap-2 mx-auto"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <FileSearch size={20} />
                        Gerar Análise Editorial
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSearch className="text-emerald-400" size={24} />
                  <div>
                    <h3 className="text-lg font-semibold text-white">Relatório de Análise Editorial</h3>
                    {chapter.analysisDate && (
                      <p className="text-sm text-gray-400">
                        Gerado em {new Date(chapter.analysisDate).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportAnalysisPdf}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-all flex items-center gap-2"
                  >
                    <Download size={18} />
                    Exportar PDF
                  </button>
                  <button
                    onClick={handleAnalyzeChapter}
                    disabled={analyzing}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center gap-2"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        Atualizar Análise
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg border border-emerald-500/30">
                <div className="prose prose-invert prose-emerald max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ node, ...props }) => <h1 className="text-2xl font-bold text-emerald-400 mb-4 mt-6" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-emerald-400 mb-3 mt-5" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-lg font-semibold text-emerald-300 mb-2 mt-4" {...props} />,
                      p: ({ node, ...props }) => <p className="text-gray-300 mb-3 leading-relaxed" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc list-inside text-gray-300 mb-3 space-y-1" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal list-inside text-gray-300 mb-3 space-y-1" {...props} />,
                      li: ({ node, ...props }) => <li className="text-gray-300" {...props} />,
                      strong: ({ node, ...props }) => <strong className="text-emerald-300 font-semibold" {...props} />,
                      em: ({ node, ...props }) => <em className="text-emerald-200" {...props} />,
                      blockquote: ({ node, ...props }) => (
                        <blockquote className="border-l-4 border-emerald-500 pl-4 italic text-gray-400 my-3" {...props} />
                      ),
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border-collapse border border-gray-700" {...props} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => <thead className="bg-gray-700/50" {...props} />,
                      tbody: ({ node, ...props }) => <tbody {...props} />,
                      tr: ({ node, ...props }) => <tr className="border-b border-gray-700" {...props} />,
                      th: ({ node, ...props }) => (
                        <th className="px-4 py-2 text-left text-emerald-400 font-semibold border border-gray-700" {...props} />
                      ),
                      td: ({ node, ...props }) => (
                        <td className="px-4 py-2 text-gray-300 border border-gray-700" {...props} />
                      ),
                      code: ({ node, inline, ...props }) => 
                        inline ? (
                          <code className="bg-gray-700 text-emerald-400 px-1.5 py-0.5 rounded text-sm" {...props} />
                        ) : (
                          <code className="block bg-gray-700 text-emerald-400 p-3 rounded-lg text-sm overflow-x-auto" {...props} />
                        ),
                    }}
                  >
                    {chapter.analysis}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
