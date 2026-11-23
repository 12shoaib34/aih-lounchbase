export default function mount(scope) {
  const projects = {
    commerce: {
      title: "A better way to order",
      type: "ILLUSTRATIVE COMMERCE CONCEPT",
      intro:
        "A restaurant ordering experience that makes the menu the hero and the next step clear.",
      points: [
        "A focused menu with clear item options and pricing.",
        "A simple journey from selection to checkout.",
        "An operational view for preparing and managing orders.",
      ],
      scope:
        "Discovery, responsive interface design, ordering flows, and integration planning. This is a visual concept, not a completed client project.",
    },
    mobile: {
      title: "Everyday, elevated",
      type: "ILLUSTRATIVE MOBILE CONCEPT",
      intro:
        "A calm, purposeful mobile interface that puts the next useful action within reach.",
      points: [
        "Clear onboarding and an intuitive home screen.",
        "Readable progress and approachable activity summaries.",
        "Careful handling of loading, empty, and error states.",
      ],
      scope:
        "Product scoping, mobile interface design, Android development, and API integration planning. This is a visual concept, not a completed client project.",
    },
  };
  const dialog = document.querySelector("#project-dialog");
  document.querySelectorAll("[data-project]").forEach((b) =>
    scope.on(b, "click", () => {
      const p = projects[b.dataset.project],
        el = document.querySelector("#project-detail");
      el.replaceChildren();
      const eye = document.createElement("div");
      eye.className = "eyebrow";
      eye.textContent = p.type;
      const title = document.createElement("h2");
      title.id = "project-title";
      title.textContent = p.title;
      const intro = document.createElement("p");
      intro.textContent = p.intro;
      const ul = document.createElement("ul");
      p.points.forEach((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        ul.append(li);
      });
      const scope = document.createElement("p");
      scope.textContent = p.scope;
      el.append(eye, title, intro, ul, scope);
      const sections =
        b.dataset.project === "commerce"
          ? [
              [
                "Design focus",
                "Make menu discovery and the path to ordering easy to understand.",
              ],
              [
                "What this preview demonstrates",
                "A visual direction for a restaurant storefront. The ordering and operational flows described here are proposed capabilities, not implemented features in this preview.",
              ],
              [
                "Evidence status",
                "Illustrative concept only. No client engagement, launch, adoption, or commercial results are claimed.",
              ],
            ]
          : [
              [
                "Design focus",
                "Give a mobile home screen a clear hierarchy and an obvious next action.",
              ],
              [
                "What this preview demonstrates",
                "A visual direction for progress, discovery, and activity. The screen is illustrative and is not connected to an application backend.",
              ],
              [
                "Evidence status",
                "Illustrative concept only. No client engagement, launch, adoption, or commercial results are claimed.",
              ],
            ];
      sections.forEach(([heading, copy]) => {
        const section = document.createElement("section");
        section.className = "case-section";
        const headingEl = document.createElement("h3");
        headingEl.textContent = heading;
        const paragraph = document.createElement("p");
        paragraph.textContent = copy;
        section.append(headingEl, paragraph);
        el.append(section);
      });
      dialog.showModal();
    }),
  );
  document.querySelectorAll("dialog").forEach((d) => {
    scope.on(d.querySelector(".close"), "click", () => d.close());
    scope.on(d, "click", (e) => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          d.close();
      }
    });
  });
}
