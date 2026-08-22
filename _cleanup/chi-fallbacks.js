/* CHI — Shared "no data recorded" fallbacks
 *
 * Every field the Herbadex profile schema defines has a professional message
 * for when the record carries no reliable information. Sections are never
 * silently dropped: an absent field is itself meaningful information, and the
 * reader is told plainly that nothing has been recorded rather than being left
 * to wonder whether the section failed to load.
 *
 * Usage:
 *   CHI_FALLBACK.text(profile.modernUse, 'modernUse')   -> string to render
 *   CHI_FALLBACK.has(profile.compounds)                 -> boolean
 *   CHI_FALLBACK.note('dosage')                         -> styled placeholder HTML
 */
(function (global) {
  'use strict';

  if (global.CHI_FALLBACK) return; // guard against double-inclusion

  // Field-specific messages. Kept factual and unembellished — these appear in a
  // health context, so they state the absence of a record without implying the
  // herb is unsafe, untested, or without merit.
  var MESSAGES = {
    latin:             'Botanical name not yet recorded for this entry.',
    category:          'No primary action category has been assigned yet.',
    summary:           'No overview has been recorded for this herb yet.',
    functionalOverview:'No functional summary has been recorded for this herb yet.',
    source:            'No citable reference has been recorded for this entry.',
    origin:            'Region of origin has not been documented for this entry.',
    tradition:         'No healing tradition has been documented for this herb yet.',
    spiritualHistory:  'No spiritual or cultural history has been documented for this herb yet.',
    timeline:          'No dated record of traditional use has been compiled yet.',
    modernUse:         'No modern research or clinical use has been recorded for this herb yet.',
    compounds:         'No constituent compounds have been documented for this herb yet.',
    mechanism:         'Mechanism of action has not been documented for this compound.',
    evidence:          'No supporting evidence has been recorded for this compound.',
    herbalActions:     'No herbal actions have been documented for this herb yet.',
    bodyEffects:       'No body system effects have been documented for this herb yet.',
    preparation:       'No preparation methods have been documented for this herb yet.',
    dosage:            'No information recorded so far.',
    rareFact:          'No additional historical note has been recorded for this herb yet.',
    interactions:      'No interactions have been documented for this herb. This is not a confirmation of safety — consult a qualified practitioner, particularly if you take prescription medication.',
    safetyLevel:       'No safety assessment has been recorded for this herb yet. Consult a qualified practitioner before use.',
    preparations:      'No preparation formats have been documented for this herb yet.',
    forumSeed:         'No community reports have been shared for this herb yet.',
    botanicalDescription: 'No physical description has been recorded for this herb yet.',
    generic:           'This information has not been recorded for this herb yet.'
  };

  // A value counts as present only if it carries actual content — empty strings,
  // empty arrays and empty objects are all treated as missing.
  function has(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).some(function (k) { return has(v[k]); });
    return true;
  }

  function message(field) {
    return MESSAGES[field] || MESSAGES.generic;
  }

  // Returns the value when present, otherwise the field's fallback message.
  function text(value, field) {
    return has(value) ? value : message(field);
  }

  // Styled placeholder for use inside a section body.
  function note(field) {
    return '<p class="chi-nodata">' + message(field) + '</p>';
  }

  // Renders `builder(value)` when data exists, otherwise the placeholder — so a
  // section header always has a body under it.
  function section(value, field, builder) {
    return has(value) ? builder(value) : note(field);
  }

  global.CHI_FALLBACK = {
    has: has,
    text: text,
    note: note,
    section: section,
    message: message,
    MESSAGES: MESSAGES
  };

  // Shared styling for the placeholder, injected once.
  if (typeof document !== 'undefined' && !document.getElementById('chi-fallback-style')) {
    var style = document.createElement('style');
    style.id = 'chi-fallback-style';
    style.textContent =
      '.chi-nodata{font-size:13px;line-height:1.7;opacity:.62;font-style:italic;margin:.35rem 0;}';
    (document.head || document.documentElement).appendChild(style);
  }
})(typeof window !== 'undefined' ? window : globalThis);