'use strict';
const COLS = ['player','number','team','min','pts','reb','ast','stl','blk','tov','pf','fgm','fga','tpm','tpa','ftm','fta'];
const NUM = COLS.slice(3);
const SAMPLE = `player,number,team,min,pts,reb,ast,stl,blk,tov,pf,fgm,fga,tpm,tpa,ftm,fta
Reyes,4,Tigers,32,18,5,6,2,0,4,2,7,15,2,6,2,3
Santos,10,Tigers,30,14,9,2,1,1,3,3,6,13,0,2,2,4
Cruz,7,Tigers,28,11,3,3,0,0,5,2,4,12,3,8,0,0
Dela Pena,23,Tigers,24,8,7,1,1,2,2,4,3,7,0,0,2,6
Lim,15,Tigers,20,4,2,0,0,0,1,1,2,6,0,3,0,0
Ramos,12,Tigers,0,0,0,0,0,0,0,0,0,0,0,0,0,0
Garcia,3,Hawks,34,22,4,7,3,0,2,2,8,16,3,7,3,3
Mendoza,9,Hawks,31,16,10,1,0,2,1,3,6,11,0,1,4,5
Tan,21,Hawks,27,12,3,4,1,0,2,2,4,10,2,5,2,2
Flores,5,Hawks,25,9,6,2,2,1,1,4,3,8,1,4,2,2
Uy,14,Hawks,18,6,3,0,0,0,3,3,2,5,0,2,2,3`;

const $ = s => document.querySelector(s);
const pct = (m, a) => a ? m / a * 100 : null;
const fmtP = v => v == null ? 'n/a' : v.toFixed(1) + '%';
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const state = { rows: [], sortKey: 'eff', dir: -1, team: 'All', q: '', warnings: [] };

const ALIAS = {player:['player','name','playername','athlete'],number:['number','no','jersey','jerseynumber','num'],team:['team','squad','club'],min:['min','mins','minutes','mp'],pts:['pts','points','pt'],reb:['reb','rebs','rebounds','trb','totreb'],ast:['ast','assists'],stl:['stl','steals'],blk:['blk','blocks'],tov:['tov','to','turnovers'],pf:['pf','fouls'],fgm:['fgm','fgmade'],fga:['fga','fgattempts'],tpm:['tpm','3pm','3pmade'],tpa:['tpa','3pa'],ftm:['ftm','ftmade'],fta:['fta','ftattempts']};
const COMBO = {fg:['fgm','fga'],'3p':['tpm','tpa'],'3pt':['tpm','tpa'],ft:['ftm','fta']};
const NUMF = ['min','pts','reb','ast','stl','blk','tov','pf','fgm','fga','tpm','tpa','ftm','fta'];
const norm = k => String(k).toLowerCase().replace(/#/g, 'number').replace(/[^a-z0-9]/g, '');
const toNum = v => { if (typeof v === 'number') return v; const s = String(v ?? '').replace('%', '').trim(); if (s.includes(':')) { const [m, sec] = s.split(':'); return Number(m) + Number(sec || 0) / 60; } return s === '' ? NaN : Number(s); };

function textToObjs(text) {
  const t = text.trim();
  if (t[0] === '[' || t[0] === '{') {
    const j = JSON.parse(t); const a = Array.isArray(j) ? j : (j.players || j.data || j.rows);
    if (!Array.isArray(a)) throw new Error('JSON must be a list of player rows.'); return a;
  }
  let lines = t.split(/\r?\n/).filter(l => l.trim());
  if (!/[\t,;]/.test(lines[0]) && /\s{2,}/.test(lines[0])) lines = lines.map(l => l.trim().split(/\s{2,}/).join('\t'));
  const h0 = lines[0];
  const d = h0.includes('\t') ? '\t' : (h0.split(';').length > h0.split(',').length ? ';' : ',');
  const split = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === d && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()); };
  const head = split(lines.shift());
  return lines.map(l => { const c = split(l); const o = {}; head.forEach((h, i) => o[h] = c[i] ?? ''); return o; });
}

