const EPub = require('epub-gen-memory').default;
const Project = require('../models/Project');
const Bible = require('../models/Bible');
const Scene = require('../models/Scene');
const HybridBook = require('../models/HybridBook');
const { groupScenesForManuscript } = require('./storyStructureService');

/**
 * Generates an EPUB file compatible with Amazon KDP
 * KDP requirements:
 * - EPUB 3.0 format
 * - Valid metadata (title, author, language)
 * - Proper chapter structure
 * - CSS styling that works on Kindle devices
 */
class EpubService {
    /**
     * Generate EPUB from a project
     * @param {string} projectId - The project ID
     * @param {Object} options - Export options
     * @returns {Promise<Buffer>} - EPUB file buffer
     */
    async generateEpub(projectId, options = {}) {
        const {
            includeImages = false,
            author = 'Unknown Author',
            publisher = 'StoryForge',
            includeCoverPage = true
        } = options;

        // Load project data
        const project = await Project.findById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        const bible = await Bible.findOne({ projectId });
        const scenes = await Scene.find({ projectId })
            .sort({ chapterNumber: 1, beatId: 1, createdAt: 1, generatedAt: 1 })
            .lean();
        const hybridBook = await HybridBook.findOne({ projectId });

        // Prepare metadata
        const metadata = {
            title: project.name,
            author: author,
            publisher: publisher,
            language: this._normalizeLanguage(project.language),
            cover: this._resolveUrl(project.coverImageUrl) || undefined,
            description: bible?.premise || project.premise || '',
            publishDate: new Date().toISOString().split('T')[0],
        };

        // Build content
        const content = await this._buildContent(project, bible, scenes, hybridBook, {
            includeImages,
            includeCoverPage
        });

        console.log(`Content built: ${content.length} chapters`);

        if (!content || content.length === 0) {
            throw new Error('No content available to generate EPUB. Please generate scenes or hybrid book first.');
        }

        // EPUB generation options compatible with KDP (metadata only)
        const epubOptions = {
            ...metadata,
            // KDP-friendly CSS
            css: this._getKdpCompatibleCss(),
            fonts: [],
            version: 3, // EPUB 3.0 for KDP
            tocTitle: 'Índice',
            appendChapterTitles: true,
        };

        console.log('Calling EPub generator...');
        // Generate EPUB (options first, chapters/content as second arg)
        const epubBuffer = await EPub(epubOptions, content);
        console.log(`EPUB generated successfully, size: ${epubBuffer.length} bytes`);
        return epubBuffer;
    }

    /**
     * Build the content structure for the EPUB
     */
    async _buildContent(project, bible, scenes, hybridBook, options) {
        const content = [];

        // Add cover page if requested
        const resolvedCover = this._resolveUrl(project.coverImageUrl);

        if (options.includeCoverPage && resolvedCover) {
            content.push({
                title: 'Capa',
                content: `<div style="text-align: center; padding: 50px 0;">
                    <img src="${resolvedCover}" alt="Capa" style="max-width: 100%; height: auto;" />
                </div>`,
                excludeFromToc: true
            });
        }

        // Add title page
        content.push({
            title: 'Página de Título',
            content: `<div style="text-align: center; padding: 100px 20px;">
                <h1 style="font-size: 2.5em; margin-bottom: 30px;">${project.name}</h1>
                ${bible?.premise ? `<p style="font-style: italic; margin: 20px 0;">${bible.premise}</p>` : ''}
            </div>`,
            excludeFromToc: true
        });

        // If using HybridBook format
        if (hybridBook && hybridBook.blocks && hybridBook.blocks.length > 0) {
            const chapters = this._organizeHybridIntoChapters(hybridBook, bible);
            
            for (const chapter of chapters) {
                let chapterContent = `<h1 class="chapter-title">${chapter.title}</h1>\n`;
                
                for (const block of chapter.blocks) {
                    if (block.type === 'heading') {
                        chapterContent += `<h2>${block.text}</h2>\n`;
                    } else if (block.type === 'prose') {
                        // Format prose with proper paragraphs
                        const paragraphs = block.text.split('\n\n');
                        for (const para of paragraphs) {
                            if (para.trim()) {
                                chapterContent += `<p>${para.trim()}</p>\n`;
                            }
                        }
                    } else if (block.type === 'image' && options.includeImages && block.imageUrl) {
                        const resolvedImg = this._resolveUrl(block.imageUrl);
                        if (!resolvedImg) continue;
                        chapterContent += `<div class="image-container">
                            <img src="${resolvedImg}" alt="${block.caption || ''}" />
                            ${block.caption ? `<p class="caption">${block.caption}</p>` : ''}
                        </div>\n`;
                    }
                }
                
                content.push({
                    title: chapter.title,
                    content: chapterContent
                });
            }
        } else {
            // Use scenes organized by chapters
            const chapterGroups = this._organizeScenesByChapter(scenes, bible);
            
            for (const chapterData of chapterGroups) {
                let chapterContent = `<h1 class="chapter-title">${chapterData.title}</h1>\n`;
                
                chapterData.scenes.forEach((scene, index) => {
                    const sceneTitle = scene.title || scene.beatName || `Scene ${index + 1}`;

                    if (sceneTitle) {
                        chapterContent += `<h2 class="scene-title">${sceneTitle}</h2>\n`;
                    }
                    
                    if (scene.content) {
                        // Format prose with proper paragraphs
                        const paragraphs = scene.content.split('\n\n');
                        for (const para of paragraphs) {
                            if (para.trim()) {
                                chapterContent += `<p>${para.trim()}</p>\n`;
                            }
                        }
                    }
                });
                
                content.push({
                    title: chapterData.title,
                    content: chapterContent
                });
            }
        }

        return content;
    }

