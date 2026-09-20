/**
 * Curriculum Intelligence Portal — Department Council presentation.
 * Build:  node build_deck.js      (requires pptxgenjs)
 *
 * Typography rule for this deck: no text is smaller than 14pt (T.min).
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
  slate: "50607A",
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

/* Type scale. Nothing in this deck is allowed below T.min. */
const T = {
  min: 14,
  title: 32,
  kicker: 14,
  sub: 15,
  cardHead: 16,
  body: 14,
  caption: 14,
  footer: 14,
};

const W = 13.333, H = 7.5, M = 0.62;
const FOOT_Y = 6.85;

/* ---------- helpers ---------- */

const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE";
pres.author = "Curriculum Committee, Department of Communications and Networks Engineering";
pres.company = "Prince Sultan University — College of Engineering";
pres.title = "Curriculum Intelligence Portal (CIP)";

function shadow(blur = 10, opacity = 0.07) {
  return { type: "outer", blur, offset: 3, angle: 90, color: "0B1B2E", opacity };
}

function darkSlide() {
  const s = pres.addSlide();
  s.background = { color: C.deep };
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { color: C.deep } });
  return s;
}

function lightSlide() {
  const s = pres.addSlide();
  s.background = { color: C.white };
  return s;
}

function heading(s, kicker, title, dark = false) {
  s.addText(kicker.toUpperCase(), {
    x: M, y: 0.4, w: 11.6, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.kicker, bold: true, charSpacing: 1.8,
    color: dark ? C.orange : C.amber,
  });
  s.addText(title, {
    x: M, y: 0.74, w: 11.9, h: 0.68, isTextBox: true, margin: 0,
    fontFace: F.head, fontSize: T.title, bold: true,
    color: dark ? C.white : C.navy,
  });
}

function subline(s, text, dark = false, y = 1.44) {
  s.addText(text, {
    x: M, y, w: 12.0, h: 0.34, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.sub, color: dark ? "AFC3D8" : C.slate,
  });
}

function footer(s, n, dark = false) {
  s.addText("Curriculum Intelligence Portal  ·  Curriculum Committee  ·  Undergraduate Electrical Engineering", {
    x: M, y: FOOT_Y, w: 10.9, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.footer, color: dark ? "5D7690" : "A9B6C4",
  });
  s.addText(String(n), {
    x: W - M - 0.7, y: FOOT_Y, w: 0.7, h: 0.32, isTextBox: true, margin: 0, align: "right",
    fontFace: F.body, fontSize: T.footer, bold: true, color: dark ? "5D7690" : "A9B6C4",
  });
}

function caption(s, x, y, w, text, dark = false) {
  s.addText(text, {
    x, y, w, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.caption, italic: true, color: dark ? "7B93AC" : "8A9AAC",
  });
}

function card(s, x, y, w, h, opts = {}) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: opts.fill || C.panel },
    line: { color: opts.line || C.line, width: opts.lw === undefined ? 1 : opts.lw },
    shadow: opts.shadow === false ? undefined : shadow(),
  });
}

function chip(s, x, y, label, opts = {}) {
  const sz = opts.size || 0.4;
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w: sz, h: sz, rectRadius: 0.25,
    fill: { color: opts.fill || C.navy }, line: { color: opts.fill || C.navy, width: 0 },
  });
  s.addText(label, {
    x, y, w: sz, h: sz, isTextBox: true, margin: 0, align: "center", valign: "middle",
    fontFace: F.body, fontSize: T.min, bold: true, color: opts.color || C.white,
  });
}

/** Heading + body pair used inside and outside cards. */
function pair(s, x, y, w, head, body, o = {}) {
  s.addText(head, {
    x, y, w, h: o.headH || 0.3, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: o.headSize || T.cardHead, bold: true, color: o.headColor || C.navy,
  });
  s.addText(body, {
    x, y: y + (o.gap || 0.33), w, h: o.bodyH || 0.6, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.body, color: o.bodyColor || C.slate, lineSpacingMultiple: 1.06,
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
      fontFace: F.body, fontSize: T.body, color: o.color || C.ink,
      lineSpacingMultiple: 1.04, paraSpaceAfter: o.gap === undefined ? 7 : o.gap,
    }
  );
}