function build(objs) {
  if (!objs.length) throw new Error('No rows found.');
  const key = {}, combo = {}, warnings = [];
  Object.keys(objs[0]).forEach(k => {
    const n = norm(k);
    for (const f in ALIAS) if (ALIAS[f].includes(n) && !key[f]) key[f] = k;
    if (COMBO[n]) combo[n] = k;
  });
  if (!key.player) throw new Error('Could not find a player column. Found: ' + Object.keys(objs[0]).join(', '));
  if (!key.team) warnings.push('No team column found, so all players are grouped as one team. Add a Team column to compare two teams.');
  const split = Object.keys(combo).filter(c => !key[COMBO[c][0]]);
  const missing = NUMF.filter(f => !key[f] && !split.some(c => COMBO[c].includes(f)));
  if (missing.length) warnings.push('Columns not found, treated as 0: ' + missing.join(', ') + '. Related analysis may be incomplete.');
  state.hasMin = !!key.min;
  const rows = [];
  objs.forEach((raw, i) => {
    const o = { player: String(raw[key.player] ?? '').trim(), team: key.team ? (String(raw[key.team] ?? '').trim() || 'Unknown') : 'Team', number: key.number ? String(raw[key.number] ?? '') : '' };
    if (!o.player || /^(team )?totals?$/i.test(o.player)) return;
    const where = `Row ${i + 2} (${o.player})`;
    Object.keys(raw).forEach(k => { if (k[0] === '_') o[k.slice(1)] = raw[k]; });
    NUMF.forEach(f => {
      if (key[f]) { const v = toNum(raw[key[f]]); if (Number.isNaN(v)) { warnings.push(`${where}: ${f} missing or not a number, treated as 0`); o[f] = 0; } else o[f] = v; } else o[f] = 0;
    });
    split.forEach(c => { const p = String(raw[combo[c]] ?? '').split(/[-\/]/); const [m, a] = COMBO[c]; o[m] = toNum(p[0]) || 0; o[a] = toNum(p[1]) || 0; });
    o.min = Math.round(o.min * 10) / 10;
    if (o.p2m !== undefined) {
      const sm = o.p2m + o.tpm, sa = o.p2a + o.tpa;
      if (sm !== o.fgm) { warnings.push(`${o.player} (${o.team}): the sheet lists FG made as ${o.fgm}, but 2-point made + 3-point made is ${sm}. ${sm} is used here. Check the original sheet.`); o.fgmSource = o.fgm; o.fgm = sm; }
      if (sa !== o.fga) { warnings.push(`${o.player} (${o.team}): the sheet lists FG attempts as ${o.fga}, but 2-point + 3-point attempts is ${sa}. ${sa} is used here. Check the original sheet.`); o.fgaSource = o.fga; o.fga = sa; }
    }
    const calc = o.fgm * 2 + o.tpm + o.ftm;
    if (!key.pts) o.pts = calc; else if (calc !== o.pts && o.fga > 0 && !missing.length) warnings.push(`${where}: reported PTS ${o.pts} differs from ${calc} calculated from makes`);
    if (o.fgm > o.fga) warnings.push(`${where}: FGM is higher than FGA`);
    if (o.tpm > o.tpa) warnings.push(`${where}: 3PM is higher than 3PA`);
    if (o.ftm > o.fta) warnings.push(`${where}: FTM is higher than FTA`);
    o.played = o.min > 0 || (!key.min && (o.pts + o.reb + o.ast + o.fga + o.fta + o.tov + o.pf + o.stl + o.blk) > 0);
    o.eff = o.pts + o.reb + o.ast + o.stl + o.blk - (o.fga - o.fgm) - (o.fta - o.ftm) - o.tov;
    o.fgp = pct(o.fgm, o.fga);
    rows.push(o);
  });
  if (!rows.length) throw new Error('No player rows found.');
  state.warnings = warnings;
  return rows;
}

const aliasSet = new Set(Object.values(ALIAS).flat().concat(['fg', '3p', '3pt', 'ft']));
const hits = row => row.filter(c => aliasSet.has(norm(c))).length;

function matrixToObjs(matrix) {
  const tables = []; let cur = null, n = 0;
  matrix.forEach((row, i) => {
    if (row.length >= 4 && hits(row) >= 4) {
      n++; const prev = matrix[i - 1];
      const label = prev && prev.length === 1 && prev[0].length <= 40 ? prev[0].replace(/\s*(box score|statistics|stats)\s*$/i, '').trim() || 'Team ' + n : 'Team ' + n;
      cur = { head: row, label, rows: [] }; tables.push(cur);
    } else if (cur && row.length >= 3) cur.rows.push(row);
  });
  if (!tables.length) throw new Error('Could not find a stats table. It needs a header row with columns like Player, PTS, REB, AST.');
  const objs = [];
  tables.forEach(t => {
    const pi = t.head.findIndex(h => ALIAS.player.includes(norm(h)));
    const hasTeam = t.head.some(h => ALIAS.team.includes(norm(h)));
    t.rows.forEach(r => {
      const c = r.slice();
      if (pi >= 0 && c.length > t.head.length) { const k = c.length - t.head.length + 1; c.splice(pi, k, c.slice(pi, pi + k).join(' ')); }
      const o = {}; t.head.forEach((h, j) => o[h] = c[j] ?? '');
      if (!hasTeam) o.Team = t.label;
      objs.push(o);
    });
  });
  return objs;
}

function htmlToMatrix(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html'), m = [];
  [...doc.body.children].forEach(el => {
    if (el.tagName === 'TABLE') el.querySelectorAll('tr').forEach(tr => m.push([...tr.children].map(c => c.textContent.trim())));
    else if (el.textContent.trim()) m.push([el.textContent.trim()]);
  });
  return m;
}

async function pdfToMatrix(buf) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise, matrix = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const items = tc.items.filter(i => i.str.trim() !== '').map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width }));
    const lines = [];
    items.forEach(it => { const l = lines.find(l => Math.abs(l.y - it.y) < 3); if (l) l.items.push(it); else lines.push({ y: it.y, items: [it] }); });
    lines.sort((a, b) => b.y - a.y).forEach(l => {
      l.items.sort((a, b) => a.x - b.x);
      const cells = []; let end = -1e9;
      l.items.forEach(it => { if (cells.length && it.x - end < 1.5) cells[cells.length - 1] += it.s; else cells.push(it.s); end = it.x + it.w; });
      matrix.push(cells.map(c => c.trim()).filter(Boolean));
    });
  }
  return matrix;
}

let pendingMeta = null;
const SDASH = '[\\u2013\\u2014-]';

