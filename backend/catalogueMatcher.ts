import { matchLayer1 } from './aliasMap';

export function matchLayer2(rfqValue: string, catalogueEntries: string[]): string | null {
  const rfqLower = rfqValue.toLowerCase().trim();
  const rfqWords = rfqLower.split(/\s+/);

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of catalogueEntries) {
    const entryLower = entry.toLowerCase().trim();
    const entryWords = entryLower.split(/\s+/);

    let score = 0;

    if (entryLower.includes(rfqLower) || rfqLower.includes(entryLower)) {
      score += 10;
    }

    const overlap = rfqWords.filter(w => w.length > 2 && entryWords.includes(w));
    score += overlap.length * 3;

    const partialOverlap = rfqWords.filter(w =>
      w.length > 3 && entryWords.some(ew => ew.includes(w) || w.includes(ew))
    );
    score += partialOverlap.length * 2;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestScore >= 3 ? bestMatch : null;
}

const GEMINI_API_KEY = 'AIzaSyDC-j4bH7Lq5GAXaGuEQ5slXH79wSvWKHs';

export async function matchLayer3(rfqValue: string, catalogueEntries: string[], category: string): Promise<string | null> {
  if (!catalogueEntries || catalogueEntries.length === 0) return null;

  try {
    const prompt = `You are an industrial valve engineering expert.

A customer RFQ contains this value for the field "${category}": "${rfqValue}"

The manufacturer's available catalogue entries for "${category}" are:
${catalogueEntries.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Which catalogue entry does the RFQ value most likely refer to?
If none match, reply with: NONE

Reply with ONLY the exact catalogue entry text or NONE. No explanation.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!result || result === 'NONE') return null;

    const verified = catalogueEntries.find(
      e => e.toLowerCase() === result.toLowerCase()
    );
    return verified || null;

  } catch (err) {
    console.error('Layer 3 Gemini match failed:', err);
    return null;
  }
}

export async function matchAgainstCatalogue(rfqValue: string, catalogueEntries: string[], category: string): Promise<{ matched: string | null, layer: number | null }> {
  if (!rfqValue || !catalogueEntries || catalogueEntries.length === 0) {
    return { matched: null, layer: null };
  }

  const l1 = matchLayer1(rfqValue, catalogueEntries, category);
  if (l1) return { matched: l1, layer: 1 };

  const l2 = matchLayer2(rfqValue, catalogueEntries);
  if (l2) return { matched: l2, layer: 2 };

  const l3 = await matchLayer3(rfqValue, catalogueEntries, category);
  if (l3) return { matched: l3, layer: 3 };

  return { matched: null, layer: null };
}
