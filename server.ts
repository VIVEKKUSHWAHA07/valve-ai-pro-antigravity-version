import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { processRFQ, processSingleRow, generateTrace, generateFuzzyMatches, getSupabase, fetchUserContext, detectColumns } from './backend/engine';
import { createClient, User } from '@supabase/supabase-js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/catalogue/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: '' }) as any[];

    if (data.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    const sb = getSupabase();
    if (!sb) {
      return res.status(500).json({ error: 'Database connection failed' });
    }

    // Delete existing catalogue for this user
    await sb.from('product_catalogue').delete().eq('user_id', userId);

    // Prepare new products
    const products = data.map(row => {
      // Find columns dynamically (case-insensitive)
      const getCol = (names: string[]) => {
        const key = Object.keys(row).find(k => names.some(n => k.toLowerCase().includes(n)));
        return key ? String(row[key] || '') : '';
      };

      return {
        user_id: userId,
        part_number: getCol(['part', 'item', 'code']) || 'UNKNOWN',
        description: getCol(['desc', 'particular']) || '',
        category: getCol(['category', 'family']) || '',
        type: getCol(['type', 'valve']) || '',
        size: getCol(['size', 'nps', 'dn']) || '',
        rating: getCol(['rating', 'class', 'pressure']) || '',
        moc: getCol(['moc', 'material', 'body']) || '',
        trim: getCol(['trim', 'seat']) || '',
        end_detail: getCol(['end', 'connection']) || ''
      };
    });

    // Insert in batches of 1000
    const batchSize = 1000;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const { error } = await sb.from('product_catalogue').insert(batch);
      if (error) throw error;
    }

    // Update version history
    const { error: vError } = await sb.from('catalogue_versions').insert({
      user_id: userId,
      filename: req.file.originalname,
      row_count: products.length
    });

    if (vError) throw vError;

    res.json({ success: true, count: products.length });
  } catch (error: any) {
    console.error('Error uploading catalogue:', error);
    res.status(500).json({ error: error.message || 'Failed to upload catalogue' });
  }
});

app.post('/api/upload-rfq', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.body.user_id;
    const filename = req.file.originalname;
    const columnMap = req.body.columnMap ? JSON.parse(req.body.columnMap) : undefined;

    const authHeader = req.headers.authorization;
    let fetchedCatalogueItems: any[] = [];
    let userRules: any[] = [];
    
    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://stqkpgkyvtmvvijilgmc.supabase.co';
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0cWtwZ2t5dnRtdnZpamlsZ21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjcyMzYsImV4cCI6MjA5MDI0MzIzNn0.92FxL9YuEwesIb1T-vowKqY1no58a0FKIGwBqlMu-uw';
    
    let supabase;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      });
    } else {
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    
    const { data: catalogueItems, error } = await supabase
      .from('catalogue_items')
      .select('*');
      
    console.log('[Catalogue] error:', error);
    console.log('[Catalogue] rows loaded:', catalogueItems?.length ?? 0);
    console.log('[Catalogue] sample row:', JSON.stringify(catalogueItems?.[0]));
      
    if (catalogueItems) {
      fetchedCatalogueItems = catalogueItems;
    }

    if (userId) {
      const { data: rules } = await supabase
        .from('user_rules')
        .select('*')
        .eq('user_id', userId)
        .range(0, 9999);
      
      if (rules) {
        userRules = rules;
      }
    }

    const result = await processRFQ(req.file.buffer, columnMap || {}, fetchedCatalogueItems, userRules, filename, userId);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Working_Sheet.xlsx"`);
    res.send(result);
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
    const detectedMap = detectColumns(headers);
    
    res.json({ headers, headerRowIndex, columnMap: detectedMap });
  } catch (error: any) {
    console.error('Error extracting headers:', error);
    res.status(500).json({ error: error.message || 'Failed to extract headers' });
  }
});

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://stqkpgkyvtmvvijilgmc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0cWtwZ2t5dnRtdnZpamlsZ21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjcyMzYsImV4cCI6MjA5MDI0MzIzNn0.92FxL9YuEwesIb1T-vowKqY1no58a0FKIGwBqlMu-uw'; // Fallback to anon key if service role key is missing

const getSupabaseAdmin = () => {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

const bootstrapAdmin = async () => {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.auth.admin.listUsers();
    const users: User[] = data.users;
    
    // Confirm emails for specific users
    const emailsToConfirm = ['forai0707@gmail.com', 'warzonepredator07@gmail.com'];
    
    for (const email of emailsToConfirm) {
      const user = users.find(u => u.email === email);
      if (user && !user.email_confirmed_at) {
        await sb.auth.admin.updateUserById(user.id, { email_confirm: true });
        console.log(`Confirmed email for ${email}`);
      }
    }

    const adminUser = users.find(u => u.email === 'forai0707@gmail.com');
    
    if (adminUser) {
      await sb.from('app_access').upsert({
        email: 'forai0707@gmail.com',
        active: true,
        plan: 'custom'
      }, { onConflict: 'email' });
      
      await sb.from('admins').upsert({
        user_id: adminUser.id
      }, { onConflict: 'user_id' });
      
      console.log('Successfully bootstrapped admin forai0707@gmail.com');
    } else {
      console.log('User forai0707@gmail.com not found in auth yet. Please sign up first.');
    }
  } catch (err) {
    console.error('Failed to bootstrap admin:', err);
  }
};
bootstrapAdmin();

