#!/usr/bin/env python3
"""Remap the legacy DKR Khutsuri fonts to Unicode Georgian.

dkr-hu1.ttf (Nuskhuri) and dkr-mt1.ttf (Asomtavruli) store Georgian glyphs
at Latin codepoints using the old AcadNusx-style keyboard layout. This script
moves every letter to its Unicode Georgian codepoints so the fonts render
plain mkhedruli-encoded text:

  - Mkhedruli  U+10D0..10F5  (both fonts — apply the font to normal text)
  - Nuskhuri   U+2D00..2D25  (hu1 only, script-correct block)
  - Asomtavruli U+10A0..10C5 (mt1 only, script-correct block)

Digits, punctuation and ornament glyphs keep their original positions.
Latin letter mappings are removed, with one exception: in hu1 the decorated
"un with tick" variant stays at U+0055 'U' (it has no Unicode codepoint).

Usage: python3 georgianize-fonts.py  (run from repo root; needs fonttools+brotli)
"""

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable

# Legacy Latin slot -> mkhedruli codepoint (AcadNusx convention, verified
# glyph-by-glyph against rendered contact sheets of both fonts).
LEGACY = {
    "a": 0x10D0, "b": 0x10D1, "g": 0x10D2, "d": 0x10D3, "e": 0x10D4,
    "v": 0x10D5, "z": 0x10D6, "T": 0x10D7, "i": 0x10D8, "k": 0x10D9,
    "l": 0x10DA, "m": 0x10DB, "n": 0x10DC, "o": 0x10DD, "p": 0x10DE,
    "J": 0x10DF, "r": 0x10E0, "s": 0x10E1, "t": 0x10E2, "u": 0x10E3,
    "f": 0x10E4, "q": 0x10E5, "R": 0x10E6, "y": 0x10E7, "S": 0x10E8,
    "C": 0x10E9, "c": 0x10EA, "Z": 0x10EB, "w": 0x10EC, "W": 0x10ED,
    "x": 0x10EE, "j": 0x10EF, "h": 0x10F0,
    # archaic letters
    "E": 0x10F1,  # ჱ he
    "I": 0x10F2,  # ჲ hie
    "V": 0x10F3,  # ჳ vie
    "X": 0x10F4,  # ჴ har
    "H": 0x10F5,  # ჵ hoe
}

ASOMTAVRULI_OFFSET = -0x30   # U+10D0 -> U+10A0
NUSKHURI_OFFSET = 0x1C30     # U+10D0 -> U+2D00

JOBS = [
    {
        "src": "dkr-hu1.ttf",
        "out": "dkr-hu1-xok",
        "family": "DKR Hu1 Xok",
        "ps": "DKRHu1Xok",
        "block_offset": NUSKHURI_OFFSET,
        # ⴓ-with-tick variant glyph kept reachable at Latin 'U'
        "keep_latin": {0x0055},
    },
    {
        "src": "dkr-mt1.ttf",
        "out": "dkr-mt1-xok",
        "family": "DKR Mt1 Xok",
        "ps": "DKRMt1Xok",
        "block_offset": ASOMTAVRULI_OFFSET,
        "keep_latin": set(),
    },
]


def convert(job):
    font = TTFont(job["src"])
    old = font.getBestCmap()
    new = {}

    for cp, gname in old.items():
        ch = chr(cp)
        if ch.isascii() and ch.isalpha():
            if cp in job["keep_latin"]:
                new[cp] = gname
            continue  # Latin letter slots are dropped
        new[cp] = gname  # digits, punctuation, ornaments stay put

    for ch, mkh in LEGACY.items():
        gname = old.get(ord(ch))
        if gname is None:
            continue
        new[mkh] = gname
        new[mkh + job["block_offset"]] = gname

    if job["src"] == "dkr-mt1.ttf":
        # mt1 has both უ forms: 'U' is the traditional ႭჃ digraph (used for
        # mkhedruli უ), 'u' is the rare single letter Ⴓ (script block only).
        new[0x10E3] = old[ord("U")]
        new[0x10B3] = old[ord("u")]

    sub = CmapSubtable.getSubtableClass(4)(4)
    sub.platEncID, sub.platformID, sub.format, sub.language = 1, 3, 4, 0
    sub.cmap = new
    font["cmap"].tableVersion = 0
    font["cmap"].tables = [sub]

    # OS/2: declare Georgian coverage (bit 26 covers U+10A0-10FF, U+2D00-2D2F)
    os2 = font["OS/2"]
    os2.ulUnicodeRange1 |= 1 << 26

    name = font["name"]
    for nid, val in {
        1: job["family"],
        3: f"{job['ps']};remapped to Unicode Georgian",
        4: job["family"],
        6: job["ps"],
    }.items():
        name.setName(val, nid, 3, 1, 0x409)
        name.setName(val, nid, 1, 0, 0)

    font.save(job["out"] + ".ttf")
    font.flavor = "woff2"
    font.save(job["out"] + ".woff2")
    print(f"{job['src']} -> {job['out']}.ttf / .woff2  ({len(new)} cmap entries)")


if __name__ == "__main__":
    for job in JOBS:
        convert(job)
