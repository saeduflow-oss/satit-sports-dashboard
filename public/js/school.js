import {
  el, esc, loadData, schedulePolling, initChrome, sportIcon, statusChip,
  schoolId, schoolKey, findSchool, schoolMatches, medalDiff, schoolCrest, showLoadError
} from './common.js';

var chrome = initChrome('medals'); // หน้าโรงเรียนเป็นหน้าลูกของอันดับเหรียญ
var schoolIdParam = new URLSearchParams(location.search).get('id') || '';
var lastSig = '';
var lastScores = {};

/* =========================================================
   หน้าโรงเรียน — อ่านกลางแดดบนมือถือเป็นหลัก ตัวใหญ่กว่าหน้าอื่น
   สีจัดปรากฏได้ 2 ที่เท่านั้น: สถานะกำลังแข่ง และแถบเหรียญ
   จอกว้าง (≥1180px): ตัวตนโรงเรียน + อันดับ + เหรียญ ค้างอยู่ซ้าย รายการแข่งขันเลื่อนอยู่ขวา
   ========================================================= */
var TOP_ROW = 'flex flex-wrap items-center justify-between gap-3';
var COLS = 'flex flex-col gap-7 min-[1180px]:grid min-[1180px]:grid-cols-[1fr_1.4fr] min-[1180px]:items-start min-[1180px]:gap-11';
/* ระยะห่างใส่ตอนเรียก: utility ที่คุมสมบัติเดียวกันสองตัวในคลาสเดียว ตัวที่ชนะคือตัวที่อยู่หลังในไฟล์ CSS
   ไม่ใช่ตัวที่เขียนทีหลังใน class จึงห้ามใส่ค่าตั้งต้นไว้แล้วทับ */
var ASIDE = 'flex min-w-0 flex-col min-[1180px]:sticky min-[1180px]:top-[92px]';
var BODY = 'flex min-w-0 flex-col';
var SEC_HEAD = 'm-0 mb-1.5 flex items-baseline gap-[9px] font-display text-[17px] font-normal';
var NOTE = 'mt-2 text-[14px] text-fg-soft';
var MATCH_LIST = 'm-0 mt-1 flex list-none flex-col p-0';
var QUIET_BOX = 'rounded-lg border border-line bg-surface px-[22px] py-[18px] max-[560px]:mx-[-2px] max-[560px]:px-4 max-[560px]:pt-4 max-[560px]:pb-[18px]';
var QUIET_HEAD = 'm-0 mb-1.5 font-display text-[16px] font-normal';
var QUIET_TEXT = 'm-0 text-[14px] text-fg-soft';

/* โครงร่างระหว่างรอข้อมูล: รูปทรงตรงกับของจริง เพื่อไม่ให้เลย์เอาต์กระโดดตอนข้อมูลมาถึง */
function schoolSkeleton() {
  function sk(w, h) {
    return '<span class="block rounded-[10px] bg-surface-soft motion-safe:animate-skeleton" style="width:' + w + ';height:' + h + 'px"></span>';
  }
  return '<div class="' + TOP_ROW + '">' + backButtonHtml() + '</div>' +
    '<div class="' + COLS + '" role="status" aria-label="กำลังโหลดข้อมูลโรงเรียน">' +
      '<div class="' + ASIDE + ' gap-3.5">' +
        sk('74%', 28) +
        '<div class="flex items-center gap-5 py-1.5">' + sk('96px', 76) +
          '<div class="flex flex-1 flex-col gap-3">' + sk('100%', 16) + sk('100%', 16) + sk('100%', 16) + '</div>' +
        '</div>' +
        sk('88%', 15) + sk('62%', 15) +
      '</div>' +
      '<div class="' + BODY + ' gap-3.5">' + sk('100%', 104) + sk('100%', 76) + sk('100%', 76) + '</div>' +
    '</div>';
}

function schoolNotFound() {
  return '<div class="' + TOP_ROW + '">' + backButtonHtml() + '</div>' +
    '<div class="py-2">' +
    '<h1 class="m-0 mb-2 font-display text-[22px] font-normal">ไม่พบโรงเรียนนี้ในตารางเหรียญ</h1>' +
    '<p class="m-0 mb-[18px] max-w-[52ch] text-[14.5px] text-fg-soft">ลิงก์อาจเก่า หรือชื่อโรงเรียนในชีตถูกแก้ไขไปแล้ว เลือกใหม่จากหน้าอันดับเหรียญได้เลย</p>' +
    '<a class="inline-flex min-h-[44px] items-center rounded-full bg-brand px-5 py-[11px] text-[14px] text-on-ink no-underline hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" href="medals.html">ไปที่อันดับเหรียญรางวัล</a>' +
    '</div>';
}

