import {
  el, esc, loadData, schedulePolling, allMatches, sportIcon, statusChip, initChrome, CHIP,
  schoolCores, matchScore, dayLabel, eventParts, paintUiIcons, showLoadError,
  teamSides, splitScore, schoolByText, schoolCrest
} from './common.js';

/* ใช้โครงแถวเดียวกับผังกำหนดการ (schedule.js) เพื่อให้สองหน้าอ่านเป็นระบบเดียวกัน
   เดิมแยก "ระหว่าง" กับ "ผล" เป็นคนละช่อง คนอ่านเลยต้องเดาเองว่า 1-3 เลขไหนเป็นของใคร
   ตอนนี้รวมเป็นช่องเดียว บรรทัดละหนึ่งฝ่ายพร้อมเลขของฝ่ายนั้นที่ปลายบรรทัดเดียวกัน
   จอแคบ: เวลาอยู่ซ้ายคงที่ กีฬา/ผล/สถานะ เรียงลงเป็นสามบรรทัดในคอลัมน์ขวา */
// ช่องกีฬากับช่องผลแบ่งที่ว่างกันเป็นสัดส่วน ห้ามให้ช่องใดช่องหนึ่งเป็น minmax ที่มีเพดานเป็น px
// เพราะ grid จะขยายช่องนั้นจนเต็มเพดานก่อน แล้วเหลือให้ 1fr เท่าไรก็เท่านั้น — เคยทำให้ช่องกีฬา
// เหลือ 0px ที่จอราว 950px จนชื่อกีฬาล้นไปทับช่องผล เพดานความกว้างจึงไปอยู่ที่ "เนื้อใน" ช่องผลแทน
var ST_GRID = 'grid grid-cols-[60px_minmax(0,1.15fr)_minmax(0,1fr)_120px] items-center gap-4 px-5' +
  ' max-[1000px]:grid-cols-[58px_minmax(0,1fr)] max-[1000px]:gap-x-3 max-[1000px]:gap-y-[3px] max-[1000px]:px-4';

var DAYTAB = 'flex cursor-pointer items-center gap-[9px] rounded-full border px-4 py-[9px] font-body text-[13px]' +
  ' transition-[border-color,color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2' +
  ' focus-visible:outline-brand motion-reduce:transition-none';
var DAYTAB_OFF = ' border-line bg-surface-soft text-fg-soft hover:border-line-strong hover:text-fg';
var DAYTAB_ON = ' border-transparent bg-brand text-on-ink';

var PAGE_BTN = 'h-[30px] min-w-[30px] cursor-pointer rounded-[8px] border font-mono text-[12.5px]' +
  ' focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:cursor-default disabled:opacity-45';
var PAGE_OFF = ' border-line bg-surface text-fg-soft hover:border-line-strong hover:text-fg';
var PAGE_ON = ' border-transparent bg-brand text-on-ink';

var chrome = initChrome('matches');
var state = { data: null, activeDay: 1, tablePage: 1, tableQuery: '', pageSize: 6 };

function renderDayTabs() {
  var host = document.getElementById('daybar'); host.innerHTML = '';
  if (!state.data.days.length) { host.appendChild(el('p', 'text-[12px] text-fg-mute', 'ยังไม่มีผลการแข่งขันในชีต')); return; }
  state.data.days.forEach(function (day) {
    var on = day.id === state.activeDay;
    var btn = el('button', DAYTAB + (on ? DAYTAB_ON : DAYTAB_OFF),
      '<span class="font-mono text-[11px] tracking-[.06em] ' + (on ? 'text-on-ink-soft' : 'text-fg-mute') + '">DAY ' + day.id + '</span> ' +
      esc(day.weekday) + ' ' + esc(day.date) + (day.note ? ' · ' + esc(day.note) : ''));
    btn.type = 'button';
    btn.addEventListener('click', function () {
      state.activeDay = day.id; state.tablePage = 1;
      renderDayTabs(); renderFixtures();
    });
    host.appendChild(btn);
  });
}

