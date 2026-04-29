import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BookOpen, Sparkles, Loader2, Image as ImageIcon, Download, RefreshCw, Save } from 'lucide-react';
import { buildApiUrl, buildBackendUrl } from '../lib/api';

export default function HybridEditor({ projectId, showToast }) {
    const [hybridBook, setHybridBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [generatingLayout, setGeneratingLayout] = useState(false);
    const [generatingBlockId, setGeneratingBlockId] = useState(null);

    const [settings, setSettings] = useState({
        imagesPerBeat: 2,
        includeCaptions: true
    });

    useEffect(() => {
        fetchHybrid();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    const fetchHybrid = async () => {
        setLoading(true);
        try {
            const res = await axios.get(buildApiUrl(`/hybrid/project/${projectId}`));
            setHybridBook(res.data);
            if (res.data?.settings) {
                setSettings(prev => ({ ...prev, ...res.data.settings }));
            }
        } catch (e) {
            setHybridBook(null);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        setCreating(true);
        try {
            const res = await axios.post(buildApiUrl(`/hybrid/${projectId}`), {
                settings
            });
            setHybridBook(res.data);
            showToast?.('Hybrid book created!');
        } catch (e) {
            console.error(e);
            showToast?.('Failed to create hybrid book', 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleGenerateLayout = async () => {
        if (!hybridBook?._id) return;
        setGeneratingLayout(true);
        try {
            const res = await axios.post(buildApiUrl(`/hybrid/${hybridBook._id}/generate-layout`), {
                imagesPerBeat: settings.imagesPerBeat
            });
            setHybridBook(res.data);
            showToast?.('Hybrid layout generated!');
        } catch (e) {
            console.error(e);
            showToast?.('Failed to generate hybrid layout', 'error');
        } finally {
            setGeneratingLayout(false);
        }
    };

    const updateBlock = async (blockId, patch) => {
        if (!hybridBook?._id) return;
        try {
            const res = await axios.put(buildApiUrl(`/hybrid/${hybridBook._id}/block/${blockId}`), patch);
            setHybridBook(res.data.hybrid);
            showToast?.('Saved', 'success');
        } catch (e) {
            console.error(e);
            showToast?.('Failed to save block', 'error');
        }
    };

    const generateImage = async (blockId) => {
        if (!hybridBook?._id) return;
        setGeneratingBlockId(blockId);
        try {
            const res = await axios.post(buildApiUrl(`/hybrid/${hybridBook._id}/block/${blockId}/generate-image`));
            // refresh hybrid to get updated nested block data
            await fetchHybrid();
            showToast?.('Image generated!');
            return res.data;
        } catch (e) {
            console.error(e);
            showToast?.('Failed to generate image', 'error');
        } finally {
            setGeneratingBlockId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                <Loader2 className="animate-spin mr-2" /> Loading Hybrid Book...
            </div>
        );
    }

    if (!hybridBook) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <BookOpen className="text-orange-400" /> Create Hybrid Book
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Images per Beat</label>
                            <select
                                value={settings.imagesPerBeat}
                                onChange={(e) => setSettings(prev => ({ ...prev, imagesPerBeat: parseInt(e.target.value) }))}
                                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white"
                            >
                                <option value={0}>0 (Text-only)</option>
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                            </select>
                        </div>

                        <button
                            onClick={handleCreate}
                            disabled={creating}
                            className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
                        >
                            {creating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                            Create Hybrid Book
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between bg-gray-900 border border-gray-700 rounded-2xl p-4">
                <div>
                    <div className="text-white font-bold text-lg">{hybridBook.title || 'Hybrid Book'}</div>
                    <div className="text-xs text-gray-500">Status: {hybridBook.status}</div>
                </div>

                <div className="flex gap-2 items-center">
                    <select
                        value={settings.imagesPerBeat}
                        onChange={(e) => setSettings(prev => ({ ...prev, imagesPerBeat: parseInt(e.target.value) }))}
                        className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                        <option value={0}>0 img/beat</option>
                        <option value={1}>1 img/beat</option>
                        <option value={2}>2 img/beat</option>
                        <option value={3}>3 img/beat</option>
                    </select>

                    <button
                        onClick={handleGenerateLayout}
                        disabled={generatingLayout}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm font-bold flex items-center gap-2 transition border border-gray-700"
                    >
                        {generatingLayout ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                        Generate Layout
                    </button>

                    <button
                        onClick={() => window.open(buildApiUrl(`/hybrid/${hybridBook._id}/export/pdf`), '_blank')}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition"
                    >
                        <Download size={16} /> Export PDF
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {(hybridBook.blocks || []).map((block) => {
                    if (block.type === 'heading') {
                        return (
                            <div key={block._id} className="px-4 pt-4">
                                <div className="text-white text-xl font-bold">{block.text}</div>
                                <div className="text-xs text-gray-500">Beat {block.beatId}</div>
                            </div>
                        );
                    }

                    if (block.type === 'prose') {
                        return (
                            <div key={block._id} className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
                                <div className="text-xs text-gray-500 uppercase font-bold mb-2">Prose</div>
                                <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 text-gray-200 text-sm leading-relaxed whitespace-pre-wrap max-h-72 overflow-auto">
                                    {block.text}
                                </div>
                            </div>
                        );
                    }

                    // image block
                    return (
                        <div key={block._id} className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-xs text-gray-500 uppercase font-bold flex items-center gap-2">
                                    <ImageIcon size={14} /> Image (Beat {block.beatId})
                                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-gray-300 border border-gray-700">
                                        {block.status}
                                    </span>
                                </div>
                                <button
                                    onClick={() => generateImage(block._id)}
                                    disabled={generatingBlockId === block._id}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
                                >
                                    {generatingBlockId === block._id ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                                    Generate Image
                                </button>
                            </div>

                            <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1 block">Prompt</label>
                            <textarea
                                value={block.prompt || ''}
                                onChange={(e) => updateBlock(block._id, { prompt: e.target.value })}
                                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-white text-sm resize-none h-24"
                            />

                            <div className="mt-3 flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1 block">Caption</label>
                                    <input
                                        type="text"
                                        value={block.caption || ''}
                                        onChange={(e) => updateBlock(block._id, { caption: e.target.value })}
                                        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-white text-sm"
                                        placeholder="Optional caption"
                                    />
                                </div>
                                <button
                                    onClick={() => updateBlock(block._id, { prompt: block.prompt, caption: block.caption })}
                                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm font-bold flex items-center gap-2 transition border border-gray-700"
                                >
                                    <Save size={16} /> Save
                                </button>
                            </div>

                            {block.imageUrl && (
                                <div className="mt-4 bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
                                    <img
                                        src={buildBackendUrl(block.imageUrl)}
                                        alt="Generated"
                                        className="w-full object-contain"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