function parseSheet(lines) {
  lines = lines.map(l => l.replace(/\u2212/g, '-').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const ROW = /^(\d{1,3}) (.+?) (\d{1,3}:\d{2}|DNP) (.+)$/;
  if (!lines.some(l => /\bM\/A\b/.test(l)) || !lines.some(l => { const m = l.match(ROW); return m && /^\d+\/\d+ /.test(m[4]); })) return null;
  const n = t => /^[+-]?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
  const ma = t => { const [a, b] = String(t).split('/'); return [Number(a) || 0, Number(b) || 0]; };
  const meta = { totals: {}, extras: [], singles: [], skipped: [] }, objs = [];
  const full = lines.join(' ');
  const TITLE = new RegExp('^(.+?) (\\d{1,3}) ' + SDASH + ' (\\d{1,3}) (.+)$');
  const tl = lines.find(l => !ROW.test(l) && TITLE.test(l));
  if (tl) { const m = tl.match(TITLE); meta.teams = [m[1], m[4]]; meta.score = [+m[2], +m[3]]; }
  const q = full.match(/\((\d+-\d+(?:, ?\d+-\d+)+)\)/);
  if (q) meta.quarters = q[1].split(/, ?/).map(x => x.split('-').map(Number));
  const vi = lines.findIndex(l => l.includes('\u00b7')), ri = lines.findIndex(l => /RESULT SHEET/i.test(l));
  if (vi >= 0) meta.venue = lines[vi].replace(/ ?\u00b7 ?/g, ', ');
  if (ri >= 0 && vi > ri) meta.competition = lines.slice(ri + 1, vi).join(' ');
  const rm = full.match(/Round: ?(\S+)/); if (rm) meta.round = rm[1];
  const gm = full.match(/Report generated: (.+?)(?= Scorer|$)/); if (gm) meta.generated = gm[1];
  const sm = full.match(/Scorer: (.+?)(?= SCORING|$)/); if (sm) meta.scorer = sm[1];
  const canon = nm => (meta.teams || []).find(t => t.toLowerCase() === nm.toLowerCase()) || nm;
  const TEAMRE = /([A-Z][A-Z0-9-]*(?: [A-Z0-9.&'-]+)*) ?\(([A-Z]{2,5})\)$/;
  let team = null;
  lines.forEach(l => {
    const m = l.match(ROW);
    const tm = !m && l.match(TEAMRE);
    if (tm) { team = canon(tm[1].replace(/^.*\d(?=[A-Z])/, '').trim()); return; }
    if (m && team) {
      const tk = m[4].split(' ');
      if (tk.length !== 19) { meta.skipped.push(m[2]); return; }
      const dnp = m[3] === 'DNP';
      const [fgm, fga] = ma(tk[0]), [p2m, p2a] = ma(tk[2]), [tpm, tpa] = ma(tk[4]), [ftm, fta] = ma(tk[6]);
      objs.push({ Player: m[2].replace(/^\* ?/, '').trim(), No: m[1], Team: team, MIN: dnp ? 0 : m[3], PTS: n(tk[18]), REB: n(tk[10]), AST: n(tk[11]), STL: n(tk[13]), BLK: n(tk[14]), TOV: n(tk[12]), PF: n(tk[15]), FGM: fgm, FGA: fga, '3PM': tpm, '3PA': tpa, FTM: ftm, FTA: fta, _or: n(tk[8]), _dr: n(tk[9]), _pm: dnp ? null : n(tk[16]), _ef: n(tk[17]), _starter: m[2].startsWith('*'), _p2m: p2m, _p2a: p2a });
    } else if (team && /^Totals /.test(l)) {
      const tk = l.split(' ').slice(2);
      if (tk.length === 18) { const [fgm, fga] = ma(tk[0]), [tpm, tpa] = ma(tk[4]), [ftm, fta] = ma(tk[6]); meta.totals[team] = { fgm, fga, tpm, tpa, ftm, fta, reb: n(tk[10]), ast: n(tk[11]), tov: n(tk[12]), stl: n(tk[13]), blk: n(tk[14]), pf: n(tk[15]), pts: n(tk[17]) }; }
    }
  });
  const V = '(\\u2014|\\u2013|\\d+:\\d{2}|\\d+(?:\\.\\d+)?)';
  const val = x => /^\d/.test(x) ? x : null;
  [['Points from turnovers', ''], ['Points in the paint', ''], ['Second chance points', ''], ['Fast break points from turnovers', ''], ['Fast break points', '(?! from)'], ['Bench points', ''], ['Biggest lead', ''], ['Biggest scoring run', ''], ['Points per possession', ''], ['Time with lead', '']].forEach(([lab, la]) => {
    const mm = full.match(new RegExp(lab + la + '\\s*\\u2020?\\s*' + V + '\\s+' + V));
    if (mm) meta.extras.push({ label: lab, a: val(mm[1]), b: val(mm[2]) });
  });
  ['Lead changes', 'Times tied'].forEach(lab => { const mm = full.match(new RegExp(lab + ' (\\d+)')); if (mm) meta.singles.push({ label: lab, v: +mm[1] }); });
  return { objs, meta };
}

function validateSheet() {
  const m = state.meta; if (!m) return;
  const W = state.warnings, T = teams();
  if (m.skipped.length) W.push('Could not read these player rows: ' + m.skipped.join(', '));
  const sum = (t, k) => state.rows.filter(r => r.team === t).reduce((a, r) => a + (r[k] || 0), 0);
  if (m.score && m.teams) m.teams.forEach((t, i) => { if (T.includes(t) && sum(t, 'pts') !== m.score[i]) W.push(`${t}: sheet final score is ${m.score[i]} but player points add up to ${sum(t, 'pts')}`); });
  if (m.quarters && m.score && m.teams) m.teams.forEach((t, i) => { const qs = m.quarters.reduce((a, x) => a + x[i], 0); if (qs !== m.score[i]) W.push(`${t}: quarter scores add up to ${qs} but the final score is ${m.score[i]}`); });
  Object.entries(m.totals).forEach(([t, tot]) => [['pts', 'PTS'], ['fgm', 'FGM'], ['fga', 'FGA'], ['tpm', '3PM'], ['ftm', 'FTM'], ['fta', 'FTA'], ['reb', 'REB'], ['ast', 'AS'], ['tov', 'TO'], ['stl', 'ST'], ['blk', 'BS'], ['pf', 'PF']].forEach(([k, l]) => { if (tot[k] != null && tot[k] !== sum(t, k)) W.push(`${t}: Totals row says ${l} ${tot[k]} but players add up to ${sum(t, k)}`); }));
}

function readFile(f) {
  const ext = f.name.split('.').pop().toLowerCase();
  const r = new FileReader();
  const fail = m => { $('#status').textContent = 'Could not read ' + f.name + '. ' + m; };
  const label = 'Loaded ' + f.name;
  if (['xlsx', 'xls', 'xlsm', 'ods'].includes(ext)) {
    if (typeof XLSX === 'undefined') return fail('The spreadsheet reader did not load. Check your internet connection, or save the sheet as CSV.');
    r.onload = () => { try { const wb = XLSX.read(r.result, { type: 'array' }); load(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }), label + ' (sheet: ' + wb.SheetNames[0] + ')'); } catch (e) { fail(e.message); } };
    r.readAsArrayBuffer(f);
  } else if (ext === 'docx') {
    if (typeof mammoth === 'undefined') return fail('The Word reader did not load. Check your internet connection, or save the table as CSV.');
    r.onload = async () => { try {
      let objs;
      try { objs = matrixToObjs(htmlToMatrix((await mammoth.convertToHtml({ arrayBuffer: r.result })).value)); }
      catch (e1) { objs = textToObjs((await mammoth.extractRawText({ arrayBuffer: r.result })).value); }
      load(objs, label + ' (Word document: check team names)');
    } catch (e) { fail('No readable stats table found. ' + e.message); } };
    r.readAsArrayBuffer(f);
  } else if (ext === 'pdf') {
    if (typeof pdfjsLib === 'undefined') return fail('The PDF reader did not load. Check your internet connection.');
    r.onload = async () => { try {
      const m = await pdfToMatrix(new Uint8Array(r.result));
      if (!m.length) return fail('No selectable text found. This looks like a scanned or image PDF. Upload it to Claude in chat and ask for the table.');
      const sheet = parseSheet(m.map(c => c.join(' ')));
      if (sheet) { pendingMeta = sheet.meta; load(sheet.objs, label + ' (StatsCentral result sheet)'); }
      else load(matrixToObjs(m), label + ' (PDF: check team names and numbers)');
    } catch (e) { fail(e.message); } };
    r.readAsArrayBuffer(f);
  } else if (['csv', 'tsv', 'txt', 'json'].includes(ext)) {
    r.onload = () => { const sh = ext === 'txt' ? parseSheet(r.result.split(/\r?\n/)) : null; if (sh) { pendingMeta = sh.meta; load(sh.objs, label + ' (StatsCentral result sheet)'); } else load(r.result, label); };
    r.readAsText(f);
  } else fail(ext === 'doc' ? 'Old .doc files are not supported. Save it as .docx first.' : 'Supported types: CSV, TSV, TXT, JSON, XLSX, XLS, DOCX, PDF. For a photo of a score sheet, upload it to Claude in chat and ask for the table.');
}

function teams() { return [...new Set(state.rows.map(r => r.team))]; }

function totals(team) {
  const t = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
  state.rows.filter(r => r.team === team).forEach(r => Object.keys(t).forEach(k => t[k] += r[k]));
  return t;
}

function renderScore() {
  const [A, B] = teams();
  if (!B) { $('#score').innerHTML = '<p>Need two teams to compare.</p>'; return; }
  const a = totals(A), b = totals(B);
  const box = (n, t, win) => `<div class="team ${win ? 'win' : ''}"><span>${esc(n)}</span><span class="big">${t.pts}</span></div>`;
  $('#score').innerHTML = box(A, a, a.pts > b.pts) + `<div class="vs">${a.pts === b.pts ? 'Tied' : 'Margin ' + Math.abs(a.pts - b.pts)}</div>` + box(B, b, b.pts > a.pts);
}

function renderBars() {
  const [A, B] = teams();
  if (!B) { $('#bars').innerHTML = ''; return; }
  const a = totals(A), b = totals(B);
  const lines = [
    ['Field goal %', pct(a.fgm, a.fga), pct(b.fgm, b.fga), true],
    ['Three-point %', pct(a.tpm, a.tpa), pct(b.tpm, b.tpa), true],
    ['Free throw %', pct(a.ftm, a.fta), pct(b.ftm, b.fta), true],
    ['Rebounds', a.reb, b.reb], ['Assists', a.ast, b.ast], ['Steals', a.stl, b.stl],
    ['Blocks', a.blk, b.blk], ['Turnovers (lower is better)', a.tov, b.tov], ['Fouls', a.pf, b.pf]
  ];
  const fmt = (v, p) => v == null ? 'n/a' : p ? v.toFixed(1) + '%' : v;
  $('#bars').innerHTML = `<div class="legend"><span><b style="background:var(--a)"></b>${esc(A)}</span><span><b style="background:var(--b)"></b>${esc(B)}</span></div>` +
    lines.map(([n, x, y, p]) => {
      const s = (x || 0) + (y || 0), w = s ? (x || 0) / s * 100 : 50;
      return `<div class="row"><div class="lab"><span>${n}</span><em>${fmt(x, p)} vs ${fmt(y, p)}</em></div><div class="track"><i style="width:0" data-w="${w}"></i><i style="width:0" data-w="${100 - w}"></i></div></div>`;
    }).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('.track i').forEach(i => i.style.width = i.dataset.w + '%')));
}

