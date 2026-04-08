import * as xlsx from 'xlsx';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { matchAgainstCatalogue } from './catalogueMatcher';
import { ALIAS_MAP } from './aliasMap';

// Lazy initialize Supabase client for backend to prevent crashes if .env is missing
let supabase: SupabaseClient | null = null;

export function getSupabase() {
  if (!supabase) {
    const SUPABASE_URL = 'https://stqkpgkyvtmvvijilgmc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0cWtwZ2t5dnRtdnZpamlsZ21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjcyMzYsImV4cCI6MjA5MDI0MzIzNn0.92FxL9YuEwesIb1T-vowKqY1no58a0FKIGwBqlMu-uw';
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

export interface ProcessedRow {
  valveType: string;
  size: string;
  class: string;
  standard: string;
  model: string;
  moc: string;
  trim: string;
  gasket: string;
  packing: string;
  operator: string;
  endDetail: string;
  bolting: string;
  seat?: string;
  originalRow: any;
  score: number;
  matchId?: string;
  match_info?: string;
  catalogueModel?: string;
}

export interface Flag {
  row: number;
  field: string;
  message: string;
  type: 'warning' | 'critical';
}

export interface ProcessResult {
  total_rows: number;
  processed: number;
  not_manufactured: number;
  flags: Flag[];
  processed_rows: ProcessedRow[];
  download_url?: string;
  columnMap?: any;
  format?: string;
  catalogue_count?: number;
}

// --- Format Detection Engine ---

export function detectColumns(headers: any[]): Record<string, number> {
  const HEADER_ALIASES: Record<string, string[]> = {
    desc:     ['DESCRIPTION','DESC','ITEM DESC','ITEM DESCRIPTION','PARTICULARS','SERVICE'],
    type:     ['VALVE TYPE','TYPE'],
    size:     ['SIZE','NPS','DN','BORE','VALVE SIZE','PIPE SIZE'],
    rating:   ['RATING','CLASS','PRESSURE CLASS','PRESSURE RATING','CL','ANSI CLASS','PRESS CLASS'],
    body:     ['BODY','MOC','MATERIAL','BODY MATERIAL','BODY MOC','MATERIAL OF CONSTRUCTION','BODY/BONNET'],
    trim:     ['TRIM','TRIM MATERIAL','SEAT','TRIM/SEAT','TRIM MAT'],
    endType:  ['END','END TYPE','END CONNECTION','ENDS','FACING','END CONN'],
    construct:['CONSTRUCTION','DESIGN','CONSTRUCTION TYPE'],
    qty:      ['QTY','QUANTITY','NOS','NOS.','NO.','NUMBERS'],
  };

  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    const clean = String(h || '').toUpperCase().trim();
    if (!clean) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (colMap[field] === undefined && aliases.some(a => clean.includes(a))) {
        colMap[field] = i;
      }
    }
  });
  return colMap;
}

