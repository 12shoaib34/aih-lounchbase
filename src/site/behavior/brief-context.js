export default function mount(scope) {
  // Shared selection contract for enquiry submission.
  // Only enabled, published options may contribute context. Unconfirmed packages have no selector.
  (() => {
    const form = document.querySelector("#brief");
    if (!form) return;
    const controls = [
      ["serviceArea", "Service area"],
      ["projectType", "Project type"],
    ];
    const selected = () =>
      controls.flatMap(([name, label]) => {
        const field = form.elements[name];
        const option = field?.selectedOptions[0];
        return field && !field.disabled && option?.value
          ? [label + ": " + option.textContent.trim()]
          : [];
      });
    window.BriefContext = {
      message() {
        const text = form.elements.message.value.trim(),
          context = selected();
        return (
          text +
          (context.length ? "\n\nSelected context:\n" + context.join("\n") : "")
        );
      },
    };
    const params = new URLSearchParams(location.search);
    const summary = document.querySelector("#selected-context");
    function update() {
      const context = selected();
      summary.textContent = context.length
        ? "Your selected context: " +
          context.join(" · ") +
          ". Edit these choices in optional project details."
        : "";
      summary.hidden = !context.length;
    }
    for (const [name] of controls) {
      const field = form.elements[name];
      field.disabled = false;
      const value = params.get(name);
      if (
        value &&
        Array.from(field.options).some((option) => option.value === value)
      ) {
        field.value = value;
      }
      scope.on(field, "change", update);
    }
    update();
  })();
}
