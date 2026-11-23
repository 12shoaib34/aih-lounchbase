export default function mount(scope) {
  /* Approved motion layer. Content and native disclosures work without this file. */
  (() => {
    const root = document.querySelector(".studio-page");
    if (!root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const still = () =>
      reduced.matches || root.classList.contains("motion-paused");
    const art = root.querySelector(".studio-gates");
    const hero = root.querySelector(".studio-art");
    const gates = [...root.querySelectorAll(".studio-gate")];
    const signals = [...root.querySelectorAll(".studio-connector i")];
    const stageLinks = [...root.querySelectorAll(".studio-stage-nav a")];
    const steps = root.querySelector(".studio-steps");
    const rows = [...steps.children];
    const cards = [
      ...root.querySelectorAll(".studio-example-card,.studio-cards article"),
    ];
    const running = new Set();
    let visible = false,
      frame = 0,
      last = 0,
      phase = 0,
      scrollFrame = 0;
    const draw = () => {
      const position = ((phase % 3) + 3) % 3;
      gates.forEach((gate, i) =>
        gate.classList.toggle("studio-gate-active", i === Math.floor(position)),
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
          "studio-step-active",
          still() || row.getBoundingClientRect().top <= innerHeight * 0.6,
        ),
      );
      let current = 0;
      rows.forEach((row, i) => {
        if (row.getBoundingClientRect().top <= innerHeight * 0.4) current = i;
      });
      stageLinks.forEach((link, i) => {
        if (i === current) link.setAttribute("aria-current", "step");
        else link.removeAttribute("aria-current");
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
            ".studio-cards,.studio-steps",
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
        ".studio-hero-copy>*,.studio-section>h2,.studio-heading,.studio-steps>li,.studio-cards>article,.studio-example-card,.studio-ending>*",
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
    root.querySelectorAll(".studio-main .primary-link").forEach((link) => {
      const node = link.lastChild;
      if (node?.nodeType !== Node.TEXT_NODE || !node.textContent.endsWith("↗"))
        return;
      node.textContent = node.textContent.slice(0, -1);
      const arrow = document.createElement("span");
      arrow.className = "studio-arrow";
      arrow.textContent = "↗";
      arrow.setAttribute("aria-hidden", "true");
      link.append(arrow);
    });
    root.classList.add("studio-motion-ready");
    draw();
    sync();
  })();
}
