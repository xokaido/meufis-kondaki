#!/usr/bin/env node
// Parses the service markdown files into app/data.js for the reader app.
// Run: node build.js

const fs = require('fs');
const path = require('path');

// group 1: full services (one file each)
const SOURCES = [
  { file: 'მეუფის კონდაკი მწუხრი.md', id: 'vespers', name: 'მწუხრი', subtitle: 'წესი და განგება მწუხრისა' },
  { file: 'მეუფის კონდაკი ცისკარი.md', id: 'matins', name: 'ცისკარი', subtitle: 'წესი და განგება ცისკრისა' },
  { file: 'მეუფის_კონდაკი_ნუსხურად_ლიტურგია_ოქროპირისა_ქართულად.md', id: 'liturgy', name: 'ლიტურგია', subtitle: 'წმიდისა იოანე ოქროპირისა' },
];

// group 2: sections of the პარაკლისი და ლოცვანი file, split at exact title lines
const SECTIONED_FILE = 'მეუფის კონდაკი ნუსხურად პარაკლისი და ლოცვანი.md';
const SECTIONS = [
  { title: 'კმევები', id: 'kmevebi', name: 'კმევები', subtitle: 'კმევის წესი მსახურებებზე' },
  { title: 'მცირე პარაკლისი', id: 'paraklisi', name: 'მცირე პარაკლისი', subtitle: 'წესი მცირე პარაკლისისა', mode: 'hybrid' },
  { title: 'ლიტანიობა', id: 'litanioba', name: 'ლიტანიობა', subtitle: 'წესი ლიტანიობისა', mode: 'hybrid' },
  { title: 'ჯვართამაღლების ცისკარზე', id: 'jvari', name: 'ჯვართამაღლების ცისკარზე', subtitle: 'ჯვრის გამოსვენების განგება', mode: 'hybrid' },
  { title: 'ლოცვები ზიარების წინ', id: 'ziareba', name: 'ლოცვები ზიარების წინ', subtitle: 'და სამადლობელი ზიარების შემდგომად', mode: 'text' },
  { title: 'განსატევებელნი', id: 'gansatevebelni', name: 'განსატევებელნი', subtitle: 'სადღესასწაულო ჩამოლოცვები', mode: 'text' },
  { title: 'მცირე კურთხევანი', id: 'kurtxevani', name: 'მცირე კურთხევანი', subtitle: 'ლოცვები სხვადასხვა შემთხვევისათვის', mode: 'text', endTitle: 'ზანდუკი' },
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

// Ordered landmarks per service for the table of contents: first block whose
// text contains `match` (searching forward) becomes an anchor labeled `label`.
const LANDMARKS = {
  vespers: [
    ['მოვედით თაყვანისვცეთ', '103-ე ფსალმუნი'],
    ['მშვიდობით უფლისა მიმართ ვილოცოთ', 'დიდი კვერექსი'],
    ['უფალო ღაღადვყავი', 'უფალო ღაღადვყავი'],
    ['კურთხევა უფლისა თქვენ ზედა', 'კურთხევა და დასასრული'],
  ],
  matins: [
    ['ექვსფსალმუნ', 'ექვსფსალმუნი'],
    ['ღმერთი უფალი და გამოგვიჩნდა', 'ღმერთი უფალი'],
    ['აქებდით სახელსა', 'პოლიელეი'],
    ['ყოველი სული აქებდით უფალსა', 'სახარების წინ'],
    ['სიბრძნით აღემართენით და ისმინეთ', 'სახარება'],
    ['აქებდითის დიდების მუხლზე', 'აქებდითსა'],
    ['დიდება მაღალიანი', 'დიდება მაღალიანი'],
  ],
  liturgy: [
    ['პირველი ანტიფონის საიდუმლო ლოცვა', 'ანტიფონები'],
    ['აკურთხებს შესავალს', 'მცირე შესვლა'],
    ['ჟამი სამწმიდაოსი', 'სამწმიდაო'],
    ['წარდგომა, ფსალმუნი', 'სამოციქულო'],
    ['ლოცვა სახარების კითხვის წინ', 'სახარება'],
    ['რომელნი ქერუბიმთა', 'ქერუბიკონი'],
    ['მრწამს', 'მრწამსი'],
    ['ღირს არს და მართალ', 'ევქარისტიული კანონი'],
    ['მამაო ჩუჱნო', 'მამაო ჩუენო'],
    ['იწყება მრევლის ზიარება', 'მრევლის ზიარება'],
    ['ისპოლა ეტი დესპოტა', 'დასასრული'],
  ],
  ziareba: [
    ['ესრეთ ლოცვა სამადლობელი', 'ლოცვა სამადლობელი'],
  ],
};

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
function parseLines(lines, id, skipTitle, mode) {
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
  for (const [match, label] of LANDMARKS[id] || []) {
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

function readLines(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf-8').split(/\r?\n/);
}

const services = [];

for (const src of SOURCES) {
  const { blocks, toc } = parseLines(readLines(src.file), src.id, true);
  services.push({ id: src.id, name: src.name, subtitle: src.subtitle, group: 0, blocks, toc });
}

// Split the sectioned file at its exact title lines.
{
  const lines = readLines(SECTIONED_FILE);
  const starts = SECTIONS.map((s) => {
    const i = lines.findIndex((l) => l.trim() === s.title);
    if (i === -1) throw new Error(`section title not found: ${s.title}`);
    return i;
  });
  for (let k = 1; k < starts.length; k++) {
    if (starts[k] <= starts[k - 1]) throw new Error('section titles out of order');
  }
  SECTIONS.forEach((s, k) => {
    let end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    if (s.endTitle) {
      const e = lines.findIndex((l, i) => i > starts[k] && l.trim() === s.endTitle);
      if (e !== -1 && e < end) end = e;
    }
    const chunk = lines.slice(starts[k] + 1, end);
    const { blocks, toc } = parseLines(chunk, s.id, false, s.mode);
    services.push({ id: s.id, name: s.name, subtitle: s.subtitle, group: 1, blocks, toc });
  });
}

// ── output: per-service JSON + lightweight index ──
const appDir = path.join(__dirname, 'app');
const dataDir = path.join(appDir, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const index = services.map((s) => ({
  id: s.id, name: s.name, subtitle: s.subtitle, group: s.group, blockCount: s.blocks.length,
}));
fs.writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify(index));
for (const s of services) {
  fs.writeFileSync(path.join(dataDir, s.id + '.json'), JSON.stringify({ blocks: s.blocks, toc: s.toc }));
}

// ── service worker: inject content version + complete precache list ──
function walk(dir, base) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out.push(...walk(p, base + name + '/'));
    else if (name !== 'sw.js' && name !== '.DS_Store') out.push(base + name);
  }
  return out;
}
const assets = walk(appDir, '');
const crypto = require('crypto');
const hash = crypto.createHash('sha1');
for (const a of assets.sort()) hash.update(fs.readFileSync(path.join(appDir, a)));
const version = hash.digest('hex').slice(0, 12);

const swTemplate = fs.readFileSync(path.join(__dirname, 'sw.template.js'), 'utf-8');
fs.writeFileSync(path.join(appDir, 'sw.js'),
  swTemplate.replace('__VERSION__', version).replace('__ASSETS__', JSON.stringify(['./', ...assets])));

// Build report
for (const s of services) {
  const counts = {};
  for (const b of s.blocks) counts[b.t] = (counts[b.t] || 0) + 1;
  console.log(`${s.id}: ${s.blocks.length} blocks`, counts, `toc=${s.toc.length}`);
}
console.log(`version ${version}, ${assets.length} precached assets`);