/* =====================================================================
   1 — Title
   ===================================================================== */
{
  const s = darkSlide();

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
    x: M, y: 1.5, w: 8.0, h: 0.34, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.min, bold: true, charSpacing: 1.6, color: C.orange,
  });

  s.addText("Curriculum Intelligence Portal", {
    x: M, y: 1.98, w: 7.6, h: 1.5, isTextBox: true, margin: 0,
    fontFace: F.head, fontSize: 48, bold: true, color: C.white, lineSpacingMultiple: 0.92,
  });

  s.addText("Undergraduate EE curriculum intelligence and continuous-improvement platform", {
    x: M, y: 3.6, w: 7.1, h: 0.78, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: 17, color: "C3D6EA", lineSpacingMultiple: 1.1,
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 4.62, w: 3.7, h: 0.48, rectRadius: 0.22,
    fill: { color: "1B3A5C" }, line: { color: "2D5C8A", width: 1 },
  });
  s.addText("CIP Desktop 1.0.0  ·  r000000000003", {
    x: M, y: 4.62, w: 3.7, h: 0.48, isTextBox: true, margin: 0, align: "center", valign: "middle",
    fontFace: F.body, fontSize: T.min, bold: true, color: C.cyan,
  });

  s.addText(
    [
      { text: "Curriculum Committee", options: { bold: true, color: C.white, breakLine: true } },
      { text: "Department of Communications and Networks Engineering", options: { breakLine: true } },
      { text: "Presented to the Department Council", options: {} },
    ],
    {
      x: M, y: 5.4, w: 7.4, h: 1.15, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.min, color: "9FB6CE", lineSpacingMultiple: 1.25,
    }
  );

  s.addNotes(
    "Framing: CIP is a Curriculum Committee software asset, built by and for the committee. " +
    "This session covers the undergraduate Electrical Engineering program only. " +
    "MSc/graduate modules exist but are under construction and pending approval."
  );
  footer(s, 1, true);
}

/* =====================================================================
   2 — Why CIP was needed
   ===================================================================== */
{
  const s = lightSlide();
  heading(s, "The problem we set out to solve", "Why CIP was needed");
  subline(s, "One undergraduate program carries thousands of curriculum relationships, held in files rather than in a system.");

  const probs = [
    ["1", "Curriculum data is distributed",
      "Course specifications, CLOs, mappings, assessment material and committee records live in separate files."],
    ["2", "Faculty need one clear view",
      "Coordinators and instructors need their course, its outcomes and its mappings without chasing documents."],
    ["3", "Committee work needs traceability",
      "Review must be consistent and evidence-based across terms, and fast enough to finish inside a review cycle."],
  ];

  let y = 1.98;
  probs.forEach(([n, title, body]) => {
    card(s, M, y, 7.35, 1.48);
    chip(s, M + 0.3, y + 0.28, n, { fill: C.navy });
    s.addText(title, {
      x: M + 0.92, y: y + 0.2, w: 6.2, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.cardHead, bold: true, color: C.navy,
    });
    s.addText(body, {
      x: M + 0.92, y: y + 0.58, w: 6.25, h: 0.78, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.body, color: C.slate, lineSpacingMultiple: 1.06,
    });
    y += 1.58;
  });

  card(s, 8.35, 1.98, 4.36, 4.64, { fill: C.navy, line: C.navy, lw: 0 });
  s.addText("THE PROGRAM IN DATA", {
    x: 8.68, y: 2.24, w: 3.8, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.min, bold: true, charSpacing: 0.6, color: C.orange,
  });

  const stats = [
    ["32", "courses modelled"],
    ["171", "course learning outcomes"],
    ["7", "ABET student outcomes"],
    ["20", "performance indicators"],
    ["466", "CLO → PI relationships"],
  ];
  let sy = 2.68;
  stats.forEach(([num, label]) => {
    s.addText(num, {
      x: 8.68, y: sy, w: 1.05, h: 0.5, isTextBox: true, margin: 0,
      fontFace: F.head, fontSize: 28, bold: true, color: C.white,
    });
    s.addText(label, {
      x: 9.8, y: sy + 0.08, w: 2.6, h: 0.42, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.body, color: "AFC7DD",
    });
    sy += 0.68;
  });

  s.addText("Every one of these has to stay consistent, defensible and documented.", {
    x: 8.68, y: 6.02, w: 3.7, h: 0.56, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.body, italic: true, color: "CFE0EF", lineSpacingMultiple: 1.04,
  });

  s.addNotes(
    "The point is scale, not complaint. These numbers cannot be reviewed reliably by opening files one at a time. " +
    "Every figure is read from the committee's own approved data."
  );
  footer(s, 2);
}