    /**
     * Organize scenes by chapter
     */
    _organizeScenesByChapter(scenes, bible) {
        return groupScenesForManuscript(scenes)
            .map(group => {
                const scenesWithContent = group.scenes.filter(scene => scene.content);

                if (group.type === 'unassigned') {
                    return {
                        ...group,
                        title: 'Scenes',
                        scenes: scenesWithContent
                    };
                }

                const chapterNum = group.chapterNumber;
                let chapterTitle = `Capítulo ${chapterNum}`;

                if (bible && bible.chapters) {
                    const bibleChapter = bible.chapters.find(c => Number(c.chapterNumber) === chapterNum);
                    if (bibleChapter && bibleChapter.title) {
                        chapterTitle = `Capítulo ${chapterNum}: ${bibleChapter.title}`;
                    }
                }

                return {
                    ...group,
                    title: chapterTitle,
                    scenes: scenesWithContent
                };
            })
            .filter(group => group.scenes.length > 0);
    }

    /**
     * Organize HybridBook blocks into chapters
     */
    _organizeHybridIntoChapters(hybridBook, bible) {
        const chapters = [];
        let currentChapter = null;
        let chapterCounter = 0;

        for (const block of hybridBook.blocks) {
            // Start a new chapter when we find a heading block
            if (block.type === 'heading' && block.text && 
                (block.text.toLowerCase().includes('capítulo') || 
                 block.text.toLowerCase().includes('chapter'))) {
                
                if (currentChapter && currentChapter.blocks.length > 0) {
                    chapters.push(currentChapter);
                }
                
                chapterCounter++;
                currentChapter = {
                    title: block.text,
                    blocks: []
                };
            } else {
                // If no chapter started yet, create first chapter
                if (!currentChapter) {
                    chapterCounter = 1;
                    currentChapter = {
                        title: `Capítulo ${chapterCounter}`,
                        blocks: []
                    };
                }
                
                if (block.text || (block.type === 'image' && block.imageUrl)) {
                    currentChapter.blocks.push(block);
                }
            }
        }

        // Add last chapter
        if (currentChapter && currentChapter.blocks.length > 0) {
            chapters.push(currentChapter);
        }

        return chapters;
    }

    /**
     * Normalize language code to ISO 639-1 format required by KDP
     */
    _normalizeLanguage(language) {
        const languageMap = {
            'português brasileiro': 'pt',
            'portuguese': 'pt',
            'português': 'pt',
            'english': 'en',
            'inglês': 'en',
            'spanish': 'es',
            'espanhol': 'es',
            'french': 'fr',
            'francês': 'fr',
            'german': 'de',
            'alemão': 'de',
            'italian': 'it',
            'italiano': 'it'
        };

        const normalized = language.toLowerCase();
        return languageMap[normalized] || 'pt';
    }

    /**
     * Ensure URLs are absolute for node-fetch (epub-gen-memory requirement)
     */
    _resolveUrl(url) {
        if (!url) return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    /**
     * Get KDP-compatible CSS
     * Follows Amazon's best practices for Kindle formatting
     */
    _getKdpCompatibleCss() {
        return `
            /* KDP-Compatible CSS */
            body {
                font-family: serif;
                font-size: 1em;
                line-height: 1.5;
                margin: 0;
                padding: 0;
                text-align: justify;
            }

            h1, h2, h3, h4, h5, h6 {
                font-family: sans-serif;
                font-weight: bold;
                page-break-after: avoid;
                page-break-inside: avoid;
                margin-top: 1em;
                margin-bottom: 0.5em;
                text-align: left;
            }

            h1.chapter-title {
                font-size: 2em;
                margin-top: 2em;
                margin-bottom: 1em;
                page-break-before: always;
                text-align: center;
            }

            h2.scene-title {
                font-size: 1.5em;
                margin-top: 1.5em;
                text-align: left;
            }

            p {
                margin: 0;
                text-indent: 1.5em;
                margin-bottom: 0;
                orphans: 2;
                widows: 2;
            }

            p:first-of-type,
            h1 + p,
            h2 + p,
            h3 + p {
                text-indent: 0;
            }

            .image-container {
                text-align: center;
                margin: 1em 0;
                page-break-inside: avoid;
            }

            .image-container img {
                max-width: 100%;
                height: auto;
            }

            .caption {
                font-size: 0.9em;
                font-style: italic;
                margin-top: 0.5em;
                text-indent: 0;
            }

            /* Prevent orphans and widows */
            p {
                orphans: 2;
                widows: 2;
            }

            /* Page breaks */
            .page-break {
                page-break-after: always;
            }

            /* Center alignment for specific elements */
            .center {
                text-align: center;
                text-indent: 0;
            }

            /* Emphasis */
            em, i {
                font-style: italic;
            }

            strong, b {
                font-weight: bold;
            }
        `;
    }
}

module.exports = new EpubService();