function renderFindings() {
  const [A, B] = teams(); const out = [];
  if (B) {
    const a = totals(A), b = totals(B);
    const cmp = (label, x, y, higherBetter, unit, gap) => {
      if (x == null || y == null || Math.abs(x - y) < gap) return;
      const aw = higherBetter ? x > y : x < y;
      out.push([aw ? 'good' : '', `${aw ? A : B} had the edge in ${label}: ${A} ${unit ? x.toFixed(1) + '%' : x} vs ${B} ${unit ? y.toFixed(1) + '%' : y}.`, aw]);
    };
    cmp('field goal percentage', pct(a.fgm, a.fga), pct(b.fgm, b.fga), true, true, 3);
    cmp('three-point percentage', pct(a.tpm, a.tpa), pct(b.tpm, b.tpa), true, true, 5);
    cmp('free throw percentage', pct(a.ftm, a.fta), pct(b.ftm, b.fta), true, true, 8);
    cmp('rebounds', a.reb, b.reb, true, false, 3);
    cmp('assists', a.ast, b.ast, true, false, 3);
    cmp('turnovers (fewer is better)', a.tov, b.tov, false, false, 3);
    cmp('fouls (fewer is better)', a.pf, b.pf, false, false, 3);
  }
  const played = state.rows.filter(r => r.played);
  const top = [...played].sort((x, y) => y.eff - x.eff)[0];
  if (top) out.push(['good', `${top.player} (${top.team}) had the highest efficiency at ${top.eff}, with ${top.pts} points, ${top.reb} rebounds, and ${top.ast} assists.`]);
  played.filter(r => r.fga >= 8 && r.fgp < 35).forEach(r => out.push(['', `${r.player} (${r.team}) shot ${fmtP(r.fgp)} on ${r.fga} attempts. Video would help show whether the shots were forced or well defended.`]));
  played.filter(r => r.tov >= 4).forEach(r => out.push(['', `${r.player} (${r.team}) committed ${r.tov} turnovers${r.min ? ' in ' + r.min + ' minutes' : ''}.`]));
  played.filter(r => r.pf >= 4).forEach(r => out.push(['', `${r.player} (${r.team}) finished with ${r.pf} fouls, which may have limited playing time.`]));
  state.warnings.forEach(w => out.push(['', 'Data check: ' + w]));
  $('#findings').innerHTML = out.length ? out.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join('') : '<li>Nothing stands out from the numbers in this file.</li>';
}

