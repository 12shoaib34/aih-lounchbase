export default function mount(scope) {
  // Normalize project and venture validation before enquiry submission.
  const briefForm = document.querySelector("#brief");
  const briefMessage = briefForm.elements.message;
  function validateBriefText() {
    briefMessage.setCustomValidity(
      briefMessage.value.trim().length < 10
        ? "Please describe your project in at least 10 characters."
        : (window.BriefContext?.message().length ||
              briefMessage.value.trim().length) > 5000
          ? "Your message and selected context must fit within 5000 characters. Shorten the message or clear an optional selection."
          : "",
    );
    briefForm.elements.name.setCustomValidity(
      briefForm.elements.name.value.trim() ? "" : "Please enter your name.",
    );
    const venture = briefForm.elements.service.value.startsWith(
      "Venture partnership",
    );
    for (const field of briefForm.querySelectorAll("#venture-fields textarea"))
      field.setCustomValidity(
        venture && !field.value.trim()
          ? "Please answer this venture question."
          : "",
      );
  }
  scope.on(briefForm, "input", validateBriefText);
  scope.on(briefForm, "submit", (e) => {
    validateBriefText();
    if (!briefForm.reportValidity()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  });

  document.querySelectorAll("[data-engagement]").forEach((link) =>
    scope.on(link, "click", () => {
      document.querySelector('select[name="service"]').value =
        link.dataset.engagement;
      document
        .querySelector('select[name="service"]')
        .dispatchEvent(new Event("change"));
    }),
  );

  const serviceSelect = document.querySelector('select[name="service"]');
  scope.on(serviceSelect, "change", () => {
    const venture = serviceSelect.value.startsWith("Venture partnership");
    document.querySelector("#venture-fields").hidden = !venture;
    document
      .querySelectorAll(
        "#venture-fields textarea, #venture-fields input, #venture-fields select",
      )
      .forEach((el) => {
        el.required = venture;
        el.disabled = !venture;
      });
  });
  serviceSelect.dispatchEvent(new Event("change"));

  document.querySelectorAll("[data-solution]").forEach((link) =>
    scope.on(link, "click", () => {
      document.querySelector('select[name="solution"]').value =
        link.dataset.solution;
      document.querySelector('select[name="service"]').value =
        "Build a product";
      document
        .querySelector('select[name="service"]')
        .dispatchEvent(new Event("change"));
    }),
  );

  if (
    new URLSearchParams(window.location.search).get("engagement") === "venture"
  ) {
    serviceSelect.value = "Venture partnership — development for equity";
    serviceSelect.dispatchEvent(new Event("change"));
  }

  const params = new URLSearchParams(location.search);
  const requested = params.get("service");
  const previousAreas = new Map([
    ["Mobile app", "mobile"],
    ["Website or web application", "web"],
    ["MVP / prototype", "scoping"],
  ]);
  const previousArea = previousAreas.get(requested);
  if (previousArea && !params.has("serviceArea")) {
    const area = briefForm.elements.serviceArea;
    area.value = previousArea;
    area.dispatchEvent(new Event("change"));
  }
  const supportArrangement = briefForm.elements.supportArrangement;
  const hourlyOrWeekly =
    !!requested &&
    Array.from(supportArrangement.options).some(
      (option) => option.value === requested,
    );
  if (hourlyOrWeekly) supportArrangement.value = requested;
  if (
    hourlyOrWeekly ||
    params.get("engagement") === "team" ||
    params.get("serviceArea") === "support"
  ) {
    serviceSelect.value = "Engineering support";
  } else if (
    requested &&
    Array.from(serviceSelect.options).some(
      (option) => option.value === requested,
    )
  ) {
    serviceSelect.value = requested;
  } else if (!requested && params.get("serviceArea") === "improvement") {
    serviceSelect.value = "Improve an existing product";
  }
  serviceSelect.dispatchEvent(new Event("change"));
  const solutionSelect = briefForm.elements.solution;
  if (
    Array.from(solutionSelect.options).some(
      (option) => option.value === params.get("solution"),
    )
  ) {
    solutionSelect.value = params.get("solution");
  }

  function updateProjectQuestion() {
    const question = document.querySelector("#message-question");
    const message = briefForm.elements.message;
    const service = serviceSelect.value;
    const needsSupport = service === "Engineering support";
    supportArrangement.disabled = !needsSupport;
    document.getElementById("support-arrangement").hidden = !needsSupport;
    if (service.startsWith("Venture partnership")) {
      question.textContent = "What customer problem are you working on?";
      message.placeholder =
        "Who has this problem, and how do they handle it today?";
    } else if (service === "Engineering support") {
      question.textContent =
        "What engineering skills and weekly capacity do you need?";
      message.placeholder =
        "For example, React Native support for an upcoming Android release.";
    } else if (service === "Improve an existing product") {
      question.textContent = "What needs to change in your current product?";
      message.placeholder =
        "Tell us what already works and where people get stuck.";
    } else {
      question.textContent =
        "Who will use the software, and what should it help them do?";
      message.placeholder =
        "For example, our tutors need students to book lessons online.";
    }
  }
  scope.on(serviceSelect, "change", updateProjectQuestion);
  updateProjectQuestion();

  // Keep incoming optional choices visible.
  if (
    params.has("solution") &&
    Array.from(solutionSelect.options).some(
      (o) => o.value === params.get("solution"),
    )
  )
    document.querySelector(".brief-optional").open = true;

  scope.on(briefForm, "change", validateBriefText);
}