/* =====================================================================
   3 — What CIP is
   ===================================================================== */
{
  const s = lightSlide();
  heading(s, "Definition", "What CIP is");
  subline(s, "A secure desktop curriculum portal: installed by faculty, delivered under committee control, usable offline.");

  const items = [
    ["A", "Curriculum intelligence portal", "Structured access to courses, outcomes, mappings, assessment and improvement views."],
    ["B", "Desktop application", "Faculty install CIP Desktop. The portal opens from a validated local copy."],
    ["C", "Authenticated download", "Content is obtained once through an authorized session, then held locally."],
    ["D", "Offline and controlled updates", "Works without a network; new releases arrive through a managed channel."],
  ];

  let y = 2.02;
  items.forEach(([n, t, b]) => {
    chip(s, M, y + 0.02, n, { fill: n === "A" ? C.orange : C.navy, color: n === "A" ? C.deep : C.white });
    s.addText(t, {
      x: M + 0.6, y, w: 5.3, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.cardHead, bold: true, color: C.navy,
    });
    s.addText(b, {
      x: M + 0.6, y: y + 0.34, w: 5.4, h: 0.56, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.body, color: C.slate, lineSpacingMultiple: 1.06,
    });
    y += 1.0;
  });

  s.addText("MSc / graduate modules are under construction and pending approval, and are not part of this presentation.", {
    x: M, y: 6.06, w: 6.0, h: 0.58, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.body, italic: true, color: C.amber, lineSpacingMultiple: 1.04,
  });

  card(s, 6.85, 1.98, 5.86, 3.94, { fill: C.panel2, line: C.line });
  s.addImage({ path: SHOT + "cip-home.png", x: 7.0, y: 2.12, w: 5.56, h: 3.475 });
  caption(s, 6.85, 6.02, 5.86, "Portal entry view, undergraduate and graduate program areas");

  s.addNotes(
    "Keep this short. CIP is a portal that happens to be delivered as a desktop application; the desktop part " +
    "is a governance decision, covered later. Note the MSc status once, in passing."
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

  card(s, M, 1.98, 3.55, 4.62, { fill: C.panel });
  s.addText("WHAT IT COVERS", {
    x: M + 0.3, y: 2.22, w: 3.0, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.min, bold: true, charSpacing: 0.8, color: C.amber,
  });
  bullets(s, [
    "Program overview and objectives",
    "Course structure and prerequisites",
    "CLO / SO / PI relationships",
    "Curriculum maps and coverage",
    "Assessment and improvement views",
    "Navigation across modules",
  ], { x: M + 0.3, y: 2.66, w: 2.98, h: 3.7, gap: 12 });

  s.addImage({ path: SHOT + "program-structure-crop.png", x: 4.45, y: 1.98, w: 8.26, h: 2.51 });
  caption(s, 4.45, 4.56, 8.26, "Program structure, rendered from the committee's approved curriculum data");

  pair(s, 4.45, 5.14, 3.9,
    "138 credit hours",
    "Read from the program structure data, so the figures cannot drift from the study plan.",
    { bodyH: 0.9 });

  pair(s, 8.8, 5.14, 3.9,
    "Nothing is retyped",
    "Mission, objectives and the seven Student Outcomes come from the same file the mappings use.",
    { bodyH: 0.9 });

  s.addNotes(
    "Demonstrate live if the room allows. Emphasise that nothing here is re-typed: the credit distribution, the " +
    "study plan and the outcome statements all render from one authoritative dataset."
  );
  footer(s, 4);
}

/* =====================================================================
   5 — Course-level intelligence
   ===================================================================== */
{
  const s = lightSlide();
  heading(s, "Course level", "Course-level intelligence");
  subline(s, "Every course on one page: outcomes, mappings, teaching strategies and assessment methods.");

  s.addImage({ path: SHOT + "course-dashboard-crop.png", x: M, y: 1.98, w: 5.97, h: 4.284 });
  caption(s, M, 6.34, 5.97, "Course dashboard: CLO–SO–PI mapping and approved methods");

  const rows = [
    ["Course dashboards", "Description, objectives, credits, prerequisites and topics."],
    ["CLO visibility", "Every course learning outcome with its NQF domain and approved wording."],
    ["Teaching and assessment", "15 approved teaching strategies and 16 assessment methods."],
    ["Course-to-program alignment", "Each CLO against the outcomes and indicators it supports."],
  ];
  let y = 1.98;
  rows.forEach(([t, b], i) => {
    card(s, 7.0, y, 5.71, 1.0, { fill: i === 3 ? C.panel2 : C.panel });
    s.addText(t, {
      x: 7.26, y: y + 0.12, w: 5.2, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.cardHead, bold: true, color: C.navy,
    });
    s.addText(b, {
      x: 7.26, y: y + 0.46, w: 5.22, h: 0.46, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.body, color: C.slate, lineSpacingMultiple: 1.0,
    });
    y += 1.08;
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: 7.0, y: 6.24, w: 5.71, h: 0.52, rectRadius: 0.1,
    fill: { color: "FDF4E4" }, line: { color: "EFD3A4", width: 1 },
  });
  s.addText("Faculty, coordinators and reviewers work from one page.", {
    x: 7.2, y: 6.24, w: 5.35, h: 0.52, isTextBox: true, margin: 0, valign: "middle",
    fontFace: F.body, fontSize: T.body, bold: true, color: C.amber,
  });

  s.addNotes(
    "A coordinator preparing a syllabus, an instructor checking their CLOs and a committee reviewer all look at " +
    "the same page, which removes most version disagreements."
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

  s.addImage({ path: SHOT + "alignment-review-crop.png", x: 6.11, y: 1.98, w: 6.6, h: 4.287 });
  caption(s, 6.11, 6.34, 6.6, "Alignment review: conclusions first, then the items worth confirming");

  const feats = [
    ["CLO–SO–PI mapping visibility", "Outcome coverage, per-course contribution and the CLO–PI explorer."],
    ["Review analysis engine", "Reads approved CLO wording, artefacts and assessment methods against each indicator."],
    ["Gaps, overlaps and documentation", "Surfaces what is thin, what is duplicated and what needs confirming."],
  ];
  let y = 1.98;
  feats.forEach(([t, b], i) => {
    chip(s, M, y + 0.02, String(i + 1), { fill: C.navy });
    s.addText(t, {
      x: M + 0.6, y, w: 4.6, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.cardHead, bold: true, color: C.navy,
    });
    s.addText(b, {
      x: M + 0.6, y: y + 0.34, w: 4.66, h: 0.72, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.body, color: C.slate, lineSpacingMultiple: 1.06,
    });
    y += 1.16;
  });

  card(s, M, 5.6, 5.26, 1.14, { fill: "EAF3EC", line: "BFDCC8" });
  s.addText(
    [
      { text: "Supportive, not punitive.  ", options: { bold: true, color: C.green } },
      { text: "The engine reports status and suggests confirmation. It never grades a colleague and stores no student performance data.", options: { color: "3F5C4C" } },
    ],
    {
      x: M + 0.24, y: 5.68, w: 4.82, h: 1.0, isTextBox: true, margin: 0, valign: "middle",
      fontFace: F.body, fontSize: T.body, lineSpacingMultiple: 1.04,
    }
  );

  s.addNotes(
    "Stress the philosophy. Labels are descriptive and point at documentation to confirm, not at a person. " +
    "The Measurement and Improvement layers are deliberately empty: no attainment value is stored or displayed."
  );
  footer(s, 6);
}

/* =====================================================================
   7 — What the portal can do today  (capabilities summary)
   ===================================================================== */
{
  const s = lightSlide();
  heading(s, "Capabilities", "What the portal can do today");
  subline(s, "Everything below is produced from the same curriculum record, not from separate working copies.");

  const groups = [
    {
      head: "See", color: C.navy,
      items: [
        "Program structure, prerequisite flow and the four-year study plan",
        "Course–SO–PI performance heatmaps, exportable as PNG",
        "Textbooks and references for every course",
        "Teaching strategies and assessment methods",
      ],
    },
    {
      head: "Review", color: C.teal,
      items: [
        "CLO review with per-CLO faculty comments",
        "SO mapping review across all seven Student Outcomes",
        "CLO–SO–PI alignment and evidence analysis",
      ],
    },
    {
      head: "Produce", color: C.green,
      items: [
        "NCAAA course specifications in Word, from the approved template",
        "CLO revision reports in Word",
        "Course, CLO-review, SO-mapping and change-request PDFs",
      ],
    },
  ];

  let gy = 1.98;
  groups.forEach((g) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y: gy + 0.04, w: 0.22, h: 0.22, rectRadius: 0.1,
      fill: { color: g.color }, line: { color: g.color, width: 0 },
    });
    s.addText(g.head, {
      x: M + 0.36, y: gy, w: 2.0, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.cardHead, bold: true, color: g.color,
    });
    bullets(s, g.items, {
      x: M + 0.36, y: gy + 0.36, w: 5.95, h: g.items.length * 0.315 + 0.1, gap: 4,
    });
    gy += 0.38 + g.items.length * 0.315 + 0.16;
  });

  // pi-heatmap-crop.png is 1800 x 912 (aspect 1.9737)
  s.addImage({ path: SHOT + "pi-heatmap-crop.png", x: 7.15, y: 1.98, w: 5.56, h: 2.817 });
  caption(s, 7.15, 4.9, 5.56, "PI heatmap: approved I / P / M levels per course");

  card(s, 7.15, 5.42, 5.56, 1.22, { fill: C.panel });
  s.addText(
    [
      { text: "Generated, not maintained by hand.  ", options: { bold: true, color: C.navy } },
      { text: "Course specifications and review reports are built from the live data, so they cannot fall out of step with it.", options: { color: C.slate } },
    ],
    {
      x: 7.4, y: 5.5, w: 5.08, h: 1.06, isTextBox: true, margin: 0, valign: "middle",
      fontFace: F.body, fontSize: T.body, lineSpacingMultiple: 1.04,
    }
  );

  s.addNotes(
    "This is the consolidated answer to \"what does it actually do\". Worth pausing on the Word generation: " +
    "the NCAAA course specification uses the department's approved template and the committee's own data."
  );
  footer(s, 7);
}

