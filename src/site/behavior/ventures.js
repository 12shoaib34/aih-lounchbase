export default function mount(scope) {
  /* Approved motion layer. Content and native disclosures work without this file. */
  (() => {
    const root = document.querySelector(".venture-page");
    if (!root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const still = () =>
      reduced.matches || root.classList.contains("motion-paused");
    const art = root.querySelector(".venture-orbits");
    const hero = root.querySelector(".venture-partnership");
    const signals = [...root.querySelectorAll(".venture-signal")];
    const steps = root.querySelector(".venture-steps");
    const rows = [...steps.children];
    const cards = [
      ...root.querySelectorAll(".venture-card,.venture-terms article"),
    ];
    const running = new Set();
    let visible = false,
      frame = 0,
      last = 0,
      phase = 0,
      scrollFrame = 0;
    const draw = () =>
      signals.forEach((signal, i) => {
        const angle = phase + (i ? 0 : Math.PI);
        signal.setAttribute(
          "cx",
          String((i ? 335 : 185) + 165 * Math.cos(angle)),
        );
        signal.setAttribute("cy", String(140 + 112 * Math.sin(angle)));
      });
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
      const first = rows[0].getBoundingClientRect();
      const distance = Math.max(1, rows.at(-1).offsetTop - rows[0].offsetTop);
      steps.style.setProperty("--journey-span", `${distance}px`);
      const amount = Math.max(
        0,
        Math.min(1, (innerHeight * 0.6 - first.top) / distance),
      );
      steps.style.setProperty(
        "--journey-progress",
        String(still() ? 1 : amount),
      );
      rows.forEach((row) =>
        row.classList.toggle(
          "venture-step-active",
          still() || row.getBoundingClientRect().top <= innerHeight * 0.6,
        ),
      );
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
            ".venture-terms,.venture-steps",
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
        ".venture-hero-copy>*,.venture-section>h2,.venture-columns>*,.venture-steps>li,.venture-terms>article,.venture-example>div,.venture-ending>*",
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
    root.querySelectorAll(".venture-main .primary-link").forEach((link) => {
      const node = link.lastChild;
      if (node?.nodeType !== Node.TEXT_NODE || !node.textContent.endsWith("↗"))
        return;
      node.textContent = node.textContent.slice(0, -1);
      const arrow = document.createElement("span");
      arrow.className = "venture-arrow";
      arrow.textContent = "↗";
      arrow.setAttribute("aria-hidden", "true");
      link.append(arrow);
    });
    root.classList.add("venture-motion-ready");
    draw();
    sync();
  })();
}
