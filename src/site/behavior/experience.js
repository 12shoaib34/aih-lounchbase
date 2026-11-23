export default function mount(scope) {
  (() => {
    const init = () => {
      const root = scope.root;
      if (!root || root.dataset.experience) return;
      root.dataset.experience = "ready";
      scope.dispose(() => {
        delete root.dataset.experience;
        root.classList.remove("cursor-ready");
        document.documentElement.classList.remove("aih-motion-paused");
      });
      if (!document.documentElement.dataset.theme) {
        let saved;
        try {
          saved = localStorage.getItem("aih-theme");
        } catch {}
        document.documentElement.dataset.theme =
          saved === "light" || saved === "dark"
            ? saved
            : matchMedia("(prefers-color-scheme: light)").matches
              ? "light"
              : "dark";
      }
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      const fine = matchMedia("(hover: hover) and (pointer: fine)");
      let paused = false;
      try {
        paused = localStorage.getItem("aih-motion") === "paused";
      } catch {}
      const still = () => reduced.matches || paused;
      let resetPointer = () => {};
      const motion = document.createElement("button");
      motion.className = "motion-toggle";
      motion.type = "button";
      root.append(motion);
      const syncMotion = () => {
        root.classList.toggle("motion-paused", still());
        document.documentElement.classList.toggle("aih-motion-paused", still());
        motion.textContent = still() ? "Motion: off" : "Motion: on";
        motion.title = reduced.matches
          ? "Motion disabled by system preference"
          : paused
            ? "Enable animation"
            : "Pause animation";
        motion.setAttribute("aria-pressed", String(!still()));
        motion.disabled = reduced.matches;
        if (still())
          root.getAnimations({ subtree: true }).forEach((a) => a.cancel());
        if (still()) resetPointer();
      };
      scope.on(motion, "click", () => {
        paused = !paused;
        try {
          localStorage.setItem("aih-motion", paused ? "paused" : "on");
        } catch {}
        syncMotion();
      });
      scope.on(reduced, "change", syncMotion);

      const meter = document.createElement("div");
      meter.className = "scroll-meter";
      meter.setAttribute("aria-hidden", "true");
      root.append(meter);
      let scrollQueued = false;
      const updateScroll = () => {
        scrollQueued = false;
        meter.style.transform = `scaleX(${scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)})`;
        const journey = root.querySelector(".home-flow");
        if (journey) {
          const progress = Math.max(
            0,
            Math.min(
              0.999,
              (innerHeight - journey.getBoundingClientRect().top) /
                (innerHeight + journey.clientHeight),
            ),
          );
          journey
            .querySelectorAll("li")
            .forEach((li, i) =>
              li.classList.toggle(
                "journey-active",
                i === Math.floor(progress * 3),
              ),
            );
        }
      };
      scope.on(
        window,
        "scroll",
        () => {
          if (!scrollQueued) {
            scrollQueued = true;
            scope.frame(updateScroll);
          }
        },
        { passive: true },
      );
      scope.on(window, "resize", updateScroll);
      updateScroll();

      // The point is exact; the frame follows with a damped spring. The native
      // cursor is hidden only while this fine-pointer enhancement is active.
      const dot = document.createElement("div");
      dot.className = "cursor-dot";
      const halo = document.createElement("div");
      halo.className = "cursor-halo";
      const glyph = document.createElement("span");
      glyph.className = "cursor-glyph";
      const label = document.createElement("span");
      label.className = "cursor-label";
      halo.append(glyph, label);
      for (const element of [dot, halo]) {
        element.setAttribute("aria-hidden", "true");
        root.append(element);
      }
      const cursorMedia = matchMedia(
        "(min-width: 768px) and (hover: hover) and (pointer: fine)",
      );
      const point = { x: 0, y: 0 };
      const current = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        width: 30,
        height: 30,
        radius: 15,
      };
      let target = null,
        state = "default",
        frame = 0,
        previousTime = 0;
      let visible = false,
        pressed = false,
        selecting = false,
        needsHitTest = false;
      const eligible = () =>
        cursorMedia.matches && !still() && !document.hidden;
      const queuePointer = () => {
        if (!frame && visible) frame = scope.frame(drawPointer);
      };
      const clearTarget = () => {
        target?.classList.remove("cursor-target");
        target = null;
      };
      resetPointer = () => {
        visible = false;
        pressed = false;
        previousTime = 0;
        cancelAnimationFrame(frame);
        frame = 0;
        root.classList.remove("cursor-ready");
        clearTarget();
        dot.style.opacity = "0";
        halo.style.opacity = "0";
      };
      const resolvePointer = (element) => {
        if (
          !element ||
          !root.contains(element) ||
          !eligible() ||
          selecting ||
          element.closest(
            'input,textarea,select,iframe,dialog[open],[contenteditable]:not([contenteditable="false"]),[disabled],[aria-disabled="true"]',
          )
        ) {
          resetPointer();
          return;
        }
        const interactive = element.closest('a,button,summary,[role="button"]');
        let next = "default";
        if (interactive) {
          const bounds = interactive.getBoundingClientRect();
          if (interactive.tagName === "SUMMARY")
            next = interactive.closest("details")?.open ? "collapse" : "expand";
          else if (interactive.matches(".project,[data-project]"))
            next = "view";
          else if (bounds.width <= 380 && bounds.height <= 100)
            next = interactive.closest("header") ? "nav" : "action";
          else next = "link";
        } else if (
          element.closest(".op-work-stage.is-horizontal .op-project-visual")
        )
          next = "gallery";
        else if (element.closest("h1,h2,h3,p,li,figcaption,blockquote"))
          next = element.closest("h1,h2,h3") ? "heading" : "text";
        if (target !== interactive) {
          clearTarget();
          target = interactive;
          target?.classList.add("cursor-target");
        }
        if (state !== next || !visible) {
          state = next;
          dot.dataset.state = next;
          halo.dataset.state = next;
          glyph.textContent =
            next === "gallery"
              ? "\u2194"
              : next === "view" || next === "link"
                ? "\u2197"
                : "";
          label.textContent =
            next === "gallery" ? "SCROLL" : next === "view" ? "VIEW" : "";
        }
        if (!visible) {
          current.x = point.x;
          current.y = point.y;
          current.vx = 0;
          current.vy = 0;
          visible = true;
          root.classList.add("cursor-ready");
        }
        queuePointer();
      };
      function drawPointer(time) {
        frame = 0;
        if (!eligible() || !visible) {
          resetPointer();
          return;
        }
        if (needsHitTest) {
          needsHitTest = false;
          resolvePointer(document.elementFromPoint(point.x, point.y));
          if (!visible) return;
        }
        const dt = previousTime
          ? Math.min((time - previousTime) / 1000, 0.12)
          : 1 / 60;
        previousTime = time;
        let x = point.x,
          y = point.y,
          width = 30,
          height = 30,
          radius = 15;
        if ((state === "nav" || state === "action") && target?.isConnected) {
          const bounds = target.getBoundingClientRect();
          // A small pull inside the target gives magnetic feedback without moving
          // the real hit area or covering its label with a filled circle.
          x =
            bounds.left +
            bounds.width / 2 +
            (point.x - bounds.left - bounds.width / 2) * 0.08;
          y =
            bounds.top +
            bounds.height / 2 +
            (point.y - bounds.top - bounds.height / 2) * 0.12;
          width = bounds.width + 10;
          height = bounds.height + 10;
          radius = Math.min(
            height / 2,
            Math.max(
              9,
              parseFloat(getComputedStyle(target).borderTopLeftRadius) + 5 || 9,
            ),
          );
        } else if (state === "expand" || state === "collapse") {
          width = height = 38;
          radius = 19;
        } else if (state === "heading" || state === "text") {
          width = 12;
          height = state === "heading" ? 34 : 24;
          radius = 6;
        } else if (state === "gallery" || state === "view") {
          width = height = 68;
          radius = 34;
        } else if (state === "link") {
          width = height = 42;
          radius = 21;
        }
        // Small integration steps keep the spring stable across refresh rates.
        const steps = Math.ceil(dt / (1 / 120)),
          step = dt / steps;
        for (let i = 0; i < steps; i++) {
          current.vx += ((x - current.x) * 520 - current.vx * 42) * step;
          current.vy += ((y - current.y) * 520 - current.vy * 42) * step;
          current.x += current.vx * step;
          current.y += current.vy * step;
        }
        const blend = 1 - Math.exp(-dt * 20);
        for (const [key, value] of Object.entries({ width, height, radius }))
          current[key] += (value - current[key]) * blend;
        const shrink = pressed ? 0.91 : 1;
        halo.style.width = `${current.width}px`;
        halo.style.height = `${current.height}px`;
        halo.style.borderRadius = `${current.radius}px`;
        halo.style.transform = `translate3d(${current.x}px,${current.y}px,0) translate(-50%,-50%) scale(${shrink})`;
        dot.style.transform = `translate3d(${point.x}px,${point.y}px,0) translate(-50%,-50%) scale(${pressed ? 0.65 : 1})`;
        dot.style.opacity = "1";
        halo.style.opacity =
          state === "text" || state === "heading" ? "0" : "1";
        const moving =
          Math.abs(x - current.x) +
            Math.abs(y - current.y) +
            Math.abs(current.vx) +
            Math.abs(current.vy) >
          0.12;
        const morphing =
          Math.abs(width - current.width) +
            Math.abs(height - current.height) +
            Math.abs(radius - current.radius) >
          0.12;
        if (moving || morphing) queuePointer();
        else previousTime = 0;
      }
      const movePointer = (event) => {
        point.x = event.clientX;
        point.y = event.clientY;
        if (event.pointerType === "touch") {
          resetPointer();
          return;
        }
        resolvePointer(event.target);
      };
      scope.on(root, "pointermove", movePointer, { passive: true });
      scope.on(
        root,
        "pointerover",
        (event) => {
          if (visible) movePointer(event);
        },
        { passive: true },
      );
      scope.on(
        root,
        "pointerdown",
        (event) => {
          if (!visible) return;
          if (state === "text" || state === "heading") {
            selecting = true;
            resetPointer();
            return;
          }
          pressed = event.button === 0;
          queuePointer();
        },
        { passive: true },
      );
      scope.on(
        window,
        "pointerup",
        () => {
          pressed = false;
          selecting = false;
          if (visible) {
            needsHitTest = true;
            queuePointer();
          }
        },
        { passive: true },
      );
      scope.on(
        window,
        "pointercancel",
        () => {
          selecting = false;
          resetPointer();
        },
        { passive: true },
      );
      scope.on(
        root,
        "toggle",
        () => {
          if (visible) {
            needsHitTest = true;
            queuePointer();
          }
        },
        true,
      );
      const refreshPointer = () => {
        if (visible) {
          needsHitTest = true;
          queuePointer();
        }
      };
      scope.on(window, "scroll", refreshPointer, { passive: true });
      scope.on(window, "resize", refreshPointer, { passive: true });
      scope.on(root, "pointerleave", resetPointer);
      scope.on(root, "contextmenu", resetPointer);
      scope.on(root, "dragstart", resetPointer);
      scope.on(window, "blur", () => {
        selecting = false;
        resetPointer();
      });
      scope.on(window, "pagehide", resetPointer);
      scope.on(document, "visibilitychange", resetPointer);
      scope.on(document, "keydown", resetPointer);
      scope.on(cursorMedia, "change", resetPointer);
      root
        .querySelectorAll(
          ".home-cards>article,.content-cards>article,.service-catalogue>article,.project-catalogue>article,.scope-options>article",
        )
        .forEach((card) => {
          scope.on(card, "pointermove", (event) => {
            if (still() || !fine.matches) return;
            const bounds = card.getBoundingClientRect();
            card.style.setProperty(
              "--spot-x",
              `${event.clientX - bounds.left}px`,
            );
            card.style.setProperty(
              "--spot-y",
              `${event.clientY - bounds.top}px`,
            );
          });
        });
      const observer = scope.observe(
        IntersectionObserver,
        (entries) =>
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            if (still()) return;
            entry.target.animate(
              [
                { opacity: 0.25, transform: "translateY(36px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              { duration: 850, easing: "cubic-bezier(.16,1,.3,1)" },
            );
          }),
        { threshold: 0.12 },
      );
      root
        .querySelectorAll(
          ".home-heading,.content-heading,.home-feature,.home-cards>article,.content-cards>article,.service-catalogue>article,.scope-options>article,.content-opening h1,.home-ending h2",
        )
        .forEach((el) => observer.observe(el));

      scope.dispose(() =>
        [motion, meter, dot, halo].forEach((el) => el.remove()),
      );
      syncMotion();
    };
    if (document.readyState === "loading")
      scope.on(document, "DOMContentLoaded", init, { once: true });
    else init();
  })();
}
