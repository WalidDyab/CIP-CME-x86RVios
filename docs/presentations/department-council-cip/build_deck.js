/**
 * Curriculum Intelligence Portal — Department Council presentation.
 * Build:  node build_deck.js      (requires pptxgenjs)
 *
 * Content facts are sourced from this repository; see NOTES.md.
 * Screenshots in ./screenshots are real captures of the current portal.
 */

const PptxGenJS = require("pptxgenjs");
const path = require("path");

const HERE = __dirname.replace(/\\/g, "/");
const SHOT = HERE + "/screenshots/";
const OUT = path.join(__dirname, "CIP_Department_Council_Presentation.pptx");

/* ---------- identity ---------- */

const C = {
  navy: "143D66",   // PSU navy
  deep: "0B1B2E",   // portal background
  deep2: "122842",
  ink: "17263A",
  slate: "5B6C81",
  orange: "F2A23A", // CIP accent
  amber: "9A6208",
  teal: "1C6E93",
  cyan: "79D7FF",
  panel: "F2F5FA",
  panel2: "E6EDF5",
  line: "D3DDE8",
  white: "FFFFFF",
  green: "2D7A56",
};
const F = { head: "Cambria", body: "Calibri" };

const W = 13.333, H = 7.5, M = 0.62;

/* ---------- helpers ---------- */

const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE";
pres.author = "Curriculum Committee, Department of Communications and Networks Engineering";
pres.company = "Prince Sultan University — College of Engineering";
pres.title = "Curriculum Intelligence Portal (CIP)";

function shadow(blur = 12, opacity = 0.10, angle = 90, offset = 3) {
  return { type: "outer", blur, offset, angle, color: "0B1B2E", opacity };
}

function darkSlide() {
  const s = pres.addSlide();
  s.background = { color: C.deep };
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: W, h: H, fill: { color: C.deep },
  });
  return s;
}

function lightSlide() {
  const s = pres.addSlide();
  s.background = { color: C.white };
  return s;
}

/** Kicker + title block used on every content slide. */
function heading(s, kicker, title, dark = false) {
  s.addText(kicker.toUpperCase(), {
    x: M, y: 0.42, w: 10.5, h: 0.26, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 11, bold: true, charSpacing: 2.4,
    color: dark ? C.orange : C.amber,
  });
  s.addText(title, {
    x: M, y: 0.70, w: 11.6, h: 0.72, isTextBox: true, margin: 0,
    fontFace: F.head, fontSize: 32, bold: true,
    color: dark ? C.white : C.navy,
  });
}

function subline(s, text, dark = false, y = 1.42) {
  s.addText(text, {
    x: M, y, w: 11.9, h: 0.34, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 14, color: dark ? "AFC3D8" : C.slate,
  });
}

function footer(s, n, dark = false) {
  s.addText("Curriculum Intelligence Portal  ·  Curriculum Committee  ·  Undergraduate Electrical Engineering", {
    x: M, y: 6.94, w: 9.4, h: 0.28, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 9, color: dark ? "7D93AB" : "93A3B5",
  });
  s.addText(String(n), {
    x: W - M - 0.8, y: 6.94, w: 0.8, h: 0.28, isTextBox: true, margin: 0, align: "right",
    fontFace: F.body, fontSize: 9, bold: true, color: dark ? "7D93AB" : "93A3B5",
  });
}

/** Rounded card. Returns nothing; draw text on top separately. */
function card(s, x, y, w, h, opts = {}) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: opts.fill || C.panel },
    line: { color: opts.line || C.line, width: opts.lw === undefined ? 1 : opts.lw },
    shadow: opts.shadow === false ? undefined : shadow(10, 0.07),
  });
}

/** Small square index chip — the deck's repeating motif. */
function chip(s, x, y, label, opts = {}) {
  const sz = opts.size || 0.36;
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w: sz, h: sz, rectRadius: 0.25,
    fill: { color: opts.fill || C.navy }, line: { color: opts.fill || C.navy, width: 0 },
  });
  s.addText(label, {
    x, y, w: sz, h: sz, isTextBox: true, margin: 0, align: "center", valign: "middle",
    fontFace: F.body, fontSize: opts.fs || 13, bold: true, color: opts.color || C.white,
  });
}

function bullets(s, items, o) {
  s.addText(
    items.map((t, i) => ({
      text: t,
      options: { bullet: { code: "2022", indent: 14 }, breakLine: i !== items.length - 1 },
    })),
    {
      x: o.x, y: o.y, w: o.w, h: o.h, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: o.fs || 13.5, color: o.color || C.ink,
      lineSpacingMultiple: 1.08, paraSpaceAfter: o.gap === undefined ? 7 : o.gap,
    }
  );
}

