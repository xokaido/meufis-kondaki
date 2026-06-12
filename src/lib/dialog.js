// Shared dialog behavior (Svelte action): Escape closes, Tab cycles within
// the dialog, initial focus moves inside, and focus returns to the trigger
// on close. Markup stays in each component; this only adds behavior.
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]';

function focusables(node) {
  return Array.from(node.querySelectorAll(FOCUSABLE)).filter(
    (el) => !el.disabled && el.tabIndex !== -1 && el.getClientRects().length
  );
}

export function dialog(node, { onClose, initialFocus = true } = {}) {
  const opener = document.activeElement;
  node.setAttribute('aria-modal', 'true');
  if (!node.hasAttribute('role')) node.setAttribute('role', 'dialog');

  if (initialFocus) {
    focusables(node)[0]?.focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose?.();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = focusables(node);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // capture: sheets live inside views that have their own key handling
  document.addEventListener('keydown', onKeydown, true);

  return {
    destroy() {
      document.removeEventListener('keydown', onKeydown, true);
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    },
  };
}
