const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function extractTextFromPdf(pdfPath) {
    try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        
        const txtPath = pdfPath.replace(/\.pdf$/i, '.txt');
        fs.writeFileSync(txtPath, data.text);
        
        console.log(`Successfully extracted text to: ${txtPath}`);
        console.log(`Total pages: ${data.numpages}`);
    } catch (error) {
        console.error(`Error extracting text from ${pdfPath}:`, error.message);
    }
}

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('Usage: node extractPdfText.js <path-to-pdf>');
    process.exit(1);
}

const pdfFilePath = path.resolve(args[0]);
if (!fs.existsSync(pdfFilePath)) {
    console.error(`File not found: ${pdfFilePath}`);
    process.exit(1);
}

extractTextFromPdf(pdfFilePath);