/* =====================================================================
   1 — Title
   ===================================================================== */
{
  const s = darkSlide();

  // quiet geometric motif: concentric rounded squares, bottom-right
  [[8.05, 1.55, 4.7], [8.75, 2.25, 3.3], [9.45, 2.95, 1.9]].forEach(([x, y, d], i) => {
    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: d, h: d, rectRadius: 0.12,
      fill: { color: C.deep2, transparency: i === 0 ? 55 : i === 1 ? 35 : 10 },
      line: { color: "234A72", width: 1 },
    });
  });
  s.addShape(pres.ShapeType.roundRect, {
    x: 10.05, y: 3.55, w: 0.7, h: 0.7, rectRadius: 0.14,
    fill: { color: C.orange }, line: { color: C.orange, width: 0 },
  });
  s.addText("CIP", {
    x: 10.05, y: 3.55, w: 0.7, h: 0.7, isTextBox: true, margin: 0,
    align: "center", valign: "middle", fontFace: F.head, fontSize: 15, bold: true, color: C.deep,
  });

  s.addText("PRINCE SULTAN UNIVERSITY  ·  COLLEGE OF ENGINEERING", {
    x: M, y: 1.55, w: 8.0, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 11.5, bold: true, charSpacing: 2.2, color: C.orange,
  });

  s.addText("Curriculum Intelligence Portal", {
    x: M, y: 2.0, w: 7.6, h: 1.5, isTextBox: true, margin: 0,
    fontFace: F.head, fontSize: 48, bold: true, color: C.white, lineSpacingMultiple: 0.92,
  });

  s.addText("Undergraduate EE curriculum intelligence and continuous-improvement platform", {
    x: M, y: 3.62, w: 7.1, h: 0.75, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 17, color: "C3D6EA", lineSpacingMultiple: 1.1,
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 4.62, w: 3.05, h: 0.42, rectRadius: 0.2,
    fill: { color: "1B3A5C" }, line: { color: "2D5C8A", width: 1 },
  });
  s.addText("CIP Desktop 1.0.0  ·  r000000000003", {
    x: M, y: 4.62, w: 3.05, h: 0.42, isTextBox: true, margin: 0, align: "center", valign: "middle",
    fontFace: F.body, fontSize: 11, bold: true, color: C.cyan,
  });

  s.addText(
    [
      { text: "Curriculum Committee", options: { bold: true, color: C.white, breakLine: true } },
      { text: "Department of Communications and Networks Engineering", options: { breakLine: true } },
      { text: "Presented to the Department Council", options: {} },
    ],
    {
      x: M, y: 5.35, w: 7.4, h: 1.0, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 13, color: "9FB6CE", lineSpacingMultiple: 1.25,
    }
  );

  s.addNotes(
    "Framing: CIP is a Curriculum Committee software asset, built by and for the committee. " +
    "This session covers the undergraduate Electrical Engineering program only. " +
    "MSc/graduate modules exist but are under construction and pending approval — not today's subject."
  );
  footer(s, 1, true);
}

/* =====================================================================
   2 — Why CIP was needed
   ===================================================================== */
{
  const s = lightSlide();
  heading(s, "The problem we set out to solve", "Why CIP was needed");
  subline(s, "One undergraduate program carries thousands of curriculum relationships — held in files, not in a system.");

  const probs = [
    ["1", "Curriculum data is distributed",
      "Course specifications, CLOs, SO/PI mappings, assessment material, reports and committee records live in separate files and folders."],
    ["2", "Faculty need one clear view",
      "Coordinators and instructors need to see their course, its outcomes, its mappings and the evidence behind them without chasing documents."],
    ["3", "Committee work needs traceability",
      "Review must be consistent, evidence-based and repeatable across terms — and fast enough to finish inside a review cycle."],
  ];

  let y = 2.05;
  probs.forEach(([n, title, body]) => {
    card(s, M, y, 7.35, 1.38);
    chip(s, M + 0.32, y + 0.3, n, { fill: C.navy });
    s.addText(title, {
      x: M + 0.88, y: y + 0.22, w: 6.2, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 15.5, bold: true, color: C.navy,
    });
    s.addText(body, {
      x: M + 0.88, y: y + 0.58, w: 6.25, h: 0.68, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 12, color: C.slate, lineSpacingMultiple: 1.06,
    });
    y += 1.52;
  });

  // right: scale of the program
  card(s, 8.35, 2.05, 4.35, 4.34, { fill: C.navy, line: C.navy, lw: 0 });
  s.addText("THE UNDERGRADUATE EE PROGRAM, IN DATA", {
    x: 8.72, y: 2.34, w: 3.7, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 9.5, bold: true, charSpacing: 1.4, color: C.orange,
  });

  const stats = [
    ["32", "courses modelled", "171", "course learning outcomes"],
    ["7", "ABET student outcomes", "20", "performance indicators"],
  ];
  let sy = 2.78;
  stats.forEach(([a, al, b, bl]) => {
    [[8.72, a, al], [10.72, b, bl]].forEach(([x, num, lab]) => {
      s.addText(num, {
        x, y: sy, w: 1.85, h: 0.62, isTextBox: true, margin: 0,
        fontFace: F.head, fontSize: 40, bold: true, color: C.white,
      });
      s.addText(lab, {
        x, y: sy + 0.62, w: 1.85, h: 0.42, isTextBox: true, margin: 0,
        fontFace: F.body, fontSize: 10.5, color: "A9C1D8", lineSpacingMultiple: 0.95,
      });
    });
    sy += 1.24;
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: 8.72, y: 5.34, w: 3.62, h: 0.86, rectRadius: 0.1,
    fill: { color: "1D4370" }, line: { color: "2D5C8A", width: 1 },
  });
  s.addText(
    [
      { text: "466", options: { fontSize: 20, bold: true, color: C.orange, fontFace: F.head } },
      { text: "  CLO → PI relationships to keep consistent, defensible and documented", options: { fontSize: 11, color: "CFE0EF" } },
    ],
    {
      x: 8.9, y: 5.4, w: 3.3, h: 0.74, isTextBox: true, margin: 0, valign: "middle",
      fontFace: F.body, lineSpacingMultiple: 1.0,
    }
  );

  s.addNotes(
    "The point is scale, not complaint. 32 courses, 171 CLOs and 466 CLO-to-PI relationships cannot be reviewed " +
    "reliably by opening files one at a time. Every number here is read from the committee's own approved data."
  );
  footer(s, 2);
}

