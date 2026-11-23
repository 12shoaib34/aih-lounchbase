export default function mount(scope) {
  /* Progressive effects shared by refreshed detail pages. Content is visible without JS. */
  (() => {
    const root = document.querySelector(".detail-page");
    if (!root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const still = () =>
      reduced.matches || root.classList.contains("motion-paused");
    const art = root.querySelector(".detail-art");
    const dot = root.querySelector(".system-dot");
    const nodes = [...root.querySelectorAll(".system-nodes span")];
    const cards = [
      ...root.querySelectorAll(
        ".service-catalogue>article,.project-catalogue>article,.scope-options>article,.content-cards>article",
      ),
    ];
    const animations = new Set();
    let visible = false,
      frame = 0,
      last = 0,
      phase = 0;
    const draw = () => {
      const stage = Math.floor(phase) % 3,
        progress = phase % 1;
      const x =
        progress < 0.35
          ? 50
          : progress < 0.7
            ? 50 + ((stage - 1) * 50 * (progress - 0.35)) / 0.35
            : stage * 50;
      const y =
        progress < 0.35
          ? (progress / 0.35) * 50
          : progress < 0.7
            ? 50
            : 50 + ((progress - 0.7) / 0.3) * 50;
      if (dot) {
        dot.style.left = `${x}%`;
        dot.style.top = `${y}%`;
      }
      nodes.forEach((node, i) => node.classList.toggle("active", i === stage));
    };
    const tick = (time) => {
      frame = 0;
      if (still() || !visible || document.hidden) {
        last = 0;
        return;
      }
      if (last) phase += Math.min(time - last, 50) * 0.00024;
      last = time;
      draw();
      frame = scope.frame(tick);
    };
    const reset = () => {
      if (art) art.style.removeProperty("transform");
      cards.forEach((card) => {
        card.style.removeProperty("--spot-x");
        card.style.removeProperty("--spot-y");
      });
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      if (still()) {
        animations.forEach((a) => a.cancel());
        animations.clear();
        reset();
      } else if (dot && visible && !document.hidden) frame = scope.frame(tick);
    };
    if (art) {
      scope
        .observe(IntersectionObserver, (entries) => {
          visible = entries[0].isIntersecting;
          sync();
        })
        .observe(art);
      scope.on(art, "pointermove", (e) => {
        if (still() || !fine.matches || e.pointerType === "touch") return;
        const r = art.getBoundingClientRect();
        art.style.transform = `perspective(1000px) rotateX(${(0.5 - (e.clientY - r.top) / r.height) * 3}deg) rotateY(${((e.clientX - r.left) / r.width - 0.5) * 3}deg)`;
      });
      scope.on(art, "pointerleave", reset);
    }
    const observer = scope.observe(
      IntersectionObserver,
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          if (still()) return;
          const a = entry.target.animate(
            [
              { opacity: 0.2, translate: "0 18px" },
              { opacity: 1, translate: "0 0" },
            ],
            { duration: 550, easing: "cubic-bezier(.2,.7,.2,1)" },
          );
          animations.add(a);
          a.onfinish = a.oncancel = () => animations.delete(a);
        }),
      { threshold: 0.1 },
    );
    root
      .querySelectorAll(
        ".detail-hero-copy>*,.content-block>h2,.service-catalogue>article,.project-catalogue>article,.content-cards>article,.scope-options>article,.content-ending>*,.privacy-panel",
      )
      .forEach((el) => observer.observe(el));
    cards.forEach((card) =>
      scope.on(card, "pointermove", (e) => {
        if (still() || !fine.matches) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
        card.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
      }),
    );
    scope
      .observe(MutationObserver, sync)
      .observe(root, { attributes: true, attributeFilter: ["class"] });
    scope.on(reduced, "change", sync);
    scope.on(fine, "change", reset);
    scope.on(document, "visibilitychange", sync);
    scope.on(window, "resize", reset);
    draw();
    sync();
  })();
}
