#!/usr/bin/env node
// Parses the three service markdown files into app/data.js for the reader app.
// Run: node build.js

const fs = require('fs');
const path = require('path');

const SOURCES = [
  { file: 'მეუფის კონდაკი მწუხრი.md', id: 'vespers', name: 'მწუხრი', subtitle: 'წესი და განგება მწუხრისა' },
  { file: 'მეუფის კონდაკი ცისკარი.md', id: 'matins', name: 'ცისკარი', subtitle: 'წესი და განგება ცისკრისა' },
  { file: 'მეუფის_კონდაკი_ნუსხურად_ლიტურგია_ოქროპირისა_ქართულად.md', id: 'liturgy', name: 'ლიტურგია', subtitle: 'წმიდისა იოანე ოქროპირისა' },
];

// Speaker label -> role. Longest-prefix match against the text before ":".
const ROLE_RULES = [
  [/^(I{1,3}|ა|ბ)?\s*დიაკონ/u, 'deacon'],
  [/^დიაკვნებ/u, 'deacon'],
  [/^გუნდი/u, 'choir'],
  [/^მგალობლები/u, 'choir'],
  [/^მედავითნე/u, 'choir'],
  [/^(მღვდელმთავარი|მღდელმთავარი)/u, 'bishop'],
  [/^(მღვდელი|მღდელი|წინამძღვარი|საიდუმლოდ მღვდელმან|სასულიერონი)/u, 'priest'],
  [/^მუხლი/u, 'verse'],
];

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
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// True if the whole paragraph is wrapped in ** ** (a bold prayer or heading).
function isFullyBold(p) {
  const t = p.replace(/\s+/g, ' ').trim();
  return /^\*\*.*\*\*$/.test(t) && !t.slice(2, -2).includes('**');
}

function stripBold(s) {
  return s.replace(/\*\*/g, '').trim();
}

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
};

function parseService(src) {
  const raw = fs.readFileSync(path.join(__dirname, src.file), 'utf-8');
  const lines = raw.split(/\r?\n/);

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
  let first = true;

  for (const para of paras) {
    const flat = cleanInline(para.replace(/\n/g, ' '));
    if (!flat) continue;

    if (first) { first = false; continue; } // title line; we use src.name/subtitle

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

    // Anything else -> rubric (instructions for movement/order).
    blocks.push({ t: 'rubric', text: plain });
  }

  // Table of contents: bold headings + curated landmarks, in block order.
  const toc = [{ text: 'დასაწყისი', i: 0 }];
  blocks.forEach((b, i) => { if (b.t === 'head') toc.push({ text: b.text, i }); });
  let from = 0;
  for (const [match, label] of LANDMARKS[src.id] || []) {
    const i = blocks.findIndex((b, idx) => idx >= from && ((b.text || '').includes(match) || (b.who || '').includes(match)));
    if (i === -1) { console.warn(`  !! landmark not found (${src.id}): ${match}`); continue; }
    toc.push({ text: label, i });
    from = i + 1;
  }
  toc.sort((a, b) => a.i - b.i);
  // Drop duplicate anchors pointing at the same block.
  const seen = new Set();
  const tocClean = toc.filter((t) => !seen.has(t.i) && seen.add(t.i));

  return { id: src.id, name: src.name, subtitle: src.subtitle, blocks, toc: tocClean };
}

const services = SOURCES.map(parseService);

const out = 'window.SERVICES = ' + JSON.stringify(services) + ';\n';
fs.mkdirSync(path.join(__dirname, 'app'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'app', 'data.js'), out);

// Build report
for (const s of services) {
  const counts = {};
  for (const b of s.blocks) counts[b.t] = (counts[b.t] || 0) + 1;
  console.log(`${s.id}: ${s.blocks.length} blocks`, counts, `toc=${s.toc.length}`);
}
