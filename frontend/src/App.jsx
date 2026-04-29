import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Home, BookOpen, PlusSquare, Library, Layers } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import NewProject from './pages/NewProject';
import ProjectView from './pages/ProjectView';
import ProjectStructure from './pages/ProjectStructure';
import Anthology from './pages/Anthology';
import AnthologyList from './pages/AnthologyList';
import BatchProjects from './pages/BatchProjects';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-900 text-white font-sans">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col shadow-2xl z-10">
          <div className="p-6 border-b border-gray-700">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent tracking-tighter">
              STORYFORGE AI
            </h1>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-700/50 transition-all group">
              <Home size={20} className="text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Projetos</span>
            </Link>
            <Link to="/new" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-700/50 transition-all group">
              <PlusSquare size={20} className="text-green-400 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Novo Projeto</span>
            </Link>
            <Link to="/batch" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-700/50 transition-all group">
              <Layers size={20} className="text-purple-400 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Lote de Projetos</span>
            </Link>

            <div className="pt-4 pb-2 px-4 text-[10px] font-black uppercase tracking-widest text-gray-600">
              Coletâneas
            </div>

            <Link to="/anthology" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-700/50 transition-all group">
              <PlusSquare size={20} className="text-purple-400 group-hover:scale-110 transition-transform" />
              <span className="font-medium text-gray-300">Nova Coletânea</span>
            </Link>
            <Link to="/my-anthologies" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-700/50 transition-all group">
              <Library size={20} className="text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="font-medium text-gray-300">Minhas Coletâneas</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-gray-900">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<NewProject />} />
            <Route path="/project/:id" element={<ProjectView />} />
            <Route path="/project/:id/structure" element={<ProjectStructure />} />
            <Route path="/anthology" element={<Anthology />} />
            <Route path="/anthology/edit/:id" element={<Anthology />} />
            <Route path="/my-anthologies" element={<AnthologyList />} />
            <Route path="/batch" element={<BatchProjects />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
