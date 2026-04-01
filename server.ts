import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import * as path from 'path';
import { processRFQ, processSingleRow, generateTrace, generateFuzzyMatches } from './backend/engine';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload-rfq', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.body.user_id;
    const filename = req.file.originalname;
    const columnMap = req.body.columnMap ? JSON.parse(req.body.columnMap) : undefined;

    const result = await processRFQ(req.file.buffer, userId, filename, columnMap);
    res.json(result);
  } catch (error: any) {
    console.error('Error processing RFQ:', error);
    res.status(500).json({ error: error.message || 'Failed to process RFQ' });
  }
});

app.post('/api/extract-headers', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const xlsx = require('xlsx');
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as any[][];
    
    if (data.length < 2) {
      return res.status(400).json({ error: 'Excel file is empty or missing headers' });
    }
    
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const nonEmpty = data[i].filter(c => c && String(c).trim()).length;
      if (nonEmpty >= 3) { headerRowIndex = i; break; }
    }
    
    const headers = data[headerRowIndex] as string[];
    
    // Auto-detect columns
    const { detectColumns } = require('./backend/engine');
    const detectedMap = detectColumns(headers);
    
    res.json({ headers, headerRowIndex, detectedMap });
  } catch (error: any) {
    console.error('Error extracting headers:', error);
    res.status(500).json({ error: error.message || 'Failed to extract headers' });
  }
});

// Mock endpoints for Test Panel
app.post('/api/test/single', (req, res) => {
  try {
    const rowData = req.body;
    if (!rowData) {
      return res.status(400).json({ error: 'No row data provided' });
    }
    const result = processSingleRow(rowData);
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Error processing single row:', error);
    res.status(500).json({ error: error.message || 'Failed to process single row' });
  }
});

app.post('/api/test/fuzzy', (req, res) => {
  try {
    const { desc } = req.body;
    if (!desc) {
      return res.status(400).json({ error: 'Description is required' });
    }
    const matches = generateFuzzyMatches(desc);
    res.json({ success: true, matches });
  } catch (error: any) {
    console.error('Error in fuzzy match:', error);
    res.status(500).json({ error: error.message || 'Failed to run fuzzy match' });
  }
});

app.post('/api/test/trace', (req, res) => {
  try {
    const { desc } = req.body;
    if (!desc) {
      return res.status(400).json({ error: 'Description is required' });
    }
    const trace = generateTrace(desc);
    res.json({ success: true, trace });
  } catch (error: any) {
    console.error('Error in rule trace:', error);
    res.status(500).json({ error: error.message || 'Failed to run rule trace' });
  }
});

app.post('/api/test/batch', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.body.user_id;
    const filename = req.file.originalname;
    const columnMap = req.body.columnMap ? JSON.parse(req.body.columnMap) : undefined;

    const result = await processRFQ(req.file.buffer, userId, filename, columnMap);
    res.json(result);
  } catch (error: any) {
    console.error('Error processing batch RFQ:', error);
    res.status(500).json({ error: error.message || 'Failed to process batch RFQ' });
  }
});

// Mock endpoints for Rules Editor
app.get('/api/rules', (req, res) => {
  res.json({ success: true, rules: [] });
});

app.post('/api/rules', (req, res) => {
  res.json({ success: true, message: 'Rules saved successfully' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
