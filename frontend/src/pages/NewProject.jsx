import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Upload, Loader2, BookOpen, Target, FileText, Settings, FileJson } from 'lucide-react';
import { buildApiUrl } from '../lib/api';

const CHAPTER_TYPES = {
    NORMAL: "Capítulo Normal (2.5k-4k palavras)",
    ACTION: "Ação / Set Piece (1.8k-3k palavras)",
    REVELATION: "Revelação / Virada (3.5k-5.5k palavras)",
    FINAL: "Capítulo Final / Clímax (3k-6k palavras)"
};

function createIdempotencyKey(prefix) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function NewProject() {
    const [mode, setMode] = useState('create'); // 'create' or 'import'
    
    // Create Mode State
    const [name, setName] = useState('');
    const [style, setStyle] = useState('Space Opera');
    const [narrativeStyles, setNarrativeStyles] = useState([]);
    const [language, setLanguage] = useState('Português Brasileiro');
    const [imageStyles, setImageStyles] = useState([]);
    const [selectedImageStyle, setSelectedImageStyle] = useState('');
    const [inputMode, setInputMode] = useState('file'); // 'file' or 'text'
    const [file, setFile] = useState(null);
    const [pastedText, setPastedText] = useState('');
    const [loading, setLoading] = useState(false);
    
    // New Fields
    const [premise, setPremise] = useState('');
    const [chapterCount, setChapterCount] = useState(12);
    const [chapters, setChapters] = useState([]);
    const [targetWordCount, setTargetWordCount] = useState(5000);

    // Tab State
    const [activeTab, setActiveTab] = useState('general'); // 'general', 'structure', 'source'

    // Import Mode State
    const [importFile, setImportFile] = useState(null);

    const createRequestKeyRef = useRef(null);
    const importRequestKeyRef = useRef(null);

    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [imgRes, narrRes] = await Promise.all([
                    axios.get(buildApiUrl('/styles')),
                    axios.get(buildApiUrl('/narrative-styles'))
                ]);

                setImageStyles(imgRes.data);
                if (imgRes.data.length > 0) {
                    setSelectedImageStyle(imgRes.data[0]._id);
                }

                setNarrativeStyles(narrRes.data);
                if (narrRes.data.length > 0) {
                    setStyle(narrRes.data[0].name);
                }
            } catch (error) {
                console.error('Error fetching styles:', error);
            }
        };
        fetchData();
    }, []);

    // Initialize chapters when count changes
    useEffect(() => {
        setChapters(prev => {
            const newChapters = Array.from({ length: chapterCount }, (_, i) => {
                // Preserve existing data if available
                if (prev[i]) return prev[i];
                
                // Default structure logic (simple heuristic)
                let type = 'NORMAL';
                if (i === Math.floor(chapterCount / 2)) type = 'REVELATION';
                if (i === chapterCount - 1) type = 'FINAL';
                
                return {
                    number: i + 1,
                    type: type,
                    description: ''
                };
            });
            return newChapters;
        });
    }, [chapterCount]);

    const updateChapter = (index, field, value) => {
        const newChapters = [...chapters];
        newChapters[index] = { ...newChapters[index], [field]: value };
        setChapters(newChapters);
    };

    const getCreateRequestKey = () => {
        if (!createRequestKeyRef.current) {
            createRequestKeyRef.current = createIdempotencyKey('project-create');
        }

        return createRequestKeyRef.current;
    };

    const getImportRequestKey = () => {
        if (!importRequestKeyRef.current) {
            importRequestKeyRef.current = createIdempotencyKey('project-import');
        }

        return importRequestKeyRef.current;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (loading) {
            return;
        }

        // Validate based on input mode
        if (inputMode === 'file' && !file) {
            alert('Please upload a file');
            return;
        }
        if (inputMode === 'text' && !pastedText.trim()) {
            alert('Please paste some text');
            return;
        }
        if (!name) {
            alert('Please enter a project name');
            return;
        }

        setLoading(true);

        try {
            const requestKey = getCreateRequestKey();
            const payload = {
                idempotencyKey: requestKey,
                name,
                style,
                language,
                premise,
                initialChapterStructure: chapters,
                ...(chapterCount === 1 ? { targetWordCount } : {})
            };

            if (selectedImageStyle) {
                payload.imageStyle = selectedImageStyle;
            }

            let response;
            if (inputMode === 'file') {
                // File upload mode
                const formData = new FormData();
                formData.append('idempotencyKey', requestKey);
                formData.append('name', name);
                formData.append('style', style);
                formData.append('language', language);
                formData.append('premise', premise);
                formData.append('initialChapterStructure', JSON.stringify(chapters));
                if (chapterCount === 1) {
                    formData.append('targetWordCount', targetWordCount);
                }
                
                if (selectedImageStyle) {
                    formData.append('imageStyle', selectedImageStyle);
                }
                formData.append('file', file);

                response = await axios.post(buildApiUrl('/projects'), formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'X-Idempotency-Key': requestKey
                    }
                });
            } else {
                // Pasted text mode
                payload.text = pastedText;
                response = await axios.post(buildApiUrl('/projects'), payload, {
                    headers: {
                        'X-Idempotency-Key': requestKey
                    }
                });
            }

            const project = response.data;
            createRequestKeyRef.current = null;
            navigate(`/project/${project._id}`);
        } catch (error) {
            console.error('Error creating project:', error);
            alert('Failed to create project');
        } finally {
            setLoading(false);
        }
    };

    const handleImportSubmit = async (e) => {
        e.preventDefault();
        if (loading) {
            return;
        }

        if (!importFile) {
            alert('Please select a JSON file to import');
            return;
        }

        console.log('Preparing to import file:', importFile.name, 'Size:', importFile.size);
        console.log('File type:', importFile.type);
        console.log('File object:', importFile);
        console.log('File lastModified:', importFile.lastModified);

        // Check if file size is 0
        if (importFile.size === 0) {
            alert('The selected file appears to be empty. Please check the file and try again.');
            return;
        }

        setLoading(true);
        try {
            const requestKey = getImportRequestKey();

            // Try to read the file as text - with FileReader fallback
            let fileText;
            try {
                // Modern approach
                fileText = await importFile.text();
                console.log('File content length:', fileText.length);
                console.log('First 100 chars:', fileText.substring(0, 100));
            } catch (readError) {
                console.error('File.text() failed, trying FileReader:', readError);
                // Fallback to FileReader
                try {
                    fileText = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = (e) => reject(e);
                        reader.readAsText(importFile);
                    });
                    console.log('FileReader success, content length:', fileText.length);
                } catch (frError) {
                    console.error('FileReader also failed:', frError);
                    alert('Could not read the selected file. Please try selecting it again.');
                    return;
                }
            }

            if (!fileText || !fileText.trim()) {
                alert('The selected JSON file is empty. Please choose a file with project data.');
                return;
            }
            
            // Parse to validate JSON
            let jsonData;
            try {
                jsonData = JSON.parse(fileText);
                console.log('JSON parsed successfully, keys:', Object.keys(jsonData));
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                alert('Invalid JSON file. Please check the file format and try again.');
                return;
            }

            const importPayload = {
                ...jsonData,
                idempotencyKey: requestKey
            };

            // Send as JSON directly
            const response = await axios.post(buildApiUrl('/projects/import'), importPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': requestKey
                }
            });

            const project = response.data;
            importRequestKeyRef.current = null;
            navigate(`/project/${project._id}`);
        } catch (error) {
            console.error('Error importing project:', error);
            const backendError = error.response?.data?.error || error.response?.data?.message;
            alert('Failed to import project: ' + (backendError || error.message || 'Unexpected error.'));
        } finally {
            setLoading(false);
        }
    };

    const selectedNarrative = narrativeStyles.find(s => s.name === style);

    return (
        <div className="max-w-5xl mx-auto p-8">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                    {mode === 'create' ? 'Iniciar Novo Projeto' : 'Importar Projeto Existente'}
                </h2>
                
                <div className="bg-gray-800 p-1 rounded-lg flex">
                    <button
                        onClick={() => setMode('create')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                            mode === 'create' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Create New
                    </button>
                    <button
                        onClick={() => setMode('import')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                            mode === 'import' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Import JSON
                    </button>
                </div>
            </div>

            {mode === 'import' ? (
                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-12 text-center">
                    <div className="max-w-xl mx-auto">
                        <div className="bg-blue-900/20 border border-blue-500/30 p-6 rounded-xl mb-8">
                            <FileJson className="mx-auto text-blue-400 mb-4" size={48} />
                            <h3 className="text-xl font-bold text-white mb-2">Import Project Data</h3>
                            <p className="text-gray-400">
                                Upload a JSON file containing the full project structure, including Bible, Chapters, Beats, and Scenes.
                            </p>
                        </div>

                        <div className="border-2 border-dashed border-gray-600 rounded-xl p-12 hover:border-blue-500 transition cursor-pointer relative bg-gray-900/30 group mb-8">
                            <input
                                type="file"
                                accept=".json"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    console.log('File selected:', file?.name, 'Size:', file?.size);
                                    setImportFile(file);
                                }}
                            />
                            <div className="group-hover:scale-110 transition-transform duration-300">
                                <Upload className="mx-auto text-gray-500 mb-4 group-hover:text-blue-400" size={48} />
                            </div>
                            <p className="text-gray-300 font-medium text-lg">
                                {importFile ? `${importFile.name} (${(importFile.size / 1024).toFixed(1)} KB)` : "Click to upload JSON"}
                            </p>
                        </div>

                        <button
                            onClick={handleImportSubmit}
                            disabled={loading || !importFile}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 px-8 rounded-lg transition transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Import Project'}
                        </button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
                    
                    {/* Tabs Header */}
                    <div className="flex border-b border-gray-700">
                        <button
                            type="button"
                            onClick={() => setActiveTab('general')}
                            className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 transition ${
                                activeTab === 'general' 
                                ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' 
                                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                        >
                            <Settings size={18} />
                            General Info
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('structure')}
                            className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 transition ${
                                activeTab === 'structure' 
                                ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' 
                                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                        >
                            <BookOpen size={18} />
                            Chapter Structure
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('source')}
                            className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 transition ${
                                activeTab === 'source' 
                                ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' 
                                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                        >
                            <FileText size={18} />
                            Source Story
                        </button>
                    </div>

                    <div className="p-8">
                        {/* Tab 1: General Info */}
                        {activeTab === 'general' && (
                            <div className="space-y-8 animate-fadeIn">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Project Name</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. The Cyber-Detective"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Language / Idioma</label>
                                        <select
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                                            value={language}
                                            onChange={(e) => setLanguage(e.target.value)}
                                        >
                                            <option value="Português Brasileiro">Português Brasileiro</option>
                                            <option value="Inglês">Inglês</option>
                                            <option value="Espanhol">Espanhol</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Narrative Style</label>
                                        <select
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                                            value={style}
                                            onChange={(e) => setStyle(e.target.value)}
                                        >
                                            {narrativeStyles.map(s => (
                                                <option key={s._id} value={s.name}>{s.name}</option>
                                            ))}
                                        </select>
                                        {selectedNarrative && (
                                            <p className="text-xs text-gray-500 mt-2 italic">
                                                {selectedNarrative.description}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Image Style</label>
                                        <select
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                                            value={selectedImageStyle}
                                            onChange={(e) => setSelectedImageStyle(e.target.value)}
                                        >
                                            <option value="">No special style</option>
                                            {imageStyles.map(s => (
                                                <option key={s._id} value={s._id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Premise (The Truth to be Proven)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition"
                                        value={premise}
                                        onChange={(e) => setPremise(e.target.value)}
                                        placeholder="e.g. Greed leads to destruction"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        "Every damn good novel proves a premise." - James N. Frey
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Tab 2: Chapter Structure */}
                        {activeTab === 'structure' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="flex justify-between items-center mb-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Planejamento de Capítulos</h3>
                                        <p className="text-sm text-gray-400">Defina o ritmo e a estrutura do seu livro.</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <label className="text-sm text-gray-400 font-medium">Total de Capítulos:</label>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max="50"
                                            value={chapterCount}
                                            onChange={(e) => setChapterCount(parseInt(e.target.value) || 1)}
                                            className="w-20 bg-gray-800 border border-gray-600 rounded-lg p-2 text-center text-white font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* ── SHORT STORY MODE ─────────────────────────────── */}
                                {chapterCount === 1 && (
                                    <div className="bg-amber-900/20 border border-amber-500/40 rounded-xl p-6 space-y-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <BookOpen size={20} className="text-amber-400" />
                                            <h4 className="font-bold text-amber-300 text-base">Modo Conto / História Curta</h4>
                                        </div>
                                        <p className="text-sm text-amber-200/70">
                                            Com 1 capítulo, o sistema gera uma narrativa contínua sem divisão em capítulos. Defina quantas palavras a história deve ter.
                                        </p>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-3 uppercase font-bold tracking-wider">
                                                Alvo de Palavras: <span className="text-amber-300 text-base normal-case font-bold">{targetWordCount.toLocaleString('pt-BR')} palavras</span>
                                            </label>
                                            <input
                                                type="range"
                                                min="1000"
                                                max="20000"
                                                step="500"
                                                value={targetWordCount}
                                                onChange={(e) => setTargetWordCount(parseInt(e.target.value))}
                                                className="w-full accent-amber-400"
                                            />
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>Flash (1k)</span>
                                                <span>Conto (5k)</span>
                                                <span>Novela curta (20k)</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 flex-wrap mt-2">
                                            {[2000, 3000, 5000, 8000, 12000, 15000].map(wc => (
                                                <button
                                                    key={wc}
                                                    type="button"
                                                    onClick={() => setTargetWordCount(wc)}
                                                    className={`px-3 py-1 rounded-full text-xs font-bold border transition ${targetWordCount === wc ? 'bg-amber-500 border-amber-400 text-gray-900' : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-amber-500'}`}
                                                >
                                                    {wc.toLocaleString('pt-BR')}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="mt-2">
                                            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider">Intenção da história (opcional)</label>
                                            <textarea
                                                className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-sm text-white h-20 resize-none focus:ring-1 focus:ring-amber-500 outline-none"
                                                placeholder="Descreva o que deve acontecer nesta história curta... (deixe em branco para a IA sugerir)"
                                                value={chapters[0]?.description || ''}
                                                onChange={(e) => updateChapter(0, 'description', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* ── MULTI-CHAPTER MODE ───────────────────────────── */}
                                {chapterCount > 1 && (
                                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                    {chapters.map((chapter, index) => (
                                        <div key={index} className="bg-gray-900/30 p-4 rounded-lg border border-gray-700/50 flex gap-4 items-start hover:border-gray-600 transition">
                                            <div className="flex-shrink-0 w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center font-bold text-lg text-blue-400 border border-gray-700">
                                                {chapter.number}
                                            </div>
                                            <div className="flex-grow space-y-3">
                                                <div className="flex flex-col md:flex-row gap-4">
                                                    <div className="flex-1">
                                                        <label className="block text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider">Tipo de Capítulo</label>
                                                        <select
                                                            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                            value={chapter.type}
                                                            onChange={(e) => updateChapter(index, 'type', e.target.value)}
                                                        >
                                                            {Object.entries(CHAPTER_TYPES).map(([key, label]) => (
                                                                <option key={key} value={key}>{label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider">Intenção / Resumo</label>
                                                    <textarea
                                                        className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-sm text-white h-24 resize-none focus:ring-1 focus:ring-blue-500 outline-none"
                                                        placeholder="O que acontece neste capítulo? Qual é o conflito principal? (Deixe em branco para a IA sugerir)"
                                                        value={chapter.description}
                                                        onChange={(e) => updateChapter(index, 'description', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                )}
                            </div>
                        )}

                        {/* Tab 3: Source Story */}
                        {activeTab === 'source' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg mb-6">
                                    <h3 className="text-blue-400 font-bold mb-1 flex items-center gap-2">
                                        <Target size={18} />
                                        Material Fonte
                                    </h3>
                                    <p className="text-sm text-blue-200/70">
                                        Faça upload do texto original que servirá de base para a adaptação. A IA analisará este conteúdo para extrair personagens, cenários e beats.
                                    </p>
                                </div>

                                <div className="flex gap-2 mb-4 bg-gray-900 p-1 rounded-lg inline-flex">
                                    <button
                                        type="button"
                                        onClick={() => setInputMode('file')}
                                        className={`py-2 px-6 rounded-md font-medium text-sm transition ${inputMode === 'file'
                                                ? 'bg-gray-700 text-white shadow-sm'
                                                : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        Upload File
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInputMode('text')}
                                        className={`py-2 px-6 rounded-md font-medium text-sm transition ${inputMode === 'text'
                                                ? 'bg-gray-700 text-white shadow-sm'
                                                : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        Paste Text
                                    </button>
                                </div>

                                {inputMode === 'file' && (
                                    <div className="border-2 border-dashed border-gray-600 rounded-xl p-12 text-center hover:border-blue-500 transition cursor-pointer relative bg-gray-900/30 group">
                                        <input
                                            type="file"
                                            accept=".txt"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={(e) => setFile(e.target.files[0])}
                                        />
                                        <div className="group-hover:scale-110 transition-transform duration-300">
                                            <Upload className="mx-auto text-gray-500 mb-4 group-hover:text-blue-400" size={48} />
                                        </div>
                                        <p className="text-gray-300 font-medium text-lg">
                                            {file ? file.name : "Click to upload or drag and drop"}
                                        </p>
                                        <p className="text-gray-500 text-sm mt-2">Only .txt files are supported</p>
                                    </div>
                                )}

                                {inputMode === 'text' && (
                                    <div>
                                        <textarea
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition font-mono text-sm"
                                            rows="16"
                                            value={pastedText}
                                            onChange={(e) => setPastedText(e.target.value)}
                                            placeholder="Paste your story text here..."
                                        />
                                        <p className="text-gray-500 text-sm mt-2 text-right">
                                            {pastedText.trim() ? `${pastedText.trim().split(/\s+/).length} words` : '0 words'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 bg-gray-900/50 border-t border-gray-700 flex justify-between items-center">
                        <div className="text-sm text-gray-500">
                            {activeTab === 'general' && "Next: Define Chapter Structure"}
                            {activeTab === 'structure' && "Next: Upload Source Material"}
                            {activeTab === 'source' && "Ready to Create Project"}
                        </div>
                        
                        <div className="flex gap-3">
                            {activeTab !== 'general' && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab(activeTab === 'source' ? 'structure' : 'general')}
                                    className="px-6 py-3 rounded-lg font-medium text-gray-300 hover:bg-gray-800 transition"
                                >
                                    Back
                                </button>
                            )}
                            
                            {activeTab !== 'source' ? (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab(activeTab === 'general' ? 'structure' : 'source')}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg transition"
                                >
                                    Next Step
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold py-3 px-8 rounded-lg transition transform hover:scale-[1.02] flex items-center gap-2 shadow-lg shadow-green-900/20"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : 'Create Project'}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
}
