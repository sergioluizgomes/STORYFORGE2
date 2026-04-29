import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FileText, ChevronRight, Trash2 } from 'lucide-react';
import { buildApiUrl, BACKEND_URL } from '../lib/api';

export default function Dashboard() {
    const [projects, setProjects] = useState([]);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    useEffect(() => {
        axios.get(buildApiUrl('/projects'))
            .then(res => setProjects(res.data))
            .catch(err => console.error(err));
    }, []);

    const handleDeleteClick = (e, project) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteConfirm(project);
    };

    const confirmDelete = async () => {
        try {
            await axios.delete(buildApiUrl(`/projects/${deleteConfirm._id}`));
            setProjects(projects.filter(p => p._id !== deleteConfirm._id));
            setDeleteConfirm(null);
        } catch (err) {
            console.error('Error deleting project:', err);
            alert('Failed to delete project');
        }
    };

    const cancelDelete = () => {
        setDeleteConfirm(null);
    };

    return (
        <div className="p-8">
            <h2 className="text-3xl font-bold mb-6">Your Projects</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(project => (
                    <Link key={project._id} to={`/project/${project._id}`} className="block">
                        <div className="bg-gray-800 rounded-xl border border-gray-700 hover:border-blue-500 transition shadow-lg group overflow-hidden">
                            {project.coverImageUrl ? (
                                <div className="w-full h-48 bg-gray-900 overflow-hidden">
                                    <img
                                        src={`${BACKEND_URL}${project.coverImageUrl}`}
                                        alt={`${project.name} cover`}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                </div>
                            ) : null}
                            <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-gray-700 rounded-lg group-hover:bg-blue-900/30 transition">
                                    <FileText className="text-blue-400" size={24} />
                                </div>
                                <div className="flex gap-2 items-center">
                                    <span className={`px-2 py-1 text-xs rounded-full ${project.status === 'new' ? 'bg-purple-900/50 text-purple-300' : 'bg-green-900/50 text-green-300'
                                        }`}>
                                        {project.status.toUpperCase()}
                                    </span>
                                    <button
                                        onClick={(e) => handleDeleteClick(e, project)}
                                        className="p-1.5 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition text-red-400 hover:text-red-300"
                                        title="Delete Project"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold mb-2 text-gray-100">{project.name}</h3>
                            <p className="text-gray-400 text-sm mb-4">Style: <span className="text-blue-300">{project.style}</span></p>

                            <div className="flex items-center text-blue-400 text-sm font-medium">
                                Open Project <ChevronRight size={16} className="ml-1" />
                            </div>
                            </div>
                        </div>
                    </Link>
                ))}

                {projects.length === 0 && (
                    <div className="col-span-full text-center py-20 text-gray-500">
                        <p>No projects yet. Start by creating a new one!</p>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
                        <h3 className="text-xl font-bold mb-4 text-red-400">Confirm Deletion</h3>
                        <p className="text-gray-300 mb-6">
                            Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>? 
                            This will permanently remove the project, its Bible, all scenes, and uploaded files.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={cancelDelete}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition"
                            >
                                Delete Project
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