/* =====================================================================
   3 — What CIP is
   ===================================================================== */
{
  const s = lightSlide();
  heading(s, "Definition", "What CIP is");
  subline(s, "A secure desktop curriculum portal — installed by faculty, delivered under committee control, usable offline.");

  const items = [
    ["A", "Curriculum intelligence portal", "Structured access to undergraduate program information: courses, outcomes, mappings, assessment and improvement views."],
    ["B", "Desktop application", "Faculty install CIP Desktop on their own computer. The portal opens from a validated local copy, not a public website."],
    ["C", "Authenticated download", "Content is obtained once through an authorized session, then held locally as a verified release."],
    ["D", "Offline and controlled updates", "Works without a network connection; new curriculum releases arrive through a managed update channel."],
  ];

  let y = 2.06;
  items.forEach(([n, t, b]) => {
    chip(s, M, y + 0.04, n, { fill: n === "A" ? C.orange : C.navy, color: n === "A" ? C.deep : C.white });
    s.addText(t, {
      x: M + 0.56, y, w: 5.2, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 15.5, bold: true, color: C.navy,
    });
    s.addText(b, {
      x: M + 0.56, y: y + 0.32, w: 5.35, h: 0.68, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 12, color: C.slate, lineSpacingMultiple: 1.06,
    });
    y += 1.05;
  });

  card(s, 6.85, 2.05, 5.86, 3.84, { fill: C.panel2, line: C.line });
  s.addImage({ path: SHOT + "cip-home.png", x: 7.0, y: 2.2, w: 5.56, h: 3.48 });
  s.addText("Curriculum Intelligence Portal — entry view, undergraduate and graduate program areas", {
    x: 6.85, y: 5.98, w: 5.86, h: 0.34, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 9.5, italic: true, color: "8A9AAC",
  });

  s.addText("MSc / graduate modules are under construction and pending approval — not part of this presentation.", {
    x: M, y: 6.46, w: 6.0, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 10.5, italic: true, color: C.amber,
  });

  s.addNotes(
    "Keep this slide short. CIP is a portal that happens to be delivered as a desktop application — the desktop part " +
    "is a governance decision, covered on slides 8 and 9. Note once, in passing, that MSc modules are under construction."
  );
  footer(s, 3);
}

/* =====================================================================
   4 — Undergraduate program dashboard
   ===================================================================== */
{
  const s = lightSlide();
  heading(s, "Program level", "Undergraduate program dashboard");
  subline(s, "The whole degree in one place: structure, outcomes, mappings, assessment and improvement views.");

  card(s, M, 2.05, 3.55, 4.55, { fill: C.panel });
  const covers = [
    "Program overview, mission and educational objectives",
    "Course structure and prerequisite flow",
    "CLO / SO / PI relationships",
    "Curriculum maps and coverage",
    "Assessment and continuous-improvement views",
    "Navigation across undergraduate modules",
  ];
  s.addText("WHAT IT COVERS", {
    x: M + 0.3, y: 2.3, w: 3.0, h: 0.28, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 9.5, bold: true, charSpacing: 1.4, color: C.amber,
  });
  bullets(s, covers, { x: M + 0.3, y: 2.66, w: 2.98, h: 3.2, fs: 12, gap: 9 });
  s.addText("All figures render from one authoritative curriculum dataset.", {
    x: M + 0.3, y: 5.98, w: 2.98, h: 0.5, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 10, italic: true, color: "8A9AAC", lineSpacingMultiple: 1.0,
  });

  s.addImage({ path: SHOT + "program-structure-crop.png", x: 4.45, y: 2.05, w: 8.25, h: 2.507 });
  s.addText("Program structure — credit distribution across the four-year study plan", {
    x: 4.45, y: 4.61, w: 8.25, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 9.5, italic: true, color: "8A9AAC",
  });

  const modules = [
    ["Program Overview", "Mission, PEOs, Student Outcomes, structure and references"],
    ["Course Dashboard", "One page per course, with its outcomes and mappings"],
    ["SO Leader Dashboard", "Outcome coverage, PI progression and course evidence"],
    ["Teaching & Assessment", "Approved strategies, methods and course exceptions"],
  ];
  let mx = 4.45;
  modules.forEach(([t, b], i) => {
    card(s, mx, 5.05, 1.95, 1.55, { fill: i === 0 ? C.panel2 : C.panel, shadow: false });
    s.addShape(pres.ShapeType.roundRect, {
      x: mx + 0.2, y: 5.24, w: 0.26, h: 0.26, rectRadius: 0.12,
      fill: { color: i === 0 ? C.orange : C.navy }, line: { color: C.white, width: 0 },
    });
    s.addText(t, {
      x: mx + 0.2, y: 5.56, w: 1.62, h: 0.48, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 11.5, bold: true, color: C.navy, lineSpacingMultiple: 0.95,
    });
    s.addText(b, {
      x: mx + 0.2, y: 6.02, w: 1.64, h: 0.54, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 9, color: C.slate, lineSpacingMultiple: 0.95,
    });
    mx += 2.1;
  });

  s.addNotes(
    "Demonstrate live if the room allows. Emphasise that nothing here is re-typed: the credit distribution, the " +
    "study plan and the outcome statements all render from one authoritative dataset, so they cannot drift apart."
  );
  footer(s, 4);
}

