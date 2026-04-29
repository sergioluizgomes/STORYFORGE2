import { useState, useEffect } from 'react';
import axios from 'axios';
import { buildApiUrl } from '../lib/api';

export default function useProjectStructure(projectId) {
  const [project, setProject] = useState(null);
  const [bible, setBible] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState({ type: 'project', id: null, data: null });
  const [expandedNodes, setExpandedNodes] = useState(new Set(['project', 'bible', 'chapters', 'characters', 'settings']));

  useEffect(() => {
    if (!projectId) return;
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [projectRes, bibleRes, scenesRes] = await Promise.all([
        axios.get(buildApiUrl(`/projects/${projectId}`)),
        axios.get(buildApiUrl(`/generate/bible/${projectId}`)),
        axios.get(buildApiUrl(`/scenes/project/${projectId}`))
      ]);

      setProject(projectRes.data);
      setBible(bibleRes.data);
      setScenes(scenesRes.data);
      setSelectedItem({ type: 'project', id: projectId, data: projectRes.data });
    } catch (err) {
      console.error('Error loading project structure:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const selectItem = (type, id, data) => {
    setSelectedItem({ type, id, data });
  };

  const isExpanded = (nodeId) => expandedNodes.has(nodeId);

  // Helper: Get scenes for a specific beat
  const getScenesForBeat = (beatId) => {
    return scenes.filter(s => s.beatId === beatId);
  };

  // Helper: Get stats
  const getStats = () => {
    if (!bible) return {};
    
    return {
      charactersCount: bible.characters?.length || 0,
      settingsCount: bible.settings?.length || 0,
      chaptersCount: bible.chapters?.length || 0,
      beatsCount: bible.chapters?.reduce((sum, ch) => sum + (ch.beats?.length || 0), 0) || 0,
      scenesCount: scenes.length || 0,
      scenesWithContent: scenes.filter(s => s.content && s.content.trim()).length || 0
    };
  };

  return {
    project,
    bible,
    scenes,
    loading,
    error,
    selectedItem,
    expandedNodes,
    toggleNode,
    selectItem,
    isExpanded,
    getScenesForBeat,
    getStats,
    reload: loadProjectData
  };
}