/* =====================================================================
   8 — Continuous improvement support
   ===================================================================== */
{
  const s = lightSlide();
  heading(s, "The cycle", "Continuous improvement support");
  subline(s, "Curriculum evidence moves from source files, through CIP, into committee decisions, and back again.");

  const stages = [
    ["Source data", "Specs, CLOs, mappings,\nassessment plans", C.navy],
    ["CIP intelligence", "One linked, searchable\ncurriculum view", C.teal],
    ["Committee decisions", "Evidence-based review,\nrecorded outcomes", C.amber],
    ["Continuous improvement", "CLO revisions, mapping\nand documentation updates", C.green],
  ];
  const bw = 2.72, bh = 1.68, gap = 0.44;
  let x = M;
  stages.forEach(([t, b, col], i) => {
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 1.98, w: bw, h: bh, rectRadius: 0.08,
      fill: { color: C.white }, line: { color: col, width: 1.5 }, shadow: shadow(9, 0.08),
    });
    s.addShape(pres.ShapeType.roundRect, {
      x: x + 0.24, y: 2.18, w: 0.28, h: 0.28, rectRadius: 0.25,
      fill: { color: col }, line: { color: col, width: 0 },
    });
    s.addText(t, {
      x: x + 0.24, y: 2.54, w: bw - 0.44, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 15, bold: true, color: col,
    });
    s.addText(b, {
      x: x + 0.24, y: 2.9, w: bw - 0.4, h: 0.68, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.body, color: C.slate, lineSpacingMultiple: 1.0,
    });
    if (i < 3) {
      s.addShape(pres.ShapeType.rightArrow, {
        x: x + bw + 0.09, y: 2.68, w: 0.28, h: 0.28,
        fill: { color: C.line }, line: { color: C.line, width: 0 },
      });
    }
    x += bw + gap;
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 3.86, w: 12.09, h: 0.5, rectRadius: 0.24,
    fill: { color: C.panel }, line: { color: C.line, width: 1 },
  });
  s.addText("Improvement evidence feeds the next curriculum revision cycle", {
    x: M, y: 3.86, w: 12.09, h: 0.5, isTextBox: true, margin: 0, align: "center", valign: "middle",
    fontFace: F.body, fontSize: T.body, italic: true, color: C.slate,
  });

  const gains = [
    ["Structured evidence for discussion", "Committee conversations start from the same view of the curriculum."],
    ["Change and review outputs tracked", "Reports are produced from live data and kept with the release."],
    ["Less manual searching", "The current version of a mapping or a CLO is where everyone expects it."],
  ];
  const gw = 3.9, ggap = 0.2;
  let gx = M;
  gains.forEach(([t, b]) => {
    card(s, gx, 4.72, gw, 1.5, { fill: C.panel, shadow: false });
    s.addText(t, {
      x: gx + 0.26, y: 4.9, w: gw - 0.5, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: 15, bold: true, color: C.navy,
    });
    s.addText(b, {
      x: gx + 0.26, y: 5.24, w: gw - 0.5, h: 0.86, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.body, color: C.slate, lineSpacingMultiple: 1.04,
    });
    gx += gw + ggap;
  });

  s.addNotes(
    "The value argument for the department: CIP does not make curriculum decisions. It makes the evidence for " +
    "those decisions available quickly and consistently, and keeps the result with the release."
  );
  footer(s, 8);
}