/* =====================================================================
   5 — Course-level intelligence
   ===================================================================== */
{
  const s = lightSlide();
  heading(s, "Course level", "Course-level intelligence");
  subline(s, "Every course as a single page: outcomes, mappings, teaching strategies and assessment methods.");

  // course-dashboard-crop.png is 1310 x 940 (aspect 1.3936)
  s.addImage({ path: SHOT + "course-dashboard-crop.png", x: M, y: 1.98, w: 5.97, h: 4.284 });
  s.addText("Course dashboard — CLO–SO–PI mapping and approved teaching / assessment methods", {
    x: M, y: 6.34, w: 5.97, h: 0.44, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 9.5, italic: true, color: "8A9AAC", lineSpacingMultiple: 1.0,
  });

  const rows = [
    ["Course dashboards", "Description, objectives, credit load, prerequisites, topics and contact hours."],
    ["CLO visibility", "Every course learning outcome with its NQF domain and approved wording."],
    ["Teaching and assessment", "15 approved teaching strategies and 16 assessment methods, applied per CLO."],
    ["Course-to-program alignment", "Each CLO shown against the outcomes and indicators it supports."],
  ];
  let y = 1.98;
  rows.forEach(([t, b], i) => {
    card(s, 7.0, y, 5.71, 0.98, { fill: i === 3 ? C.panel2 : C.panel });
    s.addText(t, {
      x: 7.26, y: y + 0.13, w: 5.2, h: 0.28, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 13.5, bold: true, color: C.navy,
    });
    s.addText(b, {
      x: 7.26, y: y + 0.41, w: 5.22, h: 0.46, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 10.5, color: C.slate, lineSpacingMultiple: 1.0,
    });
    y += 1.06;
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: 7.0, y: 6.24, w: 5.71, h: 0.56, rectRadius: 0.1,
    fill: { color: "FDF4E4" }, line: { color: "EFD3A4", width: 1 },
  });
  s.addText("Serves faculty, course coordinators and committee reviewers from the same page.", {
    x: 7.2, y: 6.24, w: 5.35, h: 0.56, isTextBox: true, margin: 0, valign: "middle",
    fontFace: F.body, fontSize: 10.5, bold: true, color: C.amber, lineSpacingMultiple: 1.0,
  });

  s.addNotes(
    "A course coordinator preparing a syllabus, an instructor checking what their CLOs are meant to deliver, and a " +
    "committee member reviewing that course all look at the same page — which removes most version disagreements."
  );
  footer(s, 5);
}

/* =====================================================================
   6 — Alignment and review tools
   ===================================================================== */
{
  const s = lightSlide();
  heading(s, "Review", "Alignment and review tools");
  subline(s, "Evidence-oriented review of how the curriculum supports the seven ABET Student Outcomes.");

  // alignment-review-crop.png is 1330 x 864 (aspect 1.5394)
  s.addImage({ path: SHOT + "alignment-review-crop.png", x: 5.82, y: 1.98, w: 6.89, h: 4.476 });
  s.addText("CLO–SO–PI Alignment Review — conclusions first, then the items worth confirming", {
    x: 5.82, y: 6.5, w: 6.89, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 9.5, italic: true, color: "8A9AAC",
  });

  const feats = [
    ["CLO–SO–PI mapping visibility", "Outcome coverage, per-course contribution and the CLO–PI explorer in one view."],
    ["Review analysis engine", "Reads approved CLO wording, artefacts and assessment methods against each indicator's evidence profile."],
    ["Gaps, overlaps and documentation needs", "Surfaces what is thin, what is duplicated and what simply needs confirming."],
  ];
  let y = 2.05;
  feats.forEach(([t, b], i) => {
    chip(s, M, y + 0.02, String(i + 1), { fill: C.navy });
    s.addText(t, {
      x: M + 0.56, y, w: 4.6, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 14.5, bold: true, color: C.navy,
    });
    s.addText(b, {
      x: M + 0.56, y: y + 0.32, w: 4.62, h: 0.76, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 11.5, color: C.slate, lineSpacingMultiple: 1.06,
    });
    y += 1.24;
  });

  card(s, M, 5.86, 4.96, 1.0, { fill: "EAF3EC", line: "BFDCC8" });
  s.addText(
    [
      { text: "Supportive, not punitive.  ", options: { bold: true, color: C.green } },
      { text: "The engine reports status and suggests confirmation — it never grades a colleague and stores no student performance data.", options: { color: "3F5C4C" } },
    ],
    {
      x: M + 0.22, y: 5.94, w: 4.56, h: 0.86, isTextBox: true, margin: 0, valign: "middle",
      fontFace: F.body, fontSize: 11, lineSpacingMultiple: 1.04,
    }
  );

  s.addNotes(
    "Stress the philosophy. Labels are descriptive — strong, looks appropriate, check evidence, review — and they " +
    "point to documentation that needs confirming, not to a person. The Measurement and Improvement layers are " +
    "deliberately empty: no attainment value is stored or displayed."
  );
  footer(s, 6);
}

