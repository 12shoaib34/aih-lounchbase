export default function mount(scope) {
  /* Approved motion layer. Content and native disclosures work without this file. */
  (() => {
    const root = document.querySelector(".work-page");
    if (!root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const still = () =>
      reduced.matches || root.classList.contains("motion-paused");
    const art = root.querySelector(".work-gates");
    const hero = root.querySelector(".work-art");
    const gates = [...root.querySelectorAll(".work-gate")];
    const signals = [...root.querySelectorAll(".work-connector i")];
    const steps = root.querySelector(".work-steps");
    const rows = [...steps.children];
    const cards = [...root.querySelectorAll(".work-cards article")];
    const running = new Set();
    let visible = false,
      frame = 0,
      last = 0,
      phase = 0,
      scrollFrame = 0;
    const draw = () => {
      const position = ((phase % 3) + 3) % 3;
      gates.forEach((gate, i) =>
        gate.classList.toggle("work-gate-active", i === Math.floor(position)),
      );
      signals.forEach((signal, i) => {
        const moving = position >= i && position < i + 1;
        signal.style.opacity = moving ? "1" : "0";
        signal.style.top = `${Math.min(1, Math.max(0, position - i)) * 100}%`;
      });
    };
    const tick = (time) => {
      frame = 0;
      if (still() || !visible || document.hidden) {
        last = 0;
        return;
      }
      if (last) phase += Math.min(time - last, 50) * 0.00038;
      last = time;
      draw();
      frame = scope.frame(tick);
    };
    const resetPointer = () => {
      hero.style.removeProperty("transform");
      cards.forEach((card) => {
        card.style.removeProperty("--spot-x");
        card.style.removeProperty("--spot-y");
      });
    };
    const progress = () => {
      scrollFrame = 0;
      rows.forEach((row) => {
        const box = row.getBoundingClientRect();
        const amount = still()
          ? 1
          : Math.max(
              0,
              Math.min(1, (innerHeight * 0.8 - box.top) / (innerHeight * 0.35)),
            );
        row.style.setProperty("--step-progress", String(amount));
      });
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      if (still()) {
        running.forEach((a) => a.cancel());
        running.clear();
        resetPointer();
      } else if (visible && !document.hidden) frame = scope.frame(tick);
      progress();
    };
    scope
      .observe(
        IntersectionObserver,
        (entries) => {
          visible = entries[0].isIntersecting;
          sync();
        },
        { rootMargin: "80px" },
      )
      .observe(art);
    scope
      .observe(MutationObserver, sync)
      .observe(root, { attributes: true, attributeFilter: ["class"] });
    scope.on(reduced, "change", sync);
    scope.on(fine, "change", resetPointer);
    scope.on(document, "visibilitychange", sync);
    scope.on(
      window,
      "scroll",
      () => {
        if (!scrollFrame) scrollFrame = scope.frame(progress);
      },
      { passive: true },
    );
    scope.on(window, "resize", () => {
      resetPointer();
      progress();
    });
    const reveal = scope.observe(
      IntersectionObserver,
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          reveal.unobserve(entry.target);
          if (still()) return;
          const siblings = entry.target.parentElement.matches(
            ".work-cards,.work-steps",
          )
            ? [...entry.target.parentElement.children]
            : [];
          const delay = Math.max(0, siblings.indexOf(entry.target)) * 70;
          const a = entry.target.animate(
            [
              { opacity: 0.15, translate: "0 20px" },
              { opacity: 1, translate: "0 0" },
            ],
            {
              duration: 600,
              delay,
              easing: "cubic-bezier(.2,.7,.2,1)",
              fill: "backwards",
            },
          );
          running.add(a);
          a.onfinish = a.oncancel = () => running.delete(a);
        }),
      { threshold: 0.12 },
    );
    root
      .querySelectorAll(
        ".work-hero-copy>*,.work-section>h2,.work-partnership>*,.work-steps>li,.work-cards>article,.work-ending>*",
      )
      .forEach((el) => reveal.observe(el));
    scope.on(hero, "pointermove", (event) => {
      if (still() || !fine.matches || event.pointerType === "touch") return;
      const b = hero.getBoundingClientRect();
      hero.style.transform = `perspective(1000px) rotateX(${(0.5 - (event.clientY - b.top) / b.height) * 4}deg) rotateY(${((event.clientX - b.left) / b.width - 0.5) * 4}deg)`;
    });
    scope.on(hero, "pointerleave", resetPointer);
    cards.forEach((card) =>
      scope.on(card, "pointermove", (event) => {
        if (still() || !fine.matches || event.pointerType === "touch") return;
        const b = card.getBoundingClientRect();
        card.style.setProperty("--spot-x", `${event.clientX - b.left}px`);
        card.style.setProperty("--spot-y", `${event.clientY - b.top}px`);
      }),
    );
    const dialog = root.querySelector("#project-dialog");
    scope
      .observe(MutationObserver, () => {
        if (!dialog.open || still()) return;
        const animation = dialog.animate(
          [
            { opacity: 0, transform: "scale(.97)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 200, easing: "ease-out" },
        );
        running.add(animation);
        animation.onfinish = animation.oncancel = () =>
          running.delete(animation);
      })
      .observe(dialog, { attributes: true, attributeFilter: ["open"] });
    root.classList.add("work-motion-ready");
    draw();
    sync();
  })();
}