app.post('/api/admin/confirm-email', async (req, res) => {
  const { email, adminUserId } = req.body;
  try {
    const sb = getSupabaseAdmin(); // service role client

    // Verify admin
    const { data: admin } = await sb
      .from('admins')
      .select('*')
      .eq('user_id', adminUserId)
      .single();
    if (!admin) {
      return res.status(403).json({ 
        error: 'Not authorized' 
      });
    }

    // Find user and confirm email using admin API
    const { data } = await sb.auth.admin.listUsers();
    const users: User[] = data.users;
    const targetUser = users.find(u => u.email === email);
    
    if (targetUser) {
      await sb.auth.admin.updateUserById(
        targetUser.id,
        { email_confirm: true }
      );
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mock endpoints for Test Panel
app.post('/api/test/single', async (req, res) => {
  try {
    const rowData = req.body;
    if (!rowData) {
      return res.status(400).json({ error: 'No row data provided' });
    }
    const userId = rowData.user_id;
    const { catalogue, notMfgList, userCustomRules } = await fetchUserContext(userId);
    const { processedRow, flags } = await processSingleRow(rowData, 1, catalogue, notMfgList, userCustomRules, false);
    
    // Standardize the response shape as requested
    const matchInfo = processedRow.match_info || 'Unmatched';
    const result = {
      valveType: processedRow.valveType,
      valveType_match_info: matchInfo,
      size: processedRow.size,
      size_match_info: matchInfo,
      pressureClass: processedRow.class,
      pressureClass_match_info: matchInfo,
      moc: processedRow.moc,
      moc_match_info: matchInfo,
      standard: processedRow.standard,
      standard_match_info: matchInfo,
      endType: processedRow.endDetail,
      endType_match_info: matchInfo,
      trim: processedRow.trim,
      trim_match_info: matchInfo,
      gasket: processedRow.gasket,
      packing: processedRow.packing,
      operator: processedRow.operator,
      endDetail: processedRow.endDetail,
      bolting: processedRow.bolting,
      flags: flags
    };
    
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Error processing single row:', error);
    res.status(500).json({ error: error.message || 'Failed to process single row' });
  }
});

app.post('/api/test/fuzzy', async (req, res) => {
  try {
    const { desc, user_id } = req.body;
    if (!desc) {
      return res.status(400).json({ error: 'Description is required' });
    }
    const matches = await generateFuzzyMatches(desc, user_id);
    res.json({ success: true, matches });
  } catch (error: any) {
    console.error('Error in fuzzy match:', error);
    res.status(500).json({ error: error.message || 'Failed to run fuzzy match' });
  }
});

app.post('/api/test/trace', async (req, res) => {
  try {
    const { desc, user_id } = req.body;
    if (!desc) {
      return res.status(400).json({ error: 'Description is required' });
    }
    const trace = await generateTrace(desc, user_id);
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

    const authHeader = req.headers.authorization;
    let fetchedCatalogueItems: any[] = [];
    let userRules: any[] = [];
    
    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://stqkpgkyvtmvvijilgmc.supabase.co';
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0cWtwZ2t5dnRtdnZpamlsZ21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjcyMzYsImV4cCI6MjA5MDI0MzIzNn0.92FxL9YuEwesIb1T-vowKqY1no58a0FKIGwBqlMu-uw';
    
    let supabase;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      });
    } else {
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    
    const { data: catalogueItems, error } = await supabase
      .from('catalogue_items')
      .select('*');
      
    console.log('[Catalogue] error:', error);
    console.log('[Catalogue] rows loaded:', catalogueItems?.length ?? 0);
    console.log('[Catalogue] sample row:', JSON.stringify(catalogueItems?.[0]));
      
    if (catalogueItems) {
      fetchedCatalogueItems = catalogueItems;
    }

    if (userId) {
      const { data: rules } = await supabase
        .from('user_rules')
        .select('*')
        .eq('user_id', userId)
        .range(0, 9999);
      
      if (rules) {
        userRules = rules;
      }
    }

    const result = await processRFQ(req.file.buffer, columnMap || {}, fetchedCatalogueItems, userRules, filename, userId);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Working_Sheet.xlsx"`);
    res.send(result);
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

  // Global error handler to ensure JSON responses for API routes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Error:', err);
    if (req.path.startsWith('/api/')) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    } else {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