function backButtonHtml() {
  return '<a class="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-surface py-2.5 pr-[18px] pl-3.5 text-[14px] text-fg-soft no-underline transition-[border-color,color] duration-150 hover:border-line-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none" href="medals.html">' +
    '<span class="text-[18px] leading-none" aria-hidden="true">‹</span>อันดับเหรียญรางวัล</a>';
}

/* ตัวเลขหลัก: อันดับ + เหรียญ อ่านได้ในระยะแขนกลางแดด
   จุดสีนำหน้าคู่กับข้อความกำกับเสมอ (ทอง/เงิน/ทองแดง) ไม่สื่อความหมายด้วยสีอย่างเดียว */
var MEDAL_LINE = 'grid grid-cols-[10px_1fr_auto] items-center gap-3';
var MEDAL_DOT = 'size-2.5 flex-none rounded-full';

function medalStatHtml(m, total) {
  function line(tone, label, n) {
    return '<div class="' + MEDAL_LINE + '">' +
      '<i class="' + MEDAL_DOT + ' ' + tone + '" aria-hidden="true"></i>' +
      '<span class="text-[14.5px] text-fg-soft">' + label + '</span>' +
      '<span class="font-mono text-[22px] tabular-nums">' + n + '</span></div>';
  }
  return line('bg-gold', 'ทอง', m.gold) + line('bg-silver', 'เงิน', m.silver) + line('bg-bronze', 'ทองแดง', m.bronze) +
    '<div class="col-span-full mt-1.5 grid grid-cols-[1fr_auto] items-center gap-3 border-t border-line pt-2.5">' +
      '<span class="text-[14.5px] text-fg">รวม</span>' +
      '<span class="font-mono text-[26px] tabular-nums">' + total + '</span></div>';
}

// hideChip: ในกล่อง "กำลังแข่งอยู่ตอนนี้" หัวข้อบอกสถานะอยู่แล้ว ไม่ต้องติดป้ายซ้ำทุกแถว
// จอแคบ: เวลา/สกอร์ย้ายลงบรรทัดใหม่ใต้ชื่อรายการ
function matchRowHtml(i, hideChip, liveBox) {
  return '<li class="grid grid-cols-[auto_1fr_auto] items-center gap-[15px] border-t py-[15px] first:border-t-0 max-[560px]:grid-cols-[auto_1fr] max-[560px]:gap-3 ' +
      (liveBox ? 'border-[color-mix(in_oklch,var(--color-live)_22%,transparent)]' : 'border-line') + '">' +
    '<span class="flex size-9 flex-none items-center justify-center rounded-[11px] border ' +
      (liveBox
        ? 'border-[color-mix(in_oklch,var(--color-live)_25%,transparent)] bg-surface text-live'
        : 'border-line bg-surface-soft text-fg-soft') + '">' +
      sportIcon(i.sportId, 'size-[21px]') + '</span>' +
    '<span class="min-w-0">' +
      '<p class="m-0 mb-[3px] text-[15px]">' + esc(i.event) + '</p>' +
      '<p class="m-0 text-[13px] text-fg-soft">' + esc(i.teams || '') + '</p>' +
    '</span>' +
    '<span class="flex flex-col items-end gap-[5px] text-right max-[560px]:col-start-2 max-[560px]:flex-row max-[560px]:flex-wrap max-[560px]:items-center max-[560px]:justify-start max-[560px]:gap-2.5 max-[560px]:text-left">' +
      '<span class="font-mono text-[12.5px] whitespace-nowrap text-fg-soft">' + esc(i.dayLabel) + ' · ' + esc(i.time) + '</span>' +
      // สกอร์แสดงเฉพาะรายการที่แข่งแล้ว: ชีตบางแถวมีตัวเลขค้างไว้ก่อนเริ่มแข่ง
      (i.score && i.status !== 'upcoming'
        ? '<span class="font-mono text-[19px] tabular-nums ' + (liveBox ? 'text-live' : '') + '">' + esc(i.score) + '</span>'
        : '') +
      (hideChip ? '' : statusChip(i.status)) +
    '</span>' +
    '</li>';
}

