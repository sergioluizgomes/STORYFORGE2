import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Book, MapPin, Activity, Sparkles, Loader2, List, Layout, BookOpen, Edit3, Save, History, Settings, RefreshCw, RotateCcw, CheckCircle, AlertCircle, X, Image, Network, Download, FileSearch, Terminal } from 'lucide-react';
import HybridEditor from '../components/HybridEditor';
import BookBriefPanel from '../components/BookBriefPanel';
import StoryRoomPanel from '../components/StoryRoomPanel';
import PublishabilityPanel from '../components/PublishabilityPanel';
import QualityReportPanel from '../components/QualityReportPanel';
import PublishingPackagePanel from '../components/PublishingPackagePanel';
import { API_BASE_URL, buildApiUrl, buildBackendUrl } from '../lib/api';

const PROJECT_STATUSES_WITH_BIBLE = new Set(['bible_ready', 'writing', 'ready']);

export default function ProjectView() {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [bible, setBible] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState('cover');
    const [generatingCover, setGeneratingCover] = useState(false);
    const [coverPrompt, setCoverPrompt] = useState('');
    const [coverAuthor, setCoverAuthor] = useState('');
    const [editableName, setEditableName] = useState('');
    const [editableStyle, setEditableStyle] = useState('');
    const [editableCustomStyle, setEditableCustomStyle] = useState('');
    const [editableAiProvider, setEditableAiProvider] = useState('');
    const [editableAiModel, setEditableAiModel] = useState('');
    const [isSavingProject, setIsSavingProject] = useState(false);
    const [aiSettings, setAiSettings] = useState(null);
    const [availableAiProviders, setAvailableAiProviders] = useState([]);
    const [availableAiModels, setAvailableAiModels] = useState([]);
    const [loadingAiModels, setLoadingAiModels] = useState(false);
    const [aiModelError, setAiModelError] = useState('');

    // Image Styles State
    const [availableStyles, setAvailableStyles] = useState([]);
    const [narrativeStyles, setNarrativeStyles] = useState([]);
    const [isUpdatingStyle, setIsUpdatingStyle] = useState(false);

    // Scene Board Data
    const [scenes, setScenes] = useState([]);
    const [genId, setGenId] = useState(null); // beatId being generated

    // Editor Modal State
    const [selectedScene, setSelectedScene] = useState(null);
    const [editorTab, setEditorTab] = useState('content'); // 'content', 'info', 'versions'

    // Generation Params State (for Info Tab)
    const [genParams, setGenParams] = useState({
        beatTitle: '',
        beatDescription: '',
        instructions: ''
    });

    // Character Editor State
    const [editingCharacter, setEditingCharacter] = useState(null); // { ...char, index }
    const [charBgPrompt, setCharBgPrompt] = useState('');
    const [generatingBg, setGeneratingBg] = useState(false);
    const [charEditTab, setCharEditTab] = useState('info'); // 'info', 'background', 'visual', 'image'
    const [generatingImage, setGeneratingImage] = useState(false);

    // Location Editor State
    const [editingLocation, setEditingLocation] = useState(null); // { ...loc, index }
    const [locBgPrompt, setLocBgPrompt] = useState('');
    const [generatingLocBg, setGeneratingLocBg] = useState(false);
    const [locEditTab, setLocEditTab] = useState('info'); // 'info', 'description', 'visual', 'image'
    const [generatingLocImage, setGeneratingLocImage] = useState(false);

    // Beat Editor State
    const [editingBeat, setEditingBeat] = useState(null); // { ...beat, index }
    const [beatBgPrompt, setBeatBgPrompt] = useState('');
    const [generatingBeatBg, setGeneratingBeatBg] = useState(false);
    const [beatEditTab, setBeatEditTab] = useState('info'); // 'info', 'description', 'visual', 'image'
    const [generatingBeatImage, setGeneratingBeatImage] = useState(false);

    // Chapter Analysis State
    const [analyzingAllChapters, setAnalyzingAllChapters] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });

    // Toast State
    const [toast, setToast] = useState({ message: '', type: 'success', visible: false });

    // Export State
    const [exportingEpub, setExportingEpub] = useState(false);
    const [exportingDocx, setExportingDocx] = useState(false);
    const [exportAuthor, setExportAuthor] = useState('');
    const [exportPublisher, setExportPublisher] = useState('StoryForge');
    const [exportIncludeImages, setExportIncludeImages] = useState(false);

    // Log Tab State
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [publishability, setPublishability] = useState(null);
    const [loadingPublishability, setLoadingPublishability] = useState(false);
    const [publishabilityError, setPublishabilityError] = useState('');
    const prevSceneSavedCountRef = useRef(0);

    const showToast = (message, type = 'success') => {
        setToast({ message, type, visible: true });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
    };

    const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/logs/${id}`);
            const newLogs = res.data.logs || [];
            setLogs(newLogs);
            // If new scene_saved events appeared, refresh scenes list
            const newCount = newLogs.filter(l => l.event === 'scene_saved').length;
            if (newCount > prevSceneSavedCountRef.current) {
                prevSceneSavedCountRef.current = newCount;
                fetchScenes();
            }
        } catch (e) {
            // silently ignore
        } finally {
            setLoadingLogs(false);
        }
    };

    const fetchScenes = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/scenes/project/${id}`);
            setScenes(res.data);
        } catch (e) {
            // silently ignore
        }
    };

    const fetchPublishability = async () => {
        setLoadingPublishability(true);
        setPublishabilityError('');
        try {
            const res = await axios.get(buildApiUrl(`/projects/${id}/publishability`));
            setPublishability(res.data);
        } catch {
            setPublishabilityError('Publishability check is not available right now. Please try again in a moment.');
        } finally {
            setLoadingPublishability(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Poll for updates if project is not ready
        let interval;
        if (project && project.status !== 'ready') {
            interval = setInterval(fetchData, 5000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [id, project?.status]);

    useEffect(() => {
        const providerToLoad = editableAiProvider || aiSettings?.resolved?.provider || aiSettings?.defaults?.provider;
        if (!providerToLoad) return;

        loadAiModels(providerToLoad);
    }, [editableAiProvider, aiSettings?.resolved?.provider, aiSettings?.defaults?.provider]);

    // Initialize params when opening a scene
    useEffect(() => {
        if (selectedScene && bible) {
            const beat = bible.beats.find(b => b.id === selectedScene.beatId);
            const currentParams = selectedScene.currentParams || {};

            setGenParams({
                beatTitle: currentParams.beat?.title || beat?.title || '',
                beatDescription: currentParams.beat?.description || beat?.description || '',
                instructions: currentParams.instructions || selectedScene.instructions || ''
            });
            setEditorTab('content'); // Reset tab
        }
    }, [selectedScene, bible]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const projRes = await axios.get(`${API_BASE_URL}/projects/${id}`);
            const projectData = projRes.data;
            const shouldFetchBible = PROJECT_STATUSES_WITH_BIBLE.has(projectData.status);

            const [bibleRes, scenesRes, stylesRes, narrRes, aiSettingsRes] = await Promise.all([
                shouldFetchBible
                    ? axios.get(`${API_BASE_URL}/generate/bible/${id}`).catch(() => ({ data: null }))
                    : Promise.resolve({ data: null }),
                axios.get(`${API_BASE_URL}/scenes/project/${id}`).catch(() => ({ data: [] })),
                axios.get(`${API_BASE_URL}/styles`).catch(() => ({ data: [] })),
                axios.get(`${API_BASE_URL}/narrative-styles`).catch(() => ({ data: [] })),
                axios.get(`${API_BASE_URL}/generate/text-settings/${id}`).catch(() => ({ data: null }))
            ]);
            setProject(projectData);
            setEditableName(projectData.name);
            setEditableStyle(projectData.style);
            setEditableCustomStyle(projectData.customStyle || '');
            setEditableAiProvider(projectData.aiProvider || '');
            setEditableAiModel(projectData.aiModel || '');
            setBible(bibleRes.data);
            setScenes(scenesRes.data);
            setAvailableStyles(stylesRes.data);
            setNarrativeStyles(narrRes.data);

            if (aiSettingsRes.data) {
                setAiSettings(aiSettingsRes.data);
                setAvailableAiProviders(aiSettingsRes.data.providers || []);
            } else {
                setAiSettings(null);
                setAvailableAiProviders([]);
            }

            fetchPublishability();
        } catch (error) {
            console.error("Failed to load project data", error);
        } finally {
            setLoading(false);
        }
    };

    const loadAiModels = async (provider) => {
        setLoadingAiModels(true);
        setAiModelError('');
        try {
            const res = await axios.get(`${API_BASE_URL}/generate/providers/${provider}/models`);
            setAvailableAiModels(res.data.models || []);
        } catch (error) {
            console.error('Failed to load AI models', error);
            setAvailableAiModels([]);
            setAiModelError(error.response?.data?.error || 'Failed to load models for this provider');
        } finally {
            setLoadingAiModels(false);
        }
    };

    const handleGenerateBible = async () => {
        if (!project) return;
        setGenerating(true);
        try {
            await axios.post(`${API_BASE_URL}/generate/bible/${id}`);
            fetchData();
            showToast('Bible Generated Successfully!');
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.error || error.message;
            showToast(`Failed to generate bible: ${errorMsg}`, 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleGenerateScene = async (beatId, params = null) => {
        setGenId(beatId);
        try {
            console.log('[FRONTEND] Generating scene for beatId:', beatId, 'type:', typeof beatId);
            const payload = { projectId: id, beatId };
            if (params) {
                console.log('[FRONTEND] Using custom params:', params);
                payload.params = params;
            }

            const res = await axios.post(`${API_BASE_URL}/scenes/generate`, payload);
            const newScene = res.data;
            console.log('[FRONTEND] Scene generated successfully:', newScene.beatId);

            setScenes(prev => {
                const filtered = prev.filter(s => s.beatId !== beatId);
                return [...filtered, newScene].sort((a, b) => a.beatId - b.beatId);
            });

            if (selectedScene && selectedScene.beatId === beatId) {
                setSelectedScene(newScene);
                setEditorTab('content');
            }
        } catch (error) {
            console.error('[FRONTEND] Error generating scene:', error);
            console.error('[FRONTEND] Error details:', error.response?.data);
            showToast(error.response?.data?.error || "Failed to generate scene", 'error');
        } finally {
            setGenId(null);
        }
    };

    const handleRegenerateClick = () => {
        if (!selectedScene) return;
        const params = {
            beat: {
                id: selectedScene.beatId,
                title: genParams.beatTitle,
                description: genParams.beatDescription
            },
            instructions: genParams.instructions,
            characters: bible.characters,
            setting: bible.settings
        };
        handleGenerateScene(selectedScene.beatId, params);
    };

    const handleRestoreVersion = async (version) => {
        if (!confirm("Are you sure you want to restore this version?")) return;
        try {
            const res = await axios.put(`${API_BASE_URL}/scenes/${selectedScene._id}`, {
                content: version.content
            });
            setScenes(prev => prev.map(s => s._id === selectedScene._id ? res.data : s));
            setSelectedScene(res.data);
            setEditorTab('content');
        } catch (e) {
            console.error(e);
            showToast("Failed to restore version", 'error');
        }
    };

    const handleGenerateCharBackground = async () => {
        if (!editingCharacter) return;
        setGeneratingBg(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/generate/character-background`, {
                projectId: id,
                character: editingCharacter,
                userPrompt: charBgPrompt
            });
            setEditingCharacter(prev => ({
                ...prev,
                description: res.data.background,
                visualDescription: res.data.visualDescription
            }));
            setCharBgPrompt('');
        } catch (error) {
            console.error(error);
            showToast("Failed to generate background", 'error');
        } finally {
            setGeneratingBg(false);
        }
    };

    const handleGenerateImage = async () => {
        if (!editingCharacter?.visualDescription) {
            showToast("Visual description is required", 'error');
            return;
        }
        setGeneratingImage(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/generate/character-image`, {
                prompt: `Character Concept Art: ${editingCharacter.visualDescription}`,
                projectId: id
            });
            setEditingCharacter(prev => ({ ...prev, imageUrl: res.data.imageUrl }));
            setCharEditTab('image');
        } catch (error) {
            console.error(error);
            showToast("Failed to generate image", 'error');
        } finally {
            setGeneratingImage(false);
        }
    };

    const handleSaveCharacter = async () => {
        if (!editingCharacter) return;
        try {
            const res = await axios.put(`${API_BASE_URL}/generate/bible/${id}/character/${editingCharacter.index}`, editingCharacter);
            setBible(res.data);
            setEditingCharacter(null);
            showToast("Character saved successfully");
        } catch (error) {
            console.error(error);
            showToast("Failed to save character", 'error');
        }
    };

    const handleGenerateLocBackground = async () => {
        if (!editingLocation) return;
        setGeneratingLocBg(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/generate/location-background`, {
                projectId: id,
                location: editingLocation,
                userPrompt: locBgPrompt
            });
            setEditingLocation(prev => ({
                ...prev,
                description: res.data.description,
                visualDescription: res.data.visualDescription
            }));
            setLocBgPrompt('');
        } catch (error) {
            console.error(error);
            showToast("Failed to generate background", 'error');
        } finally {
            setGeneratingLocBg(false);
        }
    };

    const handleGenerateLocImage = async () => {
        if (!editingLocation?.visualDescription) {
            showToast("Visual description is required", 'error');
            return;
        }
        setGeneratingLocImage(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/generate/location-image`, {
                prompt: `Environment Concept Art: ${editingLocation.visualDescription}`,
                projectId: id
            });
            setEditingLocation(prev => ({ ...prev, imageUrl: res.data.imageUrl }));
            setLocEditTab('image');
        } catch (error) {
            console.error(error);
            showToast("Failed to generate image", 'error');
        } finally {
            setGeneratingLocImage(false);
        }
    };

    const handleSaveLocation = async () => {
        if (!editingLocation) return;
        try {
            const res = await axios.put(`${API_BASE_URL}/generate/bible/${id}/location/${editingLocation.index}`, editingLocation);
            setBible(res.data);
            setEditingLocation(null);
            showToast("Location saved successfully");
        } catch (error) {
            console.error(error);
            showToast("Failed to save location", 'error');
        }
    };

    const handleGenerateBeatDetails = async () => {
        if (!editingBeat) return;
        setGeneratingBeatBg(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/generate/beat-details`, {
                projectId: id,
                beat: editingBeat,
                userPrompt: beatBgPrompt
            });
            setEditingBeat(prev => ({
                ...prev,
                description: res.data.description,
                visualDescription: res.data.visualDescription
            }));
            setBeatBgPrompt('');
        } catch (error) {
            console.error(error);
            showToast("Failed to generate beat details", 'error');
        } finally {
            setGeneratingBeatBg(false);
        }
    };

    const handleGenerateBeatImage = async () => {
        if (!editingBeat?.visualDescription) {
            showToast("Visual description is required", 'error');
            return;
        }
        setGeneratingBeatImage(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/generate/beat-image`, {
                prompt: `Cinematic Shot: ${editingBeat.visualDescription}`,
                projectId: id
            });
            setEditingBeat(prev => ({ ...prev, imageUrl: res.data.imageUrl }));
            setBeatEditTab('image');
        } catch (error) {
            console.error(error);
            showToast("Failed to generate image", 'error');
        } finally {
            setGeneratingBeatImage(false);
        }
    };

    const handleSaveBeat = async () => {
        if (!editingBeat) return;
        try {
            const res = await axios.put(`${API_BASE_URL}/generate/bible/${id}/beat/${editingBeat.index}`, editingBeat);
            setBible(res.data);
            setEditingBeat(null);
            showToast("Beat saved successfully");
        } catch (error) {
            console.error(error);
            showToast("Failed to save beat", 'error');
        }
    };

    const handleUpdateImageStyle = async (imageStyleId) => {
        setIsUpdatingStyle(true);
        try {
            const res = await axios.put(`${API_BASE_URL}/projects/${id}`, { imageStyle: imageStyleId });
            setProject(res.data);
            showToast("Project Image Style updated!");
        } catch (error) {
            console.error(error);
            showToast("Failed to update image style", 'error');
        } finally {
            setIsUpdatingStyle(false);
        }
    };

    const handleGenerateCover = async () => {
        setGeneratingCover(true);
        try {
            const authorPart = coverAuthor.trim() ? ` By author "${coverAuthor.trim()}".` : '';
            const fullPrompt = `A book cover for a ${project.style} story titled "${project.name}".${authorPart} ${coverPrompt || bible?.summary || ""}. Atmospheric, high quality. Aspect Ratio: 9:16.`;
            const res = await axios.post(`${API_BASE_URL}/generate/character-image`, {
                prompt: fullPrompt,
                projectId: id
            });
            const updatedProject = { ...project, coverImageUrl: res.data.imageUrl };
            await axios.put(`${API_BASE_URL}/projects/${id}`, { coverImageUrl: res.data.imageUrl });
            setProject(updatedProject);
            showToast("Cover generated successfully!");
        } catch (error) {
            console.error(error);
            showToast("Failed to generate cover", 'error');
        } finally {
            setGeneratingCover(false);
        }
    };

    const handleAnalyzeAllChapters = async () => {
        if (!bible?.chapters || bible.chapters.length === 0) {
            showToast('Nenhum capítulo encontrado para analisar', 'error');
            return;
        }

        const totalChapters = bible.chapters.length;
        if (!confirm(`Deseja gerar análise editorial para todos os ${totalChapters} capítulos? Isso pode levar vários minutos.`)) {
            return;
        }

        setAnalyzingAllChapters(true);
        setAnalysisProgress({ current: 0, total: totalChapters });

        try {
            const res = await axios.post(`${API_BASE_URL}/projects/${id}/analyze-all-chapters`);
            
            showToast(`✓ Análises concluídas: ${res.data.successCount}/${totalChapters} capítulos`, 'success');
            
            // Reload data to show updated analyses
            await fetchData();
            
            if (res.data.errorCount > 0) {
                console.warn('Some chapters failed to analyze:', res.data.results.filter(r => !r.success));
            }
        } catch (error) {
            console.error('Error analyzing chapters:', error);
            showToast('Erro ao analisar capítulos: ' + (error.response?.data?.error || error.message), 'error');
        } finally {
            setAnalyzingAllChapters(false);
            setAnalysisProgress({ current: 0, total: 0 });
        }
    };

    const handleSaveProjectDetails = async () => {
        setIsSavingProject(true);
        try {
            await axios.put(`${API_BASE_URL}/projects/${id}`, {
                name: editableName,
                style: editableStyle,
                customStyle: editableCustomStyle,
                aiProvider: editableAiProvider,
                aiModel: editableAiModel
            });
            await fetchData();
            showToast("Project details updated!");
        } catch (error) {
            console.error(error);
            showToast("Failed to save project details", "error");
        } finally {
            setIsSavingProject(false);
        }
    };

    const handleExportPDF = () => {
        window.open(buildApiUrl(`/projects/${id}/export-pdf`), '_blank');
    };

    const handleExportEpub = async () => {
        if (!exportAuthor.trim()) {
            showToast('Por favor, insira o nome do autor', 'error');
            return;
        }

        setExportingEpub(true);
        try {
            const response = await axios.post(
                `${API_BASE_URL}/export/epub/${id}`,
                {
                    author: exportAuthor,
                    publisher: exportPublisher,
                    includeImages: exportIncludeImages,
                    includeCoverPage: true
                },
                {
                    responseType: 'blob'
                }
            );

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${project.name.replace(/\s+/g, '_')}.epub`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            showToast('EPUB gerado com sucesso!');
        } catch (error) {
            console.error('Error exporting EPUB:', error);
            showToast('Falha ao gerar EPUB: ' + (error.response?.data?.message || error.message), 'error');
        } finally {
            setExportingEpub(false);
        }
    };

    const handleExportDocx = async () => {
        if (!exportAuthor.trim()) {
            showToast('Por favor, insira o nome do autor', 'error');
            return;
        }

        setExportingDocx(true);
        try {
            const response = await axios.post(
                `${API_BASE_URL}/export/docx/${id}`,
                {
                    author: exportAuthor,
                    includeCoverPage: true,
                    fontSize: 24,
                    fontFamily: 'Times New Roman'
                },
                {
                    responseType: 'blob'
                }
            );

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${project.name.replace(/\s+/g, '_')}.docx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            showToast('DOCX gerado com sucesso!');
        } catch (error) {
            console.error('Error exporting DOCX:', error);
            showToast('Falha ao gerar DOCX: ' + (error.response?.data?.message || error.message), 'error');
        } finally {
            setExportingDocx(false);
        }
    };

    const getSceneForBeat = (beatId) => scenes.find(s => s.beatId === beatId);

    if (!project) return <div className="p-8 text-center text-white">Loading...</div>;

    return (
        <div className="p-8 h-full flex flex-col">
            <header className="mb-8 flex justify-between items-center border-b border-gray-700 pb-4">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        {project.name}
                    </h2>
                    <div className="text-gray-400 flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-2">
                            <span>Target Style:</span>
                            <span className="text-white bg-gray-700 px-2 py-0.5 rounded text-sm font-medium">{project.style}</span>
                            {narrativeStyles.find(s => s.name === project.style) && (
                                <div className="group relative">
                                    <AlertCircle size={14} className="text-gray-500 cursor-help" />
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 border border-gray-700 rounded shadow-xl text-[10px] text-gray-400 z-[100] italic leading-tight">
                                        <span className="text-green-400 font-bold block mb-1 uppercase">Narrative Prompt:</span>
                                        "{narrativeStyles.find(s => s.name === project.style).instruction}"
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                            <span className="flex items-center gap-1"><Sparkles size={14} className="text-purple-400" /> Image Style:</span>
                            <select
                                value={project.imageStyle || ''}
                                onChange={(e) => handleUpdateImageStyle(e.target.value)}
                                disabled={isUpdatingStyle}
                                className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm text-white focus:ring-1 focus:ring-purple-500 outline-none"
                            >
                                <option value="">None (Default)</option>
                                {availableStyles.map(style => (
                                    <option key={style._id} value={style._id}>{style.name}</option>
                                ))}
                            </select>
                            {project.imageStyle && availableStyles.find(s => s._id === project.imageStyle) && (
                                <div className="group relative">
                                    <AlertCircle size={14} className="text-gray-500 cursor-help" />
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 border border-gray-700 rounded shadow-xl text-[10px] text-gray-400 z-[100] italic leading-tight">
                                        <span className="text-purple-400 font-bold block mb-1 uppercase">Style Prompt:</span>
                                        "{availableStyles.find(s => s._id === project.imageStyle).prompt}"
                                    </div>
                                </div>
                            )}
                            {isUpdatingStyle && <Loader2 className="animate-spin text-purple-400" size={14} />}
                        </div>

                        {aiSettings?.resolved && (
                            <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                                <span className="flex items-center gap-1"><Settings size={14} className="text-cyan-400" /> Text AI:</span>
                                <span className="text-white bg-gray-700 px-2 py-0.5 rounded text-sm font-medium">
                                    {aiSettings.resolved.provider} / {aiSettings.resolved.model || 'provider default'}
                                </span>
                                <span className="text-[10px] uppercase tracking-widest text-gray-500">
                                    {aiSettings.resolved.inherited ? 'global default' : 'project override'}
                                </span>
                            </div>
                        )}

                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold shadow-sm ${project.status === 'ready' ? 'bg-green-600 text-white' :
                            project.status === 'new' ? 'bg-gray-600 text-gray-200' :
                                'bg-blue-600 text-white animate-pulse'
                            }`}>
                            {project.status.replace('_', ' ').toUpperCase()}
                        </span>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!bible && (
                        <button
                            onClick={handleGenerateBible}
                            disabled={generating}
                            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {generating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                            {generating ? 'Analyzing & Adapting...' : 'Generate Story Bible'}
                        </button>
                    )}
                    <button
                        onClick={handleExportPDF}
                        className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition"
                    >
                        <BookOpen size={18} /> Export PDF
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-hidden flex flex-col">
                {/* Tab Navigation */}
                <div className="flex flex-wrap gap-1 bg-gray-900 p-1 rounded-xl mb-6 self-start border border-gray-700">
                    <button
                        onClick={() => setActiveTab('cover')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'cover' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Layout size={16} /> Cover
                    </button>
                    <button
                        onClick={() => setActiveTab('style')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'style' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Edit3 size={16} /> Custom Style
                    </button>
                    <button
                        onClick={() => setActiveTab('ai')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'ai' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Settings size={16} /> AI Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('characters')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'characters' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <List size={16} /> Characters
                    </button>
                    <button
                        onClick={() => setActiveTab('locations')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'locations' ? 'bg-yellow-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <MapPin size={16} /> Locations
                    </button>
                    <Link
                        to={`/project/${id}/structure`}
                        className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition text-gray-400 hover:text-white hover:bg-gray-700/50"
                    >
                        <Network size={16} /> Structure
                    </Link>
                    <button
                        onClick={() => setActiveTab('chapters')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'chapters' ? 'bg-teal-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <BookOpen size={16} /> Chapters
                    </button>
                    <button
                        onClick={() => setActiveTab('beats')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'beats' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Activity size={16} /> Narrative Structure
                    </button>
                    <button
                        onClick={() => setActiveTab('board')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'board' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Layout size={16} /> Scene Board
                    </button>
                    <button
                        onClick={() => setActiveTab('hybrid')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'hybrid' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Image size={16} /> Hybrid
                    </button>
                    <button
                        onClick={() => setActiveTab('export')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'export' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Download size={16} /> Exportar
                    </button>
                    <button
                        onClick={() => setActiveTab('bookBrief')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'bookBrief' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <BookOpen size={16} /> Book Brief
                    </button>
                    <button
                        onClick={() => setActiveTab('storyRoom')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'storyRoom' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Sparkles size={16} /> Story Room
                    </button>
                    <button
                        onClick={() => setActiveTab('publishability')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'publishability' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <FileSearch size={16} /> Readiness
                    </button>
                    <button
                        onClick={() => setActiveTab('quality')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'quality' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <CheckCircle size={16} /> Quality
                    </button>
                    <button
                        onClick={() => setActiveTab('publishing')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'publishing' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Download size={16} /> Publishing
                    </button>
                    <button
                        onClick={() => setActiveTab('log')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'log' ? 'bg-slate-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Terminal size={16} /> Log
                        {project?.status !== 'ready' && project?.status !== 'new' && (
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        )}
                    </button>
                </div>

                <div className="flex-1 overflow-hidden bg-gray-800 rounded-xl border border-gray-700 flex flex-col">
                    {!bible && activeTab !== 'board' && activeTab !== 'log' && activeTab !== 'publishability' && activeTab !== 'bookBrief' && activeTab !== 'storyRoom' && activeTab !== 'quality' && activeTab !== 'publishing' ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                            <Book size={48} className="mb-4 opacity-20" />
                            <p>No bible generated yet. Generate a Story Bible to see details.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-auto p-0">
                            {activeTab === 'style' && (
                                <div className="p-8 max-w-5xl mx-auto">
                                    <div className="mb-6">
                                        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                                            <Edit3 size={28} className="text-purple-400" />
                                            Project Custom Style
                                        </h2>
                                        <p className="text-gray-400">
                                            Add project-specific style instructions that will augment the base narrative style (<span className="text-purple-300 font-semibold">{project.style}</span>) in all scene generations.
                                        </p>
                                    </div>

                                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl space-y-4">
                                        <div>
                                            <label className="text-sm font-semibold text-gray-300 mb-3 block">
                                                Custom Instructions
                                            </label>
                                            <textarea
                                                value={editableCustomStyle}
                                                onChange={(e) => setEditableCustomStyle(e.target.value)}
                                                placeholder="Enter any project-specific style guidelines, tone preferences, narrative techniques, or special instructions that should be applied to scene generation.&#10;&#10;Example:&#10;- Use sparse, minimalist prose&#10;- Focus heavily on sensory details of cold and isolation&#10;- All dialogue should be terse and indirect&#10;- Avoid flowery metaphors"
                                                rows={20}
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-4 text-white focus:ring-2 focus:ring-purple-500 outline-none transition resize-none font-mono text-sm leading-relaxed"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                                            <div className="text-xs text-gray-500">
                                                {editableCustomStyle.length > 0 ? (
                                                    <span className="text-purple-400 font-semibold">{editableCustomStyle.length} characters</span>
                                                ) : (
                                                    <span>No custom style defined</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={handleSaveProjectDetails}
                                                disabled={isSavingProject}
                                                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center gap-2 transition shadow-lg shadow-purple-900/30 disabled:opacity-50"
                                            >
                                                {isSavingProject ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                                Save Custom Style
                                            </button>
                                        </div>

                                        <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 mt-4">
                                            <h4 className="text-blue-200 font-semibold mb-2 text-sm">💡 How it works</h4>
                                            <p className="text-xs text-blue-300/80 leading-relaxed">
                                                These instructions will be added to every scene generation prompt under a "PROJECT CUSTOM STYLE" section, 
                                                allowing you to fine-tune the AI's output beyond the base narrative style template.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'ai' && (
                                <div className="p-8 max-w-5xl mx-auto">
                                    <div className="mb-6">
                                        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                                            <Settings size={28} className="text-cyan-400" />
                                            Text AI Settings
                                        </h2>
                                        <p className="text-gray-400">
                                            Configure which provider writes the story text. Image generation remains on the Gemini image pipeline in this release.
                                        </p>
                                    </div>

                                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl space-y-6">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-gray-300 block">Provider Override</label>
                                                <select
                                                    value={editableAiProvider}
                                                    onChange={(e) => {
                                                        setEditableAiProvider(e.target.value);
                                                        setEditableAiModel('');
                                                    }}
                                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition"
                                                >
                                                    <option value="">Use global default ({aiSettings?.defaults?.provider || 'gemini'})</option>
                                                    {availableAiProviders.map(provider => (
                                                        <option key={provider.id} value={provider.id}>
                                                            {provider.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-gray-500 leading-relaxed">
                                                    Leave this empty to inherit the global backend configuration. Use LM Studio when you want local text generation via its OpenAI-compatible server.
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-gray-300 block">Model Override</label>
                                                <div className="relative">
                                                    <select
                                                        value={editableAiModel}
                                                        onChange={(e) => setEditableAiModel(e.target.value)}
                                                        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition disabled:opacity-60"
                                                        disabled={loadingAiModels}
                                                    >
                                                        <option value="">
                                                            Use provider default ({aiSettings?.resolved?.model || aiSettings?.defaults?.model || 'auto'})
                                                        </option>
                                                        {availableAiModels.map(model => (
                                                            <option key={model.id} value={model.id}>{model.label}</option>
                                                        ))}
                                                    </select>
                                                    {loadingAiModels && <Loader2 className="absolute right-3 top-3.5 animate-spin text-cyan-400" size={16} />}
                                                </div>
                                                <p className="text-xs text-gray-500 leading-relaxed">
                                                    The list is loaded from the selected provider. For LM Studio, make sure the local server is running and the model is loaded.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-3 gap-4">
                                            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                                                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Effective Provider</div>
                                                <div className="text-white font-semibold">{aiSettings?.resolved?.provider || 'gemini'}</div>
                                            </div>
                                            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                                                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Effective Model</div>
                                                <div className="text-white font-semibold break-all">{aiSettings?.resolved?.model || 'provider default'}</div>
                                            </div>
                                            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                                                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Source</div>
                                                <div className="text-white font-semibold">{aiSettings?.resolved?.inherited ? 'Global default' : 'Project override'}</div>
                                            </div>
                                        </div>

                                        {aiModelError && (
                                            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 text-sm text-red-200">
                                                {aiModelError}
                                            </div>
                                        )}

                                        <div className="bg-cyan-900/20 border border-cyan-800/40 rounded-lg p-4 text-sm text-cyan-100 leading-relaxed">
                                            Text generation uses the provider selected here for bible creation, scene writing, summaries, beat enrichment and chapter analysis. Cover and image generation still use the existing Gemini image workflow.
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                                            <div className="text-xs text-gray-500">
                                                Default backend provider: <span className="text-cyan-300 font-semibold">{aiSettings?.defaults?.provider || 'gemini'}</span>
                                            </div>
                                            <button
                                                onClick={handleSaveProjectDetails}
                                                disabled={isSavingProject}
                                                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold flex items-center gap-2 transition shadow-lg shadow-cyan-900/30 disabled:opacity-50"
                                            >
                                                {isSavingProject ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                                Save AI Settings
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'cover' && (
                                <div className="p-8 flex flex-col md:flex-row gap-8 items-start justify-center">
                                    <div className="w-full max-w-sm aspect-[9/16] bg-gray-900 rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center overflow-hidden relative group shadow-2xl">
                                        {project.coverImageUrl ? (
                                            <>
                                                <img
                                                    src={buildBackendUrl(project.coverImageUrl)}
                                                    alt="Book Cover"
                                                    className="w-full h-full object-contain bg-gray-950"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                    <span className="text-white text-sm font-bold bg-black/60 px-3 py-1.5 rounded-full border border-white/20">Preview Mode</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center p-8">
                                                <Layout size={48} className="mx-auto text-gray-700 mb-4" />
                                                <p className="text-gray-500">No cover image generated yet.</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 max-w-lg space-y-6 bg-gray-900 border border-gray-700 p-8 rounded-2xl shadow-xl">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1 block">Title</label>
                                                <input
                                                    type="text"
                                                    value={editableName}
                                                    onChange={(e) => setEditableName(e.target.value)}
                                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition text-xl font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1 block">Style</label>
                                                <input
                                                    type="text"
                                                    value={editableStyle}
                                                    onChange={(e) => setEditableStyle(e.target.value)}
                                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition italic"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1 block">Author Name</label>
                                                <input
                                                    type="text"
                                                    value={coverAuthor}
                                                    onChange={(e) => setCoverAuthor(e.target.value)}
                                                    placeholder="e.g. João Silva"
                                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                                />
                                            </div>
                                            <button
                                                onClick={handleSaveProjectDetails}
                                                disabled={isSavingProject}
                                                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition border border-gray-600"
                                            >
                                                {isSavingProject ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                                Save Basic Details
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm font-semibold text-gray-300">Custom Cover Instructions</label>
                                                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Optional</span>
                                            </div>
                                            <textarea
                                                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none h-40 text-sm leading-relaxed"
                                                placeholder="Describe exactly what you want on the cover... e.g., 'A dramatic sunset over a floating city with steampunk airships in the foreground.'"
                                                value={coverPrompt}
                                                onChange={(e) => setCoverPrompt(e.target.value)}
                                            />
                                        </div>

                                        <div className="pt-2">
                                            <button
                                                onClick={handleGenerateCover}
                                                disabled={generatingCover}
                                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition transform active:scale-95 shadow-lg shadow-indigo-900/40 disabled:opacity-50 disabled:active:scale-100"
                                            >
                                                {generatingCover ? (
                                                    <>
                                                        <Loader2 className="animate-spin" size={20} />
                                                        Creating Masterpiece...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles size={20} />
                                                        {project.coverImageUrl ? 'Regenerate Cover' : 'Generate Book Cover'}
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        <p className="text-center text-[11px] text-gray-500 italic">
                                            All generated covers will respect the project's target style and chosen language.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'characters' && (
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4 font-bold">Name</th>
                                            <th className="px-6 py-4 font-bold">Role</th>
                                            <th className="px-6 py-4 font-bold">Description</th>
                                            <th className="px-6 py-4 font-bold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {bible?.characters.map((char, i) => (
                                            <tr key={i} className="hover:bg-gray-700/30 transition">
                                                <td className="px-6 py-4 font-bold text-gray-200">{char.name}</td>
                                                <td className="px-6 py-4"><span className="px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded text-xs">{char.role}</span></td>
                                                <td className="px-6 py-4 text-gray-400 text-sm">{char.description}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => setEditingCharacter({ ...char, index: i })}
                                                        className="inline-flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded transition"
                                                    >
                                                        <Edit3 size={14} /> Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {activeTab === 'locations' && (
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4 font-bold">Name</th>
                                            <th className="px-6 py-4 font-bold">Description</th>
                                            <th className="px-6 py-4 font-bold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {bible?.settings.map((loc, i) => (
                                            <tr key={i} className="hover:bg-gray-700/30 transition">
                                                <td className="px-6 py-4 font-bold text-gray-200">{loc.name}</td>
                                                <td className="px-6 py-4 text-gray-400 text-sm">{loc.description}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => setEditingLocation({ ...loc, index: i })}
                                                        className="inline-flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded transition"
                                                    >
                                                        <Edit3 size={14} /> Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {activeTab === 'chapters' && (
                                <div className="p-8">
                                    <div className="mb-6 flex items-center justify-between">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-2">Chapter Structure</h2>
                                            <p className="text-gray-400">Overview of the book's chapter organization and narrative flow.</p>
                                        </div>
                                        {bible?.chapters && bible.chapters.length > 0 && (
                                            <button
                                                onClick={handleAnalyzeAllChapters}
                                                disabled={analyzingAllChapters}
                                                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg"
                                            >
                                                {analyzingAllChapters ? (
                                                    <>
                                                        <Loader2 size={20} className="animate-spin" />
                                                        Analisando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <FileSearch size={20} />
                                                        Analisar Todos os Capítulos
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    
                                    {bible?.chapters && bible.chapters.length > 0 ? (
                                        <div className="space-y-4">
                                            {bible.chapters.map((chapter, idx) => (
                                                <div key={idx} className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 hover:border-teal-500/50 transition">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                                                {chapter.chapterNumber}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-3">
                                                                    <h3 className="text-xl font-bold text-white">{chapter.title || `Chapter ${chapter.chapterNumber}`}</h3>
                                                                    {chapter.analysis && (
                                                                        <span className="flex items-center gap-1 px-2 py-1 bg-emerald-900/30 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-700/50">
                                                                            <CheckCircle size={12} />
                                                                            Analisado
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {chapter.type && (
                                                                    <span className="inline-block mt-1 px-3 py-1 bg-teal-900/50 text-teal-300 text-xs font-bold rounded-full border border-teal-700">
                                                                        {chapter.type}
                                                                    </span>
                                                                )}
                                                                {chapter.analysisDate && (
                                                                    <p className="text-xs text-gray-500 mt-1">
                                                                        Análise gerada em {new Date(chapter.analysisDate).toLocaleDateString('pt-BR')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {chapter.userDescription && (
                                                        <div className="mb-3">
                                                            <p className="text-sm text-gray-400 leading-relaxed">{chapter.userDescription}</p>
                                                        </div>
                                                    )}
                                                    
                                                    {chapter.aiSummary && (
                                                        <div className="mb-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                                            <p className="text-sm text-gray-300 leading-relaxed italic">{chapter.aiSummary}</p>
                                                        </div>
                                                    )}
                                                    
                                                    {chapter.beats && chapter.beats.length > 0 && (
                                                        <div className="mt-4 pt-4 border-t border-gray-700">
                                                            <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Beats in this Chapter</h4>
                                                            <div className="space-y-2">
                                                                {chapter.beats.map((beat, beatIdx) => (
                                                                    <div key={beatIdx} className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition">
                                                                        <span className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-300">
                                                                            {beat.id}
                                                                        </span>
                                                                        <div className="flex-1">
                                                                            <p className="text-sm font-semibold text-white">{beat.title}</p>
                                                                            {beat.description && (
                                                                                <p className="text-xs text-gray-500 mt-1">{beat.description}</p>
                                                                            )}
                                                                        </div>
                                                                        {beat.type && (
                                                                            <span className="flex-shrink-0 px-2 py-1 bg-purple-900/30 text-purple-300 text-xs rounded border border-purple-700/50">
                                                                                {beat.type}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-gray-500">
                                            <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                                            <p>No chapter structure defined.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'beats' && (
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4 font-bold w-16 text-center">#</th>
                                            <th className="px-6 py-4 font-bold">Title</th>
                                            <th className="px-6 py-4 font-bold">Description</th>
                                            <th className="px-6 py-4 font-bold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {bible?.beats.map((beat, i) => {
                                            const beatScene = getSceneForBeat(beat.id);
                                            return (
                                            <tr key={i} className="hover:bg-gray-700/30 transition">
                                                <td className="px-6 py-4 text-center font-mono text-gray-500">{beat.id}</td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-200">{beat.title}</div>
                                                    {beatScene?.wordCount > 0 && (
                                                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">{beatScene.wordCount.toLocaleString()} palavras</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-gray-400 text-sm leading-relaxed">{beat.description}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => setEditingBeat({ ...beat, index: i })}
                                                        className="inline-flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded transition"
                                                    >
                                                        <Edit3 size={14} /> Edit
                                                    </button>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}

                            {activeTab === 'board' && (
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4 font-bold w-16 text-center">Beat</th>
                                            <th className="px-6 py-4 font-bold">Scene Title</th>
                                            <th className="px-6 py-4 font-bold">Status</th>
                                            <th className="px-6 py-4 font-bold text-right pr-12">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {bible?.beats.map((beat, i) => {
                                            const scene = getSceneForBeat(beat.id);
                                            return (
                                                <tr key={i} className="hover:bg-gray-700/30 transition">
                                                    <td className="px-6 py-4 text-center font-mono text-gray-500">{beat.id}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-gray-200">{beat.title}</div>
                                                        <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{beat.description}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {scene ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${scene.status === 'final' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                                                                    {scene.status.toUpperCase()}
                                                                </span>
                                                                {scene.wordCount > 0 && (
                                                                    <span className="text-[10px] text-gray-500 font-mono">{scene.wordCount.toLocaleString()} palavras</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-600 text-[10px] font-bold uppercase tracking-tighter">Not Generated</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right pr-6">
                                                        {scene ? (
                                                            <button
                                                                onClick={() => setSelectedScene(scene)}
                                                                className="inline-flex items-center gap-2 px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-lg transition"
                                                            >
                                                                <BookOpen size={14} /> Read & Edit
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleGenerateScene(beat.id)}
                                                                disabled={genId === beat.id}
                                                                className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                                                            >
                                                                {genId === beat.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                                                Generate
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {!bible?.beats && (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-12 text-center text-gray-500 italic">
                                                    Analyze project to generate beats first.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}

                            {activeTab === 'hybrid' && (
                                <HybridEditor projectId={id} showToast={showToast} />
                            )}

                            {activeTab === 'publishability' && (
                                <PublishabilityPanel
                                    data={publishability}
                                    loading={loadingPublishability}
                                    error={publishabilityError}
                                    onRefresh={fetchPublishability}
                                />
                            )}

                            {activeTab === 'bookBrief' && (
                                <BookBriefPanel projectId={id} />
                            )}

                            {activeTab === 'storyRoom' && (
                                <StoryRoomPanel projectId={id} />
                            )}

                            {activeTab === 'quality' && (
                                <QualityReportPanel projectId={id} />
                            )}

                            {activeTab === 'publishing' && (
                                <PublishingPackagePanel projectId={id} />
                            )}

                            {activeTab === 'export' && (
                                <div className="p-8 max-w-4xl mx-auto">
                                    <div className="mb-8">
                                        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                                            <Download size={32} className="text-emerald-400" />
                                            Exportar Livro
                                        </h2>
                                        <p className="text-gray-400">
                                            Exporte seu livro para o formato EPUB, compatível com o KDP (Kindle Direct Publishing) da Amazon.
                                        </p>
                                    </div>

                                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 shadow-xl space-y-6">
                                        {/* EPUB Export Section */}
                                        <div className="border-b border-gray-700 pb-6">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
                                                    <BookOpen size={24} className="text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-white">Formato EPUB</h3>
                                                    <p className="text-sm text-gray-400">Compatível com Amazon KDP e outros leitores digitais</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-sm font-semibold text-gray-300 mb-2 block">
                                                        Nome do Autor <span className="text-red-400">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={exportAuthor}
                                                        onChange={(e) => setExportAuthor(e.target.value)}
                                                        placeholder="Digite o nome do autor"
                                                        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-sm font-semibold text-gray-300 mb-2 block">
                                                        Editora
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={exportPublisher}
                                                        onChange={(e) => setExportPublisher(e.target.value)}
                                                        placeholder="Nome da editora"
                                                        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-3 p-4 bg-gray-950 rounded-lg border border-gray-700">
                                                    <input
                                                        type="checkbox"
                                                        id="includeImages"
                                                        checked={exportIncludeImages}
                                                        onChange={(e) => setExportIncludeImages(e.target.checked)}
                                                        className="w-5 h-5 text-emerald-600 bg-gray-800 border-gray-600 rounded focus:ring-emerald-500"
                                                    />
                                                    <label htmlFor="includeImages" className="text-gray-300 cursor-pointer flex-1">
                                                        <span className="font-semibold">Incluir Imagens</span>
                                                        <p className="text-sm text-gray-500 mt-1">Inclui todas as imagens geradas no livro híbrido (aumenta o tamanho do arquivo)</p>
                                                    </label>
                                                </div>

                                                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                                                    <div className="flex gap-3">
                                                        <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
                                                        <div className="text-sm text-blue-200">
                                                            <p className="font-semibold mb-1">Informações sobre o EPUB</p>
                                                            <ul className="space-y-1 text-blue-300/80">
                                                                <li>• Formato EPUB 3.0, totalmente compatível com Amazon KDP</li>
                                                                <li>• Inclui metadados completos (título, autor, idioma)</li>
                                                                <li>• Estrutura de capítulos automaticamente organizada</li>
                                                                <li>• CSS otimizado para leitores Kindle</li>
                                                                <li>• Índice automático para navegação</li>
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={handleExportEpub}
                                                    disabled={exportingEpub || !exportAuthor.trim()}
                                                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition transform active:scale-95 shadow-lg shadow-emerald-900/40 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
                                                >
                                                    {exportingEpub ? (
                                                        <>
                                                            <Loader2 className="animate-spin" size={20} />
                                                            Gerando EPUB...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Download size={20} />
                                                            Exportar para EPUB (KDP)
                                                        </>
                                                    )}
                                                </button>

                                                {!exportAuthor.trim() && (
                                                    <p className="text-center text-sm text-red-400">
                                                        Por favor, insira o nome do autor para continuar
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* DOCX Export Section */}
                                        <div>
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                                                    <Book size={24} className="text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-white">Formato DOCX</h3>
                                                    <p className="text-sm text-gray-400">Compatível com Microsoft Word e Google Docs</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                                                    <div className="flex gap-3">
                                                        <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
                                                        <div className="text-sm text-blue-200">
                                                            <p className="font-semibold mb-1">Informações sobre o DOCX</p>
                                                            <ul className="space-y-1 text-blue-300/80">
                                                                <li>• Formato Microsoft Word (.docx)</li>
                                                                <li>• Formatação profissional com Times New Roman 12pt</li>
                                                                <li>• Suporte completo a Markdown: **negrito**, *itálico*</li>
                                                                <li>• Estrutura de capítulos e beats organizada</li>
                                                                <li>• Editável no Word, Google Docs, LibreOffice, etc.</li>
                                                                <li>• Ideal para edições finais e revisões</li>
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={handleExportDocx}
                                                    disabled={exportingDocx || !exportAuthor.trim()}
                                                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition transform active:scale-95 shadow-lg shadow-blue-900/40 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
                                                >
                                                    {exportingDocx ? (
                                                        <>
                                                            <Loader2 className="animate-spin" size={20} />
                                                            Gerando DOCX...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Download size={20} />
                                                            Exportar para DOCX (Word)
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Future formats */}
                                        <div className="opacity-50 mt-6 pt-6 border-t border-gray-700">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                                                    <Book size={24} className="text-gray-500" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-gray-500">Outros Formatos</h3>
                                                    <p className="text-sm text-gray-600">Em breve: PDF, MOBI, AZW3</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'log' && (
                                <div className="flex flex-col h-full">
                                    {/* Log Header */}
                                    <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700 bg-gray-900/70">
                                        <div className="flex items-center gap-3">
                                            <Terminal size={18} className="text-slate-400" />
                                            <span className="text-sm font-bold text-white">Generation Log</span>
                                            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full font-mono">{logs.length} entries</span>
                                            {project?.status !== 'ready' && project?.status !== 'new' && (
                                                <span className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
                                                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                                    Auto-refresh ativo
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={fetchLogs}
                                            disabled={loadingLogs}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition disabled:opacity-50"
                                        >
                                            {loadingLogs ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                            Refresh
                                        </button>
                                    </div>

                                    {/* Log Entries */}
                                    <div className="flex-1 overflow-auto bg-gray-950 p-4 font-mono text-xs">
                                        {logs.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-gray-600">
                                                <Terminal size={40} className="mb-3 opacity-30" />
                                                <p>Nenhum evento de geração registrado.</p>
                                                <p className="mt-1 text-gray-700">Os logs aparecem aqui quando a geração é iniciada.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {[...logs].reverse().map((entry, i) => {
                                                    const t = new Date(entry.timestamp);
                                                    const time = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
                                                    const isError = entry.level === 'error';

                                                    const EVENT_LABELS = {
                                                        started: '🚀 Automação iniciada',
                                                        resumed: '🔄 Automação retomada',
                                                        skipped_existing_progress: '⏭ Progresso existente — pulado',
                                                        skipped_duplicate_dispatch: '⏭ Dispatch duplicado — ignorado',
                                                        status_updated: `📌 Status → ${entry.details?.status || ''}`,
                                                        source_loaded: `📄 Texto fonte carregado (${(entry.details?.textLength || 0).toLocaleString()} chars)`,
                                                        analysis_completed: `🔍 Análise concluída — ${entry.details?.beatCount || 0} beats, ${entry.details?.characterCount || 0} personagens`,
                                                        bible_generated: `📖 Bíblia gerada — ${entry.details?.chapterCount || 0} capítulos`,
                                                        bible_saved: '💾 Bíblia salva no banco',
                                                        resume_bible_loaded: '📚 Bíblia carregada (resume)',
                                                        source_text_unavailable_on_resume: '⚠️ Texto fonte indisponível no resume',
                                                        beat_enrichment_started: `✨ Enriquecimento de beats iniciado (${entry.details?.beatCount || 0} beats)`,
                                                        beat_enrichment_finished: `✅ Enriquecimento concluído (${entry.details?.failedCount || 0} falhas)`,
                                                        beat_enrichment_failed: `⚠️ Falha no beat: ${entry.details?.beatTitle || entry.details?.beatId}`,
                                                        beat_enrichment_skipped_resume: '⏭ Enriquecimento pulado (resume)',
                                                        scene_writing_started: `✍️ Escrita iniciada — ${entry.details?.beatCount || 0} cenas`,
                                                        scene_generation_started: `🖊  Escrevendo: ${entry.details?.beatTitle || ''}`,
                                                        scene_saved: `✅ Cena salva: "${entry.details?.beatTitle || ''}" — ${(entry.details?.wordCount || 0).toLocaleString()} palavras`,
                                                        scene_skipped_already_done: `⏭ Cena já gerada: ${entry.details?.beatTitle || ''}`,
                                                        scene_generation_failed: `❌ Falha na cena: ${entry.details?.beatTitle || ''} — ${entry.details?.error || ''}`,
                                                        scene_writing_finished: `📊 Escrita finalizada — ${entry.details?.successCount || 0}/${entry.details?.attemptedCount || 0} cenas`,
                                                        completed: '🎉 Geração concluída com sucesso!',
                                                        completed_with_errors: `⚠️ Concluído com erros — ${entry.details?.sceneFailureCount || 0} falhas`,
                                                        failed: `💥 Erro fatal: ${entry.details?.error || ''}`,
                                                        status_reset: `🔁 Status resetado → ${entry.details?.status || ''}`,
                                                    };

                                                    const label = EVENT_LABELS[entry.event] || entry.event;

                                                    return (
                                                        <div key={i} className={`flex items-start gap-2 py-0.5 px-2 rounded ${
                                                            isError ? 'bg-red-950/30' :
                                                            entry.event === 'scene_saved' ? 'bg-green-950/20' :
                                                            entry.event.includes('started') || entry.event.includes('started') ? 'bg-blue-950/20' :
                                                            ''
                                                        }`}>
                                                            <span className="text-gray-600 flex-shrink-0 mt-px">[{time}]</span>
                                                            <span className={`flex-shrink-0 mt-px ${ isError ? 'text-red-400' : 'text-green-400' }`}>●</span>
                                                            <span className={`flex-1 leading-relaxed ${ isError ? 'text-red-200' : 'text-gray-200' }`}>{label}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>

            {/* Read/Edit/Info Modal (Ported from SceneBoard) */}
            {selectedScene && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
                    <div className="bg-gray-900 w-full max-w-5xl h-[90vh] rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <BookOpen size={20} className="text-blue-400" />
                                    {selectedScene.title}
                                </h2>
                                <div className="flex bg-gray-900 rounded-lg p-1 gap-1">
                                    <button
                                        onClick={() => setEditorTab('content')}
                                        className={`px-3 py-1 rounded text-sm flex items-center gap-2 ${editorTab === 'content' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <BookOpen size={14} /> Scene Text
                                    </button>
                                    <button
                                        onClick={() => setEditorTab('info')}
                                        className={`px-3 py-1 rounded text-sm flex items-center gap-2 ${editorTab === 'info' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Settings size={14} /> Generation Info
                                    </button>
                                    <button
                                        onClick={() => setEditorTab('versions')}
                                        className={`px-3 py-1 rounded text-sm flex items-center gap-2 ${editorTab === 'versions' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <History size={14} /> Versions
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedScene(null)}
                                className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition"
                            >
                                Close
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 min-h-0 bg-gray-800 flex flex-col">
                            {editorTab === 'content' && (
                                <div className="flex-1 flex flex-col p-6">
                                    <div className="flex-1 bg-gray-900/50 rounded-lg p-4 mb-4 border border-gray-700/50">
                                        <textarea
                                            className="w-full h-full bg-transparent border-none focus:ring-0 text-gray-200 font-serif text-lg leading-loose resize-none outline-none custom-scrollbar"
                                            value={selectedScene.content}
                                            onChange={(e) => setSelectedScene({ ...selectedScene, content: e.target.value })}
                                            placeholder="Scene content..."
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await axios.put(`${API_BASE_URL}/scenes/${selectedScene._id}`, {
                                                        content: selectedScene.content
                                                    });
                                                    setScenes(prev => prev.map(s => s._id === selectedScene._id ? selectedScene : s));
                                                    showToast("Saved successfully");
                                                } catch (e) {
                                                    showToast("Failed to save", 'error');
                                                }
                                            }}
                                            className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition flex items-center gap-2 shadow-lg shadow-green-900/20"
                                        >
                                            <Save size={18} /> Save Changes
                                        </button>
                                    </div>
                                </div>
                            )}

                            {editorTab === 'info' && (
                                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                                    <div className="max-w-2xl mx-auto space-y-6">
                                        <div className="bg-blue-900/20 border border-blue-800/50 p-4 rounded-lg">
                                            <h3 className="text-blue-200 font-bold mb-2 flex items-center gap-2">
                                                <Edit3 size={16} /> Generation Parameters
                                            </h3>
                                            <p className="text-sm text-blue-300/80">
                                                Edit the context below and click Regenerate to create a new version of the scene.
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-gray-400 text-sm font-medium mb-1">Beat Title</label>
                                                <input
                                                    type="text"
                                                    value={genParams.beatTitle}
                                                    onChange={(e) => setGenParams(prev => ({ ...prev, beatTitle: e.target.value }))}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-sm font-medium mb-1">Beat Description (Context)</label>
                                                <textarea
                                                    value={genParams.beatDescription}
                                                    onChange={(e) => setGenParams(prev => ({ ...prev, beatDescription: e.target.value }))}
                                                    rows={4}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-sm font-medium mb-1">Additional Instructions</label>
                                                <textarea
                                                    value={genParams.instructions}
                                                    onChange={(e) => setGenParams(prev => ({ ...prev, instructions: e.target.value }))}
                                                    placeholder="e.g. Make the dialogue more tense."
                                                    rows={4}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-gray-700 mt-6">
                                            <button
                                                onClick={handleRegenerateClick}
                                                disabled={genId === selectedScene.beatId}
                                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                {genId === selectedScene.beatId ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                                                Regenerate Scene
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {editorTab === 'versions' && (
                                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                                    <div className="max-w-3xl mx-auto">
                                        <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                                            <History size={20} /> Version History
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="bg-gray-700/50 border border-green-500/50 rounded-lg p-4 relative">
                                                <div className="absolute top-0 right-0 px-2 py-0.5 bg-green-900/80 text-green-200 text-xs rounded-bl-lg rounded-tr-lg font-bold">CURRENT</div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 className="font-bold text-white">Latest Version</h4>
                                                        <p className="text-xs text-gray-400">{new Date(selectedScene.generatedAt).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                                <p className="text-gray-300 text-sm line-clamp-3 font-serif bg-gray-900/50 p-2 rounded">{selectedScene.content}</p>
                                            </div>
                                            {selectedScene.versions && [...selectedScene.versions].reverse().map((ver, idx) => (
                                                <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-gray-300">Version {ver.versionNumber || '?'}</h4>
                                                                {ver.params?.instructions && <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-400">Has Instructions</span>}
                                                            </div>
                                                            <p className="text-xs text-gray-500">{new Date(ver.generatedAt).toLocaleString()}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRestoreVersion(ver)}
                                                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white text-xs rounded transition flex items-center gap-1.5"
                                                        >
                                                            <RotateCcw size={12} /> Restore
                                                        </button>
                                                    </div>
                                                    <p className="text-gray-400 text-sm line-clamp-2 font-serif bg-gray-900/30 p-2 rounded">{ver.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Beat Edit Modal */}
            {editingBeat && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
                    <div className="bg-gray-900 w-full max-w-5xl rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Edit3 size={20} className="text-purple-400" />
                                    Edit Beat: {editingBeat.title}
                                </h2>
                                <div className="flex bg-gray-950 rounded-lg p-1 gap-1 border border-gray-700">
                                    <button
                                        onClick={() => setBeatEditTab('info')}
                                        className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 ${beatEditTab === 'info' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Basic Info
                                    </button>
                                    <button
                                        onClick={() => setBeatEditTab('description')}
                                        className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 ${beatEditTab === 'description' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Description
                                    </button>
                                    <button
                                        onClick={() => setBeatEditTab('visual')}
                                        className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 ${beatEditTab === 'visual' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Visual Details
                                    </button>
                                    <button
                                        onClick={() => setBeatEditTab('image')}
                                        className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 ${beatEditTab === 'image' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Image
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingBeat(null)}
                                className="text-gray-400 hover:text-white transition"
                            >
                                Close
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar min-h-[400px]">
                            {beatEditTab === 'info' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-gray-400 text-xs font-bold uppercase mb-1">Title</label>
                                            <input
                                                type="text"
                                                value={editingBeat.title}
                                                onChange={(e) => setEditingBeat(prev => ({ ...prev, title: e.target.value }))}
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 text-xs font-bold uppercase mb-1">Type</label>
                                            <input
                                                type="text"
                                                value={editingBeat.type || 'Beat'}
                                                onChange={(e) => setEditingBeat(prev => ({ ...prev, type: e.target.value }))}
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-purple-900/10 border border-purple-800/30 p-4 rounded-xl space-y-3 mt-6">
                                        <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                                            <Sparkles size={16} /> AI Enhance Description & Visuals
                                        </div>
                                        <p className="text-xs text-gray-400">Provide context to enhance the narrative beat description and generate visual concepts.</p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Add instruction (e.g. Make the conflict more emotional)"
                                                value={beatBgPrompt}
                                                onChange={(e) => setBeatBgPrompt(e.target.value)}
                                                className="flex-1 bg-gray-950 border border-purple-900/30 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                            />
                                            <button
                                                onClick={handleGenerateBeatDetails}
                                                disabled={generatingBeatBg}
                                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2 shrink-0"
                                            >
                                                {generatingBeatBg ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                Enhance All
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {beatEditTab === 'description' && (
                                <div className="animate-in fade-in slide-in-from-left-2 duration-300 flex flex-col h-full">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-gray-400 text-xs font-bold uppercase">Beat Description</label>
                                    </div>
                                    <textarea
                                        value={editingBeat.description}
                                        onChange={(e) => setEditingBeat(prev => ({ ...prev, description: e.target.value }))}
                                        rows={14}
                                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm leading-relaxed flex-1"
                                    />
                                </div>
                            )}

                            {beatEditTab === 'visual' && (
                                <div className="animate-in fade-in slide-in-from-right-2 duration-300 flex flex-col h-full">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-gray-400 text-xs font-bold uppercase text-purple-300">Visual Description (AI Image Gen Ready)</label>
                                    </div>
                                    <textarea
                                        value={editingBeat.visualDescription || ''}
                                        onChange={(e) => setEditingBeat(prev => ({ ...prev, visualDescription: e.target.value }))}
                                        placeholder="Detailed visual description for the scene..."
                                        rows={12}
                                        className="w-full bg-gray-950 border border-purple-900/40 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm leading-relaxed mb-4 flex-1"
                                    />
                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleGenerateBeatImage}
                                            disabled={generatingBeatImage}
                                            className="px-6 py-2 bg-pink-600 hover:bg-pink-700 rounded-lg text-white font-bold transition flex items-center gap-2 shadow-lg shadow-pink-900/20 disabled:opacity-50"
                                        >
                                            {generatingBeatImage ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                                            Generate Concept Image
                                        </button>
                                    </div>
                                </div>
                            )}

                            {beatEditTab === 'image' && (
                                <div className="animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
                                    <div className="w-full h-[60vh] bg-black/40 rounded-xl overflow-hidden border border-gray-700 relative group flex items-center justify-center">
                                        {editingBeat.imageUrl ? (
                                            <img
                                                src={buildBackendUrl(editingBeat.imageUrl)}
                                                alt={editingBeat.title}
                                                className="max-w-full max-h-full object-contain"
                                            />
                                        ) : (
                                            <div className="text-center p-8 text-gray-500">
                                                <div className="mb-4 flex justify-center"><Sparkles size={48} className="opacity-20" /></div>
                                                <p>No concept art generated yet.</p>
                                                <p className="text-sm mt-2 opacity-60">Go to "Visual Details" and click Generate.</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={handleGenerateBeatImage}
                                            disabled={generatingBeatImage}
                                            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {generatingBeatImage ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                            Regenerate
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-end gap-2">
                            <button
                                onClick={() => setEditingBeat(null)}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm font-bold transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveBeat}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm font-bold transition shadow-lg shadow-green-900/20"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {editingCharacter && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
                    <div className="bg-gray-900 w-full max-w-5xl rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Edit3 size={20} className="text-purple-400" />
                                    Edit Character: {editingCharacter.name}
                                </h2>
                                <div className="flex bg-gray-950 rounded-lg p-1 gap-1 border border-gray-700">
                                    <button
                                        onClick={() => setCharEditTab('info')}
                                        className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 ${charEditTab === 'info' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Basic Info
                                    </button>
                                    <button
                                        onClick={() => setCharEditTab('background')}
                                        className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 ${charEditTab === 'background' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Background
                                    </button>
                                    <button
                                        onClick={() => setCharEditTab('visual')}
                                        className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 ${charEditTab === 'visual' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Visual Details
                                    </button>
                                    <button
                                        onClick={() => setCharEditTab('image')}
                                        className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 ${charEditTab === 'image' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Image
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingCharacter(null)}
                                className="text-gray-400 hover:text-white transition"
                            >
                                Close
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar min-h-[400px]">
                            {charEditTab === 'info' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-gray-400 text-xs font-bold uppercase mb-1">Name</label>
                                            <input
                                                type="text"
                                                value={editingCharacter.name}
                                                onChange={(e) => setEditingCharacter(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 text-xs font-bold uppercase mb-1">Role</label>
                                            <input
                                                type="text"
                                                value={editingCharacter.role}
                                                onChange={(e) => setEditingCharacter(prev => ({ ...prev, role: e.target.value }))}
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 text-xs font-bold uppercase mb-1">Archetype</label>
                                            <input
                                                type="text"
                                                value={editingCharacter.archetype || ''}
                                                onChange={(e) => setEditingCharacter(prev => ({ ...prev, archetype: e.target.value }))}
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-xs font-bold uppercase mb-1">Motivation</label>
                                        <textarea
                                            value={editingCharacter.motivation || ''}
                                            onChange={(e) => setEditingCharacter(prev => ({ ...prev, motivation: e.target.value }))}
                                            rows={3}
                                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm leading-relaxed"
                                        />
                                    </div>

                                    <div className="bg-purple-900/10 border border-purple-800/30 p-4 rounded-xl space-y-3 mt-6">
                                        <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                                            <Sparkles size={16} /> AI Background & Visual Generator
                                        </div>
                                        <p className="text-xs text-gray-400">Provide context to generate a rich background and detailed visual traits for this character.</p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Add context (e.g. He is a former soldier with a dark past)"
                                                value={charBgPrompt}
                                                onChange={(e) => setCharBgPrompt(e.target.value)}
                                                className="flex-1 bg-gray-950 border border-purple-900/30 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                            />
                                            <button
                                                onClick={handleGenerateCharBackground}
                                                disabled={generatingBg}
                                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2 shrink-0"
                                            >
                                                {generatingBg ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                Generate All
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                {charEditTab === 'background' && (
                                    <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-gray-400 text-xs font-bold uppercase">Description / Background</label>
                                        </div>
                                        <textarea
                                            value={editingCharacter.description}
                                            onChange={(e) => setEditingCharacter(prev => ({ ...prev, description: e.target.value }))}
                                            rows={14}
                                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm leading-relaxed"
                                        />
                                    </div>
                                )}
                                {charEditTab === 'visual' && (
                                    <div className="animate-in fade-in slide-in-from-right-2 duration-300 flex flex-col h-full">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-gray-400 text-xs font-bold uppercase text-purple-300">Visual Description (AI Image Gen Ready)</label>
                                        </div>
                                        <textarea
                                            value={editingCharacter.visualDescription || ''}
                                            onChange={(e) => setEditingCharacter(prev => ({ ...prev, visualDescription: e.target.value }))}
                                            placeholder="Detailed visual traits, costume, colors..."
                                            rows={12}
                                            className="w-full bg-gray-950 border border-purple-900/40 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm leading-relaxed mb-4"
                                        />
                                        <div className="flex justify-end">
                                            <button
                                                onClick={handleGenerateImage}
                                                disabled={generatingImage || !editingCharacter.visualDescription}
                                                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-purple-900/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {generatingImage ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                Generate Image from Description
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {charEditTab === 'image' && (
                                    <div className="animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
                                        <div className="w-full h-[60vh] bg-black/40 rounded-xl overflow-hidden border border-gray-700 relative group flex items-center justify-center">
                                            {editingCharacter.imageUrl ? (
                                                <img
                                                    src={buildBackendUrl(editingCharacter.imageUrl)}
                                                    alt={editingCharacter.name}
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            ) : (
                                                <div className="text-center p-8 text-gray-500">
                                                    <div className="mb-4 flex justify-center"><Sparkles size={48} className="opacity-20" /></div>
                                                    <p>No image generated yet.</p>
                                                    <p className="text-sm mt-2 opacity-60">Go to "Visual Details" and click Generate.</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-4 flex justify-end">
                                            <button
                                                onClick={handleGenerateImage}
                                                disabled={generatingImage || !editingCharacter.visualDescription}
                                                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {generatingImage ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                                Regenerate
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingCharacter(null)}
                                className="px-4 py-2 text-gray-400 hover:text-white text-sm font-bold transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCharacter}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-green-900/20 flex items-center gap-2"
                            >
                                <Save size={18} /> Save Character
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Location Edit Modal */}
            {editingLocation && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
                    <div className="bg-gray-900 w-full max-w-5xl rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <MapPin size={20} className="text-yellow-400" />
                                    Edit Location: {editingLocation.name}
                                </h2>
                                <div className="flex bg-gray-950 rounded-lg p-1 gap-1 border border-gray-700">
                                    <button
                                        onClick={() => setLocEditTab('info')}
                                        className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 ${locEditTab === 'info' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Basic Info
                                    </button>
                                    <button
                                        onClick={() => setLocEditTab('description')}
                                        className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 ${locEditTab === 'description' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Description
                                    </button>
                                    <button
                                        onClick={() => setLocEditTab('visual')}
                                        className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 ${locEditTab === 'visual' ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-900/40' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Visual Details
                                    </button>
                                    <button
                                        onClick={() => setLocEditTab('image')}
                                        className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 ${locEditTab === 'image' ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-900/40' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Image
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingLocation(null)}
                                className="text-gray-400 hover:text-white transition"
                            >
                                Close
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar min-h-[400px]">
                            {locEditTab === 'info' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-gray-400 text-xs font-bold uppercase mb-1">Name</label>
                                            <input
                                                type="text"
                                                value={editingLocation.name}
                                                onChange={(e) => setEditingLocation(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 text-xs font-bold uppercase mb-1">Type</label>
                                            <input
                                                type="text"
                                                value={editingLocation.type || ''}
                                                onChange={(e) => setEditingLocation(prev => ({ ...prev, type: e.target.value }))}
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-xs font-bold uppercase mb-1">Atmosphere</label>
                                        <textarea
                                            value={editingLocation.atmosphere || ''}
                                            onChange={(e) => setEditingLocation(prev => ({ ...prev, atmosphere: e.target.value }))}
                                            rows={2}
                                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-yellow-500 outline-none resize-none text-sm leading-relaxed"
                                        />
                                    </div>

                                    <div className="bg-yellow-900/10 border border-yellow-800/30 p-4 rounded-xl space-y-3 mt-6">
                                        <div className="flex items-center gap-2 text-yellow-300 font-bold text-sm">
                                            <Sparkles size={16} /> AI Background & Visual Generator
                                        </div>
                                        <p className="text-xs text-gray-400">Provide context to generate a rich description and detailed visual traits for this location.</p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Add context (e.g. A bustling cyberpunk marketplace with neon lights)"
                                                value={locBgPrompt}
                                                onChange={(e) => setLocBgPrompt(e.target.value)}
                                                className="flex-1 bg-gray-950 border border-yellow-900/30 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                                            />
                                            <button
                                                onClick={handleGenerateLocBackground}
                                                disabled={generatingLocBg}
                                                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2 shrink-0"
                                            >
                                                {generatingLocBg ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                Generate All
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                {locEditTab === 'description' && (
                                    <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-gray-400 text-xs font-bold uppercase">Description</label>
                                        </div>
                                        <textarea
                                            value={editingLocation.description}
                                            onChange={(e) => setEditingLocation(prev => ({ ...prev, description: e.target.value }))}
                                            rows={14}
                                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-yellow-500 outline-none resize-none text-sm leading-relaxed"
                                        />
                                    </div>
                                )}
                                {locEditTab === 'visual' && (
                                    <div className="animate-in fade-in slide-in-from-right-2 duration-300 flex flex-col h-full">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-gray-400 text-xs font-bold uppercase text-yellow-300">Visual Description (AI Image Gen Ready)</label>
                                        </div>
                                        <textarea
                                            value={editingLocation.visualDescription || ''}
                                            onChange={(e) => setEditingLocation(prev => ({ ...prev, visualDescription: e.target.value }))}
                                            placeholder="Detailed visual details, colors, lighting..."
                                            rows={12}
                                            className="w-full bg-gray-950 border border-yellow-900/40 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-yellow-500 outline-none resize-none text-sm leading-relaxed mb-4"
                                        />
                                        <div className="flex justify-end">
                                            <button
                                                onClick={handleGenerateLocImage}
                                                disabled={generatingLocImage || !editingLocation.visualDescription}
                                                className="px-6 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-yellow-900/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {generatingLocImage ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                Generate Image from Description
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {locEditTab === 'image' && (
                                    <div className="animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
                                        <div className="w-full h-[60vh] bg-black/40 rounded-xl overflow-hidden border border-gray-700 relative group flex items-center justify-center">
                                            {editingLocation.imageUrl ? (
                                                <img
                                                    src={buildBackendUrl(editingLocation.imageUrl)}
                                                    alt={editingLocation.name}
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            ) : (
                                                <div className="text-center p-8 text-gray-500">
                                                    <div className="mb-4 flex justify-center"><Sparkles size={48} className="opacity-20" /></div>
                                                    <p>No image generated yet.</p>
                                                    <p className="text-sm mt-2 opacity-60">Go to "Visual Details" and click Generate.</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-4 flex justify-end">
                                            <button
                                                onClick={handleGenerateLocImage}
                                                disabled={generatingLocImage || !editingLocation.visualDescription}
                                                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {generatingLocImage ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                                Regenerate
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingLocation(null)}
                                className="px-4 py-2 text-gray-400 hover:text-white text-sm font-bold transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveLocation}
                                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-bold rounded-lg transition shadow-lg shadow-yellow-900/20 flex items-center gap-2"
                            >
                                <Save size={18} /> Save Location
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 transform ${toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-md ${toast.type === 'success'
                    ? 'bg-green-900/80 border-green-500/50 text-green-100'
                    : 'bg-red-900/80 border-red-500/50 text-red-100'
                    }`}>
                    {toast.type === 'success' ? <CheckCircle size={20} className="text-green-400" /> : <AlertCircle size={20} className="text-red-400" />}
                    <span className="font-medium">{toast.message}</span>
                    <button
                        onClick={() => setToast(prev => ({ ...prev, visible: false }))}
                        className="ml-4 hover:opacity-70 transition"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
