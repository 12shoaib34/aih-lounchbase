import PDFDocument from "#invoice-pdfkit";
import { invoicePdfData, type PrintableInvoice } from "./invoicePdfData";

type Structure = PDFKit.PDFStructureElement;
type Fonts = { regular: Uint8Array; bold: Uint8Array };
const left = 40;
const width = 532;
const bottom = 748;
const ink = "#111827";
const muted = "#64748b";
const rule = "#e2e8f0";

// PDFKit 0.20 supports scope on structure options; its published 0.17 types
// omit it. Use the supported option instead of mutating structure dictionaries.
function tableHeader(doc: PDFKit.PDFDocument, scope: "Column" | "Row") {
  const options = { scope, title: undefined };
  return doc.struct("TH", options);
}

export async function renderInvoicePdf(
  invoice: PrintableInvoice,
  fonts: Fonts,
  options: { print?: boolean; compress?: boolean } = {},
): Promise<Uint8Array> {
  const data = invoicePdfData(invoice);
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 36, left, right: left, bottom: 44 },
    // PDFKit 0.20 accepts in-memory fonts here; its 0.17 types still say string.
    font: fonts.regular as unknown as string,
    bufferPages: true,
    tagged: true,
    // PDFKit 0.20 supports PDF/UA; the published types still list only PDF/A.
    subset: "PDF/UA" as PDFKit.PDFDocumentOptions["subset"],
    pdfVersion: "1.7",
    lang: "en-US",
    displayTitle: true,
    compress: options.compress ?? true,
    info: { Title: `${data.title} ${data.reference}`, Author: data.sellerName },
  });
  doc.registerFont("Regular", fonts.regular).registerFont("Bold", fonts.bold);
  const chunks: Uint8Array[] = [];
  const output = new Promise<Uint8Array>((resolve, reject) => {
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => {
      const bytes = new Uint8Array(
        chunks.reduce((sum, chunk) => sum + chunk.length, 0),
      );
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(bytes);
    });
  });
  const root = doc.struct("Document");
  doc.addStructure(root);
  let y = 36;
  const font = (bold = false, size = 10) =>
    doc.font(bold ? "Bold" : "Regular").fontSize(size);
  const height = (text: string, w: number, bold = false, size = 10) => {
    font(bold, size);
    return doc.heightOfString(`${text} `, { width: w, lineGap: 1 });
  };
  const artifact = (draw: () => void, pagination = false) => {
    doc.markContent("Artifact", { type: pagination ? "Pagination" : "Layout" });
    draw();
    doc.endMarkedContent();
  };
  const line = (at: number, x = left, w = width) =>
    artifact(() => {
      doc
        .save()
        .lineWidth(0.5)
        .strokeColor(rule)
        .moveTo(x, at)
        .lineTo(x + w, at)
        .stroke()
        .restore();
    });
  const background = (
    x: number,
    at: number,
    w: number,
    h: number,
    color: string,
  ) =>
    artifact(() => {
      doc.save().fillColor(color).rect(x, at, w, h).fill().restore();
    });
  const newPage = () => {
    doc.addPage();
    y = 36;
  };
  const ensure = (h: number) => {
    if (y + h > bottom) newPage();
  };
  const text = (
    value: string,
    x: number,
    at: number,
    w: number,
    {
      parent = root,
      tag = "P",
      bold = false,
      size = 10,
      color = ink,
      align = "left",
      decorative = false,
    }: {
      parent?: Structure;
      tag?: string;
      bold?: boolean;
      size?: number;
      color?: string;
      align?: "left" | "right";
      decorative?: boolean;
    } = {},
  ) => {
    // Preserve word boundaries across explicit address/note lines in extracted speech.
    const separated = value.replace(/\n/g, " \n") + " ";
    const draw = () => {
      font(bold, size)
        .fillColor(color)
        .text(separated, x, at, { width: w, align, lineGap: 1 });
    };
    if (decorative) artifact(draw, true);
    else parent.add(doc.struct(tag, {}, draw));
    return doc.y;
  };

  // The title leads the logical reading order, regardless of logo placement.
  const titleHeight = height(data.title, 250, true, 28);
  text(data.title, 322, y, 250, {
    tag: "H1",
    bold: true,
    size: 28,
    align: "right",
  });
  const referenceEnd = text(
    `# ${data.reference}`,
    322,
    y + titleHeight + 6,
    250,
    { color: muted, align: "right" },
  );
  const status = data.status ? doc.struct("P") : undefined;
  if (status) root.add(status);
  if (data.logo) {
    root.add(
      doc.struct(
        "Figure",
        { alt: data.sellerName ? `${data.sellerName} logo` : "Seller logo" },
        () => {
          doc.image(data.logo, left, y, { fit: [150, 56] });
        },
      ),
    );
  }
  y = Math.max(referenceEnd, y + (data.logo ? 56 : 0)) + 24;
  line(y);
  y += 20;

  const partyWidth =
    (width - 24 * (data.parties.length - 1)) / data.parties.length;
  const partyHeight = (party: (typeof data.parties)[number], w: number) =>
    height(party.label, w, true, 9) +
    7 +
    (party.name ? height(party.name, w, true, 11) + 4 : 0) +
    party.details.reduce((sum, value) => sum + height(value, w) + 3, 0);
  const tallestParty = Math.max(
    ...data.parties.map((party) => partyHeight(party, partyWidth)),
  );
  const drawParty = (
    party: (typeof data.parties)[number],
    x: number,
    at: number,
    w: number,
  ) => {
    const section = doc.struct("Sect");
    root.add(section);
    let end =
      text(party.label, x, at, w, {
        parent: section,
        tag: "H2",
        bold: true,
        size: 9,
        color: muted,
      }) + 7;
    if (party.name)
      end =
        text(party.name, x, end, w, { parent: section, bold: true, size: 11 }) +
        4;
    for (const value of party.details)
      end = text(value, x, end, w, { parent: section, color: "#475569" }) + 3;
    section.end();
    return end;
  };
  if (tallestParty < bottom - 36) {
    ensure(tallestParty);
    const at = y;
    y = Math.max(
      ...data.parties.map((party, index) =>
        drawParty(party, left + index * (partyWidth + 24), at, partyWidth),
      ),
    );
  } else {
    // Pathological multiline addresses use full-width flow rather than clip columns.
    for (const party of data.parties) {
      ensure(40);
      y = drawParty(party, left, y, width) + 12;
    }
  }
  y += 20;
  if (data.metadata.length) {
    const w = (width - 16 * (data.metadata.length - 1)) / data.metadata.length;
    const block = Math.max(
      ...data.metadata.map(
        ([label, value]) =>
          height(label, w, true, 9) + 5 + height(value, w, false, 9.5),
      ),
    );
    ensure(block);
    const at = y;
    data.metadata.forEach(([label, value], index) => {
      const x = left + index * (w + 16);
      const end = text(label, x, at, w, { bold: true, size: 9, color: muted });
      text(value, x, end + 5, w, { size: 9.5 });
    });
    y += block + 24;
  }

  const table = doc.struct("Table");
  root.add(table);
  const widths = [272, 68, 88, 104];
  const rowHeight = (cells: string[], heading = false) =>
    Math.max(
      ...cells.map((value, i) =>
        height(value, widths[i] - 20, heading || i === 3, heading ? 9 : 10),
      ),
    ) + (heading ? 18 : 22);
  const heading = ["Item", "Quantity", "Rate", "Amount"];
  const drawRow = (cells: string[], headingRow = false, repeated = false) => {
    const h = rowHeight(cells, headingRow);
    if (headingRow) background(left, y, width, h, ink);
    const row = repeated ? undefined : doc.struct("TR");
    if (row) table.add(row);
    let x = left;
    cells.forEach((value, index) => {
      if (repeated)
        text(value, x + 10, y + 9, widths[index] - 20, {
          decorative: true,
          bold: true,
          size: 9,
          color: "white",
          align: index ? "right" : "left",
        });
      else {
        const cell = headingRow ? tableHeader(doc, "Column") : doc.struct("TD");
        row!.add(cell);
        text(value, x + 10, y + (headingRow ? 9 : 11), widths[index] - 20, {
          parent: cell,
          bold: headingRow || index === 3,
          size: headingRow ? 9 : 10,
          color: headingRow ? "white" : ink,
          align: index ? "right" : "left",
        });
        cell.end();
      }
      x += widths[index];
    });
    row?.end();
    y += h;
    if (!headingRow) line(y);
  };
  ensure(rowHeight(heading, true) + rowHeight(data.items[0]));
  drawRow(heading, true);
  for (const cells of data.items) {
    if (y + rowHeight(cells) > bottom) {
      newPage();
      drawRow(heading, true, true);
    }
    drawRow(cells);
  }
  table.end();
  y += 16;

  const summaryHeight = data.summary.reduce(
    (sum, [label, value]) =>
      sum +
      Math.max(
        height(label, 132, true),
        height(value, 108, true, label === "Balance due" ? 12 : 10),
      ) +
      16,
    0,
  );
  ensure(summaryHeight);
  const summary = doc.struct("Table");
  root.add(summary);
  for (const [label, value] of data.summary) {
    const emphasis = label === "Total" || label === "Balance due";
    const size = label === "Balance due" ? 12 : 10;
    const h =
      Math.max(
        height(label, 132, emphasis),
        height(value, 108, emphasis, size),
      ) + 16;
    if (label === "Balance due") background(312, y, 260, h, "#f1f5f9");
    const row = doc.struct("TR");
    summary.add(row);
    const key = tableHeader(doc, "Row");
    row.add(key);
    text(label, 322, y + 8, 132, {
      parent: key,
      bold: emphasis,
      color: label === "Balance due" ? ink : muted,
    });
    key.end();
    const valueCell = doc.struct("TD");
    row.add(valueCell);
    text(value, 454, y + 8, 108, {
      parent: valueCell,
      bold: emphasis,
      size,
      align: "right",
    });
    valueCell.end();
    row.end();
    y += h;
  }
  summary.end();
  y += 24;

  for (const [label, value] of [
    ["Notes", data.notes],
    ["Terms", data.terms],
  ]) {
    if (!value) continue;
    ensure(42);
    line(y);
    y += 10;
    const section = doc.struct("Sect");
    root.add(section);
    y =
      text(label, left, y, width, {
        parent: section,
        tag: "H2",
        bold: true,
        size: 9,
        color: muted,
      }) + 6;
    // PDFKit continues this tagged paragraph across pages without truncating it.
    y = text(value, left, y, width, { parent: section, color: "#475569" }) + 18;
    section.end();
  }
  const pageCount = doc.bufferedPageRange().count;
  for (let page = 0; page < pageCount; page++) {
    doc.switchToPage(page);
    const footer = (value: string, align: "left" | "right") => {
      font(false, 8).fillColor(muted);
      const valueWidth = doc.widthOfString(value + " ");
      doc.text(
        value + " ",
        align === "right" ? left + width - valueWidth : left,
        760,
        { lineBreak: false },
      );
    };
    if (data.status) {
      if (page === 0) {
        status!.add(() => footer(data.status, "left"));
        status!.end();
      } else artifact(() => footer(data.status, "left"), true);
    }
    if (pageCount > 1)
      artifact(() => footer(`${page + 1} / ${pageCount}`, "right"), true);
  }
  if (options.print) {
    // Same standard named Print action previously used by pdfmake.
    const action = doc.ref({ Type: "Action", S: "Named", N: "Print" });
    (
      doc as PDFKit.PDFDocument & { _root: { data: Record<string, unknown> } }
    )._root.data.OpenAction = action;
    action.end(undefined);
  }
  root.end();
  doc.end();
  return output;
}
