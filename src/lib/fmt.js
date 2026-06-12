export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Sentence-initial Georgian letters get a .si span so khucuri mode can
// render them as Asomtavruli capitals (the manuscript convention; styling is
// scoped in Block.svelte — in mkhedruli mode the spans are inert). A sentence
// starts at the beginning of the block or after ./!/?/… + space, optionally
// behind an opening quote or our <em> tag.
const SENTENCE_INITIAL = /(^|[.!?…]\s+)((?:<em>)?[„«"]?)([ა-ჵ])/g;

// inline emphasis: *word* in the source markdown -> <em>; then mark initials
export const fmt = (s) =>
  esc(s)
    .replace(/\*([^*\n]{1,120}?)\*/g, '<em>$1</em>')
    .replace(SENTENCE_INITIAL, '$1$2<span class="si">$3</span>');
