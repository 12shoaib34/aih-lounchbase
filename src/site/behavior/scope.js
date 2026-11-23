// All document-level effects belong to one mounted marketing route.
export function createScope(root) {
  const controller = new AbortController();
  const cleanup = [];
  const frames = new Set();
  const timers = new Set();
  return {
    root,
    get active() {
      return !controller.signal.aborted;
    },
    on(target, type, listener, options) {
      target.addEventListener(type, listener, {
        ...(typeof options === "boolean" ? { capture: options } : options),
        signal: controller.signal,
      });
    },
    observe(Type, callback, options) {
      const observer = new Type(callback, options);
      cleanup.push(() => observer.disconnect());
      return observer;
    },
    frame(fn) {
      if (controller.signal.aborted) return 0;
      const id = requestAnimationFrame((t) => {
        frames.delete(id);
        fn(t);
      });
      frames.add(id);
      return id;
    },
    timer(fn, delay) {
      if (controller.signal.aborted) return 0;
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, delay);
      timers.add(id);
      return id;
    },
    dispose(fn) {
      cleanup.push(fn);
    },
    close() {
      controller.abort();
      cleanup.reverse().forEach((fn) => fn());
      frames.forEach(cancelAnimationFrame);
      timers.forEach(clearTimeout);
    },
  };
}
