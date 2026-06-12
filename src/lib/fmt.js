export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// inline emphasis: *word* in the source markdown -> <em>
export const fmt = (s) => esc(s).replace(/\*([^*\n]{1,120}?)\*/g, '<em>$1</em>');
