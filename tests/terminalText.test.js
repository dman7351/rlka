import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapTerminalText } from '../src/components/terminalText.js';

const width = text => Array.from(text).length;

test('dialog wrapping keeps words and explicit paragraph breaks', () => {
  assert.deepEqual(wrapTerminalText('ONE TWO THREE', 7, width), ['ONE TWO', 'THREE']);
  assert.deepEqual(wrapTerminalText('FIRST\n\nSECOND', 10, width), ['FIRST', '', 'SECOND']);
  assert.deepEqual(wrapTerminalText('', 10, width), ['']);
});

test('long event addresses/URLs wrap without losing content or splitting Unicode code points', () => {
  const value = 'Åsa🎵-abcdefghijklmnopqrstuvwxyz';
  const lines = wrapTerminalText(value, 6, width);
  assert.equal(lines.join(''), value);
  assert.ok(lines.every(line => width(line) <= 6));
  assert.deepEqual(wrapTerminalText('a🎵å', 1, width), ['a', '🎵', 'å']);
});
