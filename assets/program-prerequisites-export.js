/* PNG export for the Prerequisite Flow board.
 *
 * program-prerequisites.js builds a plain-data snapshot of the board — the
 * geometry it has already routed, plus the exact highlight state on screen — and
 * hands it to window.CIPFlowExport.renderPng(). This module paints that snapshot
 * onto a 2D canvas and returns a PNG blob. Nothing is read from the DOM here and
 * no image, font or network resource is loaded, so it works offline and under the
 * strict Content Security Policy (which allows no data:/blob: images, ruling out
 * an SVG-to-image round trip). The colours mirror program-prerequisites.css.
 */
(() => {
  'use strict';

  const C = {
    board: '#060b14',
    tile: '#0d1626',
    trace: '#38587a',
    via: '#5b83ab',
    up: '#ffc04d',
    upSoft: '#b88a3c',
    down: '#5fd3ff',
    downSoft: '#3f8ead',
    co: '#7ee787',
    text: 'rgba(255,255,255,.94)',
    muted: 'rgba(255,255,255,.68)',
    cyan: '#79d7ff',
    code: '#ffd56e'
  };

  const CATEGORY_COLORS = {
    university_requirements: '#79d7ff',
    college_requirements: '#f2a23a',
    capstone_project: '#7ee787',
    program_core_requirements: '#ffd56e',
    program_elective_requirements: '#b98cff',
    field_experience: '#8fb3d9'
  };

  const M = { margin: 30, headerH: 128, footerH: 108 };

  const roundRect = (ctx, x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  const setSpacing = (ctx, value) => {
    if ('letterSpacing' in ctx) ctx.letterSpacing = value;
  };

  const ellipsize = (ctx, text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let out = text;
    while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
    return `${out.trimEnd()}…`;
  };

  /* Greedy word wrap into at most maxLines lines; the last line is ellipsized. */
  const wrapLines = (ctx, text, maxWidth, maxLines) => {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (let i = 0; i < words.length; i += 1) {
      const trial = line ? `${line} ${words[i]}` : words[i];
      if (ctx.measureText(trial).width <= maxWidth || !line) {
        line = trial;
      } else {
        lines.push(line);
        line = words[i];
        if (lines.length === maxLines - 1) {
          line = words.slice(i).join(' ');
          break;
        }
      }
    }
    if (line) lines.push(line);
    return lines.slice(0, maxLines).map((value, index, all) =>
      (index === all.length - 1 ? ellipsize(ctx, value, maxWidth) : value));
  };

  const pill = (ctx, text, x, y, opts) => {
    ctx.save();
    ctx.font = opts.font;
    setSpacing(ctx, opts.spacing || '0px');
    const padX = opts.padX ?? 7;
    const h = opts.h ?? 16;
    const w = ctx.measureText(text).width + padX * 2;
    const left = opts.alignRight ? x - w : x;
    if (opts.glow) {
      ctx.shadowColor = opts.glow;
      ctx.shadowBlur = 12;
    }
    roundRect(ctx, left, y, w, h, h / 2);
    ctx.fillStyle = opts.fill;
    ctx.fill();
    ctx.shadowBlur = 0;
    if (opts.stroke) {
      ctx.lineWidth = opts.strokeWidth ?? 1;
      ctx.strokeStyle = opts.stroke;
      ctx.stroke();
    }
    ctx.fillStyle = opts.color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, left + padX, y + h / 2 + 0.5);
    ctx.restore();
    return { left, width: w };
  };

  // ---------------------------------------------------------------- Board ---

  const drawBoard = (ctx, snap, fonts) => {
    const W = snap.width;
    const H = snap.height;
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 16);
    ctx.clip();
    ctx.fillStyle = C.board;
    ctx.fillRect(0, 0, W, H);

    // Dot grid.
    ctx.fillStyle = 'rgba(150,190,235,.10)';
    for (let gx = 11; gx < W; gx += 22) {
      for (let gy = 11; gy < H; gy += 22) ctx.fillRect(gx - 0.6, gy - 0.6, 1.2, 1.2);
    }

    // Year zones.
    snap.zones.forEach((zone, index) => {
      if (index % 2 === 1) {
        const gradient = ctx.createLinearGradient(0, 0, 0, H);
        gradient.addColorStop(0, 'rgba(120,170,230,.045)');
        gradient.addColorStop(1, 'rgba(120,170,230,.015)');
        ctx.fillStyle = gradient;
        ctx.fillRect(zone.x, 0, zone.w, H);
      }
      if (index > 0) {
        ctx.fillStyle = 'rgba(150,190,235,.12)';
        ctx.fillRect(zone.x, 0, 1, H);
      }
      ctx.save();
      ctx.font = `800 270px ${fonts.sans}`;
      ctx.fillStyle = snap.view === 'journey' ? 'rgba(150,190,235,.07)' : 'rgba(150,190,235,.035)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(String(zone.year), zone.x + zone.w - 14, 118 + 215);
      ctx.restore();
    });

    // Year bands.
    for (const year of snap.years) {
      ctx.fillStyle = 'rgba(150,190,235,.22)';
      ctx.fillRect(year.x, 53, year.w, 1);
      ctx.save();
      ctx.translate(year.x + 4, 49);
      ctx.rotate(-Math.PI / 2);
      ctx.font = `800 10.5px ${fonts.mono}`;
      setSpacing(ctx, '2.3px');
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('YEAR', 0, 0);
      ctx.restore();
      ctx.font = `300 50px ${fonts.sans}`;
      ctx.fillStyle = 'rgba(255,255,255,.94)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(year.name, year.x + 22, 49);
      ctx.font = `800 15px ${fonts.mono}`;
      ctx.fillStyle = C.cyan;
      ctx.textAlign = 'right';
      ctx.fillText(year.total, year.x + year.w, 28);
      ctx.font = `400 12px ${fonts.sans}`;
      ctx.fillStyle = C.muted;
      ctx.fillText(ellipsize(ctx, year.summary, year.w - 90), year.x + year.w, 46);
    }

    // Semester headers.
    for (const sem of snap.sems) {
      ctx.save();
      ctx.font = `800 10.5px ${fonts.mono}`;
      setSpacing(ctx, '1.3px');
      ctx.fillStyle = C.cyan;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(sem.level.toUpperCase(), sem.x, 72);
      ctx.restore();
      ctx.font = `700 13.5px ${fonts.sans}`;
      ctx.fillStyle = C.text;
      ctx.textAlign = 'left';
      ctx.fillText(sem.name, sem.x, 88);
      ctx.font = `800 13px ${fonts.mono}`;
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'right';
      ctx.fillText(sem.total, sem.x + sem.w, 84);
      for (const milestone of sem.milestones) {
        pill(ctx, milestone.text, sem.x + sem.w - 34, 57, {
          font: `800 10px ${fonts.sans}`,
          fill: milestone.hot ? '#1f7a38' : 'rgba(126,231,135,.10)',
          stroke: milestone.hot ? '#c9ffd0' : 'rgba(126,231,135,.5)',
          strokeWidth: milestone.hot ? 1.5 : 1,
          color: milestone.hot ? '#ffffff' : '#bff1c4',
          glow: milestone.hot ? 'rgba(126,231,135,.8)' : null,
          h: 15,
          alignRight: true
        });
      }
    }

    // Support rail label.
    const rail = snap.rail;
    const railGradient = ctx.createLinearGradient(0, rail.y, 0, rail.y + 28);
    railGradient.addColorStop(0, 'rgba(150,190,235,.045)');
    railGradient.addColorStop(1, 'rgba(150,190,235,0)');
    ctx.fillStyle = railGradient;
    ctx.fillRect(0, rail.y, W, 28);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(150,190,235,.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rail.y + 0.5);
    ctx.lineTo(W, rail.y + 0.5);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.font = `800 11px ${fonts.mono}`;
    setSpacing(ctx, '2px');
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(rail.name.toUpperCase(), 26, rail.y + 15);
    const nameWidth = ctx.measureText(rail.name.toUpperCase()).width;
    setSpacing(ctx, '0px');
    ctx.font = `400 11px ${fonts.sans}`;
    ctx.fillStyle = 'rgba(255,255,255,.48)';
    ctx.fillText(ellipsize(ctx, rail.note, W - 26 - nameWidth - 14 - 26), 26 + nameWidth + 14, rail.y + 15);
    ctx.restore();

    drawTraces(ctx, snap);
    for (const node of snap.nodes) drawNode(ctx, node, snap, fonts);
    if (snap.bank?.open) drawBank(ctx, snap.bank, fonts);

    ctx.restore();
    ctx.save();
    roundRect(ctx, 0.5, 0.5, W - 1, H - 1, 16);
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };

  const drawTraces = (ctx, snap) => {
    if (snap.view === 'journey') return;
    const strokeFor = edge => {
      if (edge.kind === 'coreq') {
        return edge.state === 'co'
          ? { color: C.co, width: 2.4, dash: [5, 4] }
          : { color: 'rgba(126,231,135,.55)', width: 1.8, dash: [5, 4] };
      }
      if (edge.state === 'up') {
        return edge.direct ? { color: C.up, width: 3.2 } : { color: C.upSoft, width: 2.4 };
      }
      if (edge.state === 'down') {
        return edge.direct ? { color: C.down, width: 3.2 } : { color: C.downSoft, width: 2.4 };
      }
      return { color: C.trace, width: 1.8 };
    };
    const lit = edge => edge.state === 'up' || edge.state === 'down' || edge.state === 'co';

    // Faded traces first, so highlighted ones are painted over them.
    const ordered = snap.edges.slice().sort((a, b) => Number(lit(a)) - Number(lit(b)));
    for (const edge of ordered) {
      const style = strokeFor(edge);
      ctx.save();
      ctx.globalAlpha = snap.focusActive && !lit(edge) ? 0.12 : 1;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = style.width;
      ctx.strokeStyle = style.color;
      ctx.setLineDash(style.dash || []);
      ctx.stroke(new Path2D(edge.d));
      ctx.setLineDash([]);
      if (edge.kind === 'coreq') {
        for (const [px, py] of edge.caps || []) {
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = C.board;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(126,231,135,.8)';
          ctx.stroke();
        }
      } else if (edge.head) {
        ctx.fillStyle = lit(edge) ? style.color : C.via;
        ctx.fill(new Path2D(edge.head));
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = snap.focusActive ? 0.25 : 1;
    for (const [vx, vy] of snap.vias) {
      ctx.beginPath();
      ctx.arc(vx, vy, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = C.via;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = C.board;
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawNode = (ctx, node, snap, fonts) => {
    const s = node.state || {};
    const accent = CATEGORY_COLORS[node.categoryId] || 'rgba(190,215,245,.3)';
    let bg = node.rail ? 'rgba(13,22,38,.72)' : C.tile;
    let border = node.rail ? 'rgba(190,215,245,.13)' : 'rgba(190,215,245,.2)';
    let borderWidth = 1;
    let dash = null;
    let leftColor = accent;
    let leftWidth = node.gateway ? 4 : 3;
    let ring = null;
    if (node.gateway) border = 'rgba(255,255,255,.5)';
    if (node.slot) { bg = '#120e26'; border = 'rgba(185,140,255,.6)'; dash = [5, 3]; }
    const override = color => { border = color; leftColor = color; };
    if (s.up) { override(C.upSoft); bg = '#17140a'; }
    if (s.down) { override(C.downSoft); bg = '#08161f'; }
    if (s.up && s.direct) { override(C.up); borderWidth = 2; ring = 'rgba(255,192,77,.3)'; }
    if (s.down && s.direct) { override(C.down); borderWidth = 2; ring = 'rgba(95,211,255,.3)'; }
    if (s.coreq) { override(C.co); bg = '#0a1a12'; borderWidth = 2; dash = [6, 4]; }
    if (s.selected) { override('#ffffff'); bg = '#16233a'; borderWidth = 2; dash = null; ring = 'rgba(255,255,255,.3)'; }

    ctx.save();
    if (s.dim) ctx.globalAlpha = 0.27;
    const { x, y, w, h } = node;

    if (ring) {
      ctx.shadowColor = ring;
      ctx.shadowBlur = 16;
    }
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.save();
    roundRect(ctx, x, y, w, h, 8);
    ctx.clip();
    ctx.fillStyle = leftColor;
    ctx.fillRect(x, y, leftWidth, h);
    ctx.restore();

    ctx.save();
    ctx.setLineDash(dash || []);
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = border;
    roundRect(ctx, x + borderWidth / 2, y + borderWidth / 2, w - borderWidth, h - borderWidth, 8);
    // Keep the accent edge visible on the left side of an idle tile.
    ctx.stroke();
    ctx.restore();
    if (s.selected) {
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,.22)';
      roundRect(ctx, x - 2.5, y - 2.5, w + 5, h + 5, 10);
      ctx.stroke();
      ctx.restore();
    }

    // Edge pins.
    const pinColor = s.up ? C.up : s.down ? C.down : C.via;
    const pin = px => {
      ctx.beginPath();
      ctx.arc(px, y + h / 2, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = C.board;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = pinColor;
      ctx.stroke();
    };
    if (node.hasIn) pin(x);
    if (node.hasOut || node.hasCo) pin(x + w);

    // Text.
    const padL = leftWidth + 8;
    const padR = 10;
    const innerW = w - padL - padR;
    const codeSize = node.rail ? 15.5 : 20;
    const titleSize = node.rail ? 12 : 13.5;
    const titleLines = node.rail ? 1 : (node.conditionChip ? 1 : 2);
    ctx.font = `400 ${titleSize}px ${fonts.sans}`;
    const title = wrapLines(ctx, node.title, innerW - (node.rail && (node.conditionChip || node.slot) ? 62 : 0), titleLines);
    const lineH = titleSize * 1.22;
    const codeH = codeSize * 1.15;
    const metaH = !node.rail && (node.conditionChip) ? 18 : 0;
    const total = codeH + 2 + title.length * lineH + metaH;
    let top = y + (h - total) / 2;

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = `800 ${codeSize}px ${fonts.mono}`;
    setSpacing(ctx, '-0.2px');
    ctx.fillStyle = node.slot ? '#d9c4ff' : (node.rail ? 'rgba(255,213,110,.86)' : C.code);
    ctx.fillText(node.code, x + padL, top + codeSize * 0.9);
    setSpacing(ctx, '0px');

    // Category tag (text, never colour alone).
    ctx.font = `800 9.5px ${fonts.mono}`;
    setSpacing(ctx, '0.5px');
    const tagW = ctx.measureText(node.tag).width + 10;
    const tagX = x + w - padR - tagW;
    const tagY = top + codeH / 2 - 7.5;
    roundRect(ctx, tagX, tagY, tagW, 15, 4);
    ctx.fillStyle = 'rgba(255,255,255,.04)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.textBaseline = 'middle';
    ctx.fillText(node.tag, tagX + 5, tagY + 8);
    setSpacing(ctx, '0px');
    ctx.textBaseline = 'alphabetic';

    top += codeH + 2;
    ctx.font = `400 ${titleSize}px ${fonts.sans}`;
    ctx.fillStyle = node.rail ? 'rgba(255,255,255,.66)' : 'rgba(255,255,255,.84)';
    title.forEach((line, i) => ctx.fillText(line, x + padL, top + lineH * (i + 0.82)));
    top += title.length * lineH;

    if (node.conditionChip) {
      const chipOpts = {
        font: `800 11px ${fonts.sans}`, fill: 'rgba(126,231,135,.16)', stroke: 'rgba(126,231,135,.6)',
        color: '#cdf3d1', h: 16, padX: 7
      };
      if (node.rail) pill(ctx, node.conditionChip, x + w - 9, y + h - 21, { ...chipOpts, alignRight: true });
      else pill(ctx, node.conditionChip, x + padL, top + 3, chipOpts);
    }
    if (node.socketNote) {
      ctx.font = `700 11px ${fonts.sans}`;
      ctx.fillStyle = 'rgba(214,190,255,.85)';
      ctx.textAlign = 'right';
      ctx.fillText(node.socketNote, x + w - 9, y + h - 8);
      ctx.textAlign = 'left';
    }

    // Gateway count or relationship tag, riding the top edge.
    if (s.reltag) {
      const tones = {
        up: s.direct ? ['#ffc04d', '#181206'] : [C.upSoft, '#ffffff'],
        down: s.direct ? ['#5fd3ff', '#04141c'] : [C.downSoft, '#ffffff'],
        coreq: [C.co, '#04140a']
      };
      const tone = s.up ? tones.up : s.down ? tones.down : tones.coreq;
      pill(ctx, s.reltag.toUpperCase(), x + w - 8, y - 9, {
        font: `800 10px ${fonts.sans}`, spacing: '0.5px', fill: tone[0], color: tone[1], h: 16, padX: 7, alignRight: true
      });
    } else if (node.gateway && !snap.focusActive) {
      pill(ctx, `Unlocks ${node.unlocks}`, x + w - 8, y - 9, {
        font: `800 10.5px ${fonts.sans}`, fill: '#1a1608', stroke: 'rgba(255,213,110,.6)',
        color: '#ffe29a', h: 16, padX: 7, alignRight: true
      });
    }
    ctx.restore();
  };

  const drawBank = (ctx, bank, fonts) => {
    const { x, y, w, h } = bank;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.65)';
    ctx.shadowBlur = 30;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = '#0d0a1f';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(185,140,255,.7)';
    ctx.stroke();

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = `800 16px ${fonts.sans}`;
    ctx.fillStyle = '#e4d6ff';
    ctx.fillText(bank.title, x + 14, y + 30);
    const titleW = ctx.measureText(bank.title).width;
    ctx.font = `700 12px ${fonts.mono}`;
    ctx.fillStyle = 'rgba(214,190,255,.85)';
    if (bank.rule) ctx.fillText(ellipsize(ctx, bank.rule, w - 28 - titleW - 14), x + 14 + titleW + 12, y + 30);

    let listTop = y + 46;
    if (bank.condition) {
      pill(ctx, bank.condition.chip, x + 14, y + 44, {
        font: `800 11px ${fonts.sans}`, fill: 'rgba(126,231,135,.16)', stroke: 'rgba(126,231,135,.6)',
        color: '#cdf3d1', h: 16
      });
      ctx.font = `400 11.5px ${fonts.sans}`;
      ctx.fillStyle = C.muted;
      const textX = x + 14 + 56;
      const lines = wrapLines(ctx, bank.condition.text, w - 28 - 56, 2);
      lines.forEach((line, i) => ctx.fillText(line, textX, y + 56 + i * 14));
      listTop = y + 44 + 16 + 14;
    }

    const cols = 2;
    const rows = Math.ceil(bank.items.length / cols);
    const gapX = 8;
    const gapY = 6;
    const itemW = (w - 28 - gapX) / cols;
    const itemH = (y + h - 12 - listTop - gapY * (rows - 1)) / rows;
    bank.items.forEach((item, index) => {
      const ix = x + 14 + (index % cols) * (itemW + gapX);
      const iy = listTop + Math.floor(index / cols) * (itemH + gapY);
      roundRect(ctx, ix, iy, itemW, itemH, 8);
      ctx.fillStyle = item.selected ? 'rgba(185,140,255,.2)' : 'rgba(185,140,255,.07)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = item.selected ? '#c9a8ff' : 'rgba(185,140,255,.28)';
      ctx.stroke();
      ctx.font = `800 13px ${fonts.mono}`;
      ctx.fillStyle = '#e4d6ff';
      ctx.fillText(item.code, ix + 9, iy + 15);
      ctx.font = `400 11px ${fonts.sans}`;
      ctx.fillStyle = 'rgba(255,255,255,.78)';
      const lines = wrapLines(ctx, item.name, itemW - 18, 2);
      lines.forEach((line, i) => ctx.fillText(line, ix + 9, iy + 15 + 13 + i * 12.5));
    });
    ctx.restore();
  };

  // ---------------------------------------------------------- Header/footer --

  const drawHeader = (ctx, snap, fonts, totalW) => {
    const x = M.margin;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const focus = snap.focus;
    const program = 'Electrical Engineering Program — Curriculum Flow';
    if (focus) {
      ctx.font = `700 14px ${fonts.sans}`;
      setSpacing(ctx, '0.6px');
      ctx.fillStyle = C.cyan;
      ctx.fillText(program.toUpperCase(), x, 42);
      setSpacing(ctx, '0px');
      ctx.font = `800 32px ${fonts.sans}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(ellipsize(ctx, `${focus.code} — ${focus.modeLabel}`, totalW - x * 2), x, 82);
      ctx.font = `400 15px ${fonts.sans}`;
      ctx.fillStyle = C.muted;
      ctx.fillText(ellipsize(ctx, focus.subtitle, totalW - x * 2), x, 106);
    } else {
      ctx.font = `800 32px ${fonts.sans}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(program, x, 62);
      ctx.font = `400 15px ${fonts.sans}`;
      ctx.fillStyle = C.muted;
      ctx.fillText(ellipsize(ctx, snap.subtitle, totalW - x * 2), x, 92);
    }
    // Accent rule under the header.
    const gradient = ctx.createLinearGradient(x, 0, totalW - x, 0);
    gradient.addColorStop(0, 'rgba(121,215,255,.7)');
    gradient.addColorStop(1, 'rgba(121,215,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, M.headerH - 10, totalW - x * 2, 2);
  };

  const drawFooter = (ctx, snap, fonts, totalW, top) => {
    const x = M.margin;
    let cx = x;
    let cy = top + 14;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    // Category legend (tag + full name).
    for (const category of snap.legend.categories) {
      const color = CATEGORY_COLORS[category.id] || C.muted;
      ctx.font = `800 9.5px ${fonts.mono}`;
      setSpacing(ctx, '0.5px');
      const tagW = ctx.measureText(category.tag).width + 10;
      ctx.font = `400 12px ${fonts.sans}`;
      setSpacing(ctx, '0px');
      const nameW = ctx.measureText(category.name).width;
      if (cx + 14 + tagW + 6 + nameW > totalW - x) { cx = x; cy += 24; }
      ctx.fillStyle = color;
      ctx.fillRect(cx, cy - 7, 4, 14);
      roundRect(ctx, cx + 10, cy - 7.5, tagW, 15, 4);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `800 9.5px ${fonts.mono}`;
      setSpacing(ctx, '0.5px');
      ctx.fillStyle = color;
      ctx.fillText(category.tag, cx + 15, cy + 0.5);
      setSpacing(ctx, '0px');
      ctx.font = `400 12px ${fonts.sans}`;
      ctx.fillStyle = C.muted;
      ctx.fillText(category.name, cx + 10 + tagW + 6, cy + 0.5);
      cx += 10 + tagW + 6 + nameW + 20;
    }

    // Trace key.
    cx = x;
    cy += 26;
    const key = (label, draw) => {
      ctx.font = `400 12px ${fonts.sans}`;
      const labelW = ctx.measureText(label).width;
      draw(cx, cy);
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'left';
      ctx.fillText(label, cx + 34, cy + 0.5);
      cx += 34 + labelW + 22;
    };
    const arrow = color => (px, py) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 22, py); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(px + 28, py); ctx.lineTo(px + 21, py - 4); ctx.lineTo(px + 21, py + 4); ctx.closePath(); ctx.fill();
    };
    key('Prerequisite chain', arrow(C.up));
    key('Unlocked courses', arrow(C.down));
    key('Co-requisite (same semester)', (px, py) => {
      ctx.strokeStyle = C.co; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 28, py); ctx.stroke(); ctx.setLineDash([]);
    });
    key('Credit-hour condition — a completion rule, not a course', (px, py) => {
      roundRect(ctx, px, py - 7, 28, 14, 5);
      ctx.fillStyle = 'rgba(126,231,135,.16)'; ctx.fill();
      ctx.strokeStyle = 'rgba(126,231,135,.6)'; ctx.lineWidth = 1; ctx.stroke();
    });
    key('Elective slot', (px, py) => {
      roundRect(ctx, px, py - 7, 28, 14, 5);
      ctx.fillStyle = 'rgba(185,140,255,.12)'; ctx.fill();
      ctx.setLineDash([3, 2]); ctx.strokeStyle = 'rgba(185,140,255,.8)'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    });

    // Focused-course record and source line.
    ctx.textBaseline = 'alphabetic';
    let lineY = cy + 28;
    if (snap.focus?.recorded) {
      ctx.font = `400 12.5px ${fonts.sans}`;
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      ctx.textAlign = 'left';
      ctx.fillText(ellipsize(ctx, snap.focus.recorded, totalW - x * 2), x, lineY);
      lineY += 20;
    }
    ctx.font = `400 11.5px ${fonts.sans}`;
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.textAlign = 'right';
    ctx.fillText(`Curriculum Intelligence Portal · program structure data · ${snap.date}`, totalW - x, lineY);
    return lineY;
  };

  // ------------------------------------------------------------------ API ---

  const renderPng = async (snap, options = {}) => {
    const fonts = snap.fonts;
    const totalW = Math.round(snap.width + M.margin * 2);
    const footerExtra = snap.focus?.recorded ? 20 : 0;
    const totalH = Math.round(M.headerH + snap.height + M.footerH + footerExtra + 22 * (snap.legend.extraRows || 0));
    // "Standard" fills a 1920 px wide image; "high" doubles the logical size.
    const scale = options.scale && options.scale > 0 ? options.scale : 1920 / totalW;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(totalW * scale);
    canvas.height = Math.round(totalH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('A 2D canvas is not available in this browser.');
    ctx.scale(scale, scale);
    ctx.imageSmoothingQuality = 'high';

    const background = ctx.createLinearGradient(0, 0, 0, totalH);
    background.addColorStop(0, '#0b1424');
    background.addColorStop(1, '#08111e');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, totalW, totalH);

    drawHeader(ctx, snap, fonts, totalW);
    ctx.save();
    ctx.translate(M.margin, M.headerH);
    drawBoard(ctx, snap, fonts);
    ctx.restore();
    drawFooter(ctx, snap, fonts, totalW, M.headerH + snap.height + 18);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => (result ? resolve(result) : reject(new Error('The browser could not encode the PNG.'))), 'image/png');
    });
    return { blob, width: canvas.width, height: canvas.height };
  };

  window.CIPFlowExport = Object.freeze({ renderPng });
})();
