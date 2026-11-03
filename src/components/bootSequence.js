// Power-on state transitions; time is supplied so pauses and tests are explicit.
export function createBootSequence({ fadeMs, transitionMs, remembered = false }) {
  let requested = false;
  let prepared = false;
  let transitionStart = null;
  let entered = remembered;
  const clamp = value => Math.max(0, Math.min(1, value));

  function begin(now) {
    if (requested && prepared && transitionStart === null && !entered) transitionStart = now;
  }

  return {
    activate(now) { requested = true; begin(now); },
    ready(now) { prepared = true; begin(now); },
    read(now, instant = false) {
      const progress = transitionStart === null ? 0 : instant ? 1 : clamp((now - transitionStart) / Math.max(1, transitionMs));
      if (progress === 1) entered = true;
      return {
        phase: entered ? 'poster' : requested ? 'starting' : 'boot',
        opacity: instant ? 1 : clamp(now / Math.max(1, fadeMs)),
        reveal: entered ? 1 : progress * progress * (3 - 2 * progress),
        prepared,
        animating: !entered && !instant && (now < fadeMs || transitionStart !== null),
      };
    },
  };
}
