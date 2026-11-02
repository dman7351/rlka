import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEventValue } from '../src/config/event.js';

test('missing event details fall back to TBA while a zero entry price remains valid', () => {
  for (const missing of [null, undefined, '', '  ']) {
    assert.equal(formatEventValue(missing), 'TBA');
  }
  assert.equal(formatEventValue(0), '0');
  assert.equal(formatEventValue('FREE / ALL AGES'), 'FREE / ALL AGES');
});