/* =====================================================================
   7 — Continuous improvement support
   ===================================================================== */
{
  const s = lightSlide();
  heading(s, "The cycle", "Continuous improvement support");
  subline(s, "Curriculum evidence moves from source files, through CIP, into committee decisions — and back again.");

  // flow
  const stages = [
    ["Source data", "Course specs, CLOs,\nmappings, assessment plans", C.navy],
    ["CIP intelligence", "Structured, cross-linked,\nsearchable curriculum views", C.teal],
    ["Committee decisions", "Evidence-based review,\nrecorded outcomes", C.amber],
    ["Continuous improvement", "CLO revisions, mapping\nupdates, documentation", C.green],
  ];
  const bw = 2.72, bh = 1.62, gap = 0.44;
  let x = M;
  stages.forEach(([t, b, col], i) => {
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 2.2, w: bw, h: bh, rectRadius: 0.08,
      fill: { color: C.white }, line: { color: col, width: 1.5 }, shadow: shadow(9, 0.08),
    });
    s.addShape(pres.ShapeType.roundRect, {
      x: x + 0.24, y: 2.42, w: 0.3, h: 0.3, rectRadius: 0.25,
      fill: { color: col }, line: { color: col, width: 0 },
    });
    s.addText(t, {
      x: x + 0.24, y: 2.82, w: bw - 0.48, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 14, bold: true, color: col,
    });
    s.addText(b, {
      x: x + 0.24, y: 3.16, w: bw - 0.44, h: 0.6, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 10.5, color: C.slate, lineSpacingMultiple: 1.0,
    });
    if (i < 3) {
      s.addShape(pres.ShapeType.rightArrow, {
        x: x + bw + 0.09, y: 2.88, w: 0.28, h: 0.26,
        fill: { color: C.line }, line: { color: C.line, width: 0 },
      });
    }
    x += bw + gap;
  });

  // return path
  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 4.08, w: 12.09, h: 0.42, rectRadius: 0.2,
    fill: { color: C.panel }, line: { color: C.line, width: 1 },
  });
  s.addText("Improvement evidence feeds the next curriculum revision cycle", {
    x: M, y: 4.08, w: 12.09, h: 0.42, isTextBox: true, margin: 0, align: "center", valign: "middle",
    fontFace: F.body, fontSize: 11.5, italic: true, color: C.slate,
  });

  const gains = [
    ["Structured evidence for discussion", "Committee conversations start from the same view of the curriculum instead of competing spreadsheets."],
    ["Change and review outputs tracked", "CLO revision reports and alignment reviews are produced from live data and kept with the release."],
    ["Faster documentation", "Course specifications and review reports are generated from the portal rather than reassembled by hand."],
    ["Less manual searching", "No hunting across scattered folders for the current version of a mapping or a CLO."],
  ];
  let gy = 4.78;
  gains.forEach(([t, b], i) => {
    const gx = i % 2 === 0 ? M : 6.85;
    if (i % 2 === 0 && i > 0) gy += 1.0;
    card(s, gx, gy, 5.86, 0.9, { fill: C.panel, shadow: false });
    s.addText(t, {
      x: gx + 0.24, y: gy + 0.12, w: 5.4, h: 0.26, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 12.5, bold: true, color: C.navy,
    });
    s.addText(b, {
      x: gx + 0.24, y: gy + 0.38, w: 5.42, h: 0.44, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 10, color: C.slate, lineSpacingMultiple: 0.98,
    });
  });

  s.addNotes(
    "This is the value argument for the department: CIP does not make curriculum decisions. It makes the evidence " +
    "for those decisions available quickly, in a consistent form, and keeps the result with the release."
  );
  footer(s, 7);
}