/* =====================================================================
   9 — From public web portal to controlled desktop platform
   ===================================================================== */
{
  const s = darkSlide();
  heading(s, "Architecture decision", "From public web portal to controlled desktop platform", true);
  subline(s, "Curriculum information is institutional data. The delivery model was changed to match that.", true);

  const stages = [
    {
      tag: "STAGE 1", title: "GitHub Pages model",
      good: ["Simple deployment", "Browser access anywhere", "Fast iteration", "Proved the concept"],
      limLabel: "DATA-GOVERNANCE LIMITATION",
      lim: "Static public web hosting. Files are served from a publicly reachable location, knowing the URL can make static resources retrievable, and no server-side authorization protects the package.",
      col: "8FA8C2",
    },
    {
      tag: "STAGE 2", title: "A deliberate evolution",
      good: ["Protection by design", "Authorization before delivery", "Least exposure", "Controlled distribution"],
      limLabel: "WHY WE MOVED",
      lim: "The committee chose a controlled desktop architecture so that governance of curriculum data is enforced by the delivery model, not by the obscurity of a link.",
      col: C.orange,
    },
    {
      tag: "STAGE 3", title: "CIP Desktop",
      good: ["Authenticated gateway", "Private release storage", "Verified package", "Validated local copy"],
      limLabel: "RELEASE MANAGEMENT",
      lim: "Release identifiers and integrity hashes, delivered through a managed update channel so faculty machines do not diverge into unmanaged curriculum copies.",
      col: C.cyan,
    },
  ];

  let x = M;
  const cw = 3.73, gapx = 0.45;
  stages.forEach((st) => {
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 1.96, w: cw, h: 4.32, rectRadius: 0.08,
      fill: { color: C.deep2 }, line: { color: "23456C", width: 1 },
    });
    s.addText(st.tag, {
      x: x + 0.26, y: 2.12, w: 2.4, h: 0.28, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.min, bold: true, charSpacing: 0.8, color: st.col,
    });
    s.addText(st.title, {
      x: x + 0.26, y: 2.44, w: cw - 0.5, h: 0.36, isTextBox: true, margin: 0,
      fontFace: F.head, fontSize: 18, bold: true, color: C.white,
    });
    bullets(s, st.good, { x: x + 0.26, y: 2.9, w: cw - 0.52, h: 1.4, gap: 3, color: "BCD1E5" });

    s.addShape(pres.ShapeType.roundRect, {
      x: x + 0.2, y: 4.36, w: cw - 0.4, h: 1.78, rectRadius: 0.07,
      fill: { color: "0E2338" }, line: { color: "1E3E5F", width: 1 },
    });
    s.addText(st.limLabel, {
      x: x + 0.38, y: 4.46, w: cw - 0.76, h: 0.28, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.min, bold: true, color: st.col,
    });
    s.addText(st.lim, {
      x: x + 0.38, y: 4.78, w: cw - 0.76, h: 1.28, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.body, color: "9FB6CE", lineSpacingMultiple: 1.02,
    });
    x += cw + gapx;
  });

  s.addText(
    [
      { text: "GitHub Pages is not being called insecure. ", options: { bold: true, color: C.orange } },
      { text: "Its public static-hosting model does not match our data-governance requirements.", options: { color: "9FB6CE" } },
    ],
    {
      x: M, y: 6.38, w: 12.09, h: 0.34, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.body,
    }
  );

  s.addNotes(
    "Be precise. Stage 1 was the right choice for proving the concept and we are not disowning it. What changed " +
    "is the requirement: once the portal held the approved curriculum record, we needed authorization before delivery."
  );
  footer(s, 9, true);
}

