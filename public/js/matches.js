import {
  el, esc, loadData, schedulePolling, allMatches, sportIcon, statusChip, initChrome,
  schoolCores, matchScore, dayLabel, eventParts, paintUiIcons, showLoadError
} from './common.js';

/* ตารางแข่งขันมีผลกับสถานะเพิ่มมาสองช่อง ใช้โครงแถวเดียวกับผังกำหนดการ (schedule.js)
   เพื่อให้สองหน้าอ่านเป็นระบบเดียวกัน ไม่ใช่การ์ดคนละแบบ
   จอแคบ: เวลาอยู่ซ้ายคงที่ กีฬากับคู่แข่งเรียงลงสองบรรทัด */
var ST_GRID = 'grid grid-cols-[60px_minmax(0,1.4fr)_minmax(0,1.25fr)_92px_108px] items-center gap-4 px-5' +
  ' max-[860px]:grid-cols-[58px_minmax(0,1fr)_auto] max-[860px]:gap-x-3 max-[860px]:gap-y-[3px] max-[860px]:px-4';

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
  var thead = el('div', ST_GRID + ' border-b border-line py-2.5 text-[11.5px] text-fg-mute max-[860px]:hidden',
    '<span>เวลา</span><span>กีฬา / ประเภท</span><span>ระหว่าง</span>' +
    '<span class="justify-self-end">ผล</span><span class="justify-self-end">สถานะ</span>');
  thead.setAttribute('aria-hidden', 'true');
  host.appendChild(thead);

  if (!pageRows.length) {
    host.appendChild(el('div', 'px-5 py-[26px] text-center text-[13.5px] text-fg-mute', 'ไม่พบรายการที่ตรงกับคำค้นหา'));
  } else {
    var selfRow = state.data.medalTable.filter(function (r) { return r.isSelf; })[0];
    var selfCores = selfRow ? schoolCores(selfRow) : [];
    pageRows.forEach(function (m) {
      var head = eventParts(m.sport, m.event);
      var live = m.status === 'live';
      var isSelf = selfCores.length > 0 && matchScore(m.teams || '', selfCores) > 0;
      host.appendChild(el('div',
        ST_GRID + ' border-b border-line py-[11px] text-[14.5px] last:border-b-0 max-[860px]:py-[13px]' +
        (isSelf ? ' bg-brand-100' : ''),
        '<span class="font-mono text-[14px] text-fg-soft tabular-nums max-[860px]:col-start-1 max-[860px]:row-start-1">' + esc(m.time) + '</span>' +
        '<span class="flex min-w-0 flex-col gap-px max-[860px]:col-start-2 max-[860px]:row-start-1">' +
          '<span class="flex items-center gap-2 leading-[1.35] text-fg">' + sportIcon(m.sportId, 'size-[17px]') + esc(head.sport) + '</span>' +
          (head.kind ? '<span class="text-[12.5px] leading-[1.4] text-fg-mute">' + esc(head.kind) + '</span>' : '') +
        '</span>' +
        '<span class="min-w-0 text-[13px] leading-[1.4] break-words text-fg-soft max-[860px]:col-span-2 max-[860px]:col-start-2 max-[860px]:row-start-2">' +
          (m.teams ? esc(m.teams) : '<span class="text-fg-mute">—</span>') + '</span>' +
        // สกอร์คือพระเอกของแถว จึงเป็นตัวโตสุดและชิดขวา · ผลกับสถานะซ้อนกันมุมขวาบนจอแคบ
        '<span class="flex flex-col items-end gap-0.5 justify-self-end text-right max-[860px]:col-start-3 max-[860px]:row-start-1">' +
          (m.score
            ? '<span class="font-mono text-[18px] whitespace-nowrap tabular-nums ' + (live ? 'text-live' : 'text-fg') + '">' + esc(m.score) + '</span>'
            : '<span class="text-fg-mute">—</span>') +
          (m.unofficial ? '<span class="text-[10.5px] whitespace-nowrap text-fg-mute">ยังไม่เป็นทางการ</span>' : '') +
        '</span>' +
        '<span class="justify-self-end max-[860px]:col-span-2 max-[860px]:col-start-2 max-[860px]:row-start-3 max-[860px]:mt-1 max-[860px]:justify-self-start">' +
          // ป้าย "ประกาศแล้ว" ขึ้นแทบทุกแถว ถ้าเป็นสีเขียวจะกลายเป็นสีตกแต่งเต็มตาราง
          // สีในตารางนี้เหลือไว้ให้ "กำลังแข่ง" ที่เป็นสิ่งเดียวที่เกิดขึ้นตอนนี้จริง ๆ
          statusChip(m.status, m.status === 'done' ? 'bg-surface-soft text-fg-soft' : '') +
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
