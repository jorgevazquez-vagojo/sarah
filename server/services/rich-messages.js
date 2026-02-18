/**
 * Rich Message Builder
 * Creates structured content types for the widget to render
 */

function card({ title, subtitle, imageUrl, buttons = [] }) {
  return {
    type: 'card',
    title,
    subtitle,
    imageUrl,
    buttons: buttons.map(normalizeButton),
  };
}

function carousel(cards) {
  return {
    type: 'carousel',
    cards: cards.map((c) => card(c)),
  };
}

function quickReplies(text, replies) {
  return {
    type: 'quick_replies',
    text,
    replies: replies.map((r) =>
      typeof r === 'string' ? { label: r, value: r } : r
    ),
  };
}

function form({ title, fields, submitLabel = 'Submit' }) {
  return { type: 'form', title, fields, submitLabel };
}

function image({ url, caption }) {
  return { type: 'image', url, caption };
}

function file({ url, name, mimeType, size }) {
  return { type: 'file', url, name, mimeType, size };
}

function buttons(text, btns) {
  return {
    type: 'buttons',
    text,
    buttons: btns.map(normalizeButton),
  };
}

function normalizeButton(btn) {
  if (typeof btn === 'string') return { label: btn, action: 'postback', value: btn };
  return {
    label: btn.label,
    action: btn.action || 'postback', // postback | url | call | escalate
    value: btn.value || btn.url || btn.label,
  };
}

module.exports = { card, carousel, quickReplies, form, image, file, buttons };
