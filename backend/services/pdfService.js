const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function _toLocalFilePath(maybeUrlPath) {
    if (!maybeUrlPath) return null;
    const asString = String(maybeUrlPath);
    if (/^https?:\/\//i.test(asString)) {
        try {
            const url = new URL(asString);
            const pathname = url.pathname || '';
            const cleanedFromUrl = pathname.replace(/^[/\\]+/, '');
            return cleanedFromUrl ? path.join(__dirname, '..', cleanedFromUrl) : null;
        } catch {
            return null;
        }
    }

    // On Windows, paths like "/uploads/x.png" are considered absolute by path.isAbsolute,
    // but they are actually URL paths in this app. Treat leading-slash paths as relative to backend.
    const looksLikeWindowsAbs = /^[a-zA-Z]:[\\/]/.test(asString) || /^\\\\/.test(asString);
    if (looksLikeWindowsAbs) return asString;

    const cleaned = asString.replace(/^[/\\]+/, '');
    return path.join(__dirname, '..', cleaned);
}

function _pickPanelImagePath(panel) {
    // Prefer current imageUrl, else last imageHistory entry
    const candidate = panel?.imageUrl || panel?.imageHistory?.slice(-1)[0]?.imageUrl;
    return _toLocalFilePath(candidate);
}

function _inferLayout(panels) {
    const count = panels?.length || 0;
    if (count === 1) return 'splash';
    if (count === 2) return 'horizontal-split';
    if (count === 3) return '3-panel';
    if (count === 4) return '2x2';
    if (count === 5) return '2-3-split';
    if (count >= 6) return '2x3';
    return '2x2';
}

function _cellsForLayout(layout, panelCount, contentWidth, contentHeight, originX, originY, gap) {
    const cells = [];
    const safeGap = gap ?? 8;
    const cw = contentWidth;
    const ch = contentHeight;

    const makeGrid = (rows, cols) => {
        const totalGapX = safeGap * (cols - 1);
        const totalGapY = safeGap * (rows - 1);
        const cellW = (cw - totalGapX) / cols;
        const cellH = (ch - totalGapY) / rows;
        const arr = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                arr.push({
                    x: originX + c * (cellW + safeGap),
                    y: originY + r * (cellH + safeGap),
                    w: cellW,
                    h: cellH
                });
            }
        }
        return arr;
    };

    switch (layout) {
        case 'splash':
            cells.push({ x: originX, y: originY, w: cw, h: ch });
            break;
        case 'horizontal-split':
            cells.push(...makeGrid(1, Math.max(2, panelCount)));
            break;
        case 'vertical-split':
            cells.push(...makeGrid(Math.max(2, panelCount), 1));
            break;
        case '3-panel':
            cells.push(...makeGrid(3, 1));
            break;
        case '2x2':
            cells.push(...makeGrid(2, 2));
            break;
        case '2x3':
            // Interpret 2x3 as 2 columns x 3 rows (taller grid)
            cells.push(...makeGrid(3, 2));
            break;
        case '2-3-split': {
            const row1H = ch * 0.45;
            const row2H = ch - row1H - safeGap;
            const row1Cells = makeGrid(1, 2).map(c => ({ ...c, h: row1H }));
            const row2Cells = [];
            const totalGapX = safeGap * 2; // 3 cols => 2 gaps
            const cellW = (cw - totalGapX) / 3;
            for (let c = 0; c < 3; c++) {
                row2Cells.push({
                    x: originX + c * (cellW + safeGap),
                    y: originY + row1H + safeGap,
                    w: cellW,
                    h: row2H
                });
            }
            cells.push(...row1Cells, ...row2Cells);
            break;
        }
        default:
            cells.push(...makeGrid(Math.ceil(panelCount / 2), 2));
    }

    return cells.slice(0, panelCount);
}