/* ---------- หนึ่งบรรทัด = หนึ่งฝ่าย + เลขของฝ่ายนั้น ---------- */

/**
 * แตก "A พบ B" กับ "1-3" ให้กลายเป็นสองบรรทัดที่จับคู่กันแล้ว
 * ผลที่ไม่ใช่คู่ตัวเลข (เช่น "ทอง: ปทุมวัน" ของรายการชิงชนะเลิศรวม) แตกไม่ได้
 * จึงเกาะไว้กับบรรทัดแรกทั้งก้อน ไม่ต้องพยายามหารสองให้มันผิด
 */
function resultLines(m) {
  var sides = teamSides(m.teams);
  var pair = splitScore(m.score);
  var live = m.status === 'live';

  if (sides.length >= 2 && pair) {
    var a = parseInt(pair[0], 10), b = parseInt(pair[1], 10);
    var known = !isNaN(a) && !isNaN(b) && a !== b;
    // ฝ่ายชนะเน้นสี ฝ่ายแพ้จาง (ชุดสีเดียวกับการ์ดผลบนหน้าหลัก)
    // แมตช์สดยังไม่มีผู้ชนะ ตัวเลขสองฝ่ายจึงเป็นสีสถานะเท่ากัน
    var tone = ['text-fg', 'text-fg'];
    if (live) tone = ['text-live', 'text-live'];
    else if (known) tone = a > b ? ['text-brand-strong', 'text-fg-mute'] : ['text-fg-mute', 'text-brand-strong'];
    return [
      { side: sides[0], score: pair[0], tone: tone[0], num: true, win: !live && known && a > b },
      { side: sides[1], score: pair[1], tone: tone[1], num: true, win: !live && known && b > a }
    ];
  }

  var tone1 = live ? 'text-live' : 'text-fg';
  if (!sides.length) return [{ side: '', score: m.score || '', tone: tone1, dash: !m.score }];
  // บรรทัดกลุ่มนี้ไม่ตั้ง num ผลจึงขึ้นด้วยฟอนต์เนื้อความ ไม่ใช่ฟอนต์ตัวเลข
  return sides.map(function (side, i) {
    return { side: side, score: i === 0 ? (m.score || '') : '', tone: tone1, dash: i === 0 && !m.score };
  });
}

/**
 * ฝั่งที่เป็นโรงเรียนเราเน้นที่ "ชื่อ" ไม่ใช่ย้อมทั้งแถว
 * ของเดิมย้อมแถวเป็นสีฟ้าเมื่อเจอชื่อเรา แต่ในชีตจริงปทุมวันลงแข่งทุกคู่ ตารางเลยฟ้าทั้งใบ
 * จนไฮไลต์ไม่ได้บอกอะไรเลย — เน้นที่ชื่อยังอ่านออกแม้ทุกแถวจะเป็นแมตช์ของเรา
 *
 * ฝ่ายชนะมีคำว่า "ชนะ" กำกับ ไม่ปล่อยให้สีเป็นตัวบอกอย่างเดียว
 * คนตาบอดสีกับคนที่ฟังด้วย screen reader ต้องได้ข้อมูลเท่ากัน
 */
