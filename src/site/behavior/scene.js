import { createCloudBrain } from "./cloud-brain.mjs";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
export default function mount(scope) {
  gsap.registerPlugin(ScrollTrigger);
  const root = scope.root;
  if (root) start();

  function start() {
    // Route load/font measurements through the same scroll-aware refresh queue.
    // GSAP's default load refresh can otherwise cancel a native anchor journey.
    ScrollTrigger.config({ autoRefreshEvents: "visibilitychange,resize" });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const wide = matchMedia("(min-width: 901px) and (min-height: 760px)");
    const host = document.querySelector("#op-canvas");
    const hero = document.querySelector(".op-hero");
    const stage = document.querySelector(".op-work-stage");
    const controls = document.querySelector(".op-work-controls");
    const slides = [...document.querySelectorAll(".op-project")];
    const lastSlide = slides.length - 1;
    stage.style.setProperty("--project-count", slides.length);
    const state = { progress: 0 };
    let context,
      frame = 0,
      previous = 0,
      elapsed = 0,
      visible = true;
    let sculpture;
    const pointer = { x: 0, y: 0 };
    const still = () =>
      reduced.matches || root.classList.contains("motion-paused");

    function makeScene() {
      sculpture = createCloudBrain(host);
      setSceneTheme();
      host.parentElement.classList.add("rendered");
      root.dataset.scene = "svg";
      requestRender();
    }
    function render(time) {
      frame = 0;
      if (!sculpture || !visible || document.hidden) {
        previous = 0;
        return;
      }
      const delta = previous ? Math.min((time - previous) / 1000, 0.05) : 0;
      previous = time;
      if (!still()) elapsed += delta;
      sculpture.update(elapsed, state.progress, still(), pointer);
      if (!still()) frame = scope.frame(render);
    }
    function setSceneTheme() {
      const palette = getComputedStyle(root);
      sculpture?.setTheme(
        palette.getPropertyValue("--blue").trim(),
        palette.getPropertyValue("--electric").trim(),
      );
    }
    function requestRender() {
      if (!frame && sculpture && visible && !document.hidden)
        frame = scope.frame(render);
    }
    function resize() {
      requestRender();
    }

    const statement = document.querySelector(".op-statement");
    statement.replaceChildren(
      ...statement.textContent
        .trim()
        .split(" ")
        .flatMap((word, i) => {
          const span = document.createElement("span");
          span.textContent = word;
          return i ? [document.createTextNode(" "), span] : [span];
        }),
    );

    function setProject(index) {
      document.querySelector(".op-work-counter").textContent =
        `0${index + 1} / 0${slides.length}`;
      document
        .querySelectorAll("[data-work]")
        .forEach((button, i) =>
          button.setAttribute("aria-pressed", String(i === index)),
        );
    }
    function setup() {
      context?.revert();
      stage.classList.remove("is-horizontal");
      controls.hidden = true;
      state.progress = 0;
      if (still()) {
        requestRender();
        return;
      }
      context = gsap.context(() => {
        gsap.to(state, {
          progress: 1,
          ease: "none",
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom top",
            scrub: 0.7,
          },
          onUpdate: requestRender,
        });
        gsap.fromTo(
          ".op-statement>span",
          { opacity: 0.4 },
          {
            opacity: 1,
            stagger: 0.1,
            ease: "none",
            scrollTrigger: {
              trigger: statement,
              start: "top 85%",
              end: "top 40%",
              scrub: true,
            },
          },
        );
        gsap.to(".op-timeline", {
          "--progress": 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".op-timeline",
            start: "top 65%",
            end: "bottom 55%",
            scrub: true,
          },
        });
        gsap.to(".op-venture-steps li", {
          "--venture-step-progress": 1,
          stagger: 0.25,
          ease: "none",
          scrollTrigger: {
            trigger: ".op-venture-steps",
            start: "top 75%",
            end: "bottom 45%",
            scrub: true,
          },
        });
        gsap.to(".venture-orbit-inner", {
          rotation: 90,
          svgOrigin: "250 150",
          ease: "none",
          scrollTrigger: {
            trigger: ".op-venture-exchange",
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        });
        gsap.to(".op-system-ring", {
          rotation: 180,
          ease: "none",
          scrollTrigger: {
            trigger: ".op-about",
            start: "top 70%",
            end: "bottom top",
            scrub: 1,
          },
        });
        gsap.to(".op-system-ring b", {
          rotation: -180,
          ease: "none",
          scrollTrigger: {
            trigger: ".op-about",
            start: "top 70%",
            end: "bottom top",
            scrub: 1,
          },
        });
        gsap.utils.toArray(".op-section-heading h2").forEach((heading) => {
          gsap.from(heading, {
            y: 36,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: heading, start: "top 92%", once: true },
          });
        });
        gsap.utils.toArray(".op-service-art").forEach((art) => {
          // Animate a child so hover feedback can keep its own transform.
          gsap.fromTo(
            art.children[0],
            { y: 12 },
            {
              y: -12,
              ease: "none",
              scrollTrigger: {
                trigger: art,
                start: "top bottom",
                end: "bottom top",
                scrub: 1,
              },
            },
          );
        });
        if (wide.matches && lastSlide > 0) {
          stage.classList.add("is-horizontal");
          controls.hidden = false;
          gsap.to(".op-work-track", {
            xPercent: (-100 * lastSlide) / slides.length,
            ease: "none",
            scrollTrigger: {
              // Measure this spacer before triggers in the sections that follow Work.
              id: "onepage-work",
              refreshPriority: 1,
              trigger: stage,
              start: "top 110px",
              end: () => "+=" + innerWidth * 0.825 * lastSlide,
              pin: true,
              scrub: 0.65,
              invalidateOnRefresh: true,
              onUpdate: (trigger) =>
                setProject(Math.round(trigger.progress * lastSlide)),
            },
          });
        } else {
          gsap.utils.toArray(".op-project-visual").forEach((visual) => {
            const object = visual.querySelector(
              ".op-mock-phone,.op-commerce-window",
            );
            if (object)
              gsap.fromTo(
                object,
                { y: 18 },
                {
                  y: -12,
                  ease: "none",
                  scrollTrigger: {
                    trigger: visual,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 0.5,
                  },
                },
              );
          });
        }
      }, root);
      ScrollTrigger.refresh();
      requestRender();
    }
    function showProject(index) {
      const trigger = ScrollTrigger.getById("onepage-work");
      if (!trigger) return;
      window.scrollTo({
        top:
          trigger.start + ((trigger.end - trigger.start) * index) / lastSlide,
        behavior: "instant",
      });
      ScrollTrigger.update();
      trigger.getTween()?.progress(1);
      trigger.animation?.progress(index / lastSlide);
      // Native focus scrolling must not additionally offset the clipped track.
      stage.scrollLeft = 0;
      stage.querySelector(".op-work-track").scrollLeft = 0;
      setProject(index);
    }
    document
      .querySelectorAll("[data-work]")
      .forEach((button) =>
        scope.on(button, "click", () =>
          showProject(Number(button.dataset.work)),
        ),
      );
    scope.on(stage, "focusin", (event) => {
      const slide = event.target.closest(".op-project");
      if (slide) showProject(slides.indexOf(slide));
    });
    // Disclosure changes and asynchronous copy overrides can change document geometry.
    let refreshTimer,
      anchorFallback,
      anchorScrolling = false;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = undefined;
      if (!anchorScrolling)
        refreshTimer = scope.timer(() => {
          refreshTimer = undefined;
          ScrollTrigger.refresh();
        }, 180);
    };
    const finishAnchor = () => {
      if (!anchorScrolling) return;
      anchorScrolling = false;
      clearTimeout(anchorFallback);
      scheduleRefresh();
    };
    // A measurement refresh restores scroll position. Wait until native anchor scrolling
    // settles so the initial ResizeObserver notification cannot interrupt that journey.
    scope.on(
      window,
      "scroll",
      () => {
        if (refreshTimer !== undefined) scheduleRefresh();
      },
      { passive: true },
    );
    scope.on(document, "click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      // Wait for the browser's actual completion, including the gap before its first
      // scroll frame. A duration estimate can expire during a long anchor journey.
      anchorScrolling = true;
      clearTimeout(anchorFallback);
      // Same-position anchors and older browsers may not emit scrollend.
      anchorFallback = scope.timer(finishAnchor, 5000);
      scheduleRefresh();
    });
    scope.on(document, "scrollend", finishAnchor);
    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"])
      scope.on(window, type, finishAnchor, { passive: true });
    scope.on(window, "load", scheduleRefresh, { once: true });
    document.fonts.ready.then(scheduleRefresh);
    document
      .querySelectorAll("details")
      .forEach((detail) => scope.on(detail, "toggle", scheduleRefresh));
    scope
      .observe(ResizeObserver, scheduleRefresh)
      .observe(document.querySelector(".op-services"));
    scope
      .observe(ResizeObserver, scheduleRefresh)
      .observe(document.querySelector(".op-ventures"));
    scope
      .observe(ResizeObserver, scheduleRefresh)
      .observe(document.querySelector(".op-contact"));
    try {
      makeScene();
    } catch (error) {
      sculpture = null;
      host.replaceChildren();
      root.dataset.scene = "fallback";
      console.info("Static product core available:", error.message);
    }
    scope.observe(ResizeObserver, resize).observe(host);
    scope.on(window, "resize", resize, { passive: true });
    scope
      .observe(
        IntersectionObserver,
        (entries) => {
          visible = entries[0].isIntersecting;
          requestRender();
        },
        { rootMargin: "80px" },
      )
      .observe(host);
    scope.on(
      hero,
      "pointermove",
      (event) => {
        if (still() || event.pointerType === "touch") return;
        pointer.x = event.clientX / innerWidth - 0.5;
        pointer.y = event.clientY / innerHeight - 0.5;
      },
      { passive: true },
    );
    scope.on(hero, "pointerleave", () => {
      pointer.x = 0;
      pointer.y = 0;
    });
    scope
      .observe(MutationObserver, (changes) => {
        if (changes.some((c) => c.attributeName === "class")) setup();
        if (changes.some((c) => c.attributeName === "data-theme")) {
          setSceneTheme();
          requestRender();
        }
      })
      .observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
    scope.on(reduced, "change", setup);
    scope.on(wide, "change", setup);
    scope.on(document, "visibilitychange", () => {
      previous = 0;
      requestRender();
    });
    scope.on(window, "pagehide", () => {
      cancelAnimationFrame(frame);
      frame = 0;
    });
    scope.on(window, "pageshow", requestRender);
    setup();
    scope.dispose(() => context?.revert());
  }
}