/* =====================================================================
   8 — From public web portal to controlled desktop platform
   ===================================================================== */
{
  const s = darkSlide();
  heading(s, "Architecture decision", "From public web portal to controlled desktop platform", true);
  subline(s, "Curriculum information is institutional data. The delivery model was changed to match that.", true);

  const stages = [
    {
      tag: "STAGE 1", title: "GitHub Pages model",
      good: ["Simple deployment", "Browser access anywhere", "Fast iteration", "Proved the portal concept"],
      lim: "Static public web hosting. Files placed there are served from a publicly reachable location, and knowing the URL can make static resources retrievable. No server-side faculty authorization protects the curriculum package itself.",
      limLabel: "DATA-GOVERNANCE LIMITATION",
      col: "5E7894",
    },
    {
      tag: "STAGE 2", title: "A deliberate evolution",
      good: ["Protection became a design requirement", "Authorization before delivery", "Least exposure by default", "Controlled distribution"],
      lim: "The Curriculum Committee chose a controlled desktop architecture so that governance of curriculum data is enforced by the delivery model, not by the obscurity of a link.",
      limLabel: "WHY WE MOVED",
      col: C.orange,
    },
    {
      tag: "STAGE 3", title: "CIP Desktop",
      good: ["Authenticated gateway", "Private release storage", "Cryptographically verified package", "Validated local copy, offline capable"],
      lim: "Release identifiers and integrity hashes, delivered through a managed update channel so faculty machines do not diverge into unmanaged curriculum copies.",
      limLabel: "RELEASE MANAGEMENT",
      col: C.cyan,
    },
  ];

  let x = M;
  const cw = 3.73, gapx = 0.45;
  stages.forEach((st) => {
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 2.05, w: cw, h: 4.18, rectRadius: 0.08,
      fill: { color: C.deep2 }, line: { color: "23456C", width: 1 },
    });
    s.addText(st.tag, {
      x: x + 0.26, y: 2.24, w: 2.0, h: 0.24, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 9, bold: true, charSpacing: 1.6, color: st.col,
    });
    s.addText(st.title, {
      x: x + 0.26, y: 2.5, w: cw - 0.5, h: 0.34, isTextBox: true, margin: 0,
      fontFace: F.head, fontSize: 18, bold: true, color: C.white,
    });
    bullets(s, st.good, { x: x + 0.26, y: 2.94, w: cw - 0.52, h: 1.18, fs: 11, gap: 4, color: "BCD1E5" });

    s.addShape(pres.ShapeType.roundRect, {
      x: x + 0.2, y: 4.28, w: cw - 0.4, h: 1.78, rectRadius: 0.07,
      fill: { color: "0E2338" }, line: { color: "1E3E5F", width: 1 },
    });
    s.addText(st.limLabel, {
      x: x + 0.38, y: 4.4, w: cw - 0.76, h: 0.24, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 8.5, bold: true, charSpacing: 1.3, color: st.col,
    });
    s.addText(st.lim, {
      x: x + 0.38, y: 4.66, w: cw - 0.76, h: 1.3, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 10, color: "9FB6CE", lineSpacingMultiple: 1.04,
    });
    x += cw + gapx;
  });

  s.addText(
    [
      { text: "GitHub Pages is not being called insecure. ", options: { bold: true, color: C.orange } },
      { text: "Its public static-hosting model simply does not match our data-governance and controlled-distribution requirements.", options: { color: "9FB6CE" } },
    ],
    {
      x: M, y: 6.38, w: 12.09, h: 0.34, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 11,
    }
  );

  s.addNotes(
    "Be precise here. Stage 1 was the right choice for proving the concept and we are not disowning it. What changed " +
    "is the requirement: once the portal held the department's approved curriculum record, we needed authorization " +
    "before delivery and a managed release lifecycle — which static public hosting does not provide."
  );
  footer(s, 8, true);
}