function announceScoreChanges(m, liveRows) {
  var changed = [];
  liveRows.forEach(function (i) {
    var key = schoolId(schoolKey(m)) + '|' + i.dayId + '|' + i.time + '|' + i.event;
    var prev = lastScores[key];
    if (prev !== undefined && prev !== i.score && i.score) changed.push(i.event + ' ' + i.score);
    lastScores[key] = i.score;
  });
  if (changed.length) document.getElementById('schoolLiveMsg').textContent = 'สกอร์อัปเดต: ' + changed.join(' · ');
}

function renderSchool(data) {
  var host = document.getElementById('schoolShell');
  if (!data) { host.innerHTML = schoolSkeleton(); return; }

  var m = findSchool(data, schoolIdParam);
  if (!m) { host.innerHTML = schoolNotFound(); return; }

  var list = data.medalTable;
  var idx = list.indexOf(m);
  var total = m.gold + m.silver + m.bronze;
  var rows = schoolMatches(data, m);

  var live = rows.filter(function (i) { return i.status === 'live'; });
  var upcoming = rows.filter(function (i) { return i.status === 'upcoming'; })
    .sort(function (a, b) { return (a.dayId - b.dayId) || a.time.localeCompare(b.time); });
  var done = rows.filter(function (i) { return i.status === 'done'; })
    .sort(function (a, b) { return (b.dayId - a.dayId) || b.time.localeCompare(a.time); });

  /* ข้ามการวาดใหม่ถ้าข้อมูลยังเหมือนเดิม: กันโฟกัสคีย์บอร์ดหลุดทุกครั้งที่ซิงก์ (20 วินาที) */
  var sig = [
    schoolIdParam, m.rank, m.gold, m.silver, m.bronze,
    rows.map(function (i) { return i.status + i.score + i.time + i.event; }).join(';'),
    m.isSelf ? data.sports.map(function (sp) { return sp.gold + '-' + sp.silver + '-' + sp.bronze; }).join(',') : ''
  ].join('|');
  if (sig === lastSig && host.firstChild) { updateSchoolSync(); return; }
  lastSig = sig;

  /* --- ระยะห่างอันดับ: คำนวณจากตารางเหรียญจริงเท่านั้น --- */
  var gapParts = [];
  if (idx > 0) {
    var above = list[idx - 1], dU = medalDiff(above, m);
    gapParts.push(dU
      ? 'ตามอันดับ ' + above.rank + ' ' + esc(above.school) + ' อยู่ ' + dU.n + ' ' + dU.label
      : 'มีเหรียญเท่ากับอันดับ ' + above.rank + ' ' + esc(above.school) + ' ทุกชนิด');
  } else {
    gapParts.push('อยู่อันดับ 1 ของตารางเหรียญ');
  }
  if (idx < list.length - 1) {
    var below = list[idx + 1], dD = medalDiff(m, below);
    gapParts.push(dD
      ? 'นำอันดับ ' + below.rank + ' ' + esc(below.school) + ' อยู่ ' + dD.n + ' ' + dD.label
      : 'มีเหรียญเท่ากับอันดับ ' + below.rank + ' ' + esc(below.school) + ' ทุกชนิด');
  }

  /* --- แมตช์สด --- */
  var liveHtml;
  if (!rows.length) {
    // ไม่มีรายการของโรงเรียนนี้เลย: บอกครั้งเดียว ไม่ต้องขึ้นกล่องว่างซ้ำสามที่
    liveHtml = '<section class="' + QUIET_BOX + '">' +
      '<h2 class="' + QUIET_HEAD + '">ยังไม่มีรายการของโรงเรียนนี้ในตารางแข่งขัน</h2>' +
      '<p class="' + QUIET_TEXT + '">ชีตตารางแข่งขันยังไม่ได้ระบุชื่อโรงเรียนนี้ไว้ เมื่อกรรมการบันทึกรายการเข้ามา จะขึ้นที่นี่ทันที</p>' +
      '</section>';
  } else if (live.length) {
    // สถานะสด — จุดเดียวในหน้าที่ได้ใช้สีเต็ม
    liveHtml = '<section class="rounded-lg border border-[color-mix(in_oklch,var(--color-live)_32%,transparent)] bg-live-bg px-[22px] py-5 max-[560px]:mx-[-2px] max-[560px]:px-4 max-[560px]:pt-4 max-[560px]:pb-[18px]" aria-labelledby="schLiveHead">' +
      '<h2 class="m-0 mb-1 flex items-center gap-2.5 font-display text-[17px] font-normal text-live" id="schLiveHead">' +
        '<span class="size-1.5 flex-none rounded-full bg-current motion-safe:animate-blink" aria-hidden="true"></span>' +
        'กำลังแข่งอยู่ตอนนี้ ' + live.length + ' รายการ</h2>' +
      '<ul class="' + MATCH_LIST + '">' + live.map(function (i) { return matchRowHtml(i, true, true); }).join('') + '</ul>' +
      '</section>';
  } else {
    var next = upcoming[0];
    liveHtml = '<section class="' + QUIET_BOX + '" aria-labelledby="schLiveHead">' +
      '<h2 class="' + QUIET_HEAD + '" id="schLiveHead">ตอนนี้ไม่มีรายการที่กำลังแข่ง</h2>' +
      '<p class="' + QUIET_TEXT + '">' + (next
        ? 'รายการถัดไป ' + esc(next.dayLabel) + ' เวลา ' + esc(next.time) + ' น. — ' + esc(next.event)
        : 'ไม่มีรายการที่ยังไม่แข่งเหลืออยู่ในตารางของโรงเรียนนี้') + '</p>' +
      '</section>';
  }

  /* --- เหรียญแยกรายกีฬา: ชีตกลางบันทึกไว้เฉพาะโรงเรียนของเรา --- */
  var sportsHtml;
  if (m.isSelf) {
    var withMedals = data.sports.filter(function (sp) { return (sp.gold + sp.silver + sp.bronze) > 0; });
    sportsHtml = '<section aria-labelledby="schSportsHead">' +
      '<h2 class="' + SEC_HEAD + '" id="schSportsHead">เหรียญแยกตามชนิดกีฬา</h2>' +
      (withMedals.length
        ? '<div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">' + withMedals.map(function (sp) {
            return '<div class="flex items-center gap-[11px] rounded-md border border-line bg-surface-soft px-3 py-2.5">' +
              '<span class="flex size-8 flex-none items-center justify-center rounded-[9px] border border-line bg-surface text-fg-soft">' +
                sportIcon(sp.id, 'size-[22px]') + '</span>' +
              '<div><p class="m-0 mb-0.5 text-[14px]">' + esc(sp.name) + '</p>' +
              '<p class="m-0 flex gap-3 font-mono text-[12px] text-fg-soft">' +
                '<span class="inline-flex items-center gap-[5px]"><i class="' + MEDAL_DOT + ' bg-gold"></i>' + sp.gold + '</span>' +
                '<span class="inline-flex items-center gap-[5px]"><i class="' + MEDAL_DOT + ' bg-silver"></i>' + sp.silver + '</span>' +
                '<span class="inline-flex items-center gap-[5px]"><i class="' + MEDAL_DOT + ' bg-bronze"></i>' + sp.bronze + '</span>' +
              '</p></div></div>';
          }).join('') + '</div>'
        : '<p class="' + NOTE + '">ยังไม่มีชนิดกีฬาที่ได้เหรียญ</p>') +
      '</section>';
  } else {
    sportsHtml = '<section><h2 class="' + SEC_HEAD + '">เหรียญแยกตามชนิดกีฬา</h2>' +
      '<p class="' + NOTE + '">มีเฉพาะโรงเรียนของเรา เพราะชีตกลางบันทึกเหรียญรายกีฬาไว้เฉพาะของเรา</p></section>';
  }

  function section(id, title, items, emptyText) {
    return '<section aria-labelledby="' + id + '">' +
      '<h2 class="' + SEC_HEAD + '" id="' + id + '">' + title +
        ' <span class="font-mono text-[13px] text-fg-soft">' + items.length + '</span></h2>' +
      (items.length
        ? '<ul class="' + MATCH_LIST + '">' + items.map(function (i) { return matchRowHtml(i); }).join('') + '</ul>'
        : '<p class="' + NOTE + '">' + emptyText + '</p>') +
      '</section>';
  }

  host.innerHTML =
    '<div class="' + TOP_ROW + '">' + backButtonHtml() +
      '<span class="text-[13px] text-bronze tabular-nums" id="schSync" hidden></span></div>' +

    '<div class="' + COLS + '"><div class="' + ASIDE + ' gap-6">' +

    '<header class="flex flex-wrap items-center gap-x-3 gap-y-1.5">' +
      schoolCrest(m, 'size-[54px] text-[21px]') +
      '<h1 class="m-0 max-w-[28ch] font-display text-[26px] leading-[1.3] font-normal text-balance text-fg max-[560px]:text-[22px]">' +
        esc(m.fullName || m.school) + '</h1>' +
      (m.isSelf ? '<span class="rounded-full bg-brand-100 px-3 py-1 text-[12.5px] text-brand-strong">โรงเรียนเรา</span>' : '') +
    '</header>' +

    // จอกว้างคอลัมน์ซ้ายแคบอยู่แล้ว อันดับกับเหรียญจึงเรียงลงกัน · จอกลางวางคู่กันได้
    '<div class="grid grid-cols-[minmax(120px,200px)_1fr] items-center gap-7 border-t border-line-strong border-b border-b-line pt-[22px] pb-[26px]' +
      ' min-[1180px]:grid-cols-1 min-[1180px]:gap-5 max-[560px]:grid-cols-1 max-[560px]:gap-5 max-[560px]:pt-[18px] max-[560px]:pb-[22px]">' +
      '<div class="max-[560px]:flex max-[560px]:flex-wrap max-[560px]:items-baseline max-[560px]:gap-3">' +
        '<p class="m-0 text-[12.5px] tracking-[.08em] text-fg-soft max-[560px]:order-1">อันดับ</p>' +
        '<p class="mt-1 mb-1.5 font-mono text-[60px] leading-[.95] tabular-nums max-[560px]:order-2 max-[560px]:m-0 max-[560px]:text-[52px]">' + m.rank + '</p>' +
        '<p class="m-0 text-[13.5px] text-fg-soft max-[560px]:order-3">จาก ' + list.length + ' โรงเรียน</p>' +
      '</div>' +
      '<div class="flex max-w-[300px] flex-col gap-2 min-[1180px]:max-w-none max-[560px]:max-w-none">' +
        (total ? medalStatHtml(m, total) : '<p class="m-0 text-[15px] text-fg-soft">ยังไม่ได้เหรียญ</p>') +
      '</div>' +
    '</div>' +

    '<div class="flex flex-col gap-1.5">' +
      gapParts.map(function (t) {
        return '<p class="m-0 max-w-[62ch] text-[14.5px] leading-[1.6] text-fg-soft">' + t + '</p>';
      }).join('') +
    '</div>' +

    '</div><div class="' + BODY + ' gap-6">' +

    liveHtml +

    (rows.length
      ? section('schNextHead', 'รายการถัดไป', upcoming, 'ไม่มีรายการที่ยังไม่แข่ง') +
        section('schDoneHead', 'ประกาศผลแล้ว', done, 'ยังไม่มีผลที่ประกาศ')
      : '') +

    sportsHtml +

    '<p class="m-0 text-[12.5px] leading-[1.6] text-fg-mute">รายการแข่งขันแสดงเฉพาะรายการที่ระบุชื่อโรงเรียนนี้ไว้ในตารางแข่งขันหรือในผลการแข่งขัน</p>' +

    '</div></div>';

  announceScoreChanges(m, live);
  updateSchoolSync();
}

/* ---------- ป้ายเวลาซิงก์บนหน้าโรงเรียน: บอกตรง ๆ เมื่อข้อมูลเริ่มเก่า ---------- */
function updateSchoolSync() {
  var out = document.getElementById('schSync');
  if (!out) return;
  var stale = chrome.secondsSinceSync() > 60;
  out.hidden = !stale;
  if (stale) out.textContent = 'ข้อมูลอาจไม่เป็นปัจจุบัน · อัปเดตล่าสุด ' + Math.floor(chrome.secondsSinceSync() / 60) + ' นาทีที่แล้ว';
}
chrome.onTick(updateSchoolSync);

renderSchool(null); // แสดงโครงหน้าก่อนข้อมูลมาถึง

loadData().then(function (data) {
  renderSchool(data);
  chrome.onData(data);
  schedulePolling(function (d) { renderSchool(d); chrome.onData(d); });
}).catch(showLoadError);