export function extractSizeFromText(text: string): string | null {
  const dnMatch = text.match(/\bDN\s*(\d+)\b/i);
  if (dnMatch) {
    const dn = parseInt(dnMatch[1]);
    const dnMap: {[k:number]:string} = {
      15:'1/2"', 20:'3/4"', 25:'1"', 32:'1.1/4"',
      40:'1.1/2"', 50:'2"', 65:'2.1/2"', 80:'3"',
      100:'4"', 125:'5"', 150:'6"', 200:'8"',
      250:'10"', 300:'12"', 350:'14"', 400:'16"',
      450:'18"', 500:'20"', 600:'24"'
    };
    return dnMap[dn] || `DN${dn}`;
  }

  const mmMatch = text.match(/\b(\d+(?:\.\d+)?)\s*mm\b/i);
  if (mmMatch) {
    return `${mmMatch[1]}mm`;
  }

  const npsMatch = text.match(/\bNPS\s*(\d+(?:\.\d+)?)/i);
  if (npsMatch) {
    return `${npsMatch[1]}"`;
  }

  const inchMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:inch|inches|in\b)/i);
  if (inchMatch) {
    return `${inchMatch[1]}"`;
  }

  const quoteMatch = text.match(/\b(\d+(?:\.\d+)?)\s*["'']\s/);
  if (quoteMatch) {
    return `${quoteMatch[1]}"`;
  }

  // Fallback for fractions like 1/2" 3/4" 1.1/2" 1-1/2" 1 1/2"
  const fracMatch = text.match(/\b(\d+[\s\-\.]\d+\/\d+"|\d+\/\d+")/);
  if (fracMatch) return fracMatch[1].replace(/[\s\-]/, '.');

  // Pattern 5: SIZE keyword
  const sizeKeyword = text.match(/SIZE\s*:?\s*(\d+(?:\.\d+)?(?:[\s\-]\d+\/\d+)?(?:inch|inches|"|''|in\b|mm\b)?)/i);
  if (sizeKeyword) {
    let val = sizeKeyword[1];
    if (val.includes(' ') || val.includes('-')) {
      val = val.replace(/[\s\-]/, '.');
    }
    if (!val.includes('"') && !val.toLowerCase().includes('mm') && !val.toLowerCase().includes('in')) {
      val += '"';
    }
    return val;
  }

  return null; // Size not found in text
}

function extractClassFromText(text: string): string | null {
  const t = text.toUpperCase();

  // Pattern 1: RATING: keyword (most explicit)
  const ratingMatch = t.match(
    /RATING\s*:.*?(\d{3,4})\s*(?:#|LB|LBS|CLASS)/
  );
  if (ratingMatch) return `Class ${ratingMatch[1]}`;

  // Pattern 2: explicit class patterns
  const clMatch = t.match(
    /\b(?:CL|CLASS|ANSI\s*CLASS?)\s*(\d{3,4})\b/
  );
  if (clMatch) return `Class ${clMatch[1]}`;

  // Pattern 3: # notation
  const hashMatch = t.match(
    /\b(150|300|600|800|900|1500|2500|3000)\s*#/
  );
  if (hashMatch) {
    const val = parseInt(hashMatch[1]);
    if (val === 3000 || val === 6000) {
      return `${val}# (Threaded/SW Class)`;
    }
    return `Class ${val}`;
  }

  // Pattern 4: LB/LBS notation
  const lbMatch = t.match(
    /\b(150|300|600|800|900|1500|2500)\s*LBS?\b/
  );
  if (lbMatch) return `Class ${lbMatch[1]}`;

  // Pattern 5: PN notation (European)
  const pnMatch = t.match(/\bPN\s*(10|16|25|40|63|100)\b/);
  if (pnMatch) return `PN ${pnMatch[1]}`;

  return null;
}

function extractTrimMOC(t: string): string | null {
  // STEM material
  const stemMatch = t.match(
    /A182\s*F\s*(3\d+)\s*STEM|SS\s*(3\d+)\s*STEM/
  );

  // BALL material (for ball valves)
  const ballMatch = t.match(
    /(?:F(3\d+)\s*SS|ENP\s*A105|A182\s*F(3\d+))\s*.*?BALL/
  );

  // SEAT material
  const seatMatch = t.match(
    /\b(PEEK|PTFE|NYLON|TEFLON|METAL|STELLITE|SS\s*3\d+)\s*SEATS?\b/
  );

  const parts: string[] = [];
  if (stemMatch)
    parts.push(`F${stemMatch[1] || stemMatch[2]} Stem`);
  if (ballMatch)
    parts.push(ballMatch[1] ? `F${ballMatch[1]} Ball` : 'ENP A105 Ball');
  if (seatMatch) parts.push(`${seatMatch[1]} Seat`);

  return parts.length > 0 ? parts.join(' / ') : null;
}

function extractMOCFromText(text: string): {
  bodyMoc: string | null;
  trimMoc: string | null;
  resolvedMoc: string;
} {
  const t = text.toUpperCase();

  let bodyMoc = null;
  let trimMoc = null;

  const bodyMatch = text.match(/(?:BODY\s*IN|BODY\s*MATERIAL|BODY\s*:)\s*([^,;\n]+)/i);
  if (bodyMatch) {
    bodyMoc = bodyMatch[1].trim();
  } else {
    if (/A351\s*CF8M|CF8M/.test(t)) bodyMoc = 'A351 CF8M';
    else if (/A352\s*LCB|LCB/.test(t)) bodyMoc = 'A352 LCB';
    else if (/A216\s*WCB|WCB/.test(t)) bodyMoc = 'A216 WCB';
    else if (/\bA105\b/.test(t)) bodyMoc = 'A105';
    else if (/A182\s*F\s*316\s*(?:BODY|\/A351)/.test(t) || /A182\s*F316\s*\/\s*A351/.test(t)) bodyMoc = 'A182 F316 / A351 CF8M';
  }

  const trimMatch = text.match(/(?:TRIM\s*IN|TRIM\s*:|SEAT\s*IN)\s*([^,;\n]+)/i);
  if (trimMatch) {
    trimMoc = trimMatch[1].trim();
  } else {
    trimMoc = extractTrimMOC(t);
  }

  const resolvedMoc = bodyMoc ? getMOC(bodyMoc).resolved || bodyMoc : 'Not identified';

  return { bodyMoc, trimMoc, resolvedMoc };
}

function extractStandardFromText(
  text: string,
  valveType: string
): string {
  const t = text.toUpperCase();

  const dcMatch = t.match(
    /DESIGN\s*CODE\s*:?\s*([\w\s\/\.]+?)(?:,|$)/m
  );
  if (dcMatch) {
    const dc = dcMatch[1].trim();
    if (/API\s*6D/.test(dc))    return 'API 6D';
    if (/ISO\s*17292/.test(dc)) return 'ISO 17292';
    if (/API\s*602/.test(dc))   return 'API 602';
    if (/API\s*600/.test(dc))   return 'API 600';
    if (/API\s*603/.test(dc))   return 'API 603';
    if (/BS\s*1868/.test(dc))   return 'BS 1868';
    if (/BS\s*1873/.test(dc))   return 'BS 1873';
    if (/BS\s*5351/.test(dc))   return 'BS 5351';
    if (/ASME/.test(dc))        return 'ASME ' + dc.replace('ASME','').trim();
  }

  if (/API\s*6D/.test(t))        return 'API 6D';
  if (/ISO\s*17292/.test(t))     return 'ISO 17292';
  if (/API\s*602/.test(t))       return 'API 602';
  if (/BS\s*1868/.test(t))       return 'BS 1868';
  if (/BS\s*1873/.test(t))       return 'BS 1873';

  const vt = valveType.toUpperCase();
  if (/BALL/.test(vt))       return 'API 6D';
  if (/GATE/.test(vt))       return 'API 600';
  if (/GLOBE/.test(vt))      return 'BS 1873';
  if (/CHECK/.test(vt))      return 'BS 1868';
  if (/BUTTERFLY/.test(vt))  return 'API 609';

  return 'To be confirmed';
}

function buildModelFromDescription(text: string,
  valveType: string): string {
  const t = text.toUpperCase();
  const parts: string[] = [];

  if (/BALL\s*VALVE/.test(t))        parts.push('Ball Valve');
  else if (/GATE\s*VALVE/.test(t))   parts.push('Gate Valve');
  else if (/GLOBE\s*VALVE/.test(t))  parts.push('Globe Valve');
  else if (/CHECK\s*VALVE/.test(t))  parts.push('Check Valve');
  else if (/BUTTERFLY/.test(t))      parts.push('Butterfly Valve');
  else                                parts.push(valveType);

  if (/SPLIT\s*BODY/.test(t))        parts.push('Split Body');
  else if (/WELDED\s*BODY/.test(t))  parts.push('Welded Body');
  else if (/SOLID\s*BODY/.test(t))   parts.push('Solid Body');
  else if (/FORGED/.test(t))         parts.push('Forged Body');

  if (/BOLTED\s*BONNET/.test(t))     parts.push('Bolted Bonnet');
  else if (/WELDED\s*BONNET/.test(t)) parts.push('Welded Bonnet');
  else if (/BOLTED/.test(t))          parts.push('Bolted');

  if (/FULL\s*BORE|FULL\s*PORT/.test(t))
    parts.push('Full Bore');
  else if (/REDUCED\s*BORE|REDUCED\s*PORT/.test(t))
    parts.push('Reduced Bore');

  if (/BALL\s*VALVE/.test(t)) {
    if (/TRUNNION\s*MOUNTED/.test(t))  parts.push('Trunnion Mounted');
    else if (/FLOATING\s*BALL/.test(t)) parts.push('Floating Ball');
  }

  if (/GATE\s*VALVE/.test(t)) {
    if (/FLEXIBLE\s*WEDGE/.test(t))     parts.push('Flexible Wedge');
    else if (/SOLID\s*WEDGE/.test(t))   parts.push('Solid Wedge');
    else if (/PARALLEL\s*SLIDE/.test(t)) parts.push('Parallel Slide');
    if (/OUTSIDE\s*SCREW|OS&Y|OS\s*&\s*Y/.test(t))
      parts.push('OS&Y');
    if (/RISING\s*STEM/.test(t) ||
        /RISING\s*&\s*BACK\s*SEAT/.test(t))
      parts.push('Rising Stem');
    if (/REPLACEABLE\s*SEAT/.test(t))   parts.push('Replaceable Seat');
  }

  if (/GATE\s*VALVE|GLOBE\s*VALVE/.test(t)) {
    if (/NON[\s-]RISING\s*STEM/.test(t)) parts.push('NRS');
    else if (/RISING\s*STEM/.test(t))    parts.push('RS');
  }

  if (/WITH\s*LOCKING\s*DEVICE/.test(t)) parts.push('with Locking Device');
  if (/SPRING\s*LOADED/.test(t))         parts.push('Spring Loaded');
  if (/GEAR\s*OPERAT/.test(t))           parts.push('Gear Operated');
  if (/ELECTRIC\s*ACTUAT/.test(t))       parts.push('Electric Actuated');
  if (/PNEUMATIC\s*ACTUAT/.test(t))      parts.push('Pneumatic Actuated');

  return parts.join(', ');
}

function extractTrimFromText(text: string,
  valveType: string): string {
  const t = text.toUpperCase();
  const parts: string[] = [];

  const trimMatch = text.match(/(?:TRIM\s*IN|TRIM\s*:|SEAT\s*IN)\s*([^,;\n]+)/i);
  if (trimMatch) {
    parts.push(trimMatch[1].trim());
  }

  const stemMatch = text.match(/(?:STEM\s*IN|STEM\s*:)\s*([^,;\n]+)/i);
  if (stemMatch) {
    parts.push(stemMatch[1].trim() + ' Stem');
  } else {
    const stemF = t.match(/A182\s*F\s*(3\d+)\s*STEM/);
    const stemSS = t.match(/SS\s*(3\d+)\s*STEM/);
    if (stemF)       parts.push(`F${stemF[1]} Stem`);
    else if (stemSS) parts.push(`SS${stemSS[1]} Stem`);
    else if (/STEM/.test(t) && /316/.test(t))
      parts.push('SS316 Stem');
  }

  if (/BALL\s*VALVE/.test(t)) {
    if (/F316\s*SS.*?BALL|SS.*?F316.*?BALL/.test(t))
      parts.push('SS316 Ball');
    else if (/ENP\s*A105.*?BALL/.test(t))
      parts.push('ENP CS Ball');
    else if (/A182\s*F316.*?BALL/.test(t))
      parts.push('F316 Ball');
  }

  if (/GATE\s*VALVE|GLOBE\s*VALVE/.test(t)) {
    if (/13\s*CR|13CR/.test(t))    parts.push('13Cr Trim');
    if (/STELLITE/.test(t))        parts.push('Stellite');
    if (/SS\s*316.*?DISC/.test(t)) parts.push('SS316 Disc');
  }

  if (/PEEK\s*SEAT/.test(t))    parts.push('PEEK Seat');
  if (/PTFE\s*SEAT/.test(t))    parts.push('PTFE Seat');
  if (/METAL\s*SEAT/.test(t))   parts.push('Metal Seat');
  if (/TEFLON\s*SEAT/.test(t))  parts.push('PTFE Seat');
  if (/NYLON\s*SEAT/.test(t))   parts.push('Nylon Seat');

  if (/EXPANDED\s*GRAPHITE|GRAPHITE\s*PACKING/.test(t))
    parts.push('Graphite Packing');
  if (/PTFE\s*PACKING/.test(t)) parts.push('PTFE Packing');

  return parts.length > 0 ? parts.join(' / ') : 'Standard';
}

function extractEndTypeFromText(text: string): string {
  const t = text.toUpperCase();

  if (/THREADED\s*\(NPTF?\)|ENDS?\s*:\s*THREADED/.test(t))
    return 'Threaded (NPTF)';
  if (/\bNPTF?\b/.test(t)) return 'Threaded (NPT)';
  if (/\bTHREADED\b/.test(t)) return 'Threaded';
  if (/\bSW\b|\bSOCKET\s*WELD/.test(t)) return 'Socket Weld';
  if (/\bBW\b|\bBUTT\s*WELD/.test(t)) return 'Butt Weld';

  if (/\bRTJ\b/.test(t)) return 'RTJ Flanged';
  if (/\bRF\b/.test(t))  return 'RF Flanged';
  if (/\bFF\b/.test(t))  return 'FF Flanged';
  if (/FLANGED/.test(t)) return 'Flanged';

  return 'RF Flanged';
}

function extractOperatorFromText(text: string,
  sizeInches: number | null): string {
  const t = text.toUpperCase();

  if (/ELECTRIC\s*ACTUAT|MOV\b/.test(t)) return 'Electric Actuator';
  if (/PNEUMATIC\s*ACTUAT|AOV\b/.test(t)) return 'Pneumatic Actuator';
  if (/HYDRAULIC\s*ACTUAT/.test(t)) return 'Hydraulic Actuator';
  if (/GEAR\s*OPERAT|GEAR\s*BOX/.test(t)) return 'Gear Operated';

  if (sizeInches && sizeInches >= 6) {
    if (/GATE\s*VALVE|GLOBE\s*VALVE|BALL\s*VALVE/.test(t)) {
      return 'Gear Operated (recommended for this size)';
    }
  }

  if (/HANDWHEEL/.test(t)) return 'Handwheel';
  if (/LEVER/.test(t))     return 'Lever';

  return sizeInches && sizeInches <= 4 ? 'Lever' : 'Handwheel';
}

export async function processSingleRow(rowData: any, rowIndex: number = 1, catalogue: any[] = [], notMfgList: string[] = ['Butterfly Valve', 'Plug Valve', 'Strainer', 'Double Block & Bleed'], userCustomRules: any[] = [], isParagraphMode: boolean = false): Promise<{ processedRow: ProcessedRow, flags: Flag[], isNotMfg: boolean }> {
  const flags: Flag[] = [];
  
  let desc = '';
  if (Array.isArray(rowData) && rowData.length === 1) {
    desc = String(rowData[0] || '');
  } else if (typeof rowData === 'object' && rowData !== null && Object.keys(rowData).length === 1) {
    desc = String(Object.values(rowData)[0] || '');
  } else if (typeof rowData === 'string') {
    desc = rowData;
  } else {
    desc = rowData.desc || '';
  }

  const combinedDesc = isParagraphMode ? desc.toUpperCase().replace(/\s+/g, ' ').trim() : `${rowData.desc} ${rowData.body} ${rowData.endType} ${rowData.construct}`.toUpperCase();

  let valveType = '';
  if (isParagraphMode) {
    valveType = combinedDesc.split(',')[0].trim();
  } else {
    // Attempt from desc first, fallback to type, then body/construct
    valveType = detectValveType(rowData.desc);
    if (valveType === 'Unknown Valve' && rowData.type) {
      valveType = detectValveType(rowData.type);
    }
    if (valveType === 'Unknown Valve') {
      valveType = detectValveType('', rowData.body, rowData.construct);
    }
  }
  
  let isNotMfg = false;
  if (notMfgList.includes(valveType) || notMfgList.some(nm => valveType.toLowerCase().includes(nm.toLowerCase()))) {
    isNotMfg = true;
  }

  const processedRow: ProcessedRow = {
    valveType: valveType,
    size: '',
    class: '',
    standard: '',
    model: '',
    moc: '',
    trim: '',
    gasket: '',
    packing: '',
    operator: '',
    endDetail: '',
    bolting: '',
    originalRow: rowData,
    score: 0
  };

  let size: string | null = null;
  let pressureClass: string | null = null;

  if (isParagraphMode) {
    const standard   = extractStandardFromText(desc, valveType);
    const moc        = extractMOCFromText(desc);
    const trim       = extractTrimFromText(desc, valveType);
    const endType    = extractEndTypeFromText(desc);
    const model      = buildModelFromDescription(desc, valveType);
    
    size  = extractSizeFromText(desc);
    pressureClass = extractClassFromText(desc);

    if (!size) {
      size = 'Not specified';
      flags.push({
        row: rowIndex,
        field: 'Size',
        message: 'Size not found in description — check if size column exists',
        type: 'warning'
      });
    }

    if (!pressureClass) {
      pressureClass = 'Not specified';
      flags.push({
        row: rowIndex,
        field: 'Class',
        message: 'Pressure class not found — check if class column exists',
        type: 'warning'
      });
    }

    const sizeInches = size !== 'Not specified' ? parseFloat(size.replace('"', '')) : null;
    const operator   = extractOperatorFromText(desc, sizeInches);
    
    // Extract Seat
    let seat = '';
    const seatMatch = desc.match(/SEAT\s*:?\s*([^,;]+)/i);
    if (seatMatch) {
      seat = seatMatch[1].trim();
    } else if (desc.toUpperCase().includes('PTFE')) {
      seat = 'PTFE';
    } else if (desc.toUpperCase().includes('PEEK')) {
      seat = 'PEEK';
    } else if (desc.toUpperCase().includes('METAL SEAT')) {
      seat = 'Metal Seated';
    }

    processedRow.valveType     = valveType;
    processedRow.size          = size;
    processedRow.class         = pressureClass;
    processedRow.standard      = standard;
    processedRow.model         = model;
    processedRow.moc           = moc.resolvedMoc;
    processedRow.trim          = trim;
    processedRow.endDetail     = endType;
    processedRow.operator      = operator;
    processedRow.gasket        = getGasket(valveType);
    processedRow.packing       = getPacking(valveType, standard);
    processedRow.bolting       = getBolting(moc.resolvedMoc) || 'Standard Bolting';
    processedRow.seat          = seat;

    if (isNotMfg) {
      processedRow.gasket = `Not manufactured by XYZ Company - ${valveType}`;
      flags.push({
        row: rowIndex,
        field: 'Valve Type',
        message: 'Not manufactured',
        type: 'warning'
      });
    }

  } else {
    // Multi-column mode
    size = parseSize(rowData.size);
    if (!size && desc) {
      size = extractSizeFromText(desc);
    }
    pressureClass = parseClass(rowData.rating);

    if (size && parseFloat(size) > 100) {
      flags.push({
        row: rowIndex,
        field: 'Size',
        message: '? Size could not be parsed — check RFQ column',
        type: 'critical'
      });
      size = null;
    }

    if (valveType.includes('BALL VALVE') || valveType === 'Ball Valve') {
      valveType = resolveBallType(pressureClass || '', size || '');
    } else if (valveType.includes('CHECK VALVE') || valveType === 'Check Valve') {
      valveType = resolveCheckType(size || '');
    }

    processedRow.valveType = valveType;
    processedRow.size = formatSize(size);
    processedRow.class = pressureClass ? `CLASS ${pressureClass}` : '';

    if (isNotMfg) {
      processedRow.gasket = `Not manufactured by XYZ Company - ${valveType}`;
      flags.push({
        row: rowIndex,
        field: 'Valve Type',
        message: 'Not manufactured',
        type: 'warning'
      });
    } else {
      processedRow.standard = getStandard(valveType, size, pressureClass || '') || '';
      processedRow.model = getModel(valveType, size || '', pressureClass || '', rowData.endType);
      
      const mocResult = getMOC(rowData.body);
      processedRow.moc = mocResult.resolved || 'Unknown';
      if (mocResult.flag) {
        flags.push({
          row: rowIndex,
          field: 'MOC',
          message: mocResult.flag,
          type: 'warning'
        });
      }
      if (mocResult.cast && size && parseFloat(size) < 2) {
        flags.push({
          row: rowIndex,
          field: 'MOC',
          message: 'Cast MOC not allowed for size < 2"',
          type: 'critical'
        });
      }

      const trimResult = getTrim(valveType, size, rowData.trim, rowData.body);
      processedRow.trim = trimResult || '';
      if (!trimResult && !valveType.includes('Ball') && !isNotMfg) {
        flags.push({
          row: rowIndex,
          field: 'Trim',
          message: 'Trim not recognised',
          type: 'warning'
        });
      }

      processedRow.gasket = getGasket(valveType);
      processedRow.packing = getPacking(valveType, processedRow.standard);
      processedRow.operator = getOperator(valveType, size, pressureClass || '') || '';
      processedRow.endDetail = getEndDetail(rowData.endType, combinedDesc);
      processedRow.bolting = getBolting(processedRow.moc) || 'Standard Bolting';
    }
  }

  // ── RULES MATCHING (TOP PRIORITY) ──
  let ruleMatched = false;
  for (const rule of userCustomRules) {
    const allMet = rule.conditions.every((cond: any) => {
      const fieldMap: Record<string, string> = {
        valve_type: processedRow.valveType,
        size:       processedRow.size?.replace('"', '') || '',
        class:      processedRow.class?.replace('CLASS ', '').replace('Class ', '') || '',
        moc:        processedRow.moc || '',
        end_type:   processedRow.endDetail || '',
        trim:       processedRow.trim || '',
      };
      const actual = fieldMap[cond.field] || '';

      switch (cond.operator) {
        case 'equals':     return actual.toLowerCase() === cond.value.toLowerCase();
        case 'not_equals': return actual.toLowerCase() !== cond.value.toLowerCase();
        case '>=':         return parseFloat(actual) >= parseFloat(cond.value);
        case '<=':         return parseFloat(actual) <= parseFloat(cond.value);
        case 'contains':   return actual.toLowerCase().includes(cond.value.toLowerCase());
        default:           return false;
      }
    });

    if (allMet) {
      const fieldMap: Record<string, keyof ProcessedRow> = {
        operator: 'operator', model: 'model', standard: 'standard',
        trim: 'trim', gasket: 'gasket', packing: 'packing', bolting: 'bolting',
      };
      const target = fieldMap[rule.output_field];
      if (target) (processedRow as any)[target] = rule.output_value;
      
      processedRow.match_info = `Rule Match — Rule #${rule.id || 'Unknown'}`;
      ruleMatched = true;
      break; // Stop checking rules after first match
    }
  }

  // ── SCORE CALCULATION & CATALOGUE MATCHING ──
  processedRow.score = calculateScore(processedRow, catalogue);

  if (isNotMfg) {
    processedRow.match_info = 'Unmatched';
    processedRow.score = 0;
  } else if (ruleMatched) {
    processedRow.score = 100;
  } else {
    if (Array.isArray(catalogue) && catalogue.length > 0) {
      if (processedRow.score >= 70) {
        processedRow.match_info = 'Catalogue Match';
        const matchedItem = catalogue.find(i => (i.part_number || i.id) === processedRow.matchId);
        if (matchedItem) {
          processedRow.catalogueModel = matchedItem.part_number || matchedItem.description;
        }
      } else if (processedRow.score >= 40) {
        processedRow.match_info = 'Review Required';
        const matchedItem = catalogue.find(i => (i.part_number || i.id) === processedRow.matchId);
        if (matchedItem) {
          processedRow.catalogueModel = matchedItem.part_number || matchedItem.description;
        }
      } else {
        processedRow.match_info = 'Unmatched';
        flags.push({
          row: rowIndex,
          field: 'Catalogue',
          message: 'No matching product found in catalogue (score < 40)',
          type: 'warning'
        });
      }
    } else {
      processedRow.match_info = 'Unrestricted — No catalogue entries';
    }
  }

  return { processedRow, flags, isNotMfg };
}

export async function fetchUserContext(userId?: string) {
  let catalogue: any[] = [];
  let catalogueCount = 0;
  let notMfgList = ['Butterfly Valve', 'Plug Valve', 'Strainer', 'Double Block & Bleed'];
  let userCustomRules: any[] = [];

  if (!userId) return { catalogue, catalogueCount, notMfgList, userCustomRules };

  const sb = getSupabase();
  if (!sb) return { catalogue, catalogueCount, notMfgList, userCustomRules };

  try {
    const [{ data: catData, error: catError }, { data: rulesData, error: rulesError }, { data: customData }] = await Promise.all([
      sb.from('product_catalogue').select('*').eq('user_id', userId),
      sb.from('engine_rules').select('*').eq('user_id', userId),
      sb.from('user_custom_rules').select('*').eq('user_id', userId).eq('active', true).order('priority', { ascending: true })
    ]);
    
    if (!catError && catData) {
      catalogue = catData;
      catalogueCount = catData.length;
    }

    if (!rulesError && rulesData) {
      // Merge aliases
      const aliases = rulesData.filter(r => r.rule_type === 'aliases');
      for (const rule of aliases) {
        const { abbr, mapsTo } = rule.rule_data;
        if (!abbr || !mapsTo) continue;
        
        const targetMap = mapsTo.toLowerCase().includes('valve') ? VALVE_ALIASES : null;
        if (targetMap) {
          const key = Object.keys(VALVE_CANONICAL).find(k => VALVE_CANONICAL[k].toLowerCase() === mapsTo.toLowerCase());
          if (key) {
            if (!targetMap[key]) targetMap[key] = [];
            if (!targetMap[key].includes(abbr.toUpperCase())) {
              targetMap[key].push(abbr.toUpperCase());
            }
          }
        }
        
        // Also update the new ALIAS_MAP
        if (mapsTo.toLowerCase().includes('valve')) {
          ALIAS_MAP.valve_type[abbr.toLowerCase()] = mapsTo;
        }
      }

      // Merge MOC rules
      const mocRules = rulesData.filter(r => r.rule_type === 'moc');
      for (const rule of mocRules) {
        const { customerWrites, resolvedMoc, type } = rule.rule_data;
        if (!customerWrites || !resolvedMoc) continue;

        // Find existing key or create new one
        let key = Object.keys(MOC_CANONICAL).find(k => MOC_CANONICAL[k].toLowerCase() === resolvedMoc.toLowerCase());
        if (!key) {
          key = customerWrites.toLowerCase().replace(/[^a-z0-9]/g, '');
          MOC_CANONICAL[key] = resolvedMoc;
          MOC_CAST[key] = type === 'Cast';
        }
        
        if (!MOC_ALIASES[key]) MOC_ALIASES[key] = [];
        if (!MOC_ALIASES[key].includes(customerWrites.toUpperCase())) {
          MOC_ALIASES[key].push(customerWrites.toUpperCase());
        }
        
        // Also update the new ALIAS_MAP
        ALIAS_MAP.moc[customerWrites.toLowerCase()] = resolvedMoc;
      }

      // Merge Not Mfg rules
      const notMfgRules = rulesData.filter(r => r.rule_type === 'notmfg');
      for (const rule of notMfgRules) {
        const { label, active } = rule.rule_data;
        if (active && label && !notMfgList.includes(label)) {
          notMfgList.push(label);
        } else if (!active && label) {
          notMfgList = notMfgList.filter(l => l !== label);
        }
      }

      // Merge Trim rules
      const trimRules = rulesData.filter(r => r.rule_type === 'trim');
      for (const rule of trimRules) {
        const { code, wo, ss, ssw } = rule.rule_data;
        if (!code) continue;

        // Find existing key or create new one
        let key = Object.keys(TRIM_CANONICAL).find(k => TRIM_CANONICAL[k].toLowerCase() === code.toLowerCase());
        if (!key) {
          key = 'trim_' + code.toLowerCase().replace(/[^a-z0-9]/g, '');
          TRIM_CANONICAL[key] = code;
          TRIM_DATA[key] = { wo: wo || null, ss: ss || null, ssw: ssw || null };
        } else {
          TRIM_DATA[key] = { wo: wo || null, ss: ss || null, ssw: ssw || null };
        }
        
        if (!TRIM_ALIASES[key]) TRIM_ALIASES[key] = [];
        if (!TRIM_ALIASES[key].includes(code.toUpperCase())) {
          TRIM_ALIASES[key].push(code.toUpperCase());
        }
      }

      // Merge Operator rules
      const operatorRules = rulesData.filter(r => r.rule_type === 'operator');
      for (const rule of operatorRules) {
        const { category, class: cls, threshold, below } = rule.rule_data;
        if (!category || !cls || !threshold || !below) continue;
        
        const catKey = category.toLowerCase().includes('gate') ? 'gate' :
                       category.toLowerCase().includes('globe') ? 'globe' :
                       category.toLowerCase().includes('ball') ? 'ball' : null;
        
        if (catKey) {
          const classNum = parseInt(cls);
          if (!isNaN(classNum)) {
            if (!OPERATOR_THRESHOLDS[catKey]) OPERATOR_THRESHOLDS[catKey] = {};
            OPERATOR_THRESHOLDS[catKey][classNum] = parseFloat(threshold.replace(/[^0-9.]/g, ''));
            
            if (!OPERATOR_BELOW[catKey]) OPERATOR_BELOW[catKey] = {};
            OPERATOR_BELOW[catKey][classNum] = below;
          }
        }
      }
    }

    if (customData) userCustomRules = customData;

  } catch (err) {
    console.error('Failed to load catalogue or rules:', err);
  }

  return { catalogue, catalogueCount, notMfgList, userCustomRules };
}

function buildAliasMap(catalogueMap: any[]): Record<string, string> {
  const aliasMap: Record<string, string> = {};
  if (!Array.isArray(catalogueMap)) return aliasMap;
  const valveTypes = catalogueMap.filter(i => i.category?.toLowerCase().includes('valve')).map(i => i.description || '');
  
  for (const canonicalName of valveTypes) {
    if (!canonicalName) continue;
    const lower = canonicalName.toLowerCase();
    
    // Always map the full name to itself
    aliasMap[lower] = canonicalName;
    
    // Auto-generate short aliases from significant words
    // Remove common words: valve, type, mounted, series
    const words = lower.replace(/\b(valve|type|mounted|series|pattern)\b/g, '').trim();
    if (words.length > 2) aliasMap[words] = canonicalName;
    
    // Generate acronym: "Floating Ball Valve" → "FBV"
    const acronym = canonicalName
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase();
    if (acronym.length >= 2) aliasMap[acronym.toLowerCase()] = canonicalName;
  }
  
  return aliasMap;
}

export async function processRFQ(
  fileBuffer: Buffer,
  columnMap: Record<string, string>,
  catalogueItems: Array<{category: string, value: string}>,
  userRules: Array<any>,
  filename: string = 'RFQ.xlsx',
  userId?: string
): Promise<Buffer> {
  // STEP 1: Guard — fail loudly if catalogue missing
  if (!catalogueItems || catalogueItems.length === 0) {
    throw new Error(
      'No catalogue found. Please import your catalogue before processing RFQ.'
    )
  }

  // STEP 2: Build catalogueMap — group by category
  const catalogueMap: Record<string, string[]> = {}
  for (const item of catalogueItems) {
    const cat = item.category?.trim()
    const val = item.value?.trim()
    if (!cat || !val) continue
    if (!catalogueMap[cat]) catalogueMap[cat] = []
    catalogueMap[cat].push(val)
  }

  // STEP 3: Build alias/rules map from userRules
  const aliasMap: Record<string, string> = {}
  for (const rule of (userRules || [])) {
    const input = rule.input || rule.rule_data?.input || rule.rule_data?.customerWrites;
    const output = rule.output || rule.rule_data?.output || rule.rule_data?.resolvedMoc;
    if (input && output) {
      aliasMap[input.toLowerCase().trim()] = output
    }
  }

  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { 
    header: 1,      // gives array of arrays
    defval: '',     // empty cells = '' not undefined
    raw: false      // all values as strings
  }) as any[][];

  if (data.length < 2) {
    throw new Error('Excel file is empty or missing headers');
  }

  // Phase 1: Detect format once
  let headerRowIndex = 0;
  let isSingleColumn = false;
  
  // Find header row for multi-column format
  let foundHeaders = false;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const rowStr = data[i].join(' ').toLowerCase();
    if (rowStr.includes('desc') || rowStr.includes('item') || rowStr.includes('valve')) {
      headerRowIndex = i;
      foundHeaders = true;
      break;
    }
  }

  if (!foundHeaders) {
    // Check if it's likely a single-column format
    // A single column format usually has long text in the first column and empty subsequent columns
    let singleColumnCount = 0;
    let multiColumnCount = 0;
    
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i];
      const nonEmptyCells = row.filter(c => c && String(c).trim() !== '');
      if (nonEmptyCells.length === 1 && String(nonEmptyCells[0]).length > 20) {
        singleColumnCount++;
      } else if (nonEmptyCells.length > 1) {
        multiColumnCount++;
      }
    }

    if (singleColumnCount > multiColumnCount) {
      isSingleColumn = true;
      headerRowIndex = -1; // No headers to skip
    } else {
      // Fallback if no keywords found but looks multi-column
      for (let i = 0; i < Math.min(10, data.length); i++) {
        const nonEmpty = data[i].filter(c => c && String(c).trim()).length;
        if (nonEmpty >= 3) { headerRowIndex = i; break; }
      }
    }
  }

  if (customColumnMap) {
    isSingleColumn = false;
    if (headerRowIndex === -1) {
      for (let i = 0; i < Math.min(10, data.length); i++) {
        const nonEmpty = data[i].filter(c => c && String(c).trim()).length;
        if (nonEmpty >= 3) { headerRowIndex = i; break; }
      }
    }
  }

  const dataRows = isSingleColumn ? data : data.slice(headerRowIndex + 1);
  const headers = isSingleColumn ? [] : (data[headerRowIndex] as any[]);
  const columnMap = customColumnMap || (isSingleColumn ? {} : detectColumns(headers));

  const isMultiColumn = columnMap && Object.keys(columnMap).length > 0 ? true : (headers.length >= 3 &&
    headers.some(h => /size|dn|nps/i.test(String(h))) &&
    headers.some(h => /class|rating|pressure/i.test(String(h))));

  const isParagraphMode = columnMap && Object.keys(columnMap).length > 0 ? false : (isSingleColumn || !isMultiColumn);

  const result: ProcessResult = {
    total_rows: dataRows.length,
    processed: 0,
    not_manufactured: 0,
    flags: [],
    processed_rows: [],
    columnMap: columnMap,
    format: 'multi_column',
    catalogue_count: catalogueItems.length
  };

  // Helper — get value by detected column, fallback to fixed index
  const get = (row: any[], field: string, fallback: number): string =>
    String(row[columnMap[field] !== undefined ? columnMap[field] : fallback] || '');

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    
    // Skip completely empty rows
    if (!row || row.length === 0 || row.every(cell => !cell || String(cell).trim() === '')) continue;

    let rowData: any;
    if (isSingleColumn) {
      rowData = row;
    } else {
      rowData = {
        item:      get(row, 'item', 0),
        desc:      get(row, 'desc', 1),
        type:      get(row, 'type', -1),
        spec:      get(row, 'spec', 2),
        rating:    get(row, 'rating', 3),
        body:      get(row, 'body', 4),
        trim:      get(row, 'trim', 7),
        construct: get(row, 'construct', 8),
        endType:   get(row, 'endType', 9),
        size:      get(row, 'size', 11),
        qty:       get(row, 'qty', 12),
      };
    }

    const { processedRow, flags, isNotMfg } = await processSingleRow(rowData, i + (isSingleColumn ? 1 : headerRowIndex + 2), catalogueMap, aliasMap, [], isParagraphMode);

    if (isNotMfg) {
      result.not_manufactured++;
    }

    result.flags.push(...flags);
    result.processed_rows.push(processedRow);
    result.processed++;
  }

  // Generate output Excel (3 TABS)
  const wb = xlsx.utils.book_new();

  // Tab 1 — OUTPUT
  const outputHeaders = [
    'Sr No', 'Tag No', 'Description', 'Valve Type', 'Size', 'Pressure Class',
    'MOC', 'End Type', 'Model', 'Standard', 'Trim', 'Seat', 'Operator', 'Bolting', 'Packing', 'Gasket', 'Match Info', 'Remarks'
  ];
  const outputRows = result.processed_rows.map((r, idx) => [
    idx + 1,
    r.originalRow?.item || '',
    r.originalRow?.desc || '',
    r.valveType,
    r.size,
    r.class,
    r.moc,
    r.endDetail,
    r.model,
    r.standard,
    r.trim,
    r.seat || '',
    r.operator || '',
    r.bolting || '',
    r.packing || '',
    r.gasket || '',
    r.match_info || 'Unmatched',
    result.flags.filter(f => f.row === idx + (isSingleColumn ? 1 : headerRowIndex + 2)).map(f => f.message).join('; ')
  ]);

  const wsOutput = xlsx.utils.aoa_to_sheet([outputHeaders, ...outputRows]);
  wsOutput['!cols'] = [
    {wch:6},{wch:10},{wch:40},{wch:16},{wch:8},
    {wch:14},{wch:14},{wch:10},{wch:24},{wch:14},
    {wch:18},{wch:15},{wch:15},{wch:20},{wch:20},{wch:20},{wch:30},{wch:30}
  ];
  xlsx.utils.book_append_sheet(wb, wsOutput, 'OUTPUT');

  // Tab 2 — UNMATCHED
  const unmatchedHeaders = [
    'Sr No', 'Original Description', 'Detected Valve Type', 'Detected Size',
    'Detected Class', 'Detected MOC', 'Reason'
  ];
  const unmatchedRows = result.processed_rows
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) => r.match_info === 'Unmatched')
    .map(({ r, idx }) => [
      idx + 1,
      r.originalRow?.desc || '',
      r.valveType,
      r.size,
      r.class,
      r.moc,
      result.flags.filter(f => f.row === idx + (isSingleColumn ? 1 : headerRowIndex + 2)).map(f => f.message).join('; ') || 'No matching product in catalogue'
    ]);

  const wsUnmatched = xlsx.utils.aoa_to_sheet([
    ['These items were not found in your product catalogue.', 'Review and respond to customer separately.'],
    [],
    unmatchedHeaders,
    ...unmatchedRows
  ]);
  wsUnmatched['!cols'] = [
    {wch:6},{wch:40},{wch:16},{wch:8},
    {wch:14},{wch:14},{wch:35}
  ];
  xlsx.utils.book_append_sheet(wb, wsUnmatched, 'UNMATCHED');

  // Tab 3 — SUMMARY
  let companyName = 'Unknown';
  const sb = getSupabase();
  if (userId && sb) {
    const { data: userData } = await sb.from('profiles').select('company_name').eq('id', userId).single();
    if (userData) companyName = userData.company_name;
  }

  const ruleMatchCount = result.processed_rows.filter(r => r.match_info?.startsWith('Rule Match')).length;
  const catalogueMatchCount = result.processed_rows.filter(r => r.match_info?.startsWith('Catalogue Match')).length;
  const unmatchedCount = result.processed_rows.filter(r => r.match_info === 'Unmatched' || !r.match_info).length;

  const summaryRows = [
    ['Company/User:', companyName],
    ['Processed by:', 'ValveIQ Pro'],
    ['RFQ File:', filename || 'Unknown'],
    ['Processed on:', new Date().toISOString()],
    ['─────────────────────────────────────', ''],
    ['Total rows in RFQ:', result.total_rows],
    ['Matched by Rule:', ruleMatchCount],
    ['Matched by Catalogue:', catalogueMatchCount],
    ['Unmatched:', unmatchedCount],
    ['─────────────────────────────────────', ''],
    ['Flags raised:', result.flags.length],
    ['Processing time:', 'N/A'],
    ['─────────────────────────────────────', ''],
    ['Catalogue items used:', catalogueItems.length],
    ['Engine version:', '1.0.0']
  ];

  const wsSummary = xlsx.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{wch:28},{wch:30}];
  xlsx.utils.book_append_sheet(wb, wsSummary, 'SUMMARY');

  const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return excelBuffer;
}

