"use client";
import { useRef, useState } from "react";
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

export default function WorkConcepts() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<keyof typeof projects>("commerce");
  function open(project: keyof typeof projects) {
    setSelected(project);
    dialog.current?.showModal();
  }
  const project = projects[selected];
  const sections =
    selected === "commerce"
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
  return (
    <>
      <div className={"work-concepts"}>
        <button
          className={"work-concept"}
          data-project="commerce"
          onClick={() => open("commerce")}
          aria-haspopup={"dialog"}
        >
          <span className={"work-concept-art work-concept-commerce"}>
            <span className={"eyebrow"}>INTERFACE CONCEPT</span>
            <p className={"work-concept-brand"}>olive &amp; co.</p>
            <h3>
              Your lunch.
              <br />
              Made lovely.
            </h3>
            <div className={"work-mini"}>
              <small>FRESH THINKING. GOOD FOOD.</small>
              <strong>Explore the menu ↗</strong>
              <i />
            </div>
          </span>
          <span className={"work-concept-title"} data-copy={"work-v2-commerce"}>
            A better way to order
          </span>
          <span className={"work-concept-category"}>
            Design exploration · Restaurant commerce
          </span>
        </button>
        <button
          className={"work-concept"}
          data-project="mobile"
          onClick={() => open("mobile")}
          aria-haspopup={"dialog"}
        >
          <span className={"work-concept-art work-concept-mobile"}>
            <span className={"eyebrow"}>INTERFACE CONCEPT</span>
            <p className={"work-concept-brand"}>YOUR EVERYDAY, REIMAGINED</p>
            <h3>
              Make room
              <br />
              for better.
            </h3>
            <div className={"work-mini"}>
              <small>Your progress</small>
              <strong>One step closer.</strong>
              <i />
            </div>
          </span>
          <span className={"work-concept-title"} data-copy={"work-v2-mobile"}>
            Everyday, elevated
          </span>
          <span className={"work-concept-category"}>
            Design exploration · Mobile experience
          </span>
        </button>
      </div>

      <dialog
        ref={dialog}
        id="project-dialog"
        aria-labelledby="project-title"
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            event.currentTarget.close();
        }}
      >
        <button
          className="close"
          aria-label="Close project"
          onClick={() => dialog.current?.close()}
        >
          ✕
        </button>
        <div id="project-detail">
          <div className="eyebrow">{project.type}</div>
          <h2 id="project-title">{project.title}</h2>
          <p>{project.intro}</p>
          <ul>
            {project.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p>{project.scope}</p>
          {sections.map(([heading, copy]) => (
            <section className="case-section" key={heading}>
              <h3>{heading}</h3>
              <p>{copy}</p>
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}
