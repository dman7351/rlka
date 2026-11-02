import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionClock, cyclePhase } from '../src/effects/motionClock.js';

test('motion resumes continuously after long pauses or hidden periods', () => {
  const clock = createMotionClock(1000);
  clock.setRunning(true, 1000);
  assert.equal(clock.read(2000), 1);
  assert.equal(clock.read(1999), 1, 'an earlier RAF timestamp cannot rewind the clock');
  assert.equal(clock.read(2000), 1, 'sampling again does not count that interval twice');
  clock.setRunning(false, 2500);
  const hourLater = 3602500;
  assert.equal(clock.read(hourLater), 1.5, 'hidden time does not advance motion');
  clock.setRunning(true, hourLater);
  assert.equal(clock.read(hourLater + 500), 2, 'resume continues from the held frame');
  clock.setRunning(false, hourLater + 500);
  assert.equal(clock.read(hourLater + 10000000), 2, 'paused tuning keeps the same effect time');
});

test('shader phases retain frame-to-frame movement after long runtimes', () => {
  const seconds = 100000000;
  for (const speed of [.25, .3 / (2 * Math.PI), 1 / 20]) {
    const phase = cyclePhase(seconds, speed);
    const next = cyclePhase(seconds + 1 / 24, speed);
    assert.ok(phase >= 0 && phase < 1);
    assert.ok(next >= 0 && next < 1);
    assert.notEqual(Math.fround(phase), Math.fround(next), 'GLSL float values keep changing');
  }
  assert.equal(cyclePhase(seconds, 0), 0, 'stationary lines remain an intentional option');
  assert.equal(cyclePhase(5, -.1), .5, 'reverse motion wraps into the same bounded range');
});
