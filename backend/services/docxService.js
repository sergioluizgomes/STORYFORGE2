const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const Project = require('../models/Project');
const Scene = require('../models/Scene');
const Bible = require('../models/Bible');
const { sortScenesForManuscript } = require('./storyStructureService');

/**
 * Parse Markdown formatting and convert to TextRun array
 * Supports: **bold**, *italic*, ***bold+italic***
 */
function parseMarkdown(text) {
    const runs = [];
    let remaining = text;
    
    // Regex to match Markdown patterns
    const patterns = [
        { regex: /\*\*\*(.+?)\*\*\*/g, bold: true, italics: true },  // ***bold+italic***
        { regex: /\*\*(.+?)\*\*/g, bold: true, italics: false },      // **bold**
        { regex: /\*(.+?)\*/g, bold: false, italics: true },          // *italic*
    ];
    
    let lastIndex = 0;
    const matches = [];
    
    // Find all matches and their positions
    patterns.forEach(pattern => {
        const regex = new RegExp(pattern.regex.source, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                text: match[1],
                bold: pattern.bold,
                italics: pattern.italics
            });
        }
    });
    
    // Sort matches by start position
    matches.sort((a, b) => a.start - b.start);
    
    // Remove overlapping matches (keep the longest/most specific)
    const filteredMatches = [];
    for (let i = 0; i < matches.length; i++) {
        const current = matches[i];
        let isOverlapped = false;
        
        for (let j = 0; j < filteredMatches.length; j++) {
            const existing = filteredMatches[j];
            if (current.start >= existing.start && current.end <= existing.end) {
                isOverlapped = true;
                break;
            }
        }
        
        if (!isOverlapped) {
            filteredMatches.push(current);
        }
    }
    
    // Build TextRuns
    lastIndex = 0;
    filteredMatches.forEach(match => {
        // Add plain text before the match
        if (match.start > lastIndex) {
            const plainText = text.substring(lastIndex, match.start);
            if (plainText) {
                runs.push(new TextRun({ text: plainText }));
            }
        }
        
        // Add formatted text
        runs.push(new TextRun({
            text: match.text,
            bold: match.bold,
            italics: match.italics
        }));
        
        lastIndex = match.end;
    });
    
    // Add remaining plain text
    if (lastIndex < text.length) {
        const plainText = text.substring(lastIndex);
        if (plainText) {
            runs.push(new TextRun({ text: plainText }));
        }
    }
    
    // If no formatting was found, return simple text
    if (runs.length === 0) {
        runs.push(new TextRun({ text: text }));
    }
    
    return runs;
}

/**
 * Generate DOCX for a project
 * @param {string} projectId - The project ID
 * @param {object} options - Export options
 * @returns {Promise<Buffer>} - DOCX file buffer
 */
async function generateDocx(projectId, options = {}) {
    const {
        author = 'Unknown Author',
        includeCoverPage = true,
        fontSize = 24, // 12pt (half-points)
        fontFamily = 'Times New Roman'
    } = options;

    console.log(`Generating DOCX for project ${projectId}`);

    // Fetch project data
    const project = await Project.findById(projectId).lean();
    if (!project) {
        throw new Error('Project not found');
    }
    
    // Fetch bible to get chapter titles
    const bible = await Bible.findOne({ projectId }).lean();
    
    // Create a map of chapter numbers to chapter titles
    const chapterTitles = {};
    if (bible && bible.chapters) {
        bible.chapters.forEach(chapter => {
            chapterTitles[chapter.chapterNumber] = chapter.title;
        });
    }
    
    // Fetch all scenes in a coarse database order, then apply the manuscript order
    // in memory so legacy scenes with missing fields still get a stable fallback.
    const scenes = await Scene.find({ projectId })
        .sort({ chapterNumber: 1, beatId: 1, createdAt: 1, generatedAt: 1 })
        .lean();

    if (!scenes || scenes.length === 0) {
        throw new Error('No scenes found for this project');
    }

    const orderedScenes = sortScenesForManuscript(scenes);
    const sections = [];

    // Add cover page
    if (includeCoverPage) {
        sections.push(
            new Paragraph({
                text: project.name || 'Untitled',
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            }),
            new Paragraph({
                text: `by ${author}`,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            }),
            new Paragraph({
                text: '',
                spacing: { after: 400 }
            })
        );

        if (project.logline) {
            sections.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: project.logline,
                            italics: true
                        })
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 800 }
                })
            );
        }

        // Page break after cover
        sections.push(
            new Paragraph({
                text: '',
                pageBreakBefore: true
            })
        );
    }

    // Process scenes
    let currentChapter = null;
    let currentSceneTitle = null;

    orderedScenes.forEach((scene, index) => {
        // Add chapter heading if changed
        if (scene.chapterNumber && scene.chapterNumber !== currentChapter) {
            currentChapter = scene.chapterNumber;
            currentSceneTitle = null;
            // Get the chapter title from the bible
            const chapterTitle = chapterTitles[currentChapter] || '';
            
            // Page break before new chapter (except first)
            if (index > 0) {
                sections.push(
                    new Paragraph({
                        text: '',
                        pageBreakBefore: true
                    })
                );
            }

            // Only add chapter heading if there's a title
            if (chapterTitle) {
                sections.push(
                    new Paragraph({
                        text: chapterTitle,
                        heading: HeadingLevel.HEADING_1,
                        spacing: { after: 400 }
                    })
                );
            }
        }

        const sceneTitle = scene.title || scene.beatName || `Scene ${index + 1}`;

        // Add scene heading if changed
        if (sceneTitle && sceneTitle !== currentSceneTitle) {
            currentSceneTitle = sceneTitle;
            sections.push(
                new Paragraph({
                    text: sceneTitle,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 200 }
                })
            );
        }

        // Add scene content with Markdown parsing
        if (scene.content) {
            // Split content into paragraphs
            const paragraphs = scene.content.split('\n\n').filter(p => p.trim());
            
            paragraphs.forEach(para => {
                const trimmedPara = para.trim();
                if (trimmedPara) {
                    // Parse Markdown formatting in the paragraph
                    const textRuns = parseMarkdown(trimmedPara);
                    
                    sections.push(
                        new Paragraph({
                            children: textRuns,
                            spacing: { after: 200 },
                            alignment: AlignmentType.JUSTIFIED
                        })
                    );
                }
            });
        }

        // Add spacing between scenes
        sections.push(
            new Paragraph({
                text: '* * *',
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 200 }
            })
        );
    });

    // Create document
    const doc = new Document({
        creator: author,
        title: project.name || 'Untitled',
        description: project.logline || '',
        sections: [{
            properties: {},
            children: sections
        }]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);
    console.log(`DOCX generated successfully, size: ${buffer.length} bytes`);
    
    return buffer;
}

module.exports = {
    generateDocx
};
