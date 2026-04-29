import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpen, Loader2, Download, CheckCircle, ChevronRight, Image as ImageIcon, Trash2, Eye, Layout, Palette, Save, AlertCircle, X } from 'lucide-react';
import { API_BASE_URL, BACKEND_URL } from '../lib/api';

const Anthology = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [projects, setProjects] = useState([]);
    const [imageStyles, setImageStyles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('general'); // 'general', 'projects', or 'cover'

    const [selectedProjects, setSelectedProjects] = useState([]);
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [selectedStyle, setSelectedStyle] = useState('');
    const [coverPrompt, setCoverPrompt] = useState('');
    const [coverPreview, setCoverPreview] = useState(null);

    // Toast State
    const [toast, setToast] = useState({ message: '', type: 'success', visible: false });

    const showToast = (message, type = 'success') => {
        setToast({ message, type, visible: true });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
    };

    useEffect(() => {
        fetchInitialData();
    }, [id]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [projectsRes, stylesRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/projects`),
                axios.get(`${BACKEND_URL}/api/styles`)
            ]);
            setProjects(projectsRes.data);
            setImageStyles(stylesRes.data);

            if (isEdit) {
                const anthologyRes = await axios.get(`${API_BASE_URL}/projects/anthologies/${id}`);
                const data = anthologyRes.data;
                setTitle(data.title);
                setSubtitle(data.subtitle || '');
                setSelectedProjects(data.projectIds || []);
                setCoverPrompt(data.coverPrompt || '');
                setCoverPreview(data.coverImageUrl || null);
                setSelectedStyle(data.imageStyle || '');
            } else {
                // Reset states for new anthology
                setTitle('');
                setSubtitle('');
                setSelectedProjects([]);
                setCoverPrompt('');
                setCoverPreview(null);
                setSelectedStyle('');
            }

            setLoading(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setLoading(false);
        }
    };

    const toggleProject = (projectId) => {
        if (selectedProjects.includes(projectId)) {
            setSelectedProjects(selectedProjects.filter(pid => pid !== projectId));
        } else {
            setSelectedProjects([...selectedProjects, projectId]);
        }
    };

    const handlePreviewCover = async () => {
        if (!coverPrompt) return showToast('Por favor, descreva a capa primeiro.', 'error');
        setPreviewLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/projects/anthology/preview-cover`, {
                coverPrompt,
                imageStyleId: selectedStyle
            });
            setCoverPreview(response.data.imageUrl);
            setPreviewLoading(false);
            showToast('Arte gerada com sucesso!', 'success');
        } catch (error) {
            console.error('Error generating cover preview:', error);
            showToast('Falha ao gerar prévia da capa.', 'error');
            setPreviewLoading(false);
        }
    };

    const handleAction = async (regeneratePdf = true) => {
        if (!title) return showToast('Por favor, dê um título para a coletânea.', 'error');
        if (selectedProjects.length === 0) return showToast('Selecione pelo menos um projeto.', 'error');

        setGenerating(true);
        try {
            if (isEdit) {
                await axios.put(`${API_BASE_URL}/projects/anthologies/${id}`, {
                    title,
                    subtitle,
                    projectIds: selectedProjects,
                    coverPrompt,
                    imageStyle: selectedStyle,
                    coverImageUrl: coverPreview,
                    regeneratePdf
                });

                showToast('Coletânea atualizada com sucesso!');

                if (regeneratePdf) {
                    window.open(`${API_BASE_URL}/projects/anthologies/${id}/download`, '_blank');
                }

                setTimeout(() => navigate('/my-anthologies'), 1500);
            } else {
                const response = await axios.post(`${API_BASE_URL}/projects/anthology`, {
                    title,
                    subtitle,
                    projectIds: selectedProjects,
                    imageStyle: selectedStyle,
                    coverPrompt: coverPreview ? coverPrompt : (coverPrompt || null)
                }, {
                    responseType: 'blob'
                });

                // Create a link to download the PDF
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${title.replace(/[^a-z0-9]/gi, '_')}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();

                showToast('Coletânea criada com sucesso!');
                setTimeout(() => navigate('/my-anthologies'), 1500);
            }
        } catch (error) {
            console.error('Error processing anthology:', error);
            showToast('Falha ao processar a coletânea.', 'error');
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="animate-spin text-blue-500" size={48} />
                <p className="text-gray-400 animate-pulse font-medium">Sincronizando biblioteca...</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <header className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <BookOpen size={36} className="text-blue-400" />
                        <h1 className="text-4xl font-black text-white tracking-tight">
                            {isEdit ? 'Editar Coletânea' : 'Criar Coletânea'}
                        </h1>
                    </div>
                    <p className="text-gray-400 text-lg max-w-2xl">
                        {isEdit ? 'Atualize os detalhes de sua coletânea e regenere o PDF se desejar.' : 'Escolha seus projetos, defina uma capa e crie um livro completo.'}
                    </p>
                </div>

                <div className="flex gap-4">
                    {isEdit && (
                        <button
                            onClick={() => handleAction(false)}
                            disabled={generating}
                            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold flex items-center gap-2 border border-gray-700 transition-all"
                        >
                            <Save size={20} />
                            Salvar Metadados
                        </button>
                    )}
                    <button
                        onClick={() => handleAction(true)}
                        disabled={generating || selectedProjects.length === 0 || !title}
                        className={`px-8 py-3 rounded-xl font-black flex items-center gap-2 shadow-xl transition-all ${generating || selectedProjects.length === 0 || !title
                            ? 'bg-gray-700 cursor-not-allowed opacity-50 grayscale'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.05] active:scale-[0.95] text-white shadow-blue-500/20'
                            }`}
                    >
                        {generating ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                {isEdit ? 'Regenerando...' : 'Gerando...'}
                            </>
                        ) : (
                            <>
                                <Download size={20} />
                                {isEdit ? 'Salvar e Gerar Novo PDF' : 'Gerar Coletânea'}
                            </>
                        )}
                    </button>
                </div>
            </header>

            {/* Tabs Navigation */}
            <div className="flex border-b border-gray-800 gap-8">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'general' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Layout size={18} />
                        Dados Gerais
                    </div>
                    {activeTab === 'general' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />}
                </button>
                <button
                    onClick={() => setActiveTab('projects')}
                    className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'projects' ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <CheckCircle size={18} />
                        Selecionar Projetos
                    </div>
                    {activeTab === 'projects' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500 rounded-t-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />}
                </button>
                <button
                    onClick={() => setActiveTab('cover')}
                    className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'cover' ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Palette size={18} />
                        Capa & Estilo
                    </div>
                    {activeTab === 'cover' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500 rounded-t-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />}
                </button>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'general' && (
                    <div className="max-w-4xl mx-auto py-8">
                        <div className="bg-gray-800/50 backdrop-blur-sm p-12 rounded-[2.5rem] border border-gray-700 shadow-2xl space-y-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <h3 className="text-2xl font-black text-white">Título Principal</h3>
                                    <p className="text-gray-400 text-sm font-medium leading-relaxed">Este nome aparecerá em destaque na sua capa e será o nome oficial do arquivo PDF.</p>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Ex: Minhas Crônicas Fantásticas"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-6 py-5 text-white text-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-inner"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-2xl font-black text-white">Subtítulo ou Edição</h3>
                                    <p className="text-gray-400 text-sm font-medium leading-relaxed">Um texto secundário para complementar a capa (ex: "Volume 1", "Edição Especial", etc).</p>
                                    <input
                                        type="text"
                                        value={subtitle}
                                        onChange={(e) => setSubtitle(e.target.value)}
                                        placeholder="Ex: Volume I - O Despertar"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-6 py-5 text-white text-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-8 rounded-3xl border border-blue-500/20 flex items-start gap-6">
                                <div className="p-3 bg-blue-600/20 rounded-2xl">
                                    <Layout size={32} className="text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold mb-2 uppercase tracking-wider text-xs">Informação Importante</h4>
                                    <p className="text-sm text-blue-200/80 leading-relaxed">
                                        As coletâneas são perfeitas para organizar séries ou antologias de contos.
                                        O título e subtítulo são renderizados automaticamente na página de rosto do PDF final.
                                        Prossiga para a aba <strong>Selecionar Projetos</strong> para definir o conteúdo.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'projects' && (
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-3xl border border-gray-700 shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-gray-700 flex justify-between items-center bg-gray-900/40">
                            <div>
                                <h3 className="text-xl font-bold text-white">Escolha os Projetos</h3>
                                <p className="text-sm text-gray-500">Marque os projetos que deseja incluir nesta coletânea.</p>
                            </div>
                            <div className="px-4 py-2 bg-green-500/10 rounded-full border border-green-500/20 text-xs font-black text-green-400 select-none">
                                {selectedProjects.length} SELECIONADOS
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-900/60 text-gray-400 text-xs uppercase tracking-widest font-black">
                                    <tr>
                                        <th className="px-8 py-5">
                                            <div className="w-5 h-5 rounded border-2 border-gray-700"></div>
                                        </th>
                                        <th className="px-6 py-5">Projeto</th>
                                        <th className="px-6 py-5">Gênero / Estilo</th>
                                        <th className="px-6 py-5">Status</th>
                                        <th className="px-6 py-5">Criação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/50">
                                    {projects.map((project) => (
                                        <tr
                                            key={project._id}
                                            onClick={() => toggleProject(project._id)}
                                            className={`hover:bg-gray-700/30 transition-colors cursor-pointer group ${selectedProjects.includes(project._id) ? 'bg-blue-500/5' : ''}`}
                                        >
                                            <td className="px-8 py-5">
                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedProjects.includes(project._id) ? 'bg-green-600 border-green-600 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'border-gray-600 group-hover:border-gray-500'}`}>
                                                    {selectedProjects.includes(project._id) && <CheckCircle size={14} className="text-white" />}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors">
                                                    {project.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-sm text-gray-400">{project.style}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase font-black tracking-widest ${project.status === 'ready' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                    {project.status === 'ready' ? 'Pronto' : project.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-gray-500 text-sm font-mono">
                                                {new Date(project.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {projects.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-20 text-center text-gray-600">
                                                <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                                                <p>Nenhum projeto disponível para seleção.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'cover' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto">
                        <div className="lg:col-span-12">
                            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-3xl border border-gray-700 shadow-2xl space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            <Palette size={20} className="text-purple-400" />
                                            Estilo Visual
                                        </h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {imageStyles.map((style) => (
                                                <button
                                                    key={style._id}
                                                    onClick={() => setSelectedStyle(style._id)}
                                                    className={`px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border-2 ${selectedStyle === style._id
                                                        ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                                                        : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500'
                                                        }`}
                                                >
                                                    {style.name}
                                                </button>
                                            ))}
                                        </div>
                                        {selectedStyle && imageStyles.find(s => s._id === selectedStyle) && (
                                            <p className="mt-4 text-[10px] text-gray-500 italic bg-gray-900/30 p-3 rounded-xl border border-gray-700/30 animate-in fade-in slide-in-from-top-1">
                                                <span className="font-bold text-purple-400 uppercase mr-2 text-[9px]">Base Prompt:</span>
                                                "{imageStyles.find(s => s._id === selectedStyle).prompt}"
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            <ImageIcon size={20} className="text-purple-400" />
                                            Instruções da Capa
                                        </h3>
                                        <textarea
                                            value={coverPrompt}
                                            onChange={(e) => setCoverPrompt(e.target.value)}
                                            placeholder="Ex: Uma paisagem épica de montanhas flutuantes..."
                                            rows={3}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none shadow-inner"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-gray-700 pt-8">
                                    <div className="space-y-6">
                                        <button
                                            onClick={handlePreviewCover}
                                            disabled={previewLoading || !coverPrompt}
                                            className="w-full py-5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-purple-500/20 active:scale-[0.98]"
                                        >
                                            {previewLoading ? <Loader2 size={28} className="animate-spin" /> : <Palette size={28} />}
                                            Gerar Nova Arte
                                        </button>

                                        <div className="p-8 bg-gray-900/50 border border-gray-700 rounded-3xl">
                                            <h4 className="text-purple-400 font-black mb-4 uppercase text-xs tracking-widest">Sugestões de Prompt</h4>
                                            <div className="space-y-3">
                                                <div className="text-sm text-gray-400 p-3 bg-gray-800/50 rounded-xl cursor-help hover:text-white transition-colors" onClick={() => setCoverPrompt("Estilo fantasia medieval, guerreiro no topo da montanha, pôr do sol épico")}>Fantasy Medieval</div>
                                                <div className="text-sm text-gray-400 p-3 bg-gray-800/50 rounded-xl cursor-help hover:text-white transition-colors" onClick={() => setCoverPrompt("Estilo Cyberpunk, metrópole futurista com neon, chuva, visão ultra-realista")}>Sci-Fi / Cyberpunk</div>
                                                <div className="text-sm text-gray-400 p-3 bg-gray-800/50 rounded-xl cursor-help hover:text-white transition-colors" onClick={() => setCoverPrompt("Estilo noir clássico, detetive sob poste de luz, neblina, preto e branco dramático")}>Suspense / Noir</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-center">
                                        <div className="relative group p-4 bg-gray-900/30 rounded-[2.5rem] border-2 border-gray-700 shadow-2xl">
                                            {coverPreview ? (
                                                <div className="relative rounded-[2rem] overflow-hidden aspect-[9/16] w-[280px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] border-4 border-gray-800">
                                                    <img
                                                        src={coverPreview.startsWith('/') ? `${BACKEND_URL}${coverPreview}` : coverPreview}
                                                        alt="Cover"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-md">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setCoverPreview(null); }}
                                                            className="p-5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all transform scale-0 group-hover:scale-100 active:scale-90"
                                                        >
                                                            <Trash2 size={32} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="aspect-[9/16] w-[280px] rounded-[2rem] border-4 border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-700 gap-4 bg-gray-900/30">
                                                    <ImageIcon size={80} className="opacity-10" />
                                                    <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-20">Sem Visualização</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Toast System */}
            {toast.visible && (
                <div className={`fixed bottom-8 right-8 z-[100] flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border transition-all animate-in slide-in-from-right-10 duration-300 ${toast.type === 'success'
                    ? 'bg-green-600/90 border-green-500 text-white backdrop-blur-md'
                    : 'bg-red-600/90 border-red-500 text-white backdrop-blur-md'
                    }`}>
                    {toast.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                    <p className="font-bold text-sm tracking-wide">{toast.message}</p>
                    <button
                        onClick={() => setToast(prev => ({ ...prev, visible: false }))}
                        className="ml-2 p-1 hover:bg-black/20 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default Anthology;
