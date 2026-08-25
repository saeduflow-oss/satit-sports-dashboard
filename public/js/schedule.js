/* =========================================================
   schedule.js — ตารางการแข่งขัน (ผังกำหนดการ)
   อ่านจากแท็บ "ตารางการแข่งขัน" ในชีต ซึ่งมีแค่ วันที่ / กีฬา / ประเภท / เวลา / คู่แข่ง
   ไม่มีช่องผลหรือสถานะ จึงไม่มีคอลัมน์ผล/สถานะในหน้านี้ — ผลอยู่หน้า "ผลการแข่งขัน"

   ผังทั้งรายการยาวหลายร้อยแถว การไล่อ่านเรียงเวลาอย่างเดียวจึงหาอะไรไม่เจอ หน้านี้เลย:
   - จัดกลุ่มเป็นหัวข้อ (ตามชนิดกีฬาในแต่ละวัน หรือตามวันในแต่ละชนิดกีฬา) พับ/กางได้
   - หนึ่งรอบ = หนึ่งการ์ด เรียงตามเวลาจริง คู่เดิมที่ลงหลายรอบขึ้นซ้ำทุกรอบ (คนละเวลาที่ต้องไปลง)
   - วางการ์ดแถวละ 3 ใบบนจอกว้าง
   - มีตัวกรอง วัน / ชนิดกีฬา / คำค้น / เฉพาะโรงเรียนเรา
   ========================================================= */
import {
  el, esc, loadData, schedulePolling, initChrome, sportIcon, sportName,
  dayLabel, currentDay, schoolCores, matchScore, eventParts, teamSides, paintUiIcons, showLoadError,
  schoolByText, schoolCrest
} from './common.js';

/* ---------- ชุดคลาสที่ใช้ซ้ำทั้งหน้า (เขียนเต็มเสมอ ตัวสร้าง CSS อ่านจากสตริงพวกนี้) ---------- */
var PANEL = 'flex flex-col overflow-hidden rounded-lg border bg-surface shadow-panel';
var PANEL_HEAD = 'flex items-center gap-3 border-b border-line px-5 pt-[15px] pb-[13px]' +
  ' max-[560px]:flex-wrap max-[560px]:gap-y-[9px] max-[560px]:px-4 max-[560px]:pt-3.5 max-[560px]:pb-3';
var PANEL_TITLE = 'm-0 font-display text-[17px] font-normal text-fg';
var PILL = 'text-[12.5px] whitespace-nowrap text-fg-mute';

/* กล่องไอคอนหน้าหัวกลุ่ม — ขนาดใส่ตอนเรียก (ในหัวพาเนลย่อลงหนึ่งขนาด)
   ห้ามใส่ขนาดตั้งต้นไว้ตรงนี้แล้วให้ผู้เรียกทับ: utility คนละตัวที่คุมสมบัติเดียวกัน
   ลำดับในไฟล์ CSS เป็นตัวตัดสิน ไม่ใช่ลำดับที่เขียนใน class */
var GROUP_IC = 'flex flex-none items-center justify-center rounded-[9px] border border-line bg-surface-soft text-fg-soft';

/* แต่ละรายการเป็นการ์ดใบหนึ่ง: เวลาอยู่ซ้ายสุด เส้นคั่น แล้วตราโรงเรียนกับชื่อสองฝั่งซ้อนกัน
   อ่านทีละใบได้โดยไม่ต้องกวาดสายตาข้ามคอลัมน์ และดูออกทันทีว่าใครพบใคร */
var CARD = 'flex items-center gap-3.5 rounded-md border px-4 py-3 max-[560px]:gap-3 max-[560px]:px-3';
var CARD_OFF = ' border-line bg-surface-soft';
/* รายการของโรงเรียนเรา: พื้นสีเน้นทั้งใบ ให้กวาดตาเจอในผังที่ยาวหลายร้อยรายการ */
var CARD_SELF = ' border-transparent bg-brand-100';
var CARD_BODY = 'min-w-0 flex-1';
/* วางการ์ดแถวละ 3 ใบบนจอกว้าง — แคบกว่านั้นคอลัมน์จะเหลือไม่ถึง ~280px
   ชื่อโรงเรียนเต็ม ๆ กับตราจะเบียดกันจนตกบรรทัดทุกใบ จึงลดเหลือ 2 แล้ว 1 คอลัมน์ตามลำดับ
   ใช้ทั้งในกลุ่มที่กางอยู่ และเป็นกริดของทั้งพาเนล (การ์ดเดี่ยวที่ไม่มีกลุ่มจะได้เรียงต่อกันเอง) */
