export default function mount(scope) {
  // Navigation and enquiry choices work independently of the graphics bundle.
  (() => {
    if (!scope.root.classList.contains("onepage")) return;
    const links = [
      ...document.querySelectorAll('#main-navigation a[href^="#"]'),
    ];
    const sections = links.map((a) => document.querySelector(a.hash));
    let queued = false;
    const update = () => {
      queued = false;
      let current = -1;
      sections.forEach((section, i) => {
        if (section.getBoundingClientRect().top <= innerHeight * 0.38)
          current = i;
      });
      links.forEach((a, i) => {
        if (i === current) a.setAttribute("aria-current", "location");
        else a.removeAttribute("aria-current");
      });
    };
    const schedule = () => {
      if (!queued) {
        queued = true;
        scope.frame(update);
      }
    };
    scope.on(window, "scroll", schedule, { passive: true });
    scope.on(window, "resize", schedule);
    update();

    // Move light and illustration depth, leaving the disclosure's hit area stationary.
    const serviceCards = [...document.querySelectorAll(".op-service")];
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let activeCard,
      lightFrame = 0,
      pointerX = 0,
      pointerY = 0;
    const canLight = () =>
      finePointer.matches &&
      !reducedMotion.matches &&
      !scope.root.classList.contains("motion-paused");
    const resetLight = () => {
      cancelAnimationFrame(lightFrame);
      lightFrame = 0;
      if (!activeCard) return;
      activeCard.classList.remove("is-service-pointed");
      for (const name of [
        "--service-x",
        "--service-y",
        "--service-rx",
        "--service-ry",
      ])
        activeCard.style.removeProperty(name);
      activeCard = undefined;
    };
    const paintLight = () => {
      lightFrame = 0;
      if (!activeCard || !canLight()) {
        resetLight();
        return;
      }
      const bounds = activeCard.getBoundingClientRect();
      if (
        pointerX < bounds.left ||
        pointerX > bounds.right ||
        pointerY < bounds.top ||
        pointerY > bounds.bottom
      ) {
        resetLight();
        return;
      }
      const x = Math.max(
        0,
        Math.min(1, (pointerX - bounds.left) / bounds.width),
      );
      const y = Math.max(
        0,
        Math.min(1, (pointerY - bounds.top) / bounds.height),
      );
      activeCard.style.setProperty("--service-x", `${x * 100}%`);
      activeCard.style.setProperty("--service-y", `${y * 100}%`);
      activeCard.style.setProperty("--service-rx", `${(0.5 - y) * 10}deg`);
      activeCard.style.setProperty("--service-ry", `${(x - 0.5) * 12}deg`);
    };
    const queueLight = () => {
      if (activeCard && !lightFrame) lightFrame = scope.frame(paintLight);
    };
    serviceCards.forEach((card) => {
      scope.on(
        card,
        "pointermove",
        (event) => {
          if (event.pointerType === "touch" || !canLight()) return;
          if (activeCard !== card) {
            resetLight();
            activeCard = card;
            card.classList.add("is-service-pointed");
          }
          pointerX = event.clientX;
          pointerY = event.clientY;
          queueLight();
        },
        { passive: true },
      );
      scope.on(card, "pointerleave", () => {
        if (activeCard === card) resetLight();
      });
      scope.on(card, "pointercancel", resetLight);
      scope.on(card, "toggle", queueLight);
    });
    scope.on(window, "scroll", queueLight, { passive: true });
    scope.on(window, "resize", resetLight);
    scope.on(window, "blur", resetLight);
    scope.on(document, "keydown", resetLight);
    scope.on(document, "visibilitychange", () => {
      if (document.hidden) resetLight();
    });
    scope.on(finePointer, "change", resetLight);
    scope.on(reducedMotion, "change", resetLight);
    scope
      .observe(MutationObserver, () => {
        if (!canLight()) resetLight();
      })
      .observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });

    const pricingAnimations = new Map();
    const finishPricing = (details, open) => {
      const running = pricingAnimations.get(details);
      pricingAnimations.delete(details);
      if (running) {
        running.animation.onfinish = null;
        running.animation.cancel();
      }
      details.open = open;
      details.classList.remove("is-animating", "is-opening");
      details.querySelector(".pricing-panel").inert = false;
      details.style.removeProperty("height");
      dispatchEvent(new Event("resize"));
    };
    const settlePricing = () => {
      for (const [details, running] of pricingAnimations)
        finishPricing(details, running.open);
    };
    document.querySelectorAll(".pricing-service").forEach((details) => {
      const summary = details.querySelector("summary");
      const panel = details.querySelector(".pricing-panel");
      scope.on(summary, "click", (event) => {
        if (
          reducedMotion.matches ||
          scope.root.classList.contains("motion-paused") ||
          !details.animate
        )
          return;
        event.preventDefault();
        const previous = pricingAnimations.get(details);
        const open = !(previous ? previous.open : details.open);
        const from = details.getBoundingClientRect().height;
        if (previous) {
          previous.animation.onfinish = null;
          previous.animation.cancel();
        }
        details.open = true;
        const to = open
          ? details.getBoundingClientRect().height
          : summary.getBoundingClientRect().height + 1;
        panel.inert = !open;
        details.classList.add("is-animating");
        details.classList.toggle("is-opening", open);
        const animation = details.animate(
          [{ height: `${from}px` }, { height: `${to}px` }],
          {
            duration: open ? 440 : 300,
            easing: "cubic-bezier(.22,1,.36,1)",
          },
        );
        pricingAnimations.set(details, { animation, open });
        animation.onfinish = () => finishPricing(details, open);
      });
    });
    scope.on(reducedMotion, "change", settlePricing);
    scope.on(window, "resize", () => {
      if (pricingAnimations.size) settlePricing();
    });
    scope
      .observe(MutationObserver, () => {
        if (scope.root.classList.contains("motion-paused")) settlePricing();
      })
      .observe(scope.root, { attributes: true, attributeFilter: ["class"] });

    const form = document.getElementById("brief");
    document
      .querySelectorAll("[data-inquiry-service],[data-inquiry-venture]")
      .forEach((link) => {
        scope.on(link, "click", () => {
          if (form.dataset.submissionLocked) return;
          const select = form.elements.service;
          select.value = link.hasAttribute("data-inquiry-venture")
            ? [...select.options].find((option) =>
                option.value.startsWith("Venture partnership"),
              ).value
            : link.dataset.inquiryService;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          // Replace previous contextual choices rather than carrying an unrelated selection.
          form.elements.serviceArea.value = link.dataset.area || "";
          form.elements.projectType.value = link.dataset.projectType || "";
          form.elements.serviceArea.dispatchEvent(
            new Event("change", { bubbles: true }),
          );
          form.elements.projectType.dispatchEvent(
            new Event("change", { bubbles: true }),
          );
          // The selection summary shows the context without expanding the optional fields.
          if (link.dataset.pricingContext) {
            const message = form.elements.message;
            const existing = message.value.replace(
              /^Pricing enquiry: [^\n]*\n?/,
              "",
            );
            const prefix = `Pricing enquiry: ${link.dataset.pricingContext}\n`;
            message.value = prefix + existing;
            message.dispatchEvent(new Event("input", { bubbles: true }));
            if (!message.validity.valid) message.reportValidity();
          } else if (
            form.elements.message.value.startsWith("Pricing enquiry: ")
          ) {
            form.elements.message.value = form.elements.message.value.replace(
              /^Pricing enquiry: [^\n]*\n?/,
              "",
            );
            form.elements.message.dispatchEvent(
              new Event("input", { bubbles: true }),
            );
          }
        });
      });
  })();
}
