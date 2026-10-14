// Sorts équipés : clic gauche et R gardent leurs variantes, clic droit et Espace partagent un lot sans doublon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedSpells, flexSpells, getClass, sanitizeLoadout } from '../shared/src/index.ts';

test('clic droit et Espace acceptent tout le lot commun, clic gauche et R seulement leurs variantes', () => {
  const base = getClass('iop').spells;
  const pool = flexSpells('iop');
  assert.ok(pool.includes(base[1]) && pool.includes(base[2]));
  assert.ok(pool.includes('epee_celeste') && pool.includes('bond') && pool.includes('vitalite'));
  assert.deepEqual(allowedSpells('iop', 1), pool);
  assert.deepEqual(allowedSpells('iop', 2), pool);
  // Une variante du clic gauche ou du R ne va pas ailleurs, et un sort libre ne va pas sur R.
  assert.ok(!pool.includes('intimidation') && !pool.includes('epee_du_jugement'));
  assert.ok(!allowedSpells('iop', 3).includes('bond'));
});

test('un sort libre peut changer d emplacement, mais pas occuper les deux', () => {
  const base = getClass('iop').spells;
  // Échange des deux sorts de base, et alternative du clic droit posée sur Espace.
  assert.deepEqual(sanitizeLoadout('iop', [base[0], base[2], base[1], base[3]]), [base[0], base[2], base[1], base[3]]);
  assert.deepEqual(sanitizeLoadout('iop', [base[0], 'bond', 'epee_celeste', base[3]]), [base[0], 'bond', 'epee_celeste', base[3]]);
  // Doublon : le second emplacement reprend un sort libre encore inutilisé.
  const dup = sanitizeLoadout('iop', [base[0], 'bond', 'bond', base[3]]);
  assert.equal(dup[1], 'bond');
  assert.notEqual(dup[2], 'bond');
  assert.ok(flexSpells('iop').includes(dup[2]));
  // Sorts hors lot ou d'une autre classe : retour au sort de base.
  assert.deepEqual(sanitizeLoadout('iop', ['bond', 'fleche_magique', 'intimidation', 'bond']), base);
});

test('classes sans alternatives : les deux sorts libres s échangent quand même', () => {
  for (const id of ['osamodas', 'enutrof', 'xelor', 'pandawa']) {
    const base = getClass(id).spells;
    assert.deepEqual(flexSpells(id), [base[1], base[2]]);
    assert.deepEqual(sanitizeLoadout(id, [base[0], base[2], base[1], base[3]]), [base[0], base[2], base[1], base[3]]);
  }
});
