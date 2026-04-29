import React from 'react';
import TreeNode from './TreeNode';

export default function TreeView({ 
  project, 
  bible, 
  scenes, 
  selectedItem, 
  expandedNodes, 
  onToggle, 
  onSelect,
  getScenesForBeat 
}) {
  const isExpanded = (nodeId) => expandedNodes.has(nodeId);
  const isSelected = (type, id) => selectedItem.type === type && selectedItem.id === id;

  if (!project || !bible) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        Carregando estrutura...
      </div>
    );
  }

  // Build tree structure
  const renderTree = () => {
    return (
      <div className="space-y-1">
        {/* Project Root */}
        <TreeNode
          node={{ 
            id: 'project', 
            type: 'project', 
            label: project.name || 'Projeto',
            dataId: project._id,
            data: project
          }}
          isExpanded={isExpanded('project')}
          isSelected={isSelected('project', project._id)}
          onToggle={onToggle}
          onSelect={onSelect}
        >
          {/* Bible Section */}
          <TreeNode
            node={{ 
              id: 'bible', 
              type: 'bible', 
              label: 'Story Bible',
              dataId: null,
              data: bible
            }}
            level={1}
            isExpanded={isExpanded('bible')}
            isSelected={isSelected('bible', null)}
            onToggle={onToggle}
            onSelect={onSelect}
          >
            {/* Characters */}
            <TreeNode
              node={{ 
                id: 'characters', 
                type: 'characters', 
                label: 'Personagens',
                count: bible.characters?.length || 0,
                dataId: null,
                data: bible.characters
              }}
              level={2}
              isExpanded={isExpanded('characters')}
              isSelected={isSelected('characters', null)}
              onToggle={onToggle}
              onSelect={onSelect}
            >
              {bible.characters?.map((char, idx) => (
                <TreeNode
                  key={`char-${idx}`}
                  node={{ 
                    id: `character-${idx}`, 
                    type: 'character', 
                    label: char.name || `Personagem ${idx + 1}`,
                    dataId: idx,
                    data: char
                  }}
                  level={3}
                  isExpanded={false}
                  isSelected={isSelected('character', idx)}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              ))}
            </TreeNode>

            {/* Settings */}
            <TreeNode
              node={{ 
                id: 'settings', 
                type: 'settings', 
                label: 'Cenários',
                count: bible.settings?.length || 0,
                dataId: null,
                data: bible.settings
              }}
              level={2}
              isExpanded={isExpanded('settings')}
              isSelected={isSelected('settings', null)}
              onToggle={onToggle}
              onSelect={onSelect}
            >
              {bible.settings?.map((setting, idx) => (
                <TreeNode
                  key={`setting-${idx}`}
                  node={{ 
                    id: `setting-${idx}`, 
                    type: 'setting', 
                    label: setting.name || `Cenário ${idx + 1}`,
                    dataId: idx,
                    data: setting
                  }}
                  level={3}
                  isExpanded={false}
                  isSelected={isSelected('setting', idx)}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              ))}
            </TreeNode>

            {/* Chapters */}
            <TreeNode
              node={{ 
                id: 'chapters', 
                type: 'chapters', 
                label: 'Capítulos',
                count: bible.chapters?.length || 0,
                dataId: null,
                data: bible.chapters
              }}
              level={2}
              isExpanded={isExpanded('chapters')}
              isSelected={isSelected('chapters', null)}
              onToggle={onToggle}
              onSelect={onSelect}
            >
              {bible.chapters?.map((chapter, chIdx) => (
                <TreeNode
                  key={`chapter-${chapter.chapterNumber}`}
                  node={{ 
                    id: `chapter-${chapter.chapterNumber}`, 
                    type: 'chapter', 
                    label: `Cap ${chapter.chapterNumber}: ${chapter.title || 'Sem título'}`,
                    count: chapter.beats?.length || 0,
                    dataId: chapter.chapterNumber,
                    data: chapter
                  }}
                  level={3}
                  isExpanded={isExpanded(`chapter-${chapter.chapterNumber}`)}
                  isSelected={isSelected('chapter', chapter.chapterNumber)}
                  onToggle={onToggle}
                  onSelect={onSelect}
                >
                  {chapter.beats?.map((beat, beatIdx) => {
                    const beatScenes = getScenesForBeat(beat.id);
                    return (
                      <TreeNode
                        key={`beat-${beat.id}`}
                        node={{ 
                          id: `beat-${beat.id}`, 
                          type: 'beat', 
                          label: beat.title || `Beat ${beat.id}`,
                          count: beatScenes.length,
                          dataId: beat.id,
                          data: { ...beat, beatIndex: beatIdx, chapterNumber: chapter.chapterNumber }
                        }}
                        level={4}
                        isExpanded={isExpanded(`beat-${beat.id}`)}
                        isSelected={isSelected('beat', beat.id)}
                        onToggle={onToggle}
                        onSelect={onSelect}
                      >
                        {beatScenes.map((scene, sceneIdx) => (
                          <TreeNode
                            key={`scene-${scene._id}`}
                            node={{ 
                              id: `scene-${scene._id}`, 
                              type: 'scene', 
                              label: scene.title || `Cena ${sceneIdx + 1}`,
                              isEmpty: !scene.content || !scene.content.trim(),
                              dataId: scene._id,
                              data: scene
                            }}
                            level={5}
                            isExpanded={false}
                            isSelected={isSelected('scene', scene._id)}
                            onToggle={onToggle}
                            onSelect={onSelect}
                          />
                        ))}
                      </TreeNode>
                    );
                  })}
                </TreeNode>
              ))}
            </TreeNode>
          </TreeNode>
        </TreeNode>
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto bg-gray-800 border-r border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-white">Estrutura do Projeto</h2>
      </div>
      <div className="p-2">
        {renderTree()}
      </div>
    </div>
  );
}
