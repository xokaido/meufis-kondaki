<script>
  import { fmt } from '../lib/fmt.js';
  import { ROLE_ICONS } from '../lib/roles.js';

  // mine/cue wired in Phase 5; dropcap in Phase 6 — props exist from day one
  let { block, i, mine = false, cue = false, dropcap = false } = $props();
</script>

{#if block.t === 'say'}
  <div class="blk say role-{block.role}" class:mine class:cue class:dropcap data-i={i}>
    <span class="who">{@html ROLE_ICONS[block.role] || ''}<span>{block.who}</span>{#if mine}<i class="you">შენ</i>{/if}</span>
    <p>{@html fmt(block.text)}</p>
    {#if cue}<span class="cue-mark" title="შემდეგი — შენი სტრიქონი">●</span>{/if}
  </div>
{:else if block.t === 'rubric'}
  <div class="blk rubric" class:cue data-i={i}>{@html fmt(block.text)}{#if cue}<span class="cue-mark">●</span>{/if}</div>
{:else if block.t === 'text'}
  <div class="blk text" class:cue class:dropcap data-i={i}>{@html fmt(block.text)}{#if cue}<span class="cue-mark">●</span>{/if}</div>
{:else if block.t === 'prayer'}
  <div class="blk prayer" class:cue class:dropcap data-i={i}>{@html fmt(block.text)}{#if cue}<span class="cue-mark">●</span>{/if}</div>
{:else if block.t === 'head'}
  <h2 class="head" data-i={i}>{block.text}</h2>
{:else if block.t === 'sep'}
  <div class="sep" data-i={i} aria-hidden="true">⁘</div>
{/if}

<style>
  /* --khu-fs (set by Reader in khucuri mode, default 1) bumps the Nuskhuri
     body text up slightly; Asomtavruli headings deliberately omit it. */
  .blk { position: relative; margin-bottom: calc(15px * var(--fs)); font-size: calc(16.5px * var(--fs) * var(--khu-fs, 1)); }
  .say .who { display: flex; align-items: center; gap: 6px; font-size: calc(11.5px * var(--fs) * var(--khu-fs, 1)); letter-spacing: .12em; text-transform: uppercase; font-weight: 700; margin-bottom: 3px; }
  .say .who :global(svg) { width: calc(15px * var(--fs)); height: calc(15px * var(--fs)); flex-shrink: 0; }
  .role-bishop .who { color: var(--c-bishop); }
  .role-priest .who { color: var(--c-priest); }
  .role-deacon .who { color: var(--c-deacon); }
  .role-choir .who { color: var(--c-choir); }
  .role-reader .who { color: var(--c-reader); }
  .rubric { color: var(--accent); opacity: .88; font-style: italic; font-size: calc(14px * var(--fs) * var(--khu-fs, 1)); }
  .prayer { font-weight: 600; }
  .head { color: var(--accent); font-size: calc(15px * var(--fs)); letter-spacing: .06em; margin: calc(26px * var(--fs)) 0 calc(12px * var(--fs)); text-align: center; }
  .sep { text-align: center; color: var(--muted); margin: 18px 0; }
  .you { font-style: normal; font-size: 10px; background: var(--accent); color: var(--bg); border-radius: 6px; padding: 1px 6px; margin-left: 2px; }
  .mine { background: var(--accent-soft); box-shadow: inset 3px 0 0 var(--accent); border-radius: 8px; padding: 9px 11px; margin-left: -11px; margin-right: -11px; }
  .cue-mark { position: absolute; right: -2px; bottom: 2px; color: var(--accent); font-size: 9px; opacity: .8; }
  .dropcap > :global(p)::first-letter, .text.dropcap::first-letter, .prayer.dropcap::first-letter {
    float: left; font-size: 3.1em; line-height: .82; color: var(--accent); padding: .04em .08em 0 0; font-weight: 600;
  }
  /* Book (paginated) mode: keep a block whole within one page — a speaker
     label stranded from its line, or a split short prayer, reads badly. The
     heading should not be the last thing on a page either. Set on .view by
     the Reader; these elements are rendered here, hence the :global scope. */
  :global(.view.book) .blk,
  :global(.view.book) .head { break-inside: avoid; }
  :global(.view.book) .head { break-after: avoid; }

  /* Sentence initials (.si spans injected by fmt) render in Asomtavruli in
     khucuri mode only — the manuscript convention of capital initials over
     a Nuskhuri body. In mkhedruli mode they inherit the normal font. */
  :global(.view.khucuri) .blk :global(.si) {
    font-family: 'Khutsuri Asomtavruli', 'Noto Serif Georgian', Georgia, serif;
  }
  /* khucuri mode (class set by Reader on .view): headings and drop-cap
     initials take Asomtavruli over the Nuskhuri body — the traditional
     manuscript pairing. Speaker labels convert with everything else. */
  :global(.view.khucuri) .head,
  :global(.view.khucuri) .dropcap > :global(p)::first-letter,
  :global(.view.khucuri) .text.dropcap::first-letter,
  :global(.view.khucuri) .prayer.dropcap::first-letter {
    font-family: 'Khutsuri Asomtavruli', 'Noto Serif Georgian', Georgia, serif;
  }
</style>
