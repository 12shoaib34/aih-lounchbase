import {
  cloudPaths,
  cloudTerminals,
  terminalRadius,
  cloudPathData,
} from "./cloud-brain-shape.mjs";

// Inline vectors remain sharp through browser zoom. Projected tilt moves the SVG
// as a whole; paths, highlights and pins never pass through a bitmap canvas.
export function createCloudBrain(host) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 600 500");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("op-live-symbol");
  svg.innerHTML = `<defs><linearGradient id="op-symbol-ink" x1="-2" y1="2" x2="2" y2="-2" gradientUnits="userSpaceOnUse"><stop/><stop offset="1"/></linearGradient></defs><g data-projection><g transform="translate(300 240) scale(84 -84)" fill="none" stroke="url(#op-symbol-ink)" stroke-linecap="round" stroke-linejoin="round"></g></g>`;
  const projection = svg.querySelector("[data-projection]");
  const group = projection.firstElementChild;
  const tracks = [];
  const pins = [];
  const make = (name, attributes) => {
    const element = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attributes))
      element.setAttribute(key, value);
    group.append(element);
    return element;
  };
  const flow = (element, phase, speed, repeats, withPins) => {
    const trails = [0.06, 0.035, 0.012].map((length, index) => {
      const shine = element.cloneNode();
      shine.removeAttribute("data-symbol-path");
      shine.setAttribute("stroke", "var(--symbol-shine)");
      shine.setAttribute("pathLength", "1");
      shine.setAttribute(
        "stroke-dasharray",
        `${length} ${1 / repeats - length}`,
      );
      shine.setAttribute("opacity", [0.18, 0.4, 0.9][index]);
      group.append(shine);
      return { shine, length };
    });
    tracks.push({ phase, speed, trails });
    if (withPins) {
      for (let i = 0; i < repeats; i++)
        pins.push({
          node: make("circle", {
            r: ".021",
            fill: "var(--symbol-shine)",
            stroke: "none",
          }),
          path: element,
          phase: phase + i / repeats,
          speed,
        });
    }
  };
  cloudPaths.forEach((path, index) => {
    const element = make("path", {
      d: cloudPathData(path),
      "stroke-width": path.radius * 2,
      "data-symbol-path": index,
    });
    flow(element, index * 0.173, index ? 0.11 : 0.065, index ? 1 : 2, true);
  });
  cloudTerminals.forEach(([cx, cy], index) => {
    const element = make("circle", {
      cx,
      cy,
      r: ".2",
      "stroke-width": terminalRadius * 2,
    });
    flow(element, index * 0.23, 0.11, 1, false);
  });
  host.replaceChildren(svg);
  pins.forEach((pin) => {
    pin.length = pin.path.getTotalLength();
  });
  return {
    update(time, progress, paused, pointer) {
      const float = paused ? 0 : Math.sin(time * 0.55) * 3;
      // Orthographic projection of a rotated plane, expressed as an SVG matrix.
      // CSS 3D transforms would rasterize this fine artwork into a compositor layer.
      const x = ((-2 + pointer.y * 4) * Math.PI) / 180;
      const y = ((pointer.x * 7 + progress * 5) * Math.PI) / 180;
      const a = Math.cos(y),
        c = Math.sin(y) * Math.sin(x),
        d = Math.cos(x);
      projection.setAttribute(
        "transform",
        `matrix(${a} 0 ${c} ${d} ${300 - a * 300 - c * 240} ${240 - d * 240 + float})`,
      );
      const scale = innerWidth <= 600 ? 95 : 84;
      group.setAttribute(
        "transform",
        `translate(300 240) scale(${scale} ${-scale})`,
      );
      for (const { phase, speed, trails } of tracks) {
        for (const { shine, length } of trails)
          shine.setAttribute(
            "stroke-dashoffset",
            phase - time * speed + length,
          );
      }
      for (const pin of pins) {
        const fraction = (((time * pin.speed - pin.phase) % 1) + 1) % 1;
        const point = pin.path.getPointAtLength(fraction * pin.length);
        pin.node.setAttribute("cx", point.x);
        pin.node.setAttribute("cy", point.y);
      }
    },
    setTheme(accent, electric) {
      const stops = svg.querySelectorAll("stop");
      stops[0].style.stopColor = `color-mix(in srgb, ${electric} 75%, ${accent})`;
      stops[1].style.stopColor = `color-mix(in srgb, ${electric} 40%, ${accent})`;
      svg.style.setProperty("--symbol-shine", accent);
    },
  };
}