var CARD_GRID = 'grid grid-cols-1 min-[820px]:grid-cols-2 min-[1200px]:grid-cols-3';

/* ชิปตัวกรองอยู่ในกล่องเครื่องมือแล้ว จึงไม่ต้องมีขอบของตัวเองให้รก — ขอบโปร่งใสไว้กันขนาดขยับตอนถูกเลือก
   สีทึบสงวนไว้ให้ "กำลังกรองอยู่จริง" เท่านั้น ส่วน "ทั้งหมด" (= ไม่ได้กรอง) เป็นสถานะเทากลาง ๆ
   ไม่งั้นเปิดหน้ามาจะเจอชิปสีน้ำเงินสามอันพร้อมกันทั้งที่ยังไม่ได้กรองอะไรเลย */
var CHIP_BTN = 'inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-full border px-3 py-[7px] font-body text-[13px]' +
  ' transition-[border-color,color,background-color] duration-150 focus-visible:outline-2 focus-visible:-outline-offset-1' +
  ' focus-visible:outline-brand motion-reduce:transition-none';
var CHIP_OFF = ' border-transparent text-fg-soft hover:bg-surface-soft hover:text-fg';
var CHIP_ON = ' border-transparent bg-brand text-on-ink';
var CHIP_NEUTRAL = ' border-transparent bg-surface-soft text-fg';
/* ชิปที่กดแล้วเหลือ 0 รายการจางลงแต่ยังกดได้ (ชิปที่กำลังเลือกอยู่ไม่จาง ไม่งั้นดูเหมือนปุ่มที่ถูกปิด) */
var CHIP_EMPTY = ' opacity-45';
var CHIP_N = 'font-mono text-[11px] tabular-nums';

/* ปุ่มในสถานะว่าง (ล้างตัวกรอง) — ทรงเดียวกับปุ่มควบคุมในกล่องเครื่องมือ */
var FILTER_CHIP = 'cursor-pointer rounded-[11px] border border-line bg-surface-soft px-[15px] py-2 font-body text-[13px] text-fg-soft' +
  ' transition-[border-color,color,background-color] duration-150 hover:border-line-strong hover:text-fg' +
  ' focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none';

var chrome = initChrome('schedule');

var state = {
  data: null, cores: [], today: null,
  dayId: 'all', sportId: 'all', q: '',
  /* กลุ่มที่ผู้ใช้พับเก็บไว้ — ต้องจำไว้เอง เพราะหน้านี้วาดใหม่ทั้งหน้าทุกครั้งที่ซิงก์ (20 วิ/ครั้ง) */
  closed: {}, keys: []
};

/** ผังการแข่งขันจากแท็บของตัวเอง ถ้าชีตยังไม่มีแท็บนี้ ให้ถอยไปใช้ตารางแข่งขันเดิม */
function planDays(data) {
  var plan = data.schedule || [];
  return plan.length ? plan : (data.days || []);
}

/* ---------- แปลงผังเป็นรายการแถวเดียว พร้อมฟิลด์ที่หน้านี้ใช้กรอง/จัดกลุ่ม ---------- */
function planRows(data) {
  var rows = [];
  planDays(data).forEach(function (day) {
    (day.items || []).forEach(function (i) {
      var sport = sportName(data, i.sportId);
      var head = eventParts(sport, i.event);
      rows.push({
        dayId: day.id, day: day, time: i.time || '',
        sportId: i.sportId || '',
        sport: head.sport || sport || 'อื่น ๆ',
        kind: head.kind || '',
        teams: i.teams || '',
        mine: state.cores.length > 0 && matchScore(i.teams || '', state.cores) > 0
      });
    });
  });
  return rows;
}

/**
 * กรองตามตัวกรองที่เลือกอยู่
 * @param {string} [skip] - ข้ามตัวกรองตัวหนึ่ง ('day'/'sport') ใช้ตอนนับเลขบนชิปของตัวกรองนั้นเอง
 *   ชิปจึงบอก "ถ้ากดอันนี้จะเหลือกี่รายการ" ไม่ใช่นับซ้ำตัวเองจนเป็น 0 ทุกอันที่ไม่ได้เลือก
 */