const HEAD0 = [['player','Player'],['team','Team'],['number','#'],['min','MIN'],['pts','PTS'],['reb','REB'],['ast','AST'],['stl','STL'],['blk','BLK'],['tov','TOV'],['pf','PF'],['fgp','FG%'],['eff','EFF']];
let HEAD = HEAD0;

function visible() {
  const q = state.q.toLowerCase();
  return state.rows.filter(r => r.played && (state.team === 'All' || r.team === state.team) && r.player.toLowerCase().includes(q))
    .sort((x, y) => {
      const a = x[state.sortKey], b = y[state.sortKey];
      const c = typeof a === 'string' ? a.localeCompare(b) : (a ?? -1) - (b ?? -1);
      return c * state.dir;
    });
}

function renderTable() {
  $('#players thead').innerHTML = '<tr>' + HEAD.map(([k, l]) => `<th scope="col" aria-sort="${state.sortKey === k ? (state.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button data-k="${k}">${l}</button></th>`).join('') + '</tr>';
  const rows = visible();
  const max = Math.max(...rows.map(r => r.eff), -Infinity);
  const cell = (r, k) => k === 'fgp' ? fmtP(r.fgp) : k === 'min' ? (state.hasMin ? r.min : '') : k === 'pm' ? (r.pm == null ? '-' : (r.pm > 0 ? '+' + r.pm : r.pm)) : k === 'player' ? esc(r.player) + (r.starter ? ' *' : '') : k === 'team' || k === 'number' ? esc(r[k]) : (r[k] ?? '');
  $('#players tbody').innerHTML = rows.map(r => '<tr>' + HEAD.map(([k]) => `<td class="${k === 'eff' && r.eff === max ? 'hi' : ''}">${cell(r, k)}</td>`).join('') + '</tr>').join('') || `<tr><td colspan="${HEAD.length}">No players match.</td></tr>`;
  const d = state.rows.filter(r => !r.played);
  $('#dnp').textContent = d.length ? 'Did not play: ' + d.map(r => `${r.player} (${r.team}, #${r.number})`).join(', ') : '';
}

function renderFilter() {
  const opts = ['All', ...teams()];
  $('#teamFilter').innerHTML = opts.map(t => `<button aria-pressed="${t === state.team}" data-t="${esc(t)}">${esc(t)}</button>`).join('');
}

function load(text, label) {
  try {
    state.meta = pendingMeta; pendingMeta = null;
    state.rows = build(typeof text === 'string' ? textToObjs(text) : text);
    validateSheet();
    HEAD = state.rows.some(r => r.pm !== undefined) ? [...HEAD0, ['pm', '+/-'], ['ef', 'EF*']] : HEAD0; state.team = 'All'; state.q = ''; $('#q').value = '';
    $('#status').textContent = label;
    renderAll();
  } catch (e) { $('#status').textContent = 'Could not read file. ' + e.message; }
}

function renderAll() { renderMeta(); renderScore(); renderBars(); renderFindings(); renderPlan(); renderDev(); renderCharts(); renderQuarters(); renderFilter(); renderTable(); }

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

