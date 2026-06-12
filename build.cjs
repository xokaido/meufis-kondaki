#!/usr/bin/env node
// Parses texts/*.md (markdown with frontmatter) into public/data/*.json.
// Run: node build.cjs
//
// To add a text: drop texts/<order>-<id>.md with a frontmatter header — see
// texts/README.md for the format. No changes here are needed.

const fs = require('fs');
const path = require('path');

const TEXTS_DIR = path.join(__dirname, 'texts');

const CATEGORIES = [
  { id: 'services', name: 'მსახურებანი' },
  { id: 'rites', name: 'განგებანი' },
  { id: 'prayers', name: 'ლოცვანი' },
  { id: 'propers', name: 'დღესასწაულნი', soon: true },
  { id: 'scores', name: 'საგალობლები', soon: true },
];

// Speaker label -> role. Longest-prefix match against the text before ":".
const ROLE_RULES = [
  [/^(I{1,3}|ა|ბ)?\s*დიაკონ/u, 'deacon'],
  [/^დიაკვნებ/u, 'deacon'],
  [/^გუნდი/u, 'choir'],
  [/^მგალობლები/u, 'choir'],
  [/^(მედავითნე|მკითხველ)/u, 'reader'],
  [/^(მღვდელმთავარი|მღდელმთავარი)/u, 'bishop'],
  [/^(მღვდელი|მღდელი|მღვდელმან|მღდელმან|წინამძღვარი|საიდუმლოდ მღვდელმან|სასულიერონი)/u, 'priest'],
  [/^მუხლი/u, 'reader'],
];

// Frontmatter: '---' fenced key: value lines at the top of each text file.
// Repeated `landmark:` lines accumulate as [match, label] pairs (split on '|').
// Returns { meta, body } where body is the markdown after the closing fence.
const FRONTMATTER_KEYS = ['id', 'name', 'subtitle', 'category', 'mode', 'skipTitle', 'landmark'];

function parseFrontmatter(raw, file = '?') {
  const lines = raw.split(/\r?\n/);
  if (lines[0].trim() !== '---') throw new Error(`${file}: missing frontmatter`);
  const meta = { landmarks: [] };
  let i = 1;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') break;
    if (line.trim() === '') continue;
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) throw new Error(`${file}: bad frontmatter line: ${line}`);
    const [, key, value] = m;
    if (!FRONTMATTER_KEYS.includes(key)) {
      throw new Error(`${file}: unknown frontmatter key "${key}" (allowed: ${FRONTMATTER_KEYS.join(', ')})`);
    }
    if (key === 'landmark') {
      const [match, label] = value.split('|').map((s) => s.trim());
      if (!match || !label) throw new Error(`${file}: landmark needs "match | label"`);
      meta.landmarks.push([match, label]);
    } else if (key === 'skipTitle') {
      meta.skipTitle = value === 'true';
    } else {
      meta[key] = value;
    }
  }
  if (i === lines.length) throw new Error(`${file}: unterminated frontmatter`);
  for (const req of ['id', 'name', 'subtitle', 'category']) {
    if (!meta[req]) throw new Error(`${file}: frontmatter missing "${req}"`);
  }
  if (meta.mode && !['hybrid', 'text'].includes(meta.mode)) {
    throw new Error(`${file}: mode must be "hybrid" or "text", got "${meta.mode}"`);
  }
  return { meta, bodyLines: lines.slice(i + 1) };
}

