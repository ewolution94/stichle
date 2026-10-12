import { test } from 'node:test';
import assert from 'node:assert/strict';
// The page's own deck, loaded through Node's type stripping (no build step).
import { card, deck, nameOf } from '../src/lib/deck.ts';
import { PEOPLE, PEOPLE_FIGURES, personOf } from '../src/lib/people.js';
import { FIGURES } from '../src/lib/figures.js';

test('every card draws in both decks, in both languages, with no broken numbers', () => {
  const faces = [...deck(), { k: 'back' }];
  assert.equal(faces.length, 61);
  for (const art of ['figures', 'classic']) {
    for (const lang of ['de', 'en']) {
      for (const [i, face] of faces.entries()) {
        const svg = card(face, { art, lang, uid: i });
        assert.ok(svg.startsWith('<svg'), `${art} ${lang} ${nameOf(face, lang)}`);
        assert.ok(!/NaN|undefined|Infinity/.test(svg), `${art} ${lang} ${nameOf(face, lang)} has a broken value`);
      }
    }
  }
});

test('each element has its own person on every number, named in both languages', () => {
  const seen = new Set();
  for (const suit of ['fire', 'water', 'earth', 'air']) {
    assert.equal(PEOPLE[suit].length, 14);
    for (let v = 1; v <= 13; v++) {
      const id = PEOPLE[suit][v];
      assert.ok(id in PEOPLE_FIGURES || id in FIGURES, `${suit} ${v}: ${id}`);
      assert.ok(!seen.has(id), `${id} stands twice`);
      seen.add(id);
      const person = personOf(suit, v);
      assert.ok(person.names.de && person.names.en, `${suit} ${v} has both names`);
      assert.ok(person.parts.length > 5, `${suit} ${v} is drawn`);
    }
  }
  assert.equal(seen.size, 52);
});