/* =====================================================================
   10 — Current security and data architecture
   ===================================================================== */
{
  const s = darkSlide();
  heading(s, "Security and deployment model", "How controlled delivery works", true);
  subline(s, "Authorized faculty, private storage, verified package, local trusted copy.", true);

  s.addText("FACULTY ACCESS CHAIN", {
    x: M, y: 1.96, w: 4.6, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.min, bold: true, charSpacing: 0.8, color: C.orange,
  });

  const chain = [
    "Authorized PSU email",
    "One-time verification code",
    "Authenticated faculty session",
    "Private CIP release service",
    "Private cloud object storage",
    "Verified release package",
    "Local copy on the faculty computer",
    "Offline-capable operation",
  ];
  const cx = M + 0.16, top = 2.42, step = 0.5;
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
      x: cx + 0.46, y: y - 0.06, w: 4.6, h: 0.36, isTextBox: true, margin: 0, valign: "middle",
      fontFace: F.body, fontSize: T.body, bold: last, color: last ? C.white : "C3D6EA",
    });
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: 5.85, y: 1.92, w: 6.86, h: 3.44, rectRadius: 0.08,
    fill: { color: C.deep2 }, line: { color: "23456C", width: 1 },
  });
  s.addText("CURRENT SECURITY AND DATA ARCHITECTURE", {
    x: 6.12, y: 2.1, w: 6.2, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.min, bold: true, charSpacing: 0.6, color: C.orange,
  });
  bullets(s, [
    "Faculty are authorized by email; release metadata and downloads require a valid session.",
    "Session credentials are held by the desktop application in the operating system credential store.",
    "Release packages sit in private cloud object storage; the bucket is not publicly exposed.",
    "The portal runs from the validated local release and keeps working offline.",
    "Releases carry identifiers and integrity hashes, delivered through one controlled channel.",
  ], { x: 6.12, y: 2.5, w: 6.32, h: 2.7, gap: 6, color: "C3D6EA" });

  s.addShape(pres.ShapeType.roundRect, {
    x: 5.85, y: 5.52, w: 6.86, h: 1.16, rectRadius: 0.08,
    fill: { color: "1D4370" }, line: { color: "3A6FA0", width: 1 },
  });
  s.addText("THE OBJECTIVE, STATED ACCURATELY", {
    x: 6.12, y: 5.62, w: 6.2, h: 0.28, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.min, bold: true, color: C.cyan,
  });
  s.addText("Controlled access, controlled distribution, reduced public exposure, release integrity, and managed synchronization of authorized local copies. Not digital rights management.", {
    x: 6.12, y: 5.94, w: 6.34, h: 0.7, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.body, italic: true, color: C.white, lineSpacingMultiple: 1.02,
  });

  s.addText("Windows is the first validated desktop platform.", {
    x: M, y: 6.42, w: 5.0, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.body, bold: true, color: "8FA8C2",
  });

  s.addNotes(
    "If asked about local files: an authorized faculty member can of course inspect what is on their own machine, " +
    "and we do not claim otherwise. The gain is no public URL, a hash-verified copy, and one managed release."
  );
  footer(s, 10, true);
}