// All texts, in filename order (the numeric prefix defines library order).
function loadTexts() {
  return fs.readdirSync(TEXTS_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((f) => {
      const { meta, bodyLines } = parseFrontmatter(
        fs.readFileSync(path.join(TEXTS_DIR, f), 'utf-8'), f);
      // filename is <order>-<id>.md: the suffix must equal the frontmatter id
      // so URLs stay predictable from the file listing
      const suffix = f.replace(/^\d+-/, '').replace(/\.md$/, '');
      if (suffix !== meta.id) {
        throw new Error(`${f}: filename id "${suffix}" ≠ frontmatter id "${meta.id}"`);
      }
      return { ...meta, file: f, bodyLines };
    });
}

function roleFor(label) {
  for (const [re, role] of ROLE_RULES) if (re.test(label)) return role;
  return null;
}

function unescapeMd(s) {
  return s.replace(/\\([\\!.()\[\]*_#+-])/g, '$1');
}

function cleanInline(s) {
  return unescapeMd(s)
    .replace(/!\[\]\[image\d+\]/g, '') // image refs
    .replace(/\[image\d+\]:.*$/g, '')
    // "6" is a decorative ornament in the source font when glued to letters
    .replace(/(^|\s)6(?=[ა-ჰჱჲჳჴჵ])/g, '$1')
    .replace(/([ა-ჰჱჲჳჴჵ])6(?=\s|$)/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// True if the whole paragraph is bold (a prayer or heading). Multi-line
// paragraphs count when every line is individually wrapped in ** **.
function isFullyBold(p) {
  const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 && lines.every(
    (l) => /^\*\*.*\*\*$/.test(l) && !l.slice(2, -2).includes('**')
  );
}

function stripBold(s) {
  return s.replace(/\*\*/g, '').trim();
}

// Parse an array of source lines into blocks + toc.
// skipTitle: drop the first paragraph (a standalone title line).
// mode 'text': plain paragraphs are body text, not rubrics, and short
// unpunctuated plain lines are treated as headings (prayer/feast titles).
function parseLines(lines, id, skipTitle, mode, landmarks = []) {
  // Group into paragraphs: consecutive non-blank lines belong together,
  // except a short fully-bold line (section heading) always stands alone.
  const isHeadingLine = (l) => /^\*\*[^*]{1,60}\*\*\s*$/.test(l.trim());
  const paras = [];
  let cur = [];
  const flush = () => { if (cur.length) { paras.push(cur.join('\n')); cur = []; } };
  for (const line of lines) {
    if (line.trim() === '') {
      flush();
    } else if (isHeadingLine(line)) {
      flush();
      paras.push(line.trim());
    } else {
      cur.push(line);
    }
  }
  flush();

  const blocks = [];
  let first = skipTitle;

  for (const para of paras) {
    const flat = cleanInline(para.replace(/\n/g, ' '));
    if (!flat) continue;

    if (first) { first = false; continue; } // title line; service name is used

    // Link definitions like "[image1]: <data:...>"
    if (/^\[image\d+\]:/.test(para.trim())) continue;

    const plain = stripBold(flat);

    // Speaker line? e.g. "გუნდი: ..." possibly bold, possibly with parenthetical.
    const m = plain.match(/^([^:]{1,60}):\s*(.*)$/su);
    if (m) {
      const label = m[1].trim();
      const role = roleFor(label);
      if (role) {
        blocks.push({ t: 'say', role, who: label, text: m[2].trim() });
        continue;
      }
    }

    // Verse with a period instead of a colon: "მუხლი ა. text..."
    const mv = plain.match(/^(მუხლი [ა-ჰჱჲჳჴჵ]{1,3})\.\s+(.*)$/su);
    if (mv) {
      blocks.push({ t: 'say', role: 'reader', who: mv[1], text: mv[2].trim() });
      continue;
    }

    // Separator lines (just asterisks/dashes/punctuation).
    if (/^[\s*\-_.·~]+$/.test(plain)) {
      blocks.push({ t: 'sep' });
      continue;
    }

    // Short fully-bold line without much text -> section heading.
    if (isFullyBold(para) && plain.length <= 45 && !plain.includes(':')) {
      blocks.push({ t: 'head', text: plain });
      continue;
    }

    // Fully-bold long paragraph -> prayer text (read silently/aloud by clergy).
    if (isFullyBold(para)) {
      blocks.push({ t: 'prayer', text: plain });
      continue;
    }

    if (mode === 'text' || mode === 'hybrid') {
      // Psalm titles: "ფსალმუნი ნ" / "რმბ ფსალმუნი."
      if (/^(ფსალმუნი [ა-ჰჱჲჳჴჵ]{1,4}\.?|[ა-ჰჱჲჳჴჵ]{1,4} ფსალმუნი\.?)$/u.test(plain)) {
        blocks.push({ t: 'head', text: plain.replace(/\.$/, '') });
        continue;
      }
      // In hybrid sections rubrics need strong signals: a clergy actor at the
      // start, a parenthetical aside, or a word-anchored action verb.
      // Checked before the title heuristic so short rubrics don't become
      // headings. Everything unsignalled is body text — safer than hiding
      // a psalm as a rubric.
      const ACTOR = /^(მღვდელმთავარი|მღდელმთავარი|ეპისკოპოსი|დიაკონი|დიაკვნები|I{1,3} დიაკონი|წინამძღვარი|მღვდელი|მღვდლები|სტიქაროსანი|სტიქაროსნები)[\s,]/u;
      const ACTION = /(^|\s)(აკმევს|უკმევს|იკმევა|აკმევენ|შემოუკმევენ|ასხურებს|სახავს|გამოსახავს|კითხულობს|მიაწოდებს|გამოართმევს|დაირეკება|ემთხვევა|დადგება|დგანან|დგებიან|ადის|ჩადის|მიდის|მივა|გადის|გამოდის|შემოდის|შევლენ|შედის|შევა|წავა|წავლენ|დაბრუნდება|მობრძანდება|შემობრძანდება|გამობრძანდება|მოაბრძანებს|დააბრძანებს|შეაბრძანებს|აღესრულება|სრულდება|ხდება|ვუვლით|შევდივართ|ჩავდივართ|შევჩერდებით|იცდიან|ელოდებიან)(\s|[,.;)]|$)/u;
      if (mode === 'hybrid' && (plain.startsWith('(') || ACTOR.test(plain) || ACTION.test(plain))) {
        blocks.push({ t: 'rubric', text: plain });
        continue;
      }
      // Short title line: no terminal punctuation, doesn't read as an
      // instruction ("...ითქმის"), doesn't start with a parenthesis.
      if (plain.length <= 45 && !/[.!?:;,]$/.test(plain) && !plain.startsWith('(') && !/ითქმის$/.test(plain)) {
        blocks.push({ t: 'head', text: plain });
      } else {
        blocks.push({ t: 'text', text: plain });
      }
      continue;
    }

    // Anything else -> rubric (instructions for movement/order).
    blocks.push({ t: 'rubric', text: plain });
  }

  // Table of contents: bold headings + curated landmarks, in block order.
  // No synthetic "დასაწყისი" anchor when the content already opens with one.
  const toc = blocks[0] && blocks[0].t === 'head' ? [] : [{ text: 'დასაწყისი', i: 0 }];
  blocks.forEach((b, i) => { if (b.t === 'head') toc.push({ text: b.text, i }); });
  let from = 0;
  for (const [match, label] of landmarks) {
    const i = blocks.findIndex((b, idx) => idx >= from && ((b.text || '').includes(match) || (b.who || '').includes(match)));
    if (i === -1) { console.warn(`  !! landmark not found (${id}): ${match}`); continue; }
    toc.push({ text: label, i });
    from = i + 1;
  }
  toc.sort((a, b) => a.i - b.i);
  // Drop duplicate anchors pointing at the same block.
  const seen = new Set();
  const tocClean = toc.filter((t) => !seen.has(t.i) && seen.add(t.i));

  return { blocks, toc: tocClean };
}

// Search index: per text, [blockIndex, owningSectionTitle, plainText]
// for every block that has text. Emphasis markers stripped.
function searchEntries(svc) {
  const sectionFor = (i) => {
    // "latest toc anchor ≤ i" — same walk as Reader.svelte's `section`
    // derived; keep the two in sync if the anchoring rule ever changes.
    // parseLines always emits a toc anchor at i=0, so toc[0] covers any
    // blocks before the first explicit anchor; default to it defensively.
    let cur = svc.toc[0]?.text || '';
    for (const t of svc.toc) { if (t.i <= i) cur = t.text; else break; }
    return cur;
  };
  const entries = [];
  svc.blocks.forEach((b, i) => {
    const text = ((b.who ? b.who + ': ' : '') + (b.text || '')).replace(/\*/g, '').trim();
    if (text) entries.push([i, sectionFor(i), text]);
  });
  return entries;
}

function main() {
  const texts = loadTexts();
  const ids = new Set();
  for (const t of texts) {
    if (ids.has(t.id)) throw new Error(`duplicate text id: ${t.id}`);
    ids.add(t.id);
    if (!CATEGORIES.some((c) => c.id === t.category && !c.soon)) {
      throw new Error(`${t.file}: unknown or not-yet-open category "${t.category}"`);
    }
  }

  const services = texts.map((t) => {
    const { blocks, toc } = parseLines(t.bodyLines, t.id, !!t.skipTitle, t.mode, t.landmarks);
    return { ...t, blocks, toc };
  });

  const dataDir = path.join(__dirname, 'public', 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const index = {
    categories: CATEGORIES,
    texts: services.map((s) => ({
      id: s.id, name: s.name, subtitle: s.subtitle, category: s.category, blockCount: s.blocks.length,
    })),
  };
  fs.writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify(index));
  for (const s of services) {
    fs.writeFileSync(path.join(dataDir, s.id + '.json'), JSON.stringify({ blocks: s.blocks, toc: s.toc }));
  }
  fs.writeFileSync(path.join(dataDir, 'search-index.json'),
    JSON.stringify(services.map((s) => ({ id: s.id, name: s.name, entries: searchEntries(s) }))));

  for (const s of services) {
    const counts = {};
    for (const b of s.blocks) counts[b.t] = (counts[b.t] || 0) + 1;
    console.log(`${s.id}: ${s.blocks.length} blocks`, counts, `toc=${s.toc.length}`);
  }
}

module.exports = { parseLines, roleFor, searchEntries, parseFrontmatter, loadTexts, CATEGORIES };
if (require.main === module) main();