$('#file').addEventListener('change', e => { const f = e.target.files[0]; if (f) readFile(f); e.target.value = ''; });
['dragover', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop' && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); }));
$('#print').addEventListener('click', () => window.print());
$('#sample').addEventListener('click', () => load(SAMPLE, 'Sample data is made up for demonstration.'));
$('#template').addEventListener('click', () => download('basketball-stats-template.csv', COLS.join(',') + '\n'));
$('#q').addEventListener('input', e => { state.q = e.target.value; renderTable(); });
$('#teamFilter').addEventListener('click', e => { const t = e.target.dataset.t; if (t) { state.team = t; renderFilter(); renderTable(); } });
$('#players').addEventListener('click', e => {
  const k = e.target.dataset.k; if (!k) return;
  state.dir = state.sortKey === k ? -state.dir : (k === 'player' || k === 'team' ? 1 : -1); state.sortKey = k; renderTable();
});
$('#export').addEventListener('click', () => {
  const rows = visible();
  download('players-export.csv', HEAD.map(h => h[1]).join(',') + '\n' + rows.map(r => HEAD.map(([k]) => k === 'fgp' ? (r.fgp == null ? '' : r.fgp.toFixed(1)) : r[k]).join(',')).join('\n'));
});

/* ---------- Improvement analysis ---------- */
const BENCH0 = { fg: 45, tp: 33, ft: 72, efg: 50, ts: 55, tov: 15, ast: 1.5, ftr: 25 };
state.bench = { ...BENCH0 };
const METRICS = [
  { k: 'fg', l: 'Field goal %', hi: true, drill: 'Catch-and-shoot and finishing reps at game speed. Review video to check shot quality.' },
  { k: 'tp', l: 'Three-point %', hi: true, drill: 'Spot-up shooting from five spots (about 100 makes a week) plus off-the-dribble reps.' },
  { k: 'ft', l: 'Free throw %', hi: true, drill: 'Routine-based free throws, 50 per session, including sets after conditioning when tired.' },
  { k: 'efg', l: 'Effective FG %', hi: true, drill: 'Shot selection work: more rim attacks and open threes, fewer contested long twos.' },
  { k: 'ts', l: 'True shooting %', hi: true, drill: 'Draw more fouls and cut low-value shots. Pair finishing drills with the free throw routine.' },
  { k: 'tov', l: 'Turnover rate', hi: false, drill: 'Pressure ball-handling, 5-on-5 with a turnover count, and pass-fake decision drills.' },
  { k: 'ast', l: 'Assist to turnover', hi: true, drill: 'Drive-and-kick, pass-and-cut, and 3-on-2 decision-making drills.' },
  { k: 'ftr', l: 'Free throw rate (FTA per 100 FGA)', hi: true, drill: 'Rim attacks, post touches, and attacking closeouts to get to the line.' }
];
function metricVals(t) {
  const att = t.fga + 0.44 * t.fta, poss = att + t.tov;
  return { fg: pct(t.fgm, t.fga), tp: pct(t.tpm, t.tpa), ft: pct(t.ftm, t.fta), efg: t.fga ? (t.fgm + 0.5 * t.tpm) / t.fga * 100 : null, ts: att ? t.pts / (2 * att) * 100 : null, tov: poss ? t.tov / poss * 100 : null, ast: t.tov ? t.ast / t.tov : null, ftr: t.fga ? t.fta / t.fga * 100 : null };
}
function enough(k, t) {
  const poss = t.fga + 0.44 * t.fta + t.tov;
  return { fg: t.fga >= 6, efg: t.fga >= 6, ts: t.fga >= 6, ftr: t.fga >= 6, tp: t.tpa >= 3, ft: t.fta >= 3, tov: poss >= 10, ast: t.tov >= 2 }[k];
}
function gap(k, v) { const b = state.bench[k]; return METRICS.find(m => m.k === k).hi ? (v - b) / b : (b - v) / b; }
function level(rel) { return rel < -0.15 ? ['High', 'p-high'] : rel < -0.05 ? ['Medium', 'p-med'] : rel < 0 ? ['Low', 'p-low'] : ['Meets reference', 'p-ok']; }
const fmtM = (k, v) => v == null ? 'n/a' : (k === 'ast' ? v.toFixed(2) : v.toFixed(1) + '%');
function targetFor(k, v, rel) { if (rel >= 0) return 'Maintain'; const b = state.bench[k]; return fmtM(k, rel < -0.15 ? v + (b - v) / 2 : b); }

function renderPlan() {
  const order = { High: 0, Medium: 1, Low: 2, 'Meets reference': 3 };
  $('#plan').innerHTML = teams().map(team => {
    const t = totals(team), mv = metricVals(t);
    const rows = METRICS.filter(m => mv[m.k] != null && enough(m.k, t)).map(m => { const rel = gap(m.k, mv[m.k]); const [lv, cls] = level(rel); return { m, v: mv[m.k], rel, lv, cls }; }).sort((x, y) => order[x.lv] - order[y.lv] || x.rel - y.rel);
    return `<div class="card"><h3>${esc(team)}</h3><div class="table-wrap"><table class="plan"><thead><tr><th>Area</th><th>Current</th><th>Reference</th><th>Priority</th><th>Suggested focus</th><th>Proposed target</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.m.l}</td><td>${fmtM(r.m.k, r.v)}</td><td>${fmtM(r.m.k, state.bench[r.m.k])}</td><td><span class="badge ${r.cls}">${r.lv}</span></td><td>${r.lv === 'Meets reference' ? 'Keep it up and check that it holds over more games.' : r.m.drill}</td><td>${targetFor(r.m.k, r.v, r.rel)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }).join('');
}

function renderDev() {
  $('#dev').innerHTML = state.rows.filter(r => r.played).map(r => {
    const mv = metricVals(r);
    const ev = METRICS.filter(m => mv[m.k] != null && enough(m.k, r)).map(m => ({ m, v: mv[m.k], rel: gap(m.k, mv[m.k]) }));
    const weak = ev.filter(e => e.rel < 0).sort((a, b) => a.rel - b.rel)[0];
    const strong = ev.filter(e => e.rel >= 0.05).sort((a, b) => b.rel - a.rel).slice(0, 2);
    const base = `${r.pts} PTS, ${r.reb} REB, ${r.ast} AST, FG ${r.fgm}/${r.fga}, 3P ${r.tpm}/${r.tpa}, FT ${r.ftm}/${r.fta}, ${r.tov} TOV, ${r.pf} PF`;
    let body;
    if (!ev.length) body = '<p>Not enough attempts for a reliable read. It takes at least 6 field goal attempts, 3 three-point attempts, or 3 free throw attempts.</p>';
    else body = `<p><span class="k">Strengths in the data:</span> ${strong.length ? strong.map(x => x.m.l + ' ' + fmtM(x.m.k, x.v)).join(', ') : 'none clearly above the reference'}</p>` +
      (weak ? `<p><span class="k">Main opportunity:</span> ${weak.m.l}, ${fmtM(weak.m.k, weak.v)} vs reference ${fmtM(weak.m.k, state.bench[weak.m.k])}</p><p><span class="k">Practice focus:</span> ${weak.m.drill}</p><p><span class="k">Proposed target:</span> ${targetFor(weak.m.k, weak.v, weak.rel)} across the next 3 games (a goal, not a guarantee)</p>` : '<p><span class="k">Main opportunity:</span> Nothing below the reference in this game. Keep tracking.</p>') +
      '<p class="k">One game is a small sample. Confirm with video and more games.</p>';
    return `<div class="card"><h3>${esc(r.player)} <span class="k">${esc(r.team)}${r.number !== '' ? ' #' + esc(r.number) : ''}</span></h3><p><span class="k">Baseline:</span> ${base}</p>${body}</div>`;
  }).join('');
}

function buildBench() {
  $('#bench').innerHTML = METRICS.map(m => `<label>${m.l}<input type="number" step="any" min="0" data-k="${m.k}" value="${state.bench[m.k]}"></label>`).join('') + '<button class="btn" id="resetBench" type="button">Reset</button>';
}
const refresh = () => { renderPlan(); renderDev(); renderCharts(); };
$('#bench').addEventListener('input', e => { const k = e.target.dataset.k, v = parseFloat(e.target.value); if (k && v > 0) { state.bench[k] = v; refresh(); } });
$('#bench').addEventListener('click', e => { if (e.target.id === 'resetBench') { state.bench = { ...BENCH0 }; buildBench(); refresh(); } });

/* ---------- Charts ---------- */
const charts = {};
function mk(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($('#' + id), cfg); }
function renderCharts() {
  if (typeof Chart === 'undefined') { $('#chartNote').textContent = 'Charts need the Chart.js library, which loads from the internet. Reconnect and reload the page.'; return; }
  $('#chartNote').textContent = '';
  const s = getComputedStyle(document.documentElement), g = n => s.getPropertyValue(n).trim();
  const ink = g('--ink'), A = g('--a'), B = g('--b'), acc = g('--accent');
  Chart.defaults.color = g('--muted'); Chart.defaults.borderColor = g('--line'); Chart.defaults.font.family = '"Source Serif 4",Georgia,serif';
  const T = teams(), col = T.map((_, i) => i % 2 ? B : A), base = { responsive: true, maintainAspectRatio: false };
  const tt = T.map(totals), mv = tt.map(metricVals), bn = state.bench;
  const ks = ['fg', 'tp', 'ft', 'efg', 'ts'];
  mk('cShoot', { type: 'bar', data: { labels: ['FG%', '3P%', 'FT%', 'eFG%', 'TS%'], datasets: [...T.map((t, i) => ({ label: t, data: ks.map(k => mv[i][k]), backgroundColor: col[i] })), { type: 'line', label: 'Reference', data: ks.map(k => bn[k]), showLine: false, borderColor: ink, backgroundColor: ink, pointStyle: 'rectRot', pointRadius: 6 }] }, options: { ...base, scales: { y: { beginAtZero: true, title: { display: true, text: 'Percent' } } } } });
  mk('cMix', { type: 'bar', data: { labels: T, datasets: [['2-point', tt.map(t => (t.fgm - t.tpm) * 2), A], ['3-point', tt.map(t => t.tpm * 3), acc], ['Free throws', tt.map(t => t.ftm), '#2f9e63']].map(([label, data, backgroundColor]) => ({ label, data, backgroundColor })) }, options: { ...base, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Points' } } } } });
  const pl = state.rows.filter(r => r.played).sort((x, y) => y.eff - x.eff).slice(0, 10);
  mk('cPlayers', { type: 'bar', data: { labels: pl.map(r => `${r.player} (${r.team})`), datasets: [{ label: 'Points', data: pl.map(r => r.pts), backgroundColor: A }, { label: 'Efficiency', data: pl.map(r => r.eff), backgroundColor: acc }] }, options: { ...base, indexAxis: 'y' } });
  const rk = [['fg', 'FG%'], ['tp', '3P%'], ['ft', 'FT%'], ['efg', 'eFG%'], ['ts', 'TS%'], ['tov', 'Ball security'], ['ast', 'AST/TO'], ['ftr', 'FT rate']];
  const idx = (k, v) => v == null ? 0 : Math.min(150, (METRICS.find(m => m.k === k).hi ? v / bn[k] : bn[k] / v) * 100);
  mk('cRadar', { type: 'radar', data: { labels: rk.map(x => x[1]), datasets: [...T.map((t, i) => ({ label: t, data: rk.map(([k]) => idx(k, mv[i][k])), borderColor: col[i], backgroundColor: col[i] + '33', pointBackgroundColor: col[i] })), { label: 'Reference (100)', data: rk.map(() => 100), borderColor: ink, borderDash: [5, 4], pointRadius: 0, fill: false }] }, options: { ...base, scales: { r: { min: 0, max: 150, ticks: { backdropColor: 'transparent' } } } } });
  const mx = Math.max(10, ...state.rows.map(r => r.fga));
  mk('cScatter', { type: 'scatter', data: { datasets: [...T.map((t, i) => ({ label: t, backgroundColor: col[i], pointRadius: 7, data: state.rows.filter(r => r.team === t && r.fga > 0).map(r => ({ x: r.fga, y: r.fgp, n: r.player })) })), { type: 'line', label: 'FG% reference', data: [{ x: 0, y: bn.fg }, { x: mx + 1, y: bn.fg }], borderColor: ink, borderDash: [6, 4], pointRadius: 0 }] }, options: { ...base, scales: { x: { beginAtZero: true, title: { display: true, text: 'Field goal attempts' } }, y: { beginAtZero: true, title: { display: true, text: 'FG%' } } }, plugins: { tooltip: { callbacks: { label: c => c.raw.n ? `${c.raw.n}: ${c.raw.x} FGA, ${c.raw.y.toFixed(1)}% FG` : `${c.dataset.label}: ${c.raw.y}%` } } } } });
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { renderCharts(); renderQuarters(); });
buildBench();

load(SAMPLE, 'Sample data is made up for demonstration.');

/* ---------- Game information (result sheets) ---------- */
function renderMeta() {
  const m = state.meta, sec = $('#gameInfo');
  sec.hidden = !m; $('#qCard').hidden = !(m && m.quarters);
  if (!m) return;
  const [A, B] = m.teams || teams();
  const kv = [['Competition', m.competition], ['Venue and date', m.venue], ['Round', m.round], ['Scorer', m.scorer], ['Report generated', m.generated]].filter(x => x[1]);
  let h = `<div class="kv">${kv.map(([k, v]) => `<div><span class="k">${k}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  if (m.quarters) {
    const rows = m.quarters.map((q, i) => `<tr><td>Q${i + 1}</td><td>${q[0]}</td><td>${q[1]}</td><td>${q[0] === q[1] ? 'Tied' : esc(q[0] > q[1] ? A : B) + ' by ' + Math.abs(q[0] - q[1])}</td></tr>`).join('');
    h += `<h3>Quarter by quarter</h3><div class="table-wrap"><table class="plan"><thead><tr><th>Quarter</th><th>${esc(A)}</th><th>${esc(B)}</th><th>Won by</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  if (m.extras.length) {
    const secs = v => v == null ? 0 : /^\d+:\d{2}$/.test(v) ? v.split(':').reduce((a, b) => a * 60 + +b) : Number(v);
    h += `<h3>Team stats from the sheet</h3><div class="legend"><span><b style="background:var(--a)"></b>${esc(A)}</span><span><b style="background:var(--b)"></b>${esc(B)}</span></div><div class="bars">` +
      m.extras.map(e => { const a = secs(e.a), b = secs(e.b), t = a + b, w = t ? a / t * 100 : 50; return `<div class="row"><div class="lab"><span>${e.label}</span><em>${e.a ?? 'not derived'} vs ${e.b ?? 'not derived'}</em></div><div class="track">${t ? `<i style="width:${w}%"></i><i style="width:${100 - w}%"></i>` : ''}</div></div>`; }).join('') + '</div>';
  }
  if (m.singles.length) h += `<p>${m.singles.map(x => `<span class="k">${x.label}:</span> <b>${x.v}</b>`).join(' &nbsp; ')}</p>`;
  if (m.extras.length) h += '<p class="note">Some of these are worked out by the source from the play-by-play and are not recorded directly. Rows marked not derived could not be read back from the game log.</p>';
  $('#info').innerHTML = h;
}
function renderQuarters() {
  const m = state.meta;
  if (charts.cQuarters) { charts.cQuarters.destroy(); delete charts.cQuarters; }
  if (!m || !m.quarters || typeof Chart === 'undefined') return;
  const st = getComputedStyle(document.documentElement), g = n => st.getPropertyValue(n).trim();
  const [A, B] = m.teams || teams();
  Chart.defaults.color = g('--muted'); Chart.defaults.borderColor = g('--line');
  mk('cQuarters', { type: 'bar', data: { labels: m.quarters.map((_, i) => 'Q' + (i + 1)), datasets: [{ label: A, data: m.quarters.map(q => q[0]), backgroundColor: g('--a') }, { label: B, data: m.quarters.map(q => q[1]), backgroundColor: g('--b') }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Points' } } } } });
}

/* ---------- Site: routing, menu, reveal, contact ---------- */
const CONTACT_EMAIL = ''; // Put your email here to open the visitor's mail app when they send the form.
const VIEWS = { home: 'Home', analyzer: 'Analyzer', guide: 'Guide', about: 'About Us', contact: 'Contact' };

function route() {
  const h = (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];
  const v = VIEWS[h] ? h : 'home';
  document.querySelectorAll('.view').forEach(x => { x.hidden = x.id !== 'v-' + v; });
  document.querySelectorAll('[data-nav]').forEach(a => a.setAttribute('aria-current', a.dataset.nav === v ? 'page' : 'false'));
  document.title = VIEWS[v] + ' | Hoops Analyzer';
  $('#nav').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false');
  window.scrollTo(0, 0);
  if (v === 'analyzer') requestAnimationFrame(() => Object.values(charts).forEach(c => c.resize()));
  watchReveal();
}
function watchReveal() {
  const els = document.querySelectorAll('.view:not([hidden]) .reveal:not(.in)');
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  els.forEach(e => io.observe(e));
}
$('#burger').addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); $('#burger').setAttribute('aria-expanded', o); });
window.addEventListener('hashchange', route);
$('#year').textContent = new Date().getFullYear();

$('#contactForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, d = Object.fromEntries(new FormData(f));
  let ok = true;
  ['name', 'email', 'msg'].forEach(n => { const el = f.elements[n]; const bad = !el.value.trim() || (n === 'email' && !/^\S+@\S+\.\S+$/.test(el.value)); el.classList.toggle('bad', bad); if (bad) ok = false; });
  const st = $('#formStatus');
  if (!ok) { st.textContent = 'Please fill in your name, a valid email, and a message.'; return; }
  const body = `Topic: ${d.topic}\nFrom: ${d.name} <${d.email}>\n\n${d.msg}`;
  if (CONTACT_EMAIL) { location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Hoops Analyzer: ' + d.topic)}&body=${encodeURIComponent(body)}`; st.textContent = 'Opening your mail app. If nothing opens, copy your message and email it directly.'; }
  else { (navigator.clipboard ? navigator.clipboard.writeText(body) : Promise.reject()).then(() => st.textContent = 'No inbox is connected yet, so your message was copied. Paste it into an email to the site owner.', () => st.textContent = 'No inbox is connected yet. The site owner needs to add an email address in script.js.'); }
});
route();