export async function generateTrace(desc: string, userId?: string): Promise<string[]> {
  const trace: string[] = [];
  
  trace.push(`> Step 1 — Input received: "${desc}"`);
  
  // Create a mock rowData from the description
  const rowData = { desc, rating: '', size: '', body: '', trim: '', endType: '', construct: '' };
  
  // Try to extract size and rating from description for the trace
  const sizeMatch = desc.match(/(\d+(?:-\d+\/\d+)?|\d+\/\d+)"?/);
  if (sizeMatch) rowData.size = sizeMatch[1];
  
  const classMatch = desc.match(/(?:CLASS|CL|#|LB)?\s*(150|300|600|800|900|1500|2500)/i);
  if (classMatch) rowData.rating = classMatch[1];
  
  const { catalogue, notMfgList, userCustomRules } = await fetchUserContext(userId);
  const { processedRow } = await processSingleRow(rowData, 1, catalogue, notMfgList, userCustomRules, false);
  
  trace.push(`> Step 2 — Valve type detected: "${processedRow.valveType}"`);
  trace.push(`> Step 3 — Size detected: ${processedRow.size ? `"${processedRow.size}"` : 'Not found'}`);
  trace.push(`> Step 4 — Class detected: ${processedRow.class ? `"${processedRow.class}"` : 'Not found'}`);
  trace.push(`> Step 5 — Standard resolved: ${processedRow.standard ? `"${processedRow.standard}"` : 'Not found'}`);
  trace.push(`> Step 6 — Model resolved: ${processedRow.model ? `"${processedRow.model}"` : 'Not found'}`);
  trace.push(`> Step 7 — MOC resolved: ${processedRow.moc ? `"${processedRow.moc}"` : 'Not found'}`);
  trace.push(`> Step 8 — Trim resolved: ${processedRow.trim ? `"${processedRow.trim}"` : 'Not found'}`);
  trace.push(`> Step 9 — Operator resolved: ${processedRow.operator ? `"${processedRow.operator}"` : 'Not found'}`);
  trace.push(`> Step 10 — Bolting resolved: ${processedRow.bolting ? `"${processedRow.bolting}"` : 'Not found'}`);
  
  trace.push(`... trace completed successfully.`);
  
  return trace;
}

export async function generateFuzzyMatches(desc: string, userId?: string): Promise<any[]> {
  const { catalogue, notMfgList, userCustomRules } = await fetchUserContext(userId);
  const { processedRow } = await processSingleRow({ desc, rating: '', size: '', body: '', trim: '', endType: '', construct: '' }, 1, catalogue, notMfgList, userCustomRules, false);
  
  // Generate some mock matches based on the parsed data
  const matches = [
    {
      score: processedRow.score + 40,
      type: processedRow.valveType,
      size: processedRow.size || 'Unknown',
      class: processedRow.class || 'Unknown',
      moc: processedRow.moc || 'Unknown',
      trim: processedRow.trim || 'Unknown',
      pass: (processedRow.score + 40) >= 70
    },
    {
      score: processedRow.score + 10,
      type: processedRow.valveType,
      size: processedRow.size || 'Unknown',
      class: processedRow.class || 'Unknown',
      moc: 'Alternative MOC',
      trim: processedRow.trim || 'Unknown',
      pass: (processedRow.score + 10) >= 70
    },
    {
      score: Math.max(0, processedRow.score - 20),
      type: 'Different Valve',
      size: processedRow.size || 'Unknown',
      class: processedRow.class || 'Unknown',
      moc: processedRow.moc || 'Unknown',
      trim: 'Different Trim',
      pass: Math.max(0, processedRow.score - 20) >= 70
    }
  ];
  
  return matches.sort((a, b) => b.score - a.score);
}

// --- Deterministic Rule Functions ---

function normaliseText(text: string): string {
  return String(text || '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
}

function resolveField(input: string, aliases: Record<string, string[]>, tokens: Record<string, string[]>, canonical: Record<string, string>): string | null {
  const norm = normaliseText(input);
  if (!norm) return null;

  // Layer 1: Exact Alias Match
  for (const [key, aliasList] of Object.entries(aliases)) {
    if (aliasList.some(alias => norm.includes(normaliseText(alias)))) return key;
  }

  // Layer 2: Token Scoring
  let bestTokenKey = null;
  let maxScore = 0;
  for (const [key, tokenList] of Object.entries(tokens)) {
    const score = tokenList.filter(t => norm.includes(normaliseText(t))).length;
    if (score > maxScore) { maxScore = score; bestTokenKey = key; }
  }
  if (bestTokenKey && maxScore > 0) return bestTokenKey;

  // Layer 3: Levenshtein Distance
  let bestLevKey = null;
  let minDistance = Infinity;
  for (const [key, canon] of Object.entries(canonical)) {
    const dist = levenshtein(norm, normaliseText(canon));
    const threshold = Math.max(norm.length, canon.length) * 0.4;
    if (dist < threshold && dist < minDistance) {
      minDistance = dist;
      bestLevKey = key;
    }
  }
  return bestLevKey;
}

const VALVE_ALIASES: Record<string, string[]> = {
  gate:       ['GATE VALVE','GATE V/V','GATE VLV','GTV','WEDGE VALVE','SLAB GATE','EXPANDING GATE','GV'],
  globe:      ['GLOBE VALVE','GLOBE V/V','GLOBE VLV','GLV','GBV','Y-TYPE GLOBE','Y TYPE'],
  floating_ball: ['FLOATING BALL','SIDE ENTRY FLOATING','FBV'],
  trunnion_ball: ['TRUNNION','TRUNNION MOUNTED','TMBV'],
  ball:       ['BALL VALVE','BALL V/V','BALL VLV','BV'],
  swing_check: ['SWING CHECK'],
  piston_check: ['PISTON CHECK'],
  dual_plate: ['DUAL PLATE','DP CHECK','WAFER CHECK'],
  check:      ['CHECK VALVE','CHECK V/V','CHK','NRV','NON RETURN','LIFT CHECK'],
  butterfly:  ['BUTTERFLY VALVE','BFV','BFLY','HIGH PERFORMANCE BUTTERFLY','HPBV'],
  plug:       ['PLUG VALVE','PLV','PV'],
  strainer:   ['STRAINER','Y STRAINER','BASKET STRAINER'],
  dbb:        ['DBB','DOUBLE BLOCK AND BLEED']
};

const VALVE_TOKENS: Record<string, string[]> = {
  gate:       ['GATE','GTW','WEDGE','SLAB','KNIFE','GV'],
  globe:      ['GLOBE','GLB','GLV'],
  floating_ball: ['FLOATING','FBV'],
  trunnion_ball: ['TRUNNION','TMBV'],
  ball:       ['BALL','BV'],
  swing_check: ['SWING'],
  piston_check: ['PISTON'],
  dual_plate: ['DUAL','WAFER','DP CHECK'],
  check:      ['CHECK','CHK','NRV','NON RETURN','LIFT'],
  butterfly:  ['BUTTERFLY','BFLY','BFV','HPBV'],
  plug:       ['PLUG','PLV'],
  strainer:   ['STRAINER','Y-TYPE','BASKET'],
  dbb:        ['DOUBLE BLOCK','DBB','BLEED']
};

const VALVE_CANONICAL: Record<string, string> = {
  gate: 'Gate Valve', globe: 'Globe Valve', floating_ball: 'Floating Ball Valve', trunnion_ball: 'Trunnion Mounted Ball Valve', ball: 'Ball Valve',
  swing_check: 'Check Valve - Swing Type', piston_check: 'Lift Check Valve - Piston Type', check: 'Check Valve', dual_plate: 'Dual Plate Check Valve', butterfly: 'Butterfly Valve',
  plug: 'Plug Valve', strainer: 'Strainer', dbb: 'Double Block and Bleed'
};

function detectValveType(desc: string, body = '', construct = ''): string {
  const combined = [desc, body, construct].filter(Boolean).join(' ');
  const resolved = resolveField(combined, VALVE_ALIASES, VALVE_TOKENS, VALVE_CANONICAL);
  return resolved ? VALVE_CANONICAL[resolved] : 'Unknown Valve';
}

function parseSize(str: string): string | null {
  if (!str) return null;
  const norm = normaliseText(str);
  
  const DN_TO_NPS: Record<number, number> = {
    15: 0.5, 20: 0.75, 25: 1, 32: 1.25, 40: 1.5, 50: 2,
    65: 2.5, 80: 3, 100: 4, 125: 5, 150: 6, 200: 8,
    250: 10, 300: 12, 350: 14, 400: 16, 450: 18, 500: 20,
    600: 24, 650: 26, 700: 28, 750: 30, 900: 36
  };

  const dnMatch = norm.match(/DN\s*(\d+)/);
  if (dnMatch) {
    const nps = DN_TO_NPS[parseInt(dnMatch[1])];
    return nps ? String(nps) : null;
  }

  const npsMatch = norm.match(/NPS\s*(\d+(?:\.\d+)?)/) || norm.match(/(\d+(?:\.\d+)?)\s*NPS/);
  if (npsMatch) return npsMatch[1];

  const inchMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:INCH|IN)/);
  if (inchMatch) return inchMatch[1];
  
  const fractionMap: Record<string, number> = {
    '1/4': 0.25, '3/8': 0.375, '1/2': 0.5, '3/4': 0.75,
    '1 1/4': 1.25, '1 1/2': 1.5, '1 3/4': 1.75, '2 1/2': 2.5,
    '3 1/2': 3.5, '4 1/2': 4.5
  };
  
  for (const [frac, val] of Object.entries(fractionMap)) {
    if (norm === frac || norm.includes(frac)) return val.toString();
  }
  
  // Only match numbers if they have a unit like ", inch, mm, or are explicitly in a size column
  // Wait, parseSize is used for the size column. If the size column is just "2", it should be parsed.
  // But if it's "Model 95", it shouldn't be parsed as 95.
  // Let's check if the string is exactly a number, or starts with a number followed by a unit.
  const exactNumMatch = norm.match(/^(\d+(?:\.\d+)?)$/);
  if (exactNumMatch) {
    const num = parseFloat(exactNumMatch[1]);
    if (num > 0 && num <= 100) return num.toString();
  }

  const unitNumMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:"|''|INCH|IN|MM|NB|BORE)/);
  if (unitNumMatch) {
    const num = parseFloat(unitNumMatch[1]);
    if (num > 0 && num <= 100) return num.toString();
  }
  
  return null;
}

function formatSize(numericSize: string | null): string {
  if (!numericSize) return '';
  const num = parseFloat(numericSize);
  // Reverse fraction map for display
  const reverseMap: Record<number, string> = {
    0.25: '1/4"', 0.375: '3/8"', 0.5: '1/2"', 0.75: '3/4"',
    1.25: '1-1/4"', 1.5: '1-1/2"', 1.75: '1-3/4"', 2.5: '2-1/2"',
    3.5: '3-1/2"', 4.5: '4-1/2"'
  };
  return reverseMap[num] || `${numericSize}"`;
}

function parseClass(str: string): string {
  if (!str) return '';
  const norm = normaliseText(str);
  const match = norm.match(/(?:CLASS|CL|ANSI|LB|LBS)\s*(\d{3,4})/) || norm.match(/(\d{3,4})\s*(?:CLASS|CL|ANSI|LB|LBS)/) || norm.match(/(\d{3,4})/);
  if (match) {
    const num = parseInt(match[1]);
    if ([150, 300, 600, 800, 900, 1500, 2500].includes(num)) return String(num);
  }
  return '';
}

function resolveBallType(cls: string, size: string): string {
  const s = parseFloat(size);
  if (cls === '150') return s <= 8 ? 'Floating Ball Valve' : 'Trunnion Mounted Ball Valve';
  if (cls === '300') return s <= 4 ? 'Floating Ball Valve' : 'Trunnion Mounted Ball Valve';
  if (['600', '800', '900', '1500', '2500'].includes(cls)) return s <= 1.5 ? 'Floating Ball Valve' : 'Trunnion Mounted Ball Valve';
  return 'Ball Valve';
}

function resolveCheckType(size: string): string {
  const s = parseFloat(size);
  return s < 2 ? 'Lift Check Valve - Piston Type' : 'Check Valve - Swing Type';
}

function getStandard(valveType: string, size: string | null, classNumStr: string): string | null {
  const type = (valveType || '').toLowerCase();
  const s = size ? parseFloat(size) : null;
  const classNum = classNumStr ? parseInt(classNumStr) : null;

  // Size < 2" overrides everything (except special cases below)
  if (s !== null && s < 2) {
    if (type.includes('lift check') || type.includes('piston')) return 'ISO 15761';
    if (type.includes('ball')) return 'ISO 17292';
    return 'API 602 - Reduce Bore (STD.Bore)';
  }
  
  // Large valve override ≥ 26"
  if (s !== null && s >= 26) return 'ASME B16.34';
  
  // High pressure class override (≥ 2")
  if (classNum !== null && [900, 1500, 2500].includes(classNum)) return 'ASME B16.34';
  
  // Dual plate check — always API 594
  if (type.includes('dual plate')) return 'API 594 - Type B';
  
  // Lift check (always < 2" anyway, but safety net)
  if (type.includes('lift check') || type.includes('piston')) return 'ISO 15761';
  
  // Normal range: 2" to 25.99", class 150/300/600/800
  if (type.includes('trunnion')) return 'API 6D';
  if (type.includes('floating')) return 'ISO 17292';
  if (type.includes('ball')) return 'API 6D';
  if (type.includes('gate')) return 'API 600';
  if (type.includes('globe')) return 'BS 1873';
  if (type.includes('check') || type.includes('swing')) return 'BS 1868';
  
  return null; // Unknown — flag
}

function getModel(type: string, size: string, cls: string, end: string): string {
  const s = parseFloat(size);
  if (type.includes('Ball')) {
    if (cls === '800') return '3 Piece, Bolted, Side Entry - MFR Std';
    return '2 Piece, Bolted, Side Entry - Long pattern';
  }
  if (type.includes('Check')) {
    if (['150', '300', '600'].includes(cls)) return 'Bolted Cover';
    if (['900', '1500', '2500'].includes(cls)) {
      if (s >= 2) return 'Pressure Seal Cover';
      return 'Bolted Cover - Mfg. Std.';
    }
    if (cls === '800') return 'Bolted Cover - Mfg. Std.';
    return '';
  }
  if (['150', '300', '600'].includes(cls)) return 'Bolted - Long pattern';
  if (['900', '1500', '2500'].includes(cls)) {
    if (s >= 2) {
      if (/(FLG|RTJ)/i.test(end)) return 'Pressure Seal - Long Pattern';
      return 'Pressure Seal - Short Pattern';
    }
    return 'Bolted - Mfg. Std.';
  }
  if (cls === '800') return 'Bolted - Mfg. Std.';
  return '';
}

const MOC_ALIASES: Record<string, string[]> = {
  wcb:    ['WCB','A216 WCB','CAST CARBON STEEL','CS'],
  wcc:    ['WCC','A216 WCC'],
  lcb:    ['LCB','A352 LCB','LOW TEMP CARBON STEEL','LTCS'],
  lcc:    ['LCC','A352 LCC'],
  cf8:    ['CF8','A351 CF8','SS304','304SS','STAINLESS STEEL 304'],
  cf8m:   ['CF8M','A351 CF8M','SS316','316SS','STAINLESS STEEL 316'],
  cf3:    ['CF3','A351 CF3','SS304L','304L'],
  cf3m:   ['CF3M','A351 CF3M','SS316L','316L'],
  a105:   ['A105','A105N','FORGED CARBON STEEL','FCS'],
  lf2:    ['LF2','A350 LF2','FORGED LTCS'],
  f304:   ['F304','A182 F304','FORGED 304'],
  f316:   ['F316','A182 F316','FORGED 316'],
  f51:    ['F51','DUPLEX','2205','A182 F51'],
  f53:    ['F53','SUPER DUPLEX','2507','A182 F53'],
  f55:    ['F55','A182 F55'],
  inconel:['INCONEL','INC','ALLOY 625','ALLOY 825'],
  monel:  ['MONEL','ALLOY 400'],
  hastelloy:['HASTELLOY','ALLOY C276'],
  wc6:    ['WC6','A217 WC6'],
  wc9:    ['WC9','A217 WC9'],
  c5:     ['C5','A217 C5'],
  c12:    ['C12','A217 C12'],
  c12a:   ['C12A','A217 C12A'],
  f11:    ['F11','A182 F11'],
  f22:    ['F22','A182 F22'],
  f5:     ['F5','A182 F5'],
  f9:     ['F9','A182 F9'],
  f91:    ['F91','A182 F91']
};

const MOC_TOKENS: Record<string, string[]> = {
  wcb: ['WCB'], wcc: ['WCC'], lcb: ['LCB'], lcc: ['LCC'],
  cf8: ['CF8','304'], cf8m: ['CF8M','316'], cf3: ['CF3','304L'], cf3m: ['CF3M','316L'],
  a105: ['A105'], lf2: ['LF2'], f304: ['F304'], f316: ['F316'],
  f51: ['F51','DUPLEX'], f53: ['F53','SUPER DUPLEX'], f55: ['F55'],
  inconel: ['INCONEL'], monel: ['MONEL'], hastelloy: ['HASTELLOY'],
  wc6: ['WC6'], wc9: ['WC9'], c5: ['C5'], c12: ['C12'], c12a: ['C12A'],
  f11: ['F11'], f22: ['F22'], f5: ['F5'], f9: ['F9'], f91: ['F91']
};

const MOC_CANONICAL: Record<string, string> = {
  wcb: 'A216 WCB', wcc: 'A216 WCC', lcb: 'A352 LCB', lcc: 'A352 LCC',
  cf8: 'A351 CF8', cf8m: 'A351 CF8M', cf3: 'A351 CF3', cf3m: 'A351 CF3M',
  a105: 'A105N', lf2: 'A350 LF2', f304: 'A182 F304', f316: 'A182 F316',
  f51: 'A182 F51 (Duplex)', f53: 'A182 F53 (Super Duplex)', f55: 'A182 F55',
  inconel: 'Inconel', monel: 'Monel', hastelloy: 'Hastelloy',
  wc6: 'A217 WC6', wc9: 'A217 WC9', c5: 'A217 C5', c12: 'A217 C12', c12a: 'A217 C12A',
  f11: 'A182 F11', f22: 'A182 F22', f5: 'A182 F5', f9: 'A182 F9', f91: 'A182 F91'
};

const MOC_CAST: Record<string, boolean> = {
  wcb: true, wcc: true, lcb: true, lcc: true, cf8: true, cf8m: true, cf3: true, cf3m: true,
  a105: false, lf2: false, f304: false, f316: false, f51: false, f53: false, f55: false,
  inconel: false, monel: false, hastelloy: false,
  wc6: true, wc9: true, c5: true, c12: true, c12a: true,
  f11: false, f22: false, f5: false, f9: false, f91: false
};

function getMOC(bodyText: string): { resolved: string | null, cast: boolean, flag: string | null } {
  const resolvedKey = resolveField(bodyText, MOC_ALIASES, MOC_TOKENS, MOC_CANONICAL);
  if (!resolvedKey) return { resolved: null, cast: false, flag: 'MOC not recognised' };
  return { resolved: MOC_CANONICAL[resolvedKey], cast: MOC_CAST[resolvedKey], flag: null };
}

const TRIM_ALIASES: Record<string, string[]> = {
  trim8: ['TRIM 8', 'F6', '13CR', '410'],
  trim12: ['TRIM 12', '316', 'CF8M', 'F316'],
  trim304: ['304', 'F304'],
  trim316l: ['316L', 'F316L'],
  trimf51: ['F51', '2205', 'DUPLEX'],
  trimf53: ['F53', 'SUPER DUPLEX', '2507'],
  trimf44: ['F44', 'CK3MCUN', '254SMO'],
  trimhast: ['HASTELLOY', 'C276'],
  triminc: ['INCONEL 625', 'ALLOY 625'],
  trimmonel: ['MONEL'],
  trimlf2: ['LF2', 'LCB'],
  trima105: ['A105', 'WCB']
};

const TRIM_TOKENS: Record<string, string[]> = {
  trim8: ['TRIM 8', 'F6', '13CR', '410'],
  trim12: ['TRIM 12', '316', 'CF8M', 'F316'],
  trim304: ['304', 'F304'],
  trim316l: ['316L', 'F316L'],
  trimf51: ['F51', '2205', 'DUPLEX'],
  trimf53: ['F53', 'SUPER DUPLEX', '2507'],
  trimf44: ['F44', 'CK3MCUN', '254SMO'],
  trimhast: ['HASTELLOY', 'C276'],
  triminc: ['INCONEL', '625'],
  trimmonel: ['MONEL'],
  trimlf2: ['LF2', 'LCB'],
  trima105: ['A105', 'WCB']
};

const TRIM_CANONICAL: Record<string, string> = {
  trim8: 'TRIM 8',
  trim12: 'TRIM 12',
  trim304: '304',
  trim316l: '316L',
  trimf51: 'F51',
  trimf53: 'F53',
  trimf44: 'F44',
  trimhast: 'HASTELLOY',
  triminc: 'INCONEL 625',
  trimmonel: 'MONEL',
  trimlf2: 'LF2',
  trima105: 'A105'
};

const TRIM_DATA: Record<string, { wo: string | null, ss: string | null, ssw: string | null }> = {
  trim8: { wo: 'F6 / F6 - T1', ss: 'F6 & Hardfaced - T8', ssw: 'Hardfaced (410) - T5' },
  trim12: { wo: '316 - T10', ss: '316 and Hardfaced - T12', ssw: 'Hardfaced (316) - T16' },
  trim304: { wo: '304 - T2', ss: '304 and Hardfaced - T51', ssw: 'Hardfaced (304) - T15' },
  trim316l: { wo: '316L - T55', ss: '316L and Hardfaced - T56', ssw: 'Hardfaced (316L) - T57' },
  trimf51: { wo: 'F51 - T79', ss: 'F51 and Hardfaced - T81', ssw: 'Hardfaced (F51) - T82' },
  trimf53: { wo: 'F53 - T70', ss: 'F53 and Hardfaced - T71', ssw: 'Hardfaced (F53) - T72' },
  trimf44: { wo: 'F44 - T97', ss: 'F44 & Hardfaced', ssw: 'Hardfaced (F44)' },
  trimhast: { wo: 'Hastelloy C276 - T45', ss: 'Hastelloy C276 & Hardfaced - T46', ssw: 'Hardfaced (Hastelloy C276) - T47' },
  triminc: { wo: 'Inconel 625 - T90', ss: 'Inconel 625 & Hardfaced - T9D', ssw: 'Hardfaced (625) - T98' },
  trimmonel: { wo: 'Monel - T9', ss: 'Monel and Hardfaced - T11', ssw: 'Hardfaced (Monel)' },
  trimlf2: { wo: null, ss: 'LF2/LCB & Hardfaced', ssw: 'Hardfaced (LF2/LCB)' },
  trima105: { wo: null, ss: 'F6 & Hardfaced - T8', ssw: 'Hardfaced (410) - T5' }
};

function getTrim(valveType: string, size: string | null, trimRaw: string, mocRaw: string): string | null {
  // Trim only applies to Gate, Globe, Check valves
  const trimApplies = ['gate', 'globe', 'check', 'swing', 'lift', 'dual plate', 'piston'];
  const typeL = (valveType || '').toLowerCase();
  if (!trimApplies.some(t => typeL.includes(t))) return null; // Ball valves = no trim
  
  let raw = String(trimRaw || '').trim().toUpperCase();
  if (!raw || raw === '') {
    // Fallback to MOC-based trim only if trim col is empty
    raw = String(mocRaw || '').trim().toUpperCase();
  }
  
  const s = size && size !== 'Not specified' ? parseFloat(size) : 0;
  const noStellite = /W\/?O\s*STELLITE|WITHOUT\s*STELLITE|NO\s*STELLITE|NON.STELLITE|PLAIN\s*TRIM|PLAIN\s*SEAT|W\/?O\s*HARDFACING/i.test(raw);
  const col = s > 0 && s < 2 ? 'ssw' : (noStellite ? 'wo' : 'ss');
  
  const resolvedKey = resolveField(raw, TRIM_ALIASES, TRIM_TOKENS, TRIM_CANONICAL);
  
  if (resolvedKey && TRIM_DATA[resolvedKey]) {
    const data = TRIM_DATA[resolvedKey];
    return data[col as keyof typeof data] || data['ss'] || data['ssw'];
  }
  
  return null; // Flag as unrecognised trim
}

function getGasket(type: string): string {
  if (type.includes('Ball')) return 'Graphite';
  return 'Spiral Wound Gasket SS316 with Graphite filler';
}

function getPacking(type: string, std: string): string {
  if (type.includes('Check')) return '';
  if (type.includes('Ball')) return 'Graphite';
  if (std.includes('API')) return 'Die moulded Graphite compliance to API 622';
  return 'Die moulded Graphite';
}

const OPERATOR_THRESHOLDS: Record<string, Record<number, number | null>> = {
  gate: { 150: 12, 300: 12, 600: 10, 800: null, 900: 6, 1500: 3, 2500: 3 },
  globe: { 150: 12, 300: 12, 600: 10, 800: null, 900: 6, 1500: 3, 2500: 3 },
  ball: { 150: 6, 300: 6, 600: 4, 800: 3, 900: 3, 1500: 3, 2500: 3 },
};

const OPERATOR_BELOW: Record<string, Record<number, string>> = {
  gate: { 150: 'Hand Wheel', 300: 'Hand Wheel', 600: 'Hand Wheel', 800: 'Hand Wheel', 900: 'Hand Wheel', 1500: 'Hand Wheel', 2500: 'Hand Wheel' },
  globe: { 150: 'Hand Wheel', 300: 'Hand Wheel', 600: 'Hand Wheel', 800: 'Hand Wheel', 900: 'Hand Wheel', 1500: 'Hand Wheel', 2500: 'Hand Wheel' },
  ball: { 150: 'Lever', 300: 'Lever', 600: 'Lever', 800: 'Lever', 900: 'Lever', 1500: 'Lever', 2500: 'Lever' },
};

function getOperator(valveType: string, size: string | null, classNumStr: string): string | null {
  const type = (valveType || '').toLowerCase();
  const s = size ? parseFloat(size) : null;
  const classNum = classNumStr ? parseInt(classNumStr) : null;
  
  if (type.includes('check')) return ''; // Always blank
  if (s === null || classNum === null) return null;
  
  const isGate = type.includes('gate');
  const isGlobe = type.includes('globe');
  const isBall = type.includes('ball') || type.includes('trunnion') || type.includes('floating');
  
  const category = isGate ? 'gate' : isGlobe ? 'globe' : isBall ? 'ball' : null;
  if (!category) return null;
  
  const threshold = OPERATOR_THRESHOLDS[category]?.[classNum];
  const below = OPERATOR_BELOW[category]?.[classNum] || (isBall ? 'Lever' : 'Hand Wheel');
  
  // CLASS 800 gate/globe = always hand wheel
  if ((isGate || isGlobe) && classNum === 800) return 'Hand Wheel';
  
  if (threshold !== null && threshold !== undefined && s >= threshold) return 'Gear Unit; Locking arrangement';
  return below;
}

const END_ALIASES: Record<string, string[]> = {
  flanged: ['FLANGED','FLG','RF','FF','RTJ','RAISED FACE','FLANGE'],
  bw:      ['BUTT WELD','BW','BWE','BUTTWELD'],
  sw:      ['SOCKET WELD','SW','SWE','SOCKETWELD'],
  npt:     ['THREADED','NPT','SCREWED','THD','BSP'],
  wafer:   ['WAFER','WAFER TYPE'],
  lug:     ['LUG','LUG TYPE','LUGGED']
};

const END_TOKENS: Record<string, string[]> = {
  flanged: ['FLG','RF','RTJ'],
  bw:      ['BW','BUTT'],
  sw:      ['SW','SOCKET'],
  npt:     ['NPT','THREADED'],
  wafer:   ['WAFER'],
  lug:     ['LUG']
};

const END_CANONICAL: Record<string, string> = {
  flanged: 'Flanged', bw: 'Butt Weld', sw: 'Socket Weld',
  npt: 'Threaded (NPT)', wafer: 'Wafer', lug: 'Lug'
};

function getEndDetail(endType: string, desc: string): string {
  const combined = [endType, desc].filter(Boolean).join(' ');
  const resolved = resolveField(combined, END_ALIASES, END_TOKENS, END_CANONICAL);
  return resolved ? END_CANONICAL[resolved] : 'Flanged RF'; // Default
}

function getBolting(resolvedMOC: string | null): string | null {
  if (!resolvedMOC) return null;
  const m = resolvedMOC.toUpperCase();
  
  if (m.includes('WCB') || m.includes('WCC') || m.includes('A105') || m.includes('BRONZE') || m.includes('B62'))
    return 'ASTM A193 Gr.B7 / ASTM A194 Gr.2H';
  if (m.includes('LF2') || m.includes('LCB') || m.includes('LCC'))
    return 'ASTM A320 Gr.L7 / ASTM A194 Gr.7';
  if (m.includes('F316') || m.includes('CF8M') || m.includes('F304') || m.includes('CF8') || m.includes('CF3') || m.includes('CF3M'))
    return 'ASTM A193 Gr.B8 CL.1 / ASTM A194 Gr.8';
  if (m.includes('F44') || m.includes('CK3MCU'))
    return 'ASTM A193 Gr.B16 / ASTM A194 Gr.7';
  if (m.includes('F51') || m.includes('F53') || m.includes('F55'))
    return 'ASTM A193 Gr.B8M CL.2 / ASTM A194 Gr.8M';
  if (m.includes('HASTELLOY') || m.includes('INCONEL') || m.includes('MONEL'))
    return 'ASTM A193 Gr.B8 CL.2 / ASTM A194 Gr.8';
  if (m.includes('WC6') || m.includes('WC9') || m.includes('C5') || m.includes('C12') || m.includes('C12A') || m.includes('F11') || m.includes('F22') || m.includes('F5') || m.includes('F9') || m.includes('F91'))
    return 'ASTM A193 Gr.B16 / ASTM A194 Gr.4';
  
  return null;
}

function calculateScore(row: ProcessedRow, catalogue: any[]): number {
  if (!Array.isArray(catalogue) || catalogue.length === 0) {
    // Fallback if no catalogue is loaded
    let score = 0;
    if (row.valveType && row.valveType !== 'Unknown Valve') score += 50;
    if (row.size) score += 20;
    if (row.class) score += 15;
    if (row.moc && row.moc !== 'Unknown') score += 15;
    return Math.min(score, 100);
  }

  let bestScore = 0;
  let bestMatchId = '';

  for (const item of catalogue) {
    let score = 0;
    const desc = (item.description || '').toUpperCase();
    const category = (item.category || '').toUpperCase();

    // 1. Valve Type Match (50 points)
    if (row.valveType && row.valveType !== 'Unknown Valve') {
      const typeTokens = row.valveType.toUpperCase().split(' ');
      if (typeTokens.some(t => desc.includes(t) || category.includes(t))) {
        score += 50;
      }
    }

    // 2. Size Match (20 points)
    if (row.size) {
      const sizeStr = row.size.replace('"', '').trim();
      if (desc.includes(`${sizeStr}"`) || desc.includes(`${sizeStr} INCH`) || desc.includes(sizeStr)) {
        score += 20;
      }
    }

    // 3. Rating Match (15 points)
    if (row.class) {
      const classNum = row.class.replace('CLASS ', '').trim();
      if (desc.includes(classNum) || desc.includes(`CL${classNum}`) || desc.includes(`CL ${classNum}`) || desc.includes(`${classNum}#`)) {
        score += 15;
      }
    }

    // 4. Material Match (15 points)
    if (row.moc && row.moc !== 'Unknown') {
      const mocTokens = row.moc.toUpperCase().split(' ');
      // Check if at least one significant token matches
      const significantTokens = mocTokens.filter(t => !['ASTM', 'GR', 'GR.', 'STEEL', 'ALLOY'].includes(t));
      if (significantTokens.length > 0 && significantTokens.some(t => desc.includes(t))) {
        score += 15;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatchId = item.part_number || item.id;
    }
  }

  if (bestScore >= 40) {
    row.matchId = bestMatchId;
  }
  
  return Math.min(bestScore, 100);
}
