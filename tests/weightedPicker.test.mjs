import test from 'node:test';
import assert from 'node:assert/strict';
import { computeClipWeights, pickWeightedClip } from '../src/utils/weightedPicker.js';

const mockClips = [
  { id: 'c1', memberIds: ['a'] },
  { id: 'c2', memberIds: ['b', 'c'] },
  { id: 'c3', memberIds: ['d'] },
];

test('computeClipWeights calculates raw scores and normalized probabilities summing to 100%', () => {
  const weights = { a: 10, b: 3, c: 2, d: 5 };
  const scored = computeClipWeights(mockClips, weights);

  assert.equal(scored[0].rawScore, 10);
  assert.equal(scored[1].rawScore, 5);
  assert.equal(scored[2].rawScore, 5);

  const probSum = scored.reduce((acc, item) => acc + item.probability, 0);
  assert.ok(Math.abs(probSum - 100) < 1e-9);
  assert.equal(scored[0].probability, 50);
  assert.equal(scored[1].probability, 25);
  assert.equal(scored[2].probability, 25);
});

test('pickWeightedClip never selects zero-weight clips when positive-weight clips exist', () => {
  const weights = { a: 0, b: 0, c: 0, d: 8 };
  for (let i = 0; i < 20; i += 1) {
    const result = pickWeightedClip(mockClips, weights);
    assert.equal(result.isZeroWeightFallback, false);
    assert.equal(result.selected.clip.id, 'c3');
  }
});

test('pickWeightedClip returns zero-weight fallback flag when all candidates sum to 0', () => {
  const weights = { a: 0, b: 0, c: 0, d: 0 };
  const result = pickWeightedClip(mockClips, weights);
  assert.equal(result.isZeroWeightFallback, true);
  assert.ok(result.selected);
});
