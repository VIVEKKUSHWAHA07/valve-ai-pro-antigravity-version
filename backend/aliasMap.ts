export const ALIAS_MAP: Record<string, Record<string, string[]>> = {
  valve_type: {
    "Gate Valve": ["gate", "gtv", "gv", "gate valve", "sluice", "sluice valve", "wedge gate"],
    "Ball Valve": ["ball", "bv", "blv", "ball valve", "floating ball", "trunnion ball", "tbv", "fbv"],
    "Globe Valve": ["globe", "glv", "globe valve", "stop valve"],
    "Butterfly Valve": ["butterfly", "bfv", "btf", "butterfly valve", "lug butterfly", "wafer butterfly", "double flanged butterfly", "tobv", "triple offset"],
    "Check Valve": ["check", "chv", "nrv", "non return", "check valve", "non-return valve", "swing check", "dual plate check", "tilting disc check"],
    "Plug Valve": ["plug", "plv", "plug valve", "lubricated plug", "non lubricated plug"],
    "Needle Valve": ["needle", "nv", "needle valve"],
    "Strainer": ["strainer", "str", "y-strainer", "basket strainer", "duplex strainer", "t-strainer"],
    "Pressure Relief Valve": ["prv", "psv", "safety valve", "pressure relief", "relief valve", "pressure safety valve"],
    "Control Valve": ["cv", "control valve", "control", "modulating valve"],
    "DBB Valve": ["dbb", "double block bleed", "double block and bleed"],
  },

  size: {
    "0.5": ["1/2", "0.5", "15mm", "dn15", "½", "half inch", "0.5 inch"],
    "0.75": ["3/4", "0.75", "20mm", "dn20", "¾", "three quarter"],
    "1": ["1\"", "1inch", "1 inch", "25mm", "dn25", "1.0", "one inch"],
    "1.5": ["1.5", "1-1/2", "40mm", "dn40", "one and half"],
    "2": ["2\"", "2inch", "2 inch", "50mm", "dn50", "2.0"],
    "3": ["3\"", "3inch", "3 inch", "80mm", "dn80"],
    "4": ["4\"", "4inch", "4 inch", "100mm", "dn100"],
    "6": ["6\"", "6inch", "6 inch", "150mm", "dn150"],
    "8": ["8\"", "8inch", "8 inch", "200mm", "dn200"],
    "10": ["10\"", "10inch", "10 inch", "250mm", "dn250"],
    "12": ["12\"", "12inch", "12 inch", "300mm", "dn300"],
    "14": ["14\"", "350mm", "dn350"],
    "16": ["16\"", "400mm", "dn400"],
    "18": ["18\"", "450mm", "dn450"],
    "20": ["20\"", "500mm", "dn500"],
    "24": ["24\"", "600mm", "dn600"],
    "30": ["30\"", "750mm", "dn750"],
    "36": ["36\"", "900mm", "dn900"],
    "42": ["42\"", "1050mm", "dn1050"],
    "48": ["48\"", "1200mm", "dn1200"],
  },

  pressure_class: {
    "150": ["150", "150#", "150lb", "150 lb", "ansi 150", "class 150", "pn20"],
    "300": ["300", "300#", "300lb", "300 lb", "ansi 300", "class 300", "pn50"],
    "600": ["600", "600#", "600lb", "600 lb", "ansi 600", "class 600", "pn100"],
    "900": ["900", "900#", "900lb", "900 lb", "ansi 900", "class 900", "pn150"],
    "1500": ["1500", "1500#", "1500lb", "class 1500", "pn250"],
    "2500": ["2500", "2500#", "2500lb", "class 2500", "pn420"],
    "800": ["800", "800#", "sw800", "class 800", "socket weld 800"],
  },

  moc: {
    "WCB": ["wcb", "a216 wcb", "a216gr.wcb", "carbon steel", "cs", "a216"],
    "WCC": ["wcc", "a216 wcc", "a216gr.wcc"],
    "LCB": ["lcb", "a352 lcb", "low temp carbon steel", "ltcs"],
    "LCC": ["lcc", "a352 lcc"],
    "WC6": ["wc6", "a217 wc6", "1.25cr", "1.25 cr"],
    "WC9": ["wc9", "a217 wc9", "2.25cr", "2.25 cr"],
    "C5": ["c5", "a217 c5", "5cr"],
    "C12": ["c12", "a217 c12", "9cr"],
    "CA6NM": ["ca6nm", "a487 ca6nm", "13cr", "13 cr"],
    "CF8": ["cf8", "a351 cf8", "304ss", "ss304", "304 ss"],
    "CF8M": ["cf8m", "a351 cf8m", "316ss", "ss316", "316 ss"],
    "CF3": ["cf3", "a351 cf3", "304l", "304lss"],
    "CF3M": ["cf3m", "a351 cf3m", "316l", "316lss"],
    "SS316": ["ss316", "316", "316ss", "stainless 316", "cf8m", "aisi 316"],
    "SS304": ["ss304", "304", "304ss", "stainless 304", "cf8", "aisi 304"],
    "A105": ["a105", "a105n", "forged carbon steel", "forged cs"],
    "F316": ["f316", "a182 f316", "forged 316"],
    "F304": ["f304", "a182 f304", "forged 304"],
    "F51": ["f51", "a182 f51", "duplex", "2205", "duplex ss"],
    "F53": ["f53", "a182 f53", "super duplex", "2507"],
    "Inconel": ["inconel", "alloy 625", "alloy 825", "inconel 625", "inconel 825"],
    "Hastelloy": ["hastelloy", "alloy c276", "hastelloy c276"],
    "Monel": ["monel", "alloy 400", "monel 400"],
    "Titanium": ["titanium", "ti", "grade 2 titanium"],
  },

  standard: {
    "API 600": ["api600", "api 600"],
    "API 602": ["api602", "api 602"],
    "API 603": ["api603", "api 603"],
    "API 6D": ["api6d", "api 6d"],
    "API 608": ["api608", "api 608"],
    "API 609": ["api609", "api 609"],
    "BS 1873": ["bs1873", "bs 1873"],
    "BS 5351": ["bs5351", "bs 5351"],
    "BS 5352": ["bs5352", "bs 5352"],
    "ASME B16.34": ["b16.34", "asme b16.34", "b1634"],
    "ISO 17292": ["iso17292", "iso 17292"],
  },

  end_type: {
    "RF": ["rf", "raised face", "raised face flanged", "flanged rf"],
    "RTJ": ["rtj", "ring type joint", "ring joint"],
    "FF": ["ff", "flat face", "flat face flanged"],
    "BW": ["bw", "butt weld", "butt welded", "buttweld"],
    "SW": ["sw", "socket weld", "socket welded"],
    "NPT": ["npt", "threaded", "screwed", "scrd"],
    "Wafer": ["wafer", "waf", "wafer type"],
    "Lug": ["lug", "lug type"],
  },

  trim: {
    "Full Bore": ["full bore", "fb", "full port", "fp"],
    "Reduced Bore": ["reduced bore", "rb", "reduced port", "rp"],
    "SS316": ["ss316 trim", "316 trim", "stainless trim"],
    "Stellite": ["stellite", "hardfaced", "hard faced", "stellited"],
    "13Cr": ["13cr trim", "13 cr", "13 chrome"],
  }
};

export function matchLayer1(rfqValue: string, catalogueEntries: string[], category: string): string | null {
  const rfqLower = rfqValue.toLowerCase().trim();
  const aliasCategory = ALIAS_MAP[category] || {};

  // Direct exact match first
  for (const entry of catalogueEntries) {
    if (entry.toLowerCase().trim() === rfqLower) return entry;
  }

  // Alias lookup — find canonical that rfqValue belongs to
  for (const [canonical, aliases] of Object.entries(aliasCategory)) {
    const rfqMatchesThisCanonical =
      canonical.toLowerCase() === rfqLower ||
      aliases.some(a => rfqLower === a || rfqLower.includes(a) || a.includes(rfqLower));

    if (rfqMatchesThisCanonical) {
      // Now find this canonical in user's catalogue entries
      const catalogueMatch = catalogueEntries.find(
        e => e.toLowerCase() === canonical.toLowerCase() ||
             aliases.includes(e.toLowerCase())
      );
      if (catalogueMatch) return catalogueMatch;
    }
  }
  return null;
}