/* =====================================================================
   11 — Current production status
   ===================================================================== */
{
  const s = lightSlide();
  heading(s, "Where we are today", "Current production status");
  subline(s, "The undergraduate platform is prepared and tested; graduate modules remain under construction.");

  const status = [
    ["CIP Desktop 1.0.0", "Prepared", "Windows desktop application, built and packaged for faculty installation.", C.green],
    ["Content release r000000000003", "Current", "Identified release with a per-file integrity manifest.", C.green],
    ["Automatic content updates", "Tested", "A new content release was delivered to an installed client and verified.", C.green],
    ["First trusted-user testing", "Completed", "Initial authorized faculty test completed successfully.", C.green],
    ["Undergraduate EE modules", "In use", "Program, course, alignment and improvement views in active use.", C.navy],
    ["MSc / graduate modules", "Under construction", "Pending approval; outside the scope of this presentation.", C.amber],
  ];

  let y = 1.98;
  status.forEach(([t, badge, b, col], i) => {
    const x = i % 2 === 0 ? M : 6.85;
    if (i % 2 === 0 && i > 0) y += 1.56;
    card(s, x, y, 5.86, 1.4, { fill: i >= 4 ? C.panel2 : C.panel });
    s.addText(t, {
      x: x + 0.26, y: y + 0.16, w: 3.45, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.cardHead, bold: true, color: C.navy,
    });
    s.addShape(pres.ShapeType.roundRect, {
      x: x + 3.78, y: y + 0.15, w: 1.85, h: 0.36, rectRadius: 0.18,
      fill: { color: col === C.green ? "E4F1E9" : col === C.amber ? "FDF1DD" : "E3EAF4" },
      line: { color: col === C.green ? "BFDCC8" : col === C.amber ? "EFD3A4" : "C6D4E6", width: 1 },
    });
    s.addText(badge, {
      x: x + 3.78, y: y + 0.15, w: 1.85, h: 0.36, isTextBox: true, margin: 0,
      align: "center", valign: "middle", fontFace: F.body, fontSize: T.min, bold: true, color: col,
    });
    s.addText(b, {
      x: x + 0.26, y: y + 0.6, w: 5.36, h: 0.68, isTextBox: true, margin: 0,
      fontFace: F.body, fontSize: T.body, color: C.slate, lineSpacingMultiple: 1.04,
    });
  });

  s.addNotes(
    "Status, not promises. Everything marked here has actually been done, and the release identifier is the one " +
    "currently packaged in the repository. Broader faculty rollout follows once the committee agrees."
  );
  footer(s, 11);
}