function lineHtml(data, line, cores) {
  var mine = cores.length > 0 && line.side && matchScore(line.side, cores) > 0;
  var school = line.side ? schoolByText(data, line.side) : null;
  // ช่องนี้กรอกเป็นอย่างอื่นที่ไม่ใช่ชื่อโรงเรียนก็ได้ ("รวมทุกโรงเรียน" / "ผู้ชนะสาย A")
  // ตราปลอมที่เป็นวงกลมตัวอักษรแรกของข้อความพวกนี้อ่านเหมือนตราโรงเรียนที่ไม่มีอยู่จริง
  // จึงเว้นเป็นช่องว่างขนาดเท่าตราแทน ชื่อทุกบรรทัดในตารางจะได้เริ่มที่ขอบเดียวกัน
  var crest = school
    ? schoolCrest(school, 'size-7 text-[11px]')
    : '<span class="size-7 flex-none" aria-hidden="true"></span>';
  var name = '<span class="min-w-0 flex-1 text-[13.5px] leading-[1.35] break-words ' +
    (mine ? 'text-brand-strong' : line.side ? 'text-fg-soft' : 'text-fg-mute') + '">' +
    esc(line.side || 'รวมทุกโรงเรียน') + '</span>';

  // ผลที่เป็นคู่ตัวเลขใช้ฟอนต์ตัวเลขให้หลักตรงกันทุกแถว ส่วนผลที่เป็นข้อความ ("ทอง: ปทุมวัน")
  // ใช้ฟอนต์เนื้อความ เพราะฟอนต์ตัวเลขทำให้ภาษาไทยอ่านยากโดยไม่ได้อะไรกลับมา
  var num = line.score
    ? (line.win ? '<span class="text-[10.5px] whitespace-nowrap text-fg-mute">ชนะ</span>' : '') +
      (line.num
        ? '<span class="font-mono text-[17px] whitespace-nowrap tabular-nums ' + line.tone + '">' + esc(line.score) + '</span>'
        : '<span class="text-[14px] leading-[1.35] ' + line.tone + '">' + esc(line.score) + '</span>')
    : (line.dash ? '<span class="text-[13px] text-fg-mute">—</span>' : '');

  return '<span class="flex items-center gap-2.5">' + crest + name +
    '<span class="flex flex-none items-center gap-1.5">' + num + '</span></span>';
}

/**
 * ป้ายสถานะหนึ่งป้ายต่อแถว
 * ชีตเขียน "ไม่เป็นทางการ" หมายถึงผลเข้ามาแล้วแต่ยังไม่รับรอง ของเดิมแปลงเป็น "ประกาศแล้ว"
 * แล้วแปะ "ยังไม่เป็นทางการ" ไว้ใต้สกอร์อีกที — สองข้อความนี้ขัดกันเองในแถวเดียว
 * และรายการที่ยังไม่มีผล ก็ไม่มีผลให้พูดถึงความเป็นทางการตั้งแต่แรก
 */
function statusHtml(m) {
  if (m.unofficial && m.score) {
    return '<span class="' + CHIP + ' border border-dashed border-line-strong text-fg-soft">ยังไม่เป็นทางการ</span>';
  }
  // ป้าย "ประกาศแล้ว" ขึ้นแทบทุกแถว ถ้าเป็นสีเขียวจะกลายเป็นสีตกแต่งเต็มตาราง
  // สีในตารางนี้เหลือไว้ให้ "กำลังแข่ง" ที่เป็นสิ่งเดียวที่เกิดขึ้นตอนนี้จริง ๆ
  return statusChip(m.status, m.status === 'done' ? 'bg-surface-soft text-fg-soft' : '');
}

