#!/usr/bin/env python3
"""One-time conversion of the AcadNusx-style Latin-encoded Georgian file.

Mapping (confirmed against the text):
  lowercase a-z -> standard Georgian font layout
  C=ჩ E=ჱ H=ჵ J=ჟ R=ღ S=შ T=თ U=უ V=ჳ W=ჭ X=ჴ Z=ძ
  I=ჲ only inside words; standalone I/II/III are Roman numerals and stay.
Protected: [imageN]: link-definition lines and ![][imageN] tokens.
"""
import re
import shutil
import sys

SRC = 'მეუფის კონდაკი ნუსხურად პარაკლისი და ლოცვანი.md'
BAK = SRC + '.latin-original.bak'

LOWER = dict(zip('abcdefghijklmnopqrstuvwxyz',
                 'აბცდეფგჰიჯკლმნოპქრსტუვწხყზ'))
UPPER = {'C': 'ჩ', 'E': 'ჱ', 'H': 'ჵ', 'J': 'ჟ', 'R': 'ღ', 'S': 'შ',
         'T': 'თ', 'U': 'უ', 'V': 'ჳ', 'W': 'ჭ', 'X': 'ჴ', 'Z': 'ძ'}
TABLE = str.maketrans({**LOWER, **UPPER})

PROTECT = re.compile(r'!\[\]\[image\d+\]')


def convert_text(t):
    # I -> ჲ only when touching a (still-Latin) lowercase letter
    t = re.sub(r'(?<=[a-z])I|I(?=[a-z])', 'ჲ', t)
    return t.translate(TABLE)


def convert_line(line):
    if re.match(r'^\s*\[image\d+\]:', line):
        return line  # base64 image definition — keep verbatim
    parts, last = [], 0
    for m in PROTECT.finditer(line):
        parts.append(convert_text(line[last:m.start()]))
        parts.append(m.group(0))
        last = m.end()
    parts.append(convert_text(line[last:]))
    return ''.join(parts)


def main():
    raw = open(SRC, encoding='utf-8').read()
    shutil.copyfile(SRC, BAK)
    out = ''.join(convert_line(l) for l in raw.splitlines(keepends=True))
    open(SRC, 'w', encoding='utf-8').write(out)

    # validation: report any ASCII letters left outside protected regions
    leftovers = {}
    for line in out.splitlines():
        if re.match(r'^\s*\[image\d+\]:', line):
            continue
        clean = PROTECT.sub('', line)
        for m in re.finditer(r'[A-Za-z]+', clean):
            leftovers[m.group(0)] = leftovers.get(m.group(0), 0) + 1
    print('leftover latin tokens:', leftovers)
    print('georgian chars:', len(re.findall(r'[ა-ჰჱჲჳჴჵ]', out)))


if __name__ == '__main__':
    sys.exit(main())