function filterRows(rows, skip) {
  var q = state.q.trim().toLowerCase();
  return rows.filter(function (r) {
    if (skip !== 'day' && state.dayId !== 'all' && r.dayId !== state.dayId) return false;
    if (skip !== 'sport' && state.sportId !== 'all' && r.sportId !== state.sportId) return false;
    if (q && (r.sport + ' ' + r.kind + ' ' + r.teams + ' ' + r.time).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
function hasFilter() {
  return state.dayId !== 'all' || state.sportId !== 'all' || state.q.trim() !== '';
}

/**
 * เรียงรายการตามเวลาจริง — หนึ่งรอบคือหนึ่งรายการเสมอ
 * คู่เดิมที่ลงหลายรอบ (เช่น กรีฑารายการเดิมชั่วโมงละรอบ) จึงขึ้นซ้ำทุกรอบ ไม่ยุบรวมกัน
 * เพราะแต่ละรอบคือเวลาที่ต้องไปลงจริงคนละเวลา ไม่ใช่ข้อมูลซ้ำ
 */
function sortRows(rows) {
  var order = planDays(state.data).map(function (d) { return d.id; });
  // เรียงตามลำดับวันในชีตก่อนเสมอ แล้วค่อยเรียงเวลาในวันเดียวกัน — เรียงด้วยเวลาล้วนจะสลับวันกัน
  // (08:00 ของวันที่สอง มาก่อน 08:30 ของวันแรก) เวลาในชีตเติมศูนย์หน้าชั่วโมงหลักเดียวมาแล้ว
  // จึงเทียบเป็นข้อความได้ตรง
  return rows.slice().sort(function (a, b) {
    var d = order.indexOf(a.dayId) - order.indexOf(b.dayId);
    return d || String(a.time).localeCompare(String(b.time));
  });
}

/** จัดกลุ่มตามคีย์ โดยคงลำดับที่แถวแรกของแต่ละกลุ่มปรากฏ (= ลำดับเวลา) */
function groupRows(rows, keyOf) {
  var index = {}, groups = [];
  rows.forEach(function (r) {
    var k = keyOf(r);
    if (!index[k]) { index[k] = { key: k, rows: [], first: r }; groups.push(index[k]); }
    index[k].rows.push(r);
  });
  return groups;
}

function countItems(rows) {
  return rows.length;
}
function timeSpan(rows) {
  var all = rows.map(function (r) { return r.time; }).filter(Boolean).sort();
  if (!all.length) return '';
  return all[0] === all[all.length - 1] ? all[0] : all[0] + '–' + all[all.length - 1];
}

/* ---------- แถวรายการ ---------- */

/** หนึ่งบรรทัดของทีม: ตราโรงเรียนจริงถ้ารู้จักชื่อนี้ ไม่รู้จักก็วงกลมตัวอักษรแรก
    ฝั่งที่เป็นโรงเรียนเราเน้นสีชื่อไว้ให้กวาดตาเจอ */
function teamLine(side) {
  var mine = state.cores.length > 0 && matchScore(side, state.cores) > 0;
  var school = schoolByText(state.data, side) || { school: side };
  return '<span class="flex min-w-0 items-center gap-2.5">' +
    schoolCrest(school, 'size-7 text-[11px]') +
    '<span class="min-w-0 text-[14.5px] leading-[1.35] break-words ' +
      (mine ? 'text-brand-strong' : 'text-fg') + '">' + esc(side) + '</span></span>';
}

/** ฝั่งซ้าย: เวลาของรอบนี้รอบเดียว (รอบอื่นของคู่เดิมเป็นการ์ดของตัวเอง) */
function whenHtml(time) {
  return '<span class="w-[62px] shrink-0 text-center max-[560px]:w-[52px]">' +
    '<span class="block font-mono text-[17px] leading-tight text-fg tabular-nums max-[560px]:text-[15px]">' +
      esc(time || '—') + '</span>' +
  '</span>';
}

function rowEl(r) {
  var sides = teamSides(r.teams);

  // ชื่อกีฬาอยู่บนหัวกลุ่มเสมอ การ์ดจึงขึ้นต้นด้วย "ประเภท" ทุกใบ ไม่ต้องพกชื่อกีฬาซ้ำ
  var kind = r.kind || r.sport;
  var kindHtml = kind
    ? '<span class="block text-[12.5px] leading-[1.4] text-fg-mute">' + esc(kind) + '</span>'
    : '';

  // ไม่มีคู่แข่งในชีต (เช่น กรีฑาที่ลงเป็นรายการรวม) ก็ไม่ต้องมีบรรทัดทีมเปล่า ๆ
  var teamsHtml = sides.length
    ? '<span class="mt-1.5 flex flex-col gap-1.5">' + sides.map(teamLine).join('') + '</span>'
    : '';

  return el('div', CARD + (r.mine ? CARD_SELF : CARD_OFF),
    whenHtml(r.time) +
    '<span class="self-stretch border-l border-line" aria-hidden="true"></span>' +
    '<span class="' + CARD_BODY + '">' + kindHtml + teamsHtml + '</span>');
}

/* ---------- กลุ่มพับได้ (details/summary — ได้คีย์บอร์ดกับ screen reader มาฟรี) ---------- */
function groupEl(key, headHtml, rows) {
  state.keys.push(key);
  var box = el('details', 'group/sg col-span-full');
  box.open = !state.closed[key];

  // ลูกศรพับ/กาง วาดจากเส้นขอบสองด้าน ไม่ต้องโหลดไอคอนเพิ่มสำหรับของชิ้นเดียว
  var sum = el('summary',
    'flex cursor-pointer list-none items-center gap-[11px] rounded-md px-1 py-1.5 select-none [&::-webkit-details-marker]:hidden' +
    ' hover:bg-surface-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand' +
    ' max-[860px]:gap-2.5',
    headHtml +
    '<span class="mt-[-4px] mr-[3px] ml-[3px] size-2 flex-none rotate-45 border-r-[1.6px] border-b-[1.6px] border-fg-mute transition-[transform,margin] duration-150' +
    ' group-open/sg:mt-[3px] group-open/sg:-rotate-[135deg] motion-reduce:transition-none" aria-hidden="true"></span>');
  box.appendChild(sum);

  var list = el('div', CARD_GRID + ' gap-2 pt-2');
  rows.forEach(function (r) { list.appendChild(rowEl(r)); });
  box.appendChild(list);

  box.addEventListener('toggle', function () { state.closed[key] = !box.open; });
  return box;
}

/**
 * ใส่กลุ่มลงพาเนล — ทุกชนิดกีฬาได้หัวข้อของตัวเองเสมอ แม้วันนั้นจะแข่งรายการเดียว
 * เพื่อให้การ์ดทุกใบหน้าตาเหมือนกันหมด (ชื่อกีฬาอยู่บนหัวข้อ · การ์ดบอกประเภทกับคู่แข่ง)
 */
function addGroup(panel, key, headHtml, rows) {
  panel.body.appendChild(groupEl(key, headHtml, rows));
}

/** หัวกลุ่ม: ไอคอน + ชื่อ + ช่วงเวลา/จำนวน — โครงเดียวกันทั้งกลุ่มกีฬาและกลุ่มวัน */
function groupHead(icon, name, rows) {
  return '<span class="' + GROUP_IC + ' size-8">' + icon + '</span>' +
    '<span class="flex min-w-0 flex-col leading-[1.35]">' +
      '<span class="text-[15px] text-fg">' + esc(name) + '</span>' +
      '<span class="font-mono text-[11.5px] text-fg-mute tabular-nums">' + timeSpan(rows) + ' · ' + countItems(rows) + ' รายการ</span></span>' +
    '<span class="flex-1"></span>';
}

/* ---------- พาเนล ---------- */
/** คืน section ที่มี .body ให้เอากลุ่ม/การ์ดไปใส่ — ระยะขอบกับช่องไฟอยู่ที่ body ที่เดียว */
function panelEl(headHtml, isToday) {
  var panel = el('section', PANEL + (isToday ? ' border-brand' : ' border-line'));
  panel.appendChild(el('div', PANEL_HEAD, headHtml));
  panel.body = el('div', CARD_GRID + ' gap-3 px-5 py-4 max-[860px]:px-4 max-[860px]:py-3');
  panel.appendChild(panel.body);
  return panel;
}

/** หนึ่งพาเนลต่อวัน ข้างในซอยเป็นกลุ่มชนิดกีฬา */
function dayPanel(day, rows) {
  var isToday = !!state.today && day.date === state.today.date;
  var panel = panelEl(
    '<h2 class="' + PANEL_TITLE + '">' + esc(dayLabel(day) || ('วันที่ ' + day.id)) + '</h2>' +
    (isToday ? '<span class="' + PILL + ' text-brand-strong">วันนี้</span>' : '') +
    '<span class="flex-1 max-[560px]:h-0 max-[560px]:basis-full"></span>' +
    '<span class="' + PILL + '">' + countItems(rows) + ' รายการ · ' + timeSpan(rows) + '</span>',
    isToday);

  groupRows(rows, function (r) { return r.sportId || r.sport; }).forEach(function (g) {
    addGroup(panel, 'day' + day.id + '|' + g.key,
      groupHead(sportIcon(g.first.sportId, 'size-[21px]'), g.first.sport, g.rows), g.rows);
  });
  return panel;
}

/* ---------- แถบตัวกรอง ---------- */
/**
 * @param {boolean} on - กำลังเลือกอยู่ไหม
 * @param {boolean} [neutral] - true = ชิป "ทั้งหมด" ใช้สีเทาแทนสีทึบ (ไม่ได้กรองอะไร ไม่ต้องตะโกน)
 */
function chipBtn(cls, html, on, pick, neutral) {
  var b = el('button', cls + (on ? (neutral ? CHIP_NEUTRAL : CHIP_ON) : CHIP_OFF), html);
  b.type = 'button';
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.addEventListener('click', pick);
  return b;
}

/** ตัวเลขท้ายชิป = "กดแล้วจะเหลือกี่รายการ" สีของมันต้องตามพื้นของชิปที่กำลังเลือกอยู่ */
function chipCount(n, on) {
  return '<span class="' + CHIP_N + ' ' + (on ? 'text-on-ink-soft' : 'text-fg-mute') + '">' + n + '</span>';
}

function renderDayBar(all) {
  var host = document.getElementById('dayJump');
  host.innerHTML = '';
  var pool = filterRows(all, 'day');
  var days = planDays(state.data);
  var allOn = state.dayId === 'all';

  host.appendChild(chipBtn(CHIP_BTN, 'ทั้งหมด ' + chipCount(pool.length, false),
    allOn, function () { state.dayId = 'all'; render(); }, true));

  days.forEach(function (day) {
    var n = pool.filter(function (r) { return r.dayId === day.id; }).length;
    var on = state.dayId === day.id;
    // "วันนี้" อยู่บนชิปด้วย เพราะแถวนี้คือที่ที่คนมองหาว่าจะกดวันไหน (หัวพาเนลข้างล่างบอกอีกที)
    var isToday = !!state.today && day.date === state.today.date;
    host.appendChild(chipBtn(CHIP_BTN + (n || on ? '' : CHIP_EMPTY),
      esc(dayLabel(day)) +
      (isToday ? '<span class="text-[11.5px] ' + (on ? 'text-on-ink-soft' : 'text-brand-strong') + '">วันนี้</span>' : '') +
      chipCount(n, on),
      on, function () { state.dayId = (state.dayId === day.id ? 'all' : day.id); render(); }));
  });
  document.getElementById('dayRow').hidden = days.length < 2;
}

function renderSportBar(all) {
  var host = document.getElementById('sportBar');
  host.innerHTML = '';
  var pool = filterRows(all, 'sport');
  // เรียงตามลำดับกีฬาในชีต แล้วต่อท้ายด้วยกีฬาที่มีในผังแต่ยังไม่มีในตารางชนิดกีฬา
  var order = (state.data.sports || []).map(function (s) { return s.id; });
  var groups = groupRows(all, function (r) { return r.sportId || r.sport; })
    .sort(function (a, b) {
      var ia = order.indexOf(a.first.sportId), ib = order.indexOf(b.first.sportId);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

  var allOn = state.sportId === 'all';
  host.appendChild(chipBtn(CHIP_BTN, 'ทั้งหมด ' + chipCount(pool.length, false),
    allOn, function () { state.sportId = 'all'; render(); }, true));

  groups.forEach(function (g) {
    var id = g.first.sportId;
    var n = pool.filter(function (r) { return (r.sportId || r.sport) === g.key; }).length;
    var on = state.sportId === id;
    host.appendChild(chipBtn(CHIP_BTN + (n || on ? '' : CHIP_EMPTY),
      sportIcon(id, 'size-4') + esc(g.first.sport) + chipCount(n, on),
      on, function () { state.sportId = (state.sportId === id ? 'all' : id); render(); }));
  });
  document.getElementById('sportRow').hidden = groups.length < 2;
}

/* ---------- วาดทั้งหน้า ---------- */
function render() {
  var data = state.data;
  var all = planRows(data);
  state.keys = [];

  renderDayBar(all);
  renderSportBar(all);

  var rows = sortRows(filterRows(all));
  var host = document.getElementById('schedDays');
  host.innerHTML = '';

  if (!planDays(data).length) {
    host.appendChild(el('div', PANEL + ' border-line',
      '<div class="px-5 pt-[18px] pb-5"><p class="m-0 text-[12px] text-fg-mute">ยังไม่มีข้อมูลในแท็บ "ตารางการแข่งขัน" ของชีต</p></div>'));
  } else if (!rows.length) {
    var empty = el('div', PANEL + ' border-line',
      '<div class="flex flex-col items-center gap-3 px-5 pt-[18px] pb-5 text-center" id="schedEmpty">' +
        '<p class="m-0 text-[13.5px] text-fg-mute">ไม่พบรายการที่ตรงกับตัวกรอง</p></div>');
    var clear = el('button', FILTER_CHIP, 'ล้างตัวกรองทั้งหมด');
    clear.type = 'button';
    clear.addEventListener('click', clearFilters);
    empty.querySelector('#schedEmpty').appendChild(clear);
    host.appendChild(empty);
  } else {
    groupRows(rows, function (r) { return r.dayId; }).forEach(function (g) {
      host.appendChild(dayPanel(g.first.day, g.rows));
    });
  }

  var total = all.length, shown = filterRows(all).length;
  var dayCount = planDays(data).length;
  document.getElementById('schedNote').textContent = hasFilter()
    ? 'แสดง ' + shown + ' จาก ' + total + ' รายการ'
    : dayCount + ' วันแข่งขัน · ' + total + ' รายการ · เรียงตามเวลา';

  // แถบตัวกรองว่างทั้งสองแถว (วันเดียว กีฬาเดียว) ก็ไม่ต้องเหลือแถบเปล่าใต้แถวควบคุม
  document.getElementById('schedFilters').hidden =
    document.getElementById('dayRow').hidden && document.getElementById('sportRow').hidden;

  // "ล้างตัวกรอง" โผล่เฉพาะตอนที่มีอะไรให้ล้างจริง — ปุ่มที่กดแล้วไม่เกิดอะไรคือปุ่มที่ไม่ควรมี
  document.getElementById('schedClear').hidden = !hasFilter();

  // ไม่มีกลุ่มให้พับ (ทุกกีฬาลงวันละรายการเดียว) ก็ไม่ต้องมีปุ่มพับ
  var fold = document.getElementById('schedFold');
  var anyOpen = state.keys.some(function (k) { return !state.closed[k]; });
  fold.hidden = state.keys.length === 0;
  // ลูกศรชี้ขึ้นตอนกดแล้วพับ ชี้ลงตอนกดแล้วกาง — ทิศของลูกศรคือผลลัพธ์ของการกด ไม่ใช่สถานะตอนนี้
  fold.firstElementChild.className = 'size-2 flex-none border-r-[1.6px] border-b-[1.6px] border-current ' +
    (anyOpen ? 'rotate-[225deg]' : 'rotate-45');
  document.getElementById('schedFoldText').textContent = anyOpen ? 'พับทั้งหมด' : 'กางทั้งหมด';

  paintUiIcons(host);
}

/** ล้างทุกตัวกรองกลับไปเป็นผังเต็ม — ใช้ทั้งปุ่มในแถบเครื่องมือและปุ่มในสถานะว่าง */
function clearFilters() {
  state.dayId = 'all'; state.sportId = 'all'; state.q = '';
  document.getElementById('schedSearch').value = '';
  render();
}

/* ---------- ตัวควบคุม (ผูกครั้งเดียว องค์ประกอบเหล่านี้อยู่ใน HTML ไม่ได้วาดใหม่) ---------- */
document.getElementById('schedSearch').addEventListener('input', function (e) {
  state.q = e.target.value;
  if (state.data) render();
});

document.getElementById('schedClear').addEventListener('click', clearFilters);

document.getElementById('schedFold').addEventListener('click', function () {
  var anyOpen = state.keys.some(function (k) { return !state.closed[k]; });
  state.closed = {};
  if (anyOpen) state.keys.forEach(function (k) { state.closed[k] = true; });
  if (state.data) render();
});

function renderAll(data) {
  state.data = data;
  var self = (data.medalTable || []).filter(function (m) { return m.isSelf; })[0];
  state.cores = self ? schoolCores(self) : [];
  // "วันนี้" มาจากตารางผลการแข่งขัน (วันที่มีแมตช์สด/ประกาศผลล่าสุด) เทียบกันด้วยวันที่
  state.today = currentDay(data);
  render();
  chrome.onData(data);
}

loadData().then(function (data) {
  renderAll(data);
  schedulePolling(renderAll);
}).catch(showLoadError);