/* =====================================================================
   9 — Current security and data architecture
   ===================================================================== */
{
  const s = darkSlide();
  heading(s, "Security and deployment model", "How controlled delivery works", true);
  subline(s, "Authorized faculty, private storage, verified package, local trusted copy.", true);

  // faculty access chain
  s.addText("FACULTY ACCESS CHAIN", {
    x: M, y: 1.95, w: 4.4, h: 0.26, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 9.5, bold: true, charSpacing: 1.5, color: C.orange,
  });

  const chain = [
    "Authorized PSU email (explicit allowlist)",
    "One-time verification code",
    "Authenticated faculty session",
    "Private CIP release service",
    "Private cloud object storage",
    "Cryptographically verified package",
    "Local CIP copy on the faculty computer",
    "Offline-capable operation",
  ];
  const cx = M + 0.17, top = 2.3, step = 0.52;
  s.addShape(pres.ShapeType.line, {
    x: cx + 0.125, y: top + 0.12, w: 0, h: step * (chain.length - 1) + 0.14,
    line: { color: "2D5C8A", width: 2 },
  });
  chain.forEach((t, i) => {
    const y = top + i * step;
    const last = i === chain.length - 1;
    s.addShape(pres.ShapeType.ellipse, {
      x: cx, y, w: 0.25, h: 0.25,
      fill: { color: last ? C.orange : C.cyan }, line: { color: C.deep, width: 1.5 },
    });
    s.addText(t, {
      x: cx + 0.45, y: y - 0.05, w: 4.35, h: 0.34, isTextBox: true, margin: 0, valign: "middle",
      fontFace: F.body, fontSize: 12, bold: last, color: last ? C.white : "C3D6EA",
    });
  });

  // architecture facts
  s.addShape(pres.ShapeType.roundRect, {
    x: 5.85, y: 1.92, w: 6.86, h: 3.5, rectRadius: 0.08,
    fill: { color: C.deep2 }, line: { color: "23456C", width: 1 },
  });
  s.addText("CURRENT SECURITY AND DATA ARCHITECTURE", {
    x: 6.12, y: 2.12, w: 5.6, h: 0.26, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 9.5, bold: true, charSpacing: 1.4, color: C.orange,
  });
  bullets(s, [
    "Faculty are explicitly authorized by email; access to release metadata and downloads requires a valid faculty session.",
    "Session credentials are retained by the native desktop application using the operating system credential store.",
    "Release packages are held in private cloud object storage; the storage bucket itself is not publicly exposed.",
    "After authenticated delivery, the operational copy resides locally and the portal runs from that validated release.",
    "Content releases carry identifiers and integrity hashes, and new releases arrive through a controlled update channel.",
  ], { x: 6.12, y: 2.46, w: 6.35, h: 2.82, fs: 11.5, gap: 8, color: "C3D6EA" });

  // honest objective statement
  s.addShape(pres.ShapeType.roundRect, {
    x: 5.85, y: 5.56, w: 6.86, h: 1.1, rectRadius: 0.08,
    fill: { color: "1D4370" }, line: { color: "3A6FA0", width: 1 },
  });
  s.addText("THE OBJECTIVE, STATED ACCURATELY", {
    x: 6.12, y: 5.68, w: 5.6, h: 0.24, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 8.5, bold: true, charSpacing: 1.3, color: C.cyan,
  });
  s.addText("Controlled access, controlled distribution, reduced public exposure, release integrity, and managed synchronization of authorized local copies — not digital rights management.", {
    x: 6.12, y: 5.94, w: 6.32, h: 0.66, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 11, italic: true, color: C.white, lineSpacingMultiple: 1.02,
  });

  s.addText("Windows is the first validated desktop platform.", {
    x: M, y: 6.44, w: 5.0, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 10.5, bold: true, color: "8FA8C2",
  });

  s.addNotes(
    "If asked about local files: an authorized faculty member can of course inspect what is on their own machine, and " +
    "we are not claiming otherwise. The gain is that the curriculum package is no longer reachable from a public URL, " +
    "each copy is verified against its release hash, and every machine can be brought to the same release."
  );
  footer(s, 9, true);
}

/* =====================================================================
   10 — Current production status
   ===================================================================== */
{
  const s = lightSlide();
  heading(s, "Where we are today", "Current production status");
  subline(s, "The undergraduate platform is prepared and tested; graduate modules remain under construction.");

  const status = [
    ["CIP Desktop 1.0.0", "Prepared", "Windows desktop application built and packaged for faculty installation.", C.green],
    ["Content release r000000000003", "Current", "Identified release with a per-file integrity manifest.", C.green],
    ["Automatic content update path", "Tested", "Delivery of a new content release to an installed client verified.", C.green],
    ["First trusted-user testing", "Completed", "Initial authorized faculty test completed successfully.", C.green],
    ["Undergraduate EE modules", "Operational focus", "Program, course, alignment and improvement views in active use.", C.navy],
    ["MSc / graduate modules", "Under construction", "Pending approval; outside the scope of this presentation.", C.amber],
  ];

  let y = 2.12;
  status.forEach(([t, badge, b, col], i) => {
    const x = i % 2 === 0 ? M : 6.85;
    if (i % 2 === 0 && i > 0) y += 1.5;
    card(s, x, y, 5.86, 1.32, { fill: i >= 4 ? C.panel2 : C.panel });
    s.addText(t, {
      x: x + 0.26, y: y + 0.16, w: 3.6, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 14, bold: true, color: C.navy,
    });
    s.addShape(pres.ShapeType.roundRect, {
      x: x + 3.95, y: y + 0.18, w: 1.65, h: 0.3, rectRadius: 0.15,
      fill: { color: col === C.green ? "E4F1E9" : col === C.amber ? "FDF1DD" : "E3EAF4" },
      line: { color: col === C.green ? "BFDCC8" : col === C.amber ? "EFD3A4" : "C6D4E6", width: 1 },
    });
    s.addText(badge, {
      x: x + 3.95, y: y + 0.18, w: 1.65, h: 0.3, isTextBox: true, margin: 0,
      align: "center", valign: "middle", fontFace: F.body, fontSize: 9.5, bold: true, color: col,
    });
    s.addText(b, {
      x: x + 0.26, y: y + 0.56, w: 5.36, h: 0.6, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 11, color: C.slate, lineSpacingMultiple: 1.04,
    });
  });

  s.addNotes(
    "Status, not promises. Everything marked here has actually been done. The release identifier is the one currently " +
    "packaged in the repository, so the council can verify it. Broader faculty rollout follows once the committee agrees."
  );
  footer(s, 10);
}

