export default function mount(scope) {
  // A local pointer response behind the hero; the sculpture and content stay separate.
  (() => {
    const hero = document.querySelector(".op-hero");
    const grid = hero?.querySelector(".op-grid");
    if (!grid) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-width", "1");
    svg.append(path);
    grid.append(svg);
    grid.classList.add("grid-ready");
    let width = 0,
      height = 0,
      frame = 0,
      visible = true;
    const target = { x: 0, y: 0, strength: 0 };
    const current = { x: 0, y: 0, strength: 0 };
    const enabled = () =>
      !reduced.matches &&
      fine.matches &&
      !scope.root.classList.contains("motion-paused") &&
      visible &&
      !document.hidden;
    function draw() {
      const step = width <= 600 ? 64 : 80;
      const point = (x, y) => {
        const dx = current.x - x,
          dy = current.y - y;
        const distance = Math.hypot(dx, dy);
        const pull =
          Math.max(0, 1 - distance / 220) ** 2 * current.strength * 0.16;
        return `${(x + dx * pull).toFixed(2)},${(y + dy * pull).toFixed(2)}`;
      };
      let d = "";
      for (let x = 0; x <= width + step; x += step) {
        for (let y = 0; y <= height + step; y += step)
          d += `${y ? "L" : "M"}${point(x, y)}`;
      }
      for (let y = 0; y <= height + step; y += step) {
        for (let x = 0; x <= width + step; x += step)
          d += `${x ? "L" : "M"}${point(x, y)}`;
      }
      path.setAttribute("d", d);
      grid.style.setProperty("--grid-x", `${current.x}px`);
      grid.style.setProperty("--grid-y", `${current.y}px`);
      grid.style.setProperty("--grid-active", current.strength.toFixed(3));
    }
    function tick() {
      frame = 0;
      if (!enabled()) {
        reset();
        return;
      }
      for (const key of ["x", "y", "strength"])
        current[key] += (target[key] - current[key]) * 0.18;
      draw();
      if (
        Math.abs(target.x - current.x) +
          Math.abs(target.y - current.y) +
          Math.abs(target.strength - current.strength) * 100 >
        0.1
      )
        frame = scope.frame(tick);
    }
    function request() {
      if (!frame) frame = scope.frame(tick);
    }
    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      target.strength = current.strength = 0;
      draw();
    }
    function resize() {
      width = hero.clientWidth;
      height = hero.clientHeight;
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      reset();
    }
    scope.on(
      hero,
      "pointermove",
      (event) => {
        if (!enabled() || event.pointerType === "touch") return;
        const rect = hero.getBoundingClientRect();
        target.x = event.clientX - rect.left;
        target.y = event.clientY - rect.top;
        target.strength = 1;
        request();
      },
      { passive: true },
    );
    scope.on(hero, "pointerleave", () => {
      target.strength = 0;
      request();
    });
    scope.observe(ResizeObserver, resize).observe(hero);
    scope
      .observe(IntersectionObserver, (entries) => {
        visible = entries[0].isIntersecting;
        if (!visible) reset();
      })
      .observe(hero);
    scope
      .observe(MutationObserver, () => {
        if (!enabled()) reset();
      })
      .observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
      });
    scope
      .observe(MutationObserver, () => {
        if (!enabled()) reset();
      })
      .observe(scope.root, { attributes: true, attributeFilter: ["class"] });
    scope.on(reduced, "change", reset);
    scope.on(fine, "change", reset);
    scope.on(document, "visibilitychange", reset);
    scope.on(window, "pagehide", reset);
    resize();
  })();
}
