import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { BookOpen, Download, Search, LayoutGrid, List, FileText, Calendar, Layers, Edit } from 'lucide-react';
import { API_BASE_URL, BACKEND_URL } from '../lib/api';

const AnthologyList = () => {
    const [anthologies, setAnthologies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchAnthologies();
    }, []);

    const fetchAnthologies = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/projects/lists/anthologies`);
            setAnthologies(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching anthologies:', error);
            setLoading(false);
        }
    };

    const handleDownload = (id) => {
        window.open(`${API_BASE_URL}/projects/anthologies/${id}/download`, '_blank');
    };

    const filteredAnthologies = anthologies.filter(a =>
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.projectIds.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-400 font-medium">Carregando coletâneas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Layers size={32} className="text-purple-400" />
                        <h1 className="text-3xl font-bold text-white">Minhas Coletâneas</h1>
                    </div>
                    <p className="text-gray-400">Gerencie e baixe suas coleções de estórias geradas por IA.</p>
                </div>

                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por título ou projeto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-80 bg-gray-800 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-xl"
                    />
                </div>
            </header>

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-900/50 border-b border-gray-700">
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Capa</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Título</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Projetos Incluídos</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Data de Criação</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredAnthologies.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-50">
                                            <FileText size={48} className="text-gray-600" />
                                            <p className="text-gray-500 font-medium">Nenhuma coletânea encontrada.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAnthologies.map((anthology) => (
                                    <tr key={anthology._id} className="hover:bg-gray-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="w-12 h-16 rounded-lg bg-gray-900 border border-gray-700 flex items-center justify-center overflow-hidden shadow-lg group-hover:scale-110 transition-transform">
                                                {anthology.coverImageUrl ? (
                                                    <img
                                                        src={`${BACKEND_URL}${anthology.coverImageUrl}`}
                                                        alt="Cover"
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <BookOpen size={20} className="text-gray-700" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-white text-lg">{anthology.title}</div>
                                            <div className="text-[10px] text-gray-500 font-mono mt-1 opacity-60">ID: {anthology._id.substring(0, 8)}...</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {anthology.projectIds.map(p => (
                                                    <span key={p._id} className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[11px] font-bold rounded-md border border-blue-500/20">
                                                        {p.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Calendar size={14} className="text-gray-500" />
                                                {new Date(anthology.createdAt).toLocaleDateString()}
                                            </div>
                                            <div className="text-xs opacity-50 mt-1 pl-6">
                                                {new Date(anthology.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <Link
                                                    to={`/anthology/edit/${anthology._id}`}
                                                    className="p-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl transition-all"
                                                    title="Editar Coletânea"
                                                >
                                                    <Edit size={18} />
                                                </Link>
                                                <button
                                                    onClick={() => handleDownload(anthology._id)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 group/btn"
                                                >
                                                    <Download size={18} className="group-hover/btn:-translate-y-0.5 transition-transform" />
                                                    Download
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AnthologyList;