/* =====================================================================
   12 — Roadmap and committee value
   ===================================================================== */
{
  const s = darkSlide();
  heading(s, "Next steps", "Roadmap and committee value", true);
  subline(s, "A maintained departmental asset, not a one-off project.", true);

  const road = [
    ["1", "Automate content releases"],
    ["2", "Desktop self-update"],
    ["3", "Visible version indicator"],
    ["4", "Documentation and user guide"],
    ["5", "Extend to other programs"],
  ];

  let y = 1.98;
  road.forEach(([n, t]) => {
    chip(s, M, y, n, { fill: "1D4370", color: C.cyan, size: 0.36 });
    s.addText(t, {
      x: M + 0.56, y: y - 0.02, w: 4.9, h: 0.4, isTextBox: true, margin: 0, valign: "middle",
      fontFace: F.body, fontSize: T.cardHead, color: C.white,
    });
    y += 0.56;
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 5.0, w: 5.3, h: 1.34, rectRadius: 0.08,
    fill: { color: "0E2338" }, line: { color: "1E3E5F", width: 1 },
  });
  s.addText("ASKED OF THE COUNCIL", {
    x: M + 0.24, y: 5.14, w: 4.4, h: 0.28, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.min, bold: true, color: C.orange,
  });
  s.addText("Endorsement to continue development, and agreement on the faculty rollout list.", {
    x: M + 0.24, y: 5.48, w: 4.85, h: 0.74, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.body, color: "C3D6EA", lineSpacingMultiple: 1.04,
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: 6.3, y: 1.96, w: 6.41, h: 1.9, rectRadius: 0.08,
    fill: { color: C.deep2 }, line: { color: "23456C", width: 1 },
  });
  s.addText("PLATFORM COVERAGE", {
    x: 6.56, y: 2.12, w: 4.6, h: 0.28, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.min, bold: true, color: C.orange,
  });
  s.addText("Windows is the first validated desktop platform. The architecture is cross-platform in principle, allowing CIP to be extended to macOS while retaining the same authentication and private content-delivery model.", {
    x: 6.56, y: 2.44, w: 5.9, h: 1.3, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.body, color: "C3D6EA", lineSpacingMultiple: 1.04,
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: 6.3, y: 4.04, w: 6.41, h: 2.3, rectRadius: 0.08,
    fill: { color: "1D4370" }, line: { color: "3A6FA0", width: 1 },
  });
  s.addText("VALUE TO THE DEPARTMENT", {
    x: 6.56, y: 4.18, w: 4.9, h: 0.28, isTextBox: true, margin: 0,
    fontFace: F.body, fontSize: T.min, bold: true, color: C.cyan,
  });
  s.addText("Curriculum intelligence in a controlled lifecycle.", {
    x: 6.56, y: 4.5, w: 5.9, h: 0.36, isTextBox: true, margin: 0,
    fontFace: F.head, fontSize: 17, bold: true, color: C.white,
  });

  const lifecycle = [
    ["Faculty authorization", 2.14], ["Controlled delivery", 1.96],
    ["Validated local operation", 2.48], ["Managed releases", 1.72],
    ["Continuous improvement", 2.22],
  ];
  let lx = 6.56, ly = 4.98;
  lifecycle.forEach(([t, wdt], i) => {
    if (i === 2 || i === 4) { lx = 6.56; ly += 0.44; }
    s.addShape(pres.ShapeType.roundRect, {
      x: lx, y: ly, w: wdt, h: 0.38, rectRadius: 0.19,
      fill: { color: "2A5A8C" }, line: { color: "4A80B0", width: 1 },
    });
    s.addText(t, {
      x: lx, y: ly, w: wdt, h: 0.38, isTextBox: true, margin: 0, align: "center", valign: "middle",
      fontFace: F.body, fontSize: T.min, color: C.white,
    });
    lx += wdt + 0.14;
  });

  s.addNotes(
    "Close on ownership: this is the committee's asset and the roadmap is modest. Ask the council for endorsement " +
    "of continued development and for agreement on the faculty rollout list."
  );
  footer(s, 12, true);
}

pres.writeFile({ fileName: OUT }).then(() => console.log("Written:", OUT));
