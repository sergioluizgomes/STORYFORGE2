import React from 'react';
import { ChevronRight, ChevronDown, BookOpen, Users, MapPin, FileText, Zap, FileCheck } from 'lucide-react';

const iconMap = {
  project: BookOpen,
  bible: BookOpen,
  characters: Users,
  settings: MapPin,
  chapters: FileText,
  chapter: FileText,
  beat: Zap,
  scene: FileCheck,
};

export default function TreeNode({ 
  node, 
  level = 0, 
  isExpanded, 
  isSelected, 
  onToggle, 
  onSelect,
  children 
}) {
  const Icon = iconMap[node.type] || FileText;
  const hasChildren = React.Children.count(children) > 0;

  const handleClick = () => {
    if (hasChildren) {
      onToggle(node.id);
    }
    onSelect(node.type, node.dataId, node.data);
  };

  const getNodeColor = () => {
    switch (node.type) {
      case 'project': return 'text-purple-400';
      case 'bible': return 'text-blue-400';
      case 'characters': return 'text-green-400';
      case 'settings': return 'text-yellow-400';
      case 'chapters': return 'text-orange-400';
      case 'chapter': return 'text-orange-300';
      case 'beat': return 'text-cyan-400';
      case 'scene': return 'text-pink-400';
      default: return 'text-gray-400';
    }
  };

  const getBadge = () => {
    if (node.count !== undefined) {
      return (
        <span className="ml-auto text-xs bg-gray-700 px-2 py-0.5 rounded-full text-gray-400">
          {node.count}
        </span>
      );
    }
    if (node.isEmpty) {
      return (
        <span className="ml-auto text-xs text-gray-600 italic">vazio</span>
      );
    }
    return null;
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={`
          flex items-center gap-2 px-3 py-2 cursor-pointer
          transition-all rounded-lg group
          ${isSelected ? 'bg-blue-600/30 border-l-2 border-blue-500' : 'hover:bg-gray-700/50'}
          ${level > 0 ? 'ml-' + (level * 4) : ''}
        `}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
      >
        {hasChildren && (
          <button 
            className="text-gray-400 hover:text-white transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
        
        {!hasChildren && <div className="w-4" />}

        <Icon size={16} className={`${getNodeColor()} flex-shrink-0`} />
        
        <span className="text-sm font-medium text-gray-200 truncate flex-1">
          {node.label}
        </span>

        {getBadge()}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {children}
        </div>
      )}
    </div>
  );
}
