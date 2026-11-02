// Track active animation time, excluding pauses/hidden tabs. Keep phase values
// small before sending them to GLSL, where long-running float clocks lose detail.
export function createMotionClock(start = performance.now()) {
  let last = start;
  let seconds = 0;
  let running = false;
  function read(now) {
    if (running) seconds += Math.max(0, now - last) / 1000;
    last = Math.max(last, now);
    return seconds;
  }
  return {
    read,
    setRunning(value, now) { read(now); running = value; },
  };
}

export function cyclePhase(seconds, cyclesPerSecond) {
  const phase = (seconds * cyclesPerSecond) % 1;
  return phase < 0 ? phase + 1 : phase;
}
