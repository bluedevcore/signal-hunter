// Pull the "what you'll be doing" and "what we're looking for" sections out of a job ad's HTML.

const START = /^(what you('|’)ll (be )?do(ing)?|what you will (be )?do(ing)?|key (duties|responsibilities|tasks|accountabilities)( and (duties|responsibilities))?|main (duties|responsibilities)|(your |the )?(duties|responsibilities)( will)?( include)?|role responsibilities|day[- ]to[- ]day( responsibilities)?|the role( involves| includes)?|what the role involves|in this role,? you will|you will be responsible for|responsibilities (include|will include))\s*:?$/i;
const REQ = /^(what (we('|’)re|we are) looking for|about you|who you are|requirements|(key )?skills( and experience)?|experience( required)?|essential( criteria| skills)?|desirable|you('|’)ll (need|have|bring)|the ideal candidate|person specification|qualifications|to be considered)\s*:?$/i;
const STOP = /^(benefits|what we offer|what('|’)s in it|in return|why join|perks|package|salary|hours|about us|about the company|how to apply|working hours|location)\b/i;
const BENEFIT = /pension|holiday|annual leave|bonus|discount|parking|cycle to work|gym|healthcare|life assurance|wellbeing|perks/i;

export function htmlToBlocks(html: string): { text: string; heading: boolean }[] {
  const s = html
    .replace(/\r/g, "")
    .replace(/<\s*(br)\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<\s*\/(p|div|li|ul|ol|h[1-6])\s*>/gi, "\n")
    .replace(/<\s*(strong|b|h[1-6])[^>]*>/gi, "\n§")
    .replace(/<\s*\/(strong|b)\s*>/gi, "§\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "’").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const heading = l.startsWith("§") || (!l.startsWith("•") && l.length < 70 && /:$/.test(l));
      return { text: l.replace(/§/g, "").replace(/^•\s*/, "").trim(), heading };
    })
    .filter((b) => b.text);
}

function section(blocks: { text: string; heading: boolean }[], start: RegExp) {
  const out: string[] = [];
  let on = false;
  for (const b of blocks) {
    const t = b.text.replace(/\s+/g, " ");
    const short = t.length < 90;
    if (short && start.test(t)) { on = true; continue; }
    if (on && short && (STOP.test(t) || (start !== REQ && REQ.test(t)) || (start === REQ && START.test(t)))) {
      if (out.length) break;
      on = false;
      continue;
    }
    if (on && t.length > 15 && t.length < 400 && !BENEFIT.test(t)) out.push(t);
  }
  return out.slice(0, 20);
}

export function parseSections(html: string) {
  const blocks = htmlToBlocks(html);
  const responsibilities = section(blocks, START);
  const requirements = section(blocks, REQ);
  const text = blocks.map((b) => b.text).join("\n");
  return { responsibilities: responsibilities.length >= 3 ? responsibilities : [], requirements, text };
}
