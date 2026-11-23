export default function mount(scope) {
  // Early, optional enhancement. A failed/blocked script leaves content accessible.
  (() => {
    const path = location.pathname;
    if (
      !/^\/(?:$|index(?:\.html)?\/?$|(?:services|engagements|studio|ventures|work|contact|privacy)(?:\.html)?\/?$|blog(?:\/|$))/.test(
        path,
      )
    )
      return;
    const root = document.documentElement;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let paused = false;
    try {
      paused = localStorage.getItem("aih-motion") === "paused";
      const theme = localStorage.getItem("aih-theme");
      root.dataset.theme =
        theme === "light" || theme === "dark"
          ? theme
          : matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark";
    } catch {
      root.dataset.theme ||= matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }
    // No motion or extra waiting when the visitor has asked for stillness.
    if (reduced.matches || paused) root.dataset.openingStill = "";
    root.dataset.opening = "loading";
    const heroIntro =
      !location.hash &&
      /^(?:\/|\/index(?:\.html)?)$/.test(path) &&
      performance.getEntriesByType("navigation")[0]?.type !== "back_forward" &&
      !reduced.matches &&
      !paused;
    if (heroIntro) root.dataset.heroIntro = "waiting";
    const started = performance.now();
    let finished = false,
      readyTimer,
      exitTimer,
      heroTimer,
      heroCleanup;
    const clear = () => {
      finished = true;
      clearTimeout(readyTimer);
      clearTimeout(exitTimer);
      clearTimeout(failsafe);
      clearTimeout(heroTimer);
      clearTimeout(heroCleanup);
      delete root.dataset.heroIntro;
      delete root.dataset.opening;
      delete root.dataset.openingStill;
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("click", click);
      reduced.removeEventListener("change", preference);
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(readyTimer);
      clearTimeout(failsafe);
      if (reduced.matches || paused) {
        clear();
        return;
      }
      root.dataset.opening = "opening";
      if (heroIntro)
        heroTimer = scope.timer(() => {
          document
            .querySelectorAll(".op-live-symbol [data-symbol-path]")
            .forEach((path, index) => {
              path.style.setProperty("--trace-length", path.getTotalLength());
              path.style.setProperty("--trace-delay", `${index * 0.07}s`);
            });
          root.dataset.heroIntro = "reveal";
        }, 900);
      exitTimer = scope.timer(() => {
        delete root.dataset.opening;
        // Finish the hero entrance after the curtain has left the viewport.
        if (heroIntro) heroCleanup = scope.timer(clear, 2500);
        else clear();
      }, 1150);
    };
    scope.dispose(clear);
    const keyboard = (event) => {
      if (event.key === "Tab" || event.key === "Escape") clear();
    };
    const click = (event) => {
      if (event.target.closest?.("[data-opening-skip]")) clear();
    };
    const preference = () => {
      if (reduced.matches) clear();
    };
    const failsafe = scope.timer(clear, 4500);
    scope.on(document, "keydown", keyboard, true);
    scope.on(document, "click", click);
    scope.on(reduced, "change", preference);
    scope.on(window, "pagehide", clear, { once: true });
    scope.on(window, "pageshow", (event) => {
      if (event.persisted) clear();
    });
    const ready = () => {
      Promise.resolve(document.fonts?.ready)
        .catch(() => {})
        .then(() => {
          if (finished) return;
          readyTimer = scope.timer(
            finish,
            Math.max(
              0,
              (reduced.matches || paused ? 0 : 450) -
                (performance.now() - started),
            ),
          );
        });
    };
    if (document.readyState === "complete") ready();
    else scope.on(window, "load", ready, { once: true });
  })();
}
