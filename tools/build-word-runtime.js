'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'data', 'words');
const OUTPUT = path.join(ROOT, 'app', 'js', 'word-data.js');
const CHECK_ONLY = process.argv.includes('--check');

function loadSources() {
  const context = { window: {} };
  vm.createContext(context);
  for (const file of [
    'base-word-data.js',
    'word-phrases.js',
    'word-families.js',
    'word-confusions.js',
  ]) {
    const full = path.join(SOURCE_DIR, file);
    vm.runInContext(fs.readFileSync(full, 'utf8'), context, { filename: full });
  }
  return context.window;
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function uniqueForms(forms) {
  const seen = new Set();
  return forms.filter((form) => {
    if (!form || !String(form.label || '').trim() || !String(form.value || '').trim()) return false;
    const key = `${form.label}\u0000${form.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((form) => ({ label: String(form.label).trim(), value: String(form.value).trim() }));
}

function defaultId(word) {
  const id = String(word || '')
    .normalize('NFKC')
    .replace(/[’']/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!id) throw new Error(`Cannot derive a stable id for headword: ${word}`);
  return id;
}

function compileRuntime() {
  const source = loadSources();
  const curation = require(path.join(SOURCE_DIR, 'curation.js'));
  const baseWords = source.W11_WORDS;
  const sourceFamilies = source.W11_WORD_FAMILIES;
  const sourcePhrases = source.W11_WORD_PHRASES;
  const sourceConfusions = source.W11_WORD_CONFUSIONS;

  if (!Array.isArray(baseWords) || baseWords.length < 3000) {
    throw new Error('Base vocabulary source must contain at least 3000 records');
  }

  // Merge records only when their display spelling and case are exactly equal.
  // AD/ad and Miss/miss therefore remain separate lexical entries.
  const mergedByExactWord = new Map();
  for (const record of baseWords) {
    const word = String(record.word || '').trim();
    if (!word) throw new Error('Base vocabulary contains an empty headword');
    if (!mergedByExactWord.has(word)) {
      mergedByExactWord.set(word, { word, meanings: [], forms: [] });
    }
    const merged = mergedByExactWord.get(word);
    merged.meanings.push(record.pos);
    merged.forms.push(...record.forms);
  }

  for (const word of Object.keys(curation.entryOverrides)) {
    if (!mergedByExactWord.has(word)) {
      throw new Error(`Entry override does not match an exact source headword: ${word}`);
    }
  }

  const entries = [...mergedByExactWord.values()].map((entry) => {
    const override = curation.entryOverrides[entry.word] || {};
    return {
      id: override.id || defaultId(entry.word),
      word: entry.word,
      meanings: uniqueStrings(override.meanings || entry.meanings),
      forms: uniqueForms(Object.hasOwn(override, 'forms') ? override.forms : entry.forms),
    };
  });

  const ids = new Map();
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      throw new Error(`Stable id collision: ${entry.id} (${ids.get(entry.id)} / ${entry.word})`);
    }
    ids.set(entry.id, entry.word);
  }

  const entriesByExactWord = new Map();
  const entriesByLowerKey = new Map();
  for (const entry of entries) {
    entriesByExactWord.set(entry.word, entry);
    const key = normalizeKey(entry.word);
    if (!entriesByLowerKey.has(key)) entriesByLowerKey.set(key, []);
    entriesByLowerKey.get(key).push(entry);
  }

  // Case-folding is convenient for ordinary relationship data, but unsafe for
  // lexical collisions such as AD/ad and Miss/miss. Ambiguous spellings must
  // use the exact display case all the way through the build.
  function relationKey(value) {
    const exact = String(value || '').trim();
    const folded = normalizeKey(exact);
    const variants = entriesByLowerKey.get(folded) || [];
    if (variants.length <= 1) return `fold:${folded}`;
    if (!entriesByExactWord.has(exact)) {
      throw new Error(`Ambiguous relationship key requires exact case: ${value}`);
    }
    return `exact:${exact}`;
  }

  const entriesByRelationKey = new Map(entries.map((entry) => [relationKey(entry.word), entry]));
  const meaningForHeadword = (word) => {
    const entry = entriesByRelationKey.get(relationKey(word));
    return entry ? entry.meanings.join('；') : '';
  };

  function checkedEntryRelations(sourceObject, label, toValues) {
    const result = new Map();
    for (const [word, rawValue] of Object.entries(sourceObject)) {
      const key = relationKey(word);
      if (!entriesByRelationKey.has(key)) {
        throw new Error(`${label} owner is not a drawable lexical entry: ${word}`);
      }
      if (result.has(key)) throw new Error(`Duplicate ${label} owner: ${word}`);
      result.set(key, toValues(rawValue));
    }
    return result;
  }

  const sourcePhraseAssignments = checkedEntryRelations(
    sourcePhrases,
    'Phrase',
    (phrase) => uniqueStrings([phrase]),
  );
  const sourceConfusionAssignments = checkedEntryRelations(
    sourceConfusions,
    'Confusion',
    (confusion) => uniqueStrings([confusion]),
  );

  const familyGroups = new Map();
  for (const [root, family] of Object.entries(sourceFamilies)) {
    familyGroups.set(relationKey(root), {
      root,
      rootMeaning: curation.rootMeanings[root] || meaningForHeadword(root),
      members: family.family.map(([word, meaning]) => ({ word, meaning })),
    });
  }
  for (const [root, addition] of Object.entries(curation.familyAdditions)) {
    const key = relationKey(root);
    const group = familyGroups.get(key) || {
      root,
      rootMeaning: curation.rootMeanings[root] || meaningForHeadword(root),
      members: [],
    };
    const existing = new Set(group.members.map((member) => relationKey(member.word)));
    for (const [word, meaning] of addition.members) {
      if (!existing.has(relationKey(word))) group.members.push({ word, meaning });
    }
    familyGroups.set(key, group);
  }
  for (const root of Object.keys(curation.rootMeanings)) {
    if (!familyGroups.has(relationKey(root))) {
      throw new Error(`Root meaning does not match a family group: ${root}`);
    }
  }

  const familyByWord = new Map();
  for (const group of familyGroups.values()) {
    const assignments = [group.root, ...group.members.map((member) => member.word)];
    if (!assignments.some((word) => entriesByRelationKey.has(relationKey(word)))) {
      throw new Error(`Family has no drawable lexical entry: ${group.root}`);
    }
    for (const word of assignments) {
      const key = relationKey(word);
      const previous = familyByWord.get(key);
      if (previous && relationKey(previous.root) !== relationKey(group.root)) {
        throw new Error(`Word belongs to multiple families: ${word} (${previous.root} / ${group.root})`);
      }
      familyByWord.set(key, group);
    }
  }

  const phraseAssignments = checkedEntryRelations(
    curation.phraseAssignments,
    'Curated phrase',
    (phrases) => uniqueStrings(phrases),
  );

  const runtimeWords = entries.map((entry) => {
    const key = relationKey(entry.word);
    const group = familyByWord.get(key);
    const family = [];
    if (group) {
      if (key !== relationKey(group.root)) {
        family.push({ word: group.root, meaning: group.rootMeaning });
      }
      for (const member of group.members) {
        if (relationKey(member.word) !== key) family.push({ word: member.word, meaning: member.meaning });
      }
    }

    const phrases = phraseAssignments.get(key) || sourcePhraseAssignments.get(key) || [];
    const confusions = sourceConfusionAssignments.get(key) || [];
    const weight = Number((1
      + (family.length ? 0.3 : 0)
      + (phrases.length ? 0.2 : 0)
      + (confusions.length ? 0.2 : 0)).toFixed(1));

    return {
      ...entry,
      family,
      phrases,
      confusions,
      studyGroupId: group ? `family:${relationKey(group.root)}` : `entry:${entry.id}`,
      weight,
    };
  });

  const emittedPhrases = new Set(runtimeWords.flatMap((entry) => entry.phrases));
  for (const [root, family] of Object.entries(sourceFamilies)) {
    for (const phrase of family.phrases) {
      if (!emittedPhrases.has(phrase)) {
        throw new Error(`Family phrase was not assigned to a drawable entry: ${root} -> ${phrase}`);
      }
    }
  }

  return {
    version: curation.version,
    source: 'Human-curated Gaokao source; ECDICT inflections reviewed through explicit overrides',
    sourceCount: baseWords.length,
    count: runtimeWords.length,
    words: runtimeWords,
  };
}

function serialize(payload) {
  return [
    '/*',
    ' * Generated by tools/build-word-runtime.js. Do not edit by hand.',
    ' * Human corrections belong in data/words/curation.js.',
    ' */',
    `'use strict';`,
    `window.W11_WORD_DATA = Object.freeze(${JSON.stringify(payload)});`,
    'window.W11_WORDS = window.W11_WORD_DATA.words;',
    '',
  ].join('\n');
}

const payload = compileRuntime();
const output = serialize(payload);

if (CHECK_ONLY) {
  // Git for Windows may check text files out with CRLF even though the
  // deterministic serializer emits LF. Compare logical content, not the
  // platform-specific working-tree newline representation.
  const current = fs.existsSync(OUTPUT)
    ? fs.readFileSync(OUTPUT, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current !== output) {
    throw new Error('app/js/word-data.js is stale; run npm run words:build');
  }
  console.log(`[words] generated runtime is current: ${payload.sourceCount} source records -> ${payload.count} lexical entries`);
} else {
  fs.writeFileSync(OUTPUT, output, 'utf8');
  console.log(`[words] wrote ${payload.count} lexical entries from ${payload.sourceCount} source records to ${path.relative(ROOT, OUTPUT)}`);
}