function _renderComicPage(doc, page) {
    const panels = Array.isArray(page?.panels) ? page.panels : [];
    const layout = page?.layout || _inferLayout(panels);
    const marginLeft = doc.page.margins.left;
    const marginTop = doc.page.margins.top;
    const marginRight = doc.page.margins.right;
    const marginBottom = doc.page.margins.bottom;
    const contentWidth = doc.page.width - marginLeft - marginRight;
    const contentHeight = doc.page.height - marginTop - marginBottom;
    const cells = _cellsForLayout(layout, panels.length, contentWidth, contentHeight, marginLeft, marginTop, 10);

    panels.forEach((panel, idx) => {
        const cell = cells[idx];
        if (!cell) return;
        const imagePath = _pickPanelImagePath(panel);
        const hasImage = imagePath && fs.existsSync(imagePath);
        if (hasImage) {
            try {
                doc.image(imagePath, cell.x, cell.y, { fit: [cell.w, cell.h], align: 'center', valign: 'center' });
            } catch (e) {
                // If the image fails to embed, leave the cell blank
            }
        }
    });
}

async function generateProjectPDF(project, bible, scenes, res) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Stream PDF to response
    doc.pipe(res);

    // --- COVER PAGE (if exists) ---
    if (project.coverImageUrl) {
        try {
            const coverPath = _toLocalFilePath(project.coverImageUrl);
            if (fs.existsSync(coverPath)) {
                doc.image(coverPath, 0, 0, { width: doc.page.width, height: doc.page.height });
                doc.addPage();
            }
        } catch (e) {
            console.error("Failed to add cover to PDF", e);
        }
    }

    // --- TITLE PAGE ---
    doc.y = doc.page.height * 0.4;
    doc.fontSize(42).font('Helvetica-Bold').text(project.name, { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(20).font('Helvetica-Oblique').text(project.style, { align: 'center' });
    doc.addPage();

    await _renderProjectToDoc(doc, project, bible, scenes);

    // Finalize PDF
    doc.end();
}

async function generateChapterAnalysisPDF(project, chapter, res) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    const projectName = project?.name || 'Projeto';
    const chapterTitle = chapter?.title || 'Capítulo';
    const chapterType = chapter?.type || 'Normal';
    const generatedOn = chapter?.analysisDate ? new Date(chapter.analysisDate) : new Date();
    const formattedDate = generatedOn.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    const formattedTime = generatedOn.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    doc.fontSize(22).font('Helvetica-Bold').text('Relatório de Análise Editorial', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(16).font('Helvetica-Bold').text(projectName, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica').text(`Capítulo ${chapter.chapterNumber}: ${chapterTitle}`, { align: 'center' });
    doc.text(`Tipo: ${chapterType}`, { align: 'center' });
    doc.text(`Gerado em ${formattedDate} às ${formattedTime}`, { align: 'center' });
    doc.moveDown(1.5);

    const analysisText = (chapter.analysis || '').trim();
    if (!analysisText) {
        doc.fontSize(12).font('Helvetica').text('Sem conteúdo de análise disponível.', { align: 'left' });
        doc.end();
        return;
    }

    const defaultFont = 'Helvetica';
    const headingSizes = { 1: 24, 2: 20, 3: 18, 4: 16 };
    const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const blocks = analysisText.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);

    const drawHorizontalRule = () => {
        const y = doc.y;
        doc.strokeColor('#4b5563').lineWidth(0.75);
        doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
        doc.moveDown(0.7);
    };

    blocks.forEach(block => {
        if (!block) return;
        const headerMatch = block.match(/^(#{1,6})\s+(.*)$/);
        if (headerMatch) {
            const level = Math.min(6, headerMatch[1].length);
            const size = headingSizes[level] || 14;
            doc.font('Helvetica-Bold').fontSize(size).text(headerMatch[2], { align: 'left', width: availableWidth });
            doc.moveDown(0.25);
            doc.font(defaultFont).fontSize(12);
            return;
        }

        if (/^---+$/.test(block)) {
            drawHorizontalRule();
            return;
        }

        const listLines = block.split(/\n+/).map(l => l.trim()).filter(Boolean);
        const isList = listLines.every(line => /^[-*]\s+/.test(line));
        if (isList) {
            listLines.forEach(line => {
                const item = line.replace(/^[-*]\s+/, '');
                doc.font(defaultFont).fontSize(12).text(`• ${item}`, {
                    align: 'left',
                    width: availableWidth,
                    indent: 10
                });
            });
            doc.moveDown(0.3);
            return;
        }

        const paragraph = block.replace(/\n+/g, ' ');
        doc.font(defaultFont).fontSize(12).text(paragraph, {
            align: 'justify',
            width: availableWidth,
            lineGap: 4
        });
        doc.moveDown(0.5);
    });

    doc.end();
}

async function generateAnthologyPDF(title, coverImageUrl, projectsData, res, filePath = null, subtitle = null) {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

    // Stream PDF to response if provided
    if (res) doc.pipe(res);

    // Also stream to file if provided
    if (filePath) {
        const fileStream = fs.createWriteStream(filePath);
        doc.pipe(fileStream);
    }

    const tocEntries = [];
    let tocPageIndex = null;
    let tocStartY = null;
    const currentPageIndex = () => {
        const range = doc.bufferedPageRange();
        return range.start + range.count - 1;
    };
    const currentPageNumber = () => currentPageIndex() + 1;

    // --- COVER PAGE ---
    if (coverImageUrl) {
        try {
            const coverPath = _toLocalFilePath(coverImageUrl);
            if (fs.existsSync(coverPath)) {
                doc.image(coverPath, 0, 0, { width: doc.page.width, height: doc.page.height });
                doc.addPage();
            }
        } catch (e) {
            console.error("Failed to add cover to PDF", e);
        }
    }

    // --- ANTHOLOGY TITLE PAGE ---
    doc.y = doc.page.height * 0.4;
    doc.fontSize(42).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(20).font('Helvetica-Oblique').text(subtitle || "Uma Coletânea de Estórias", { align: 'center' });
    doc.addPage();

    // --- TABLE OF CONTENTS PLACEHOLDER ---
    const rangeAfterTocPage = doc.bufferedPageRange();
    tocPageIndex = rangeAfterTocPage.start + rangeAfterTocPage.count - 1;
    doc.fontSize(24).font('Helvetica-Bold').text('Índice', { align: 'left' });
    doc.moveDown(0.5);
    tocStartY = doc.y;

    // --- RENDER EACH PROJECT ---
    for (let i = 0; i < projectsData.length; i++) {
        const { project, bible, scenes } = projectsData[i];

        doc.addPage();
        tocEntries.push({ title: project.name, page: currentPageNumber() });

        // Project Title Page
        doc.y = doc.page.height * 0.4;
        doc.fontSize(32).font('Helvetica-Bold').text(project.name, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).font('Helvetica-Oblique').text(project.style, { align: 'center' });
        doc.addPage();

        await _renderProjectToDoc(doc, project, bible, scenes);
    }

    // --- FINALIZE TABLE OF CONTENTS ---
    if (tocEntries.length > 0 && tocPageIndex !== null) {
        doc.switchToPage(tocPageIndex);
        doc.y = tocStartY || doc.page.margins.top;

        doc.fontSize(16).font('Helvetica');

        const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        tocEntries.forEach(entry => {
            const pageLabel = String(entry.page);
            const titleLabel = entry.title || 'Projeto';

            // Build dotted leader spacing
            const dotsTarget = availableWidth - doc.widthOfString(titleLabel) - doc.widthOfString(pageLabel) - 8;
            const dotCharWidth = Math.max(1, doc.widthOfString('.'));
            const dotCount = Math.max(4, Math.floor(Math.max(0, dotsTarget) / dotCharWidth));
            const dots = '.'.repeat(dotCount);

            doc.text(`${titleLabel} ${dots} ${pageLabel}`, {
                align: 'left'
            });

            doc.moveDown(0.6);
        });
    }

    // --- FOOTER PAGE NUMBERS FOR STORY PAGES ONLY ---
    const range = doc.bufferedPageRange();
    const lastPageIndex = range.start + range.count - 1;
    if (tocPageIndex !== null && lastPageIndex > tocPageIndex) {
        for (let idx = tocPageIndex + 1; idx <= lastPageIndex; idx++) {
            doc.switchToPage(idx);
            
            const pageNumber = String(idx + 1);
            
            // Calculate footer position - near bottom but within safe margin area
            const footerY = doc.page.height - 30;
            const centerX = doc.page.width / 2;
            
            doc.fontSize(10).font('Helvetica-Oblique');
            
            // Measure text width to center it properly
            const textWidth = doc.widthOfString(pageNumber);
            const textX = centerX - (textWidth / 2);
            
            // Use direct text placement with lineBreak: false to prevent pagination
            doc.text(pageNumber, textX, footerY, {
                lineBreak: false
            });
        }

        // Ensure buffered changes (like footers) are flushed to all streams before ending
        doc.flushPages();
    }

    // Finalize PDF
    doc.end();
}

async function generateHybridBookPDF(hybridBook, project, res) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    doc.pipe(res);

    // --- TITLE PAGE ---
    const displayTitle = hybridBook?.title || project?.name || 'Hybrid Book';
    doc.y = doc.page.height * 0.4;
    doc.fontSize(38).font('Helvetica-Bold').text(displayTitle, { align: 'center' });
    if (project?.style) {
        doc.moveDown(0.8);
        doc.fontSize(16).font('Helvetica-Oblique').text(project.style, { align: 'center' });
    }
    doc.addPage();

    const blocks = Array.isArray(hybridBook?.blocks) ? hybridBook.blocks : [];
    for (const block of blocks) {
        if (!block) continue;

        if (block.type === 'heading') {
            doc.moveDown(0.5);
            doc.fontSize(28).font('Helvetica-Bold').text(block.text || '', { align: 'left' });
            doc.moveDown(0.5);
            continue;
        }

        if (block.type === 'prose') {
            doc.fontSize(20).font('Helvetica').text(block.text || '', { align: 'justify', lineGap: 8 });
            doc.moveDown(1);
            continue;
        }

        if (block.type === 'image') {
            const imagePath = _toLocalFilePath(block.imageUrl);
            if (imagePath && fs.existsSync(imagePath)) {
                // Images must be full-page: put each image on its own page.
                // If we're not at the top of a fresh page, start a new page.
                if (doc.y > doc.page.margins.top + 5) {
                    doc.addPage();
                }

                const marginLeft = doc.page.margins.left;
                const marginTop = doc.page.margins.top;
                const marginRight = doc.page.margins.right;
                const marginBottom = doc.page.margins.bottom;
                const contentWidth = doc.page.width - marginLeft - marginRight;
                const contentHeight = doc.page.height - marginTop - marginBottom;

                const hasCaption = !!(block.caption && String(block.caption).trim());
                const captionSpace = hasCaption ? 24 : 0;
                const imageHeight = Math.max(0, contentHeight - captionSpace);

                try {
                    doc.image(imagePath, marginLeft, marginTop, {
                        fit: [contentWidth, imageHeight],
                        align: 'center',
                        valign: 'center'
                    });
                } catch (e) {
                    // ignore
                }

                if (hasCaption) {
                    doc.y = marginTop + imageHeight + 6;
                    doc.fontSize(14).font('Helvetica-Oblique').text(block.caption, {
                        align: 'center',
                        width: contentWidth
                    });
                }

                // Continue prose on a new page after each full-page image.
                doc.addPage();
            } else {
                // If image isn't available yet, don't force extra pages.
                doc.moveDown(0.5);
            }
        }
    }

    doc.end();
}

async function _renderProjectToDoc(doc, project, bible, scenes) {
    // --- SCENES ---
    if (scenes && scenes.length > 0) {
        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            if (!scene.content) continue;

            const beat = bible?.beats?.find(b => b.id === scene.beatId);

            // Visual separator between scenes
            if (i > 0) {
                doc.moveDown(2);
                doc.fontSize(24).font('Helvetica-Bold').text('* * *', { align: 'center' });
                doc.moveDown(2);
            }

            // Beat Image (Illustrative)
            if (beat && beat.imageUrl) {
                try {
                    const beatImagePath = _toLocalFilePath(beat.imageUrl);
                    if (fs.existsSync(beatImagePath)) {
                        const targetFit = [495, 300];
                        const estimatedHeight = Math.min(targetFit[1], targetFit[0] * (9 / 21));
                        const marginBottom = doc.page.margins.bottom;
                        const availableHeight = doc.page.height - marginBottom - doc.y;

                        // If the image would overflow the current page, start a new one
                        if (estimatedHeight + 16 > availableHeight) {
                            doc.addPage();
                        }

                        doc.image(beatImagePath, doc.x, doc.y, { fit: targetFit });

                        // Keep modest spacing after the image
                        doc.y += estimatedHeight + 12;
                        doc.moveDown(0.5);
                    }
                } catch (e) {
                    console.error(`Failed to add beat image for scene ${scene.beatId}`, e);
                }
            }

            // Scene Content
            doc.fontSize(20).font('Helvetica').text(scene.content, { align: 'justify', lineGap: 8 });
        }
    }
}

module.exports = { generateProjectPDF, generateAnthologyPDF, generateHybridBookPDF, generateChapterAnalysisPDF };
