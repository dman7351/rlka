import test from 'node:test';
import assert from 'node:assert/strict';
import { createBootSequence } from '../src/components/bootSequence.js';

const makeSequence = options => createBootSequence({ fadeMs: 600, transitionMs: 650, ...options });

test('activation waits for the actual poster readiness and ignores repeated clicks', () => {
  const sequence = makeSequence();
  sequence.activate(100);
  sequence.activate(200);
  assert.equal(sequence.read(10000).phase, 'starting');
  assert.equal(sequence.read(10000).reveal, 0);
  sequence.ready(10000);
  assert(sequence.read(10325).reveal > 0 && sequence.read(10325).reveal < 1);
  sequence.activate(10400);
  assert.equal(sequence.read(10650).phase, 'poster');
});

test('a prepared poster waits for activation; fading the logo does not enter it', () => {
  const sequence = makeSequence();
  sequence.ready(50);
  assert.equal(sequence.read(600).opacity, 1);
  assert.equal(sequence.read(10000).phase, 'boot');
  sequence.activate(10000);
  assert.equal(sequence.read(10650).phase, 'poster');
});

test('reduced motion skips the transition but still respects readiness', () => {
  const sequence = makeSequence();
  sequence.activate(0);
  assert.equal(sequence.read(0, true).phase, 'starting');
  sequence.ready(1);
  const result = sequence.read(1, true);
  assert.equal(result.phase, 'poster');
  assert.equal(result.reveal, 1);
  assert.equal(result.animating, false);
});

test('remembered sessions open the poster without activation or another transition', () => {
  const sequence = makeSequence({ remembered: true });
  assert.equal(sequence.read(0).phase, 'poster');
  assert.equal(sequence.read(0).reveal, 1);
  assert.equal(sequence.read(0).animating, false);
});