/* =====================================================================
   11 — Roadmap and committee value
   ===================================================================== */
{
  const s = darkSlide();
  heading(s, "Next steps", "Roadmap and committee value", true);
  subline(s, "A maintained departmental asset, not a one-off project.", true);

  const road = [
    ["1", "Automate content releases", "Remove manual steps from packaging and publication."],
    ["2", "Desktop self-update", "Clients update themselves through the controlled channel."],
    ["3", "Visible version indicator", "Every faculty member can see which release they are running."],
    ["4", "Documentation and user guide", "So the platform outlives any single committee member."],
    ["5", "Extend to other programs", "Same architecture, additional curricula, when the department decides."],
  ];

  let y = 2.05;
  road.forEach(([n, t, b]) => {
    chip(s, M, y + 0.02, n, { fill: "1D4370", color: C.cyan, fs: 12 });
    s.addText(t, {
      x: M + 0.54, y, w: 4.7, h: 0.28, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 14, bold: true, color: C.white,
    });
    s.addText(b, {
      x: M + 0.54, y: y + 0.29, w: 4.75, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 10.5, color: "9FB6CE",
    });
    y += 0.78;
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 5.94, w: 5.15, h: 0.86, rectRadius: 0.08,
    fill: { color: "0E2338" }, line: { color: "1E3E5F", width: 1 },
  });
  s.addText("ASKED OF THE COUNCIL", {
    x: M + 0.22, y: 6.06, w: 4.0, h: 0.22, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 8.5, bold: true, charSpacing: 1.3, color: C.orange,
  });
  s.addText("Endorsement to continue development, and agreement on the faculty rollout list.", {
    x: M + 0.22, y: 6.3, w: 4.75, h: 0.42, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 11, color: "C3D6EA", lineSpacingMultiple: 1.0,
  });

  // cross-platform note
  s.addShape(pres.ShapeType.roundRect, {
    x: 6.0, y: 2.05, w: 6.71, h: 1.74, rectRadius: 0.08,
    fill: { color: C.deep2 }, line: { color: "23456C", width: 1 },
  });
  s.addText("PLATFORM COVERAGE", {
    x: 6.28, y: 2.24, w: 4.0, h: 0.24, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 9, bold: true, charSpacing: 1.5, color: C.orange,
  });
  s.addText("Windows is the first validated desktop platform. The architecture is cross-platform in principle, allowing CIP to be extended to macOS while retaining the same controlled authentication and private content-delivery model.", {
    x: 6.28, y: 2.5, w: 6.18, h: 0.86, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 11.5, color: "C3D6EA", lineSpacingMultiple: 1.04,
  });
  s.addText("macOS work would be packaging, Keychain integration, signing / notarization and acceptance testing — it does not exist yet.", {
    x: 6.28, y: 3.36, w: 6.18, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 10, italic: true, color: "8FA8C2",
  });

  // value statement
  s.addShape(pres.ShapeType.roundRect, {
    x: 6.0, y: 3.95, w: 6.71, h: 2.45, rectRadius: 0.08,
    fill: { color: "1D4370" }, line: { color: "3A6FA0", width: 1 },
  });
  s.addText("VALUE TO THE DEPARTMENT", {
    x: 6.28, y: 4.12, w: 4.6, h: 0.24, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 9, bold: true, charSpacing: 1.5, color: C.cyan,
  });
  s.addText("Curriculum intelligence in a controlled lifecycle", {
    x: 6.28, y: 4.38, w: 6.15, h: 0.36, isTextBox: true, margin: 0,
    fontFace: F.head, fontSize: 17, bold: true, color: C.white,
  });

  const lifecycle = [
    ["Faculty authorization", 1.80], ["Controlled delivery", 1.64], ["Validated local operation", 2.08],
    ["Managed releases", 1.46], ["Continuous improvement", 1.94],
  ];
  let lx = 6.28, ly = 4.84;
  lifecycle.forEach(([t, wdt], i) => {
    if (i === 3) { lx = 6.28; ly += 0.42; }
    s.addShape(pres.ShapeType.roundRect, {
      x: lx, y: ly, w: wdt, h: 0.34, rectRadius: 0.17,
      fill: { color: "2A5A8C" }, line: { color: "4A80B0", width: 1 },
    });
    s.addText(t, {
      x: lx, y: ly, w: wdt, h: 0.34, isTextBox: true, margin: 0, align: "center", valign: "middle",
      fontFace: F.body, fontSize: 9.5, bold: true, color: C.white,
    });
    lx += wdt + 0.12;
  });

  s.addText("CIP is a sustainable Curriculum Committee digital asset — supporting review, documentation, visibility and continuous improvement, alongside the department's official accreditation processes rather than in place of them.", {
    x: 6.28, y: 5.76, w: 6.18, h: 0.56, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 10.5, italic: true, color: "BCD1E5", lineSpacingMultiple: 1.0,
  });

  s.addNotes(
    "Close on ownership: this is the committee's asset and the roadmap is modest and fundable in effort. Ask the " +
    "council for endorsement of continued development and for agreement on the faculty rollout list."
  );
  footer(s, 11, true);
}

pres.writeFile({ fileName: OUT }).then(() => console.log("Written:", OUT));