function renderFixtures() {
  var q = state.tableQuery.trim().toLowerCase();
  var rows = allMatches(state.data).filter(function (m) { return m.day === state.activeDay; });
  if (q) rows = rows.filter(function (m) { return (m.sport + ' ' + m.event + ' ' + m.teams).toLowerCase().indexOf(q) > -1; });

  var day = state.data.days.filter(function (d) { return d.id === state.activeDay; })[0];
  document.getElementById('fixtureTitle').textContent = 'วัน' + (dayLabel(day) || ('ที่ ' + state.activeDay));
  document.getElementById('fixtureCount').textContent = rows.length + ' รายการ';

  var pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  if (state.tablePage > pages) state.tablePage = pages;
  var start = (state.tablePage - 1) * state.pageSize;
  var pageRows = rows.slice(start, start + state.pageSize);

  var host = document.getElementById('fixtureList'); host.innerHTML = '';
  var thead = el('div', ST_GRID + ' border-b border-line py-2.5 text-[11.5px] text-fg-mute max-[1000px]:hidden',
    '<span>เวลา</span><span>กีฬา / ประเภท</span><span>ระหว่าง · ผล</span>' +
    '<span>สถานะ</span>');
  thead.setAttribute('aria-hidden', 'true');
  host.appendChild(thead);

  if (!pageRows.length) {
    host.appendChild(el('div', 'px-5 py-[26px] text-center text-[13.5px] text-fg-mute', 'ไม่พบรายการที่ตรงกับคำค้นหา'));
  } else {
    var selfRow = state.data.medalTable.filter(function (r) { return r.isSelf; })[0];
    var selfCores = selfRow ? schoolCores(selfRow) : [];
    pageRows.forEach(function (m) {
      var head = eventParts(m.sport, m.event);
      host.appendChild(el('div',
        ST_GRID + ' border-b border-line py-[11px] text-[14.5px] last:border-b-0 max-[1000px]:py-[13px]',
        '<span class="self-start font-mono text-[14px] text-fg-soft tabular-nums max-[1000px]:col-start-1 max-[1000px]:row-start-1">' + esc(m.time) + '</span>' +
        '<span class="flex min-w-0 flex-col gap-px self-start max-[1000px]:col-start-2 max-[1000px]:row-start-1">' +
          '<span class="flex items-center gap-2 leading-[1.35] text-fg">' + sportIcon(m.sportId, 'size-[17px]') + esc(head.sport) + '</span>' +
          (head.kind ? '<span class="text-[12.5px] leading-[1.4] text-fg-mute">' + esc(head.kind) + '</span>' : '') +
        '</span>' +
        '<span class="flex min-w-0 max-w-[340px] flex-col gap-1.5 max-[1000px]:col-start-2 max-[1000px]:row-start-2 max-[1000px]:mt-2">' +
          resultLines(m).map(function (line) { return lineHtml(state.data, line, selfCores); }).join('') +
        '</span>' +
        '<span class="max-[1000px]:col-start-2 max-[1000px]:row-start-3 max-[1000px]:mt-2">' +
          statusHtml(m) +
        '</span>'));
    });
  }

  document.getElementById('tableCount').textContent =
    rows.length ? ('แสดง ' + (start + 1) + '–' + Math.min(start + state.pageSize, rows.length) + ' จาก ' + rows.length + ' รายการ') : 'ไม่มีรายการ';

  paintUiIcons(host);

  var pager = document.getElementById('pager'); pager.innerHTML = '';
  if (pages > 1) {
    var prev = el('button', PAGE_BTN + PAGE_OFF, '‹'); prev.disabled = state.tablePage === 1;
    prev.addEventListener('click', function () { state.tablePage--; renderFixtures(); });
    pager.appendChild(prev);
    for (var p = 1; p <= pages; p++) {
      (function (p) {
        var on = p === state.tablePage;
        var b = el('button', PAGE_BTN + (on ? PAGE_ON : PAGE_OFF), String(p));
        b.addEventListener('click', function () { state.tablePage = p; renderFixtures(); });
        pager.appendChild(b);
      })(p);
    }
    var next = el('button', PAGE_BTN + PAGE_OFF, '›'); next.disabled = state.tablePage === pages;
    next.addEventListener('click', function () { state.tablePage++; renderFixtures(); });
    pager.appendChild(next);
  }
}

document.getElementById('tableSearch').addEventListener('input', function (e) {
  state.tableQuery = e.target.value; state.tablePage = 1; renderFixtures();
});

function renderAll(data) {
  var keepDay = state.data && state.data.days.some(function (d) { return d.id === state.activeDay; });
  state.data = data;
  if (!keepDay) state.activeDay = (data.days[0] && data.days[0].id) || 1;
  // หัวเรื่องบอกภาพรวมทั้งรายการ ส่วนหัวพาเนลบอกวันที่เลือกอยู่ — ไม่พูดซ้ำกัน
  document.getElementById('tableNote').textContent =
    data.days.length + ' วันแข่งขัน · ' + allMatches(data).length + ' รายการ';
  renderDayTabs();
  renderFixtures();
  chrome.onData(data);
}

loadData().then(function (data) {
  renderAll(data);
  schedulePolling(renderAll);
}).catch(showLoadError);
