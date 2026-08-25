/**
 * server.js — เว็บเซิร์ฟเวอร์แดชบอร์ดกีฬาสาธิตสามัคคี
 * -------------------------------------------------------------
 * หน้าที่:
 *   1) เสิร์ฟไฟล์หน้าเว็บ (public/) — HTML / CSS / JS / assets
 *   2) ให้ API endpoint /api/dashboard คืนข้อมูลการแข่งขันเป็น JSON
 *      โดยดึงสดจาก Google Sheets (ชีตสาธารณะ อ่านผ่าน gviz JSON,
 *      ไม่ต้องใช้ API key / Service Account)
 *
 * ถ้าเชื่อม Google Sheets ไม่สำเร็จ (ออฟไลน์ / ชีตเปลี่ยนสิทธิ์) จะ fallback
 * ไปอ่าน data/mock.json แทนโดยอัตโนมัติ
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- เสิร์ฟไฟล์ static ทั้งหมดจากโฟลเดอร์ public ----
app.use(express.static(path.join(__dirname, 'public')));
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));
app.use('/data', express.static(path.join(__dirname, 'data')));

/* =========================================================
   ตั้งค่าการเชื่อมต่อ Google Sheets
   ========================================================= */
const SHEET_ID = '1-gVKoQrOLBcv5fufZzOMrdrRuG9pB__vpb84SDrfeXE';
/**
 * แท็บ "สถิติเหรียญรางวัล" — ตารางเหรียญรายโรงเรียน: โรงเรียน / ทอง / เงิน / ทองแดง / รวม
 * อ้างด้วย "ชื่อแท็บ" ไม่ใช่ gid เพราะ gid=0 (แท็บแรกของไฟล์) เคยชี้มาที่ตารางนี้
 * แล้วต่อมากลายเป็นแท็บเหรียญรายกีฬา จนชื่อโรงเรียนออกมาเป็นตัวเลข
 * ระวัง: ถ้าแท็บถูกเปลี่ยนชื่อ gviz จะเงียบ ๆ ส่งแท็บแรกกลับมาแทน ไม่ได้แจ้ง error
 * buildMedalTable() จึงตรวจหัวคอลัมน์ก่อนใช้ทุกครั้ง
 */
const SHEET_MEDAL_TABLE = 'สถิติเหรียญรางวัล';
const GID_SPORT_MEDALS = '771077705'; // แท็บ: ทอง / เงิน / ทองแดง / รวมเหรียญ / ชนิดกีฬา
const GID_SCHEDULE = '266724596';     // แท็บ "ผลการแข่งขันประจำวัน": วันที่ / กีฬา / ประเภท / เวลา / ระหว่าง / ผลการแข่งขัน / สถานะ
/**
 * แท็บ "ตารางการแข่งขัน" — ผังกำหนดการทั้งรายการ: วันที่ / กีฬา / ประเภท / เวลา / ทีม A / VS / ทีม B
 * คอลัมน์แรก ๆ เรียงเหมือนแท็บผลการแข่งขัน จึงใช้ buildDays() ตัวเดียวกันได้
 * ต่างกันที่แท็บนี้ไม่มีช่องผล/สถานะ — ทุกรายการจึงออกมาเป็น "รอเริ่ม" ตามความจริงของผัง
 */
const GID_SCHEDULE_PLAN = '103481153';
/**
 * แท็บภาพบรรยากาศ (ไม่บังคับ) — อ้างด้วย "ชื่อแท็บ" ไม่ใช่ gid เพราะแท็บนี้สร้าง/ลบบ่อยกว่าแท็บอื่น
 * รูปแบบ: แถวละ 1 รูป ใส่ลิงก์ไว้ช่องไหนก็ได้ (Google Drive แบบแชร์ลิงก์ หรือ URL รูปตรง ๆ)
 * แถวหัวตารางกับช่องว่างระบบข้ามให้เอง · เว้นค่านี้เป็น '' = ปิดแถบภาพบนหน้าหลัก
 */
const SHEET_PHOTOS = 'img';

// ชื่อโรงเรียนของเรา ตรงตามที่สะกดในชีต (ใช้จับคู่แถว isSelf)
const SELF_SCHOOL_NAME = 'โรงเรียนสาธิตมหาวิทยาลัยศรีนครินทรวิโรฒ ปทุมวัน';
// คำเฉพาะท้ายชื่อ ใช้จับคู่ชื่อย่อในตารางแข่งขัน (แต่ละแท็บสะกดชื่อโรงเรียนไม่ตรงกัน)
const SELF_SCHOOL_KEYWORD = SELF_SCHOOL_NAME.trim().split(/\s+/).pop();

const SPORT_IDS = {
  'กรีฑา': 'athletics', 'กอล์ฟ': 'golf', 'เทนนิส': 'tennis', 'เทเบิลเทนนิส': 'tabletennis',
  'บาสเกตบอล': 'basketball', 'บาสเกตบอล 3X3': 'basketball3x3', 'แบดมินตัน': 'badminton',
  'เปตอง': 'petanque', 'ฟุตบอล': 'football', 'ลีลาศ': 'dancesport', 'ว่ายน้ำ': 'swimming',
  'หมากกระดาน': 'boardgame', 'แฮนด์บอล': 'handball', 'วอลเลย์บอล': 'volleyball'
};

/* แต่ละแท็บในชีตพิมพ์ชื่อกีฬาไม่ตรงกันเป๊ะ ("บาสเกตบอล 3x3" ในตารางแข่งขัน กับ "บาสเกตบอล 3X3"
   ในตารางเหรียญ) เทียบแบบตรงตัวจะได้ id ว่าง แล้วหน้าเว็บจะขึ้นไอคอนกลางแทนไอคอนกีฬานั้น
   จึงเทียบด้วยชื่อที่ตัดช่องว่างซ้ำและแปลงเป็นตัวพิมพ์เล็กก่อน */
const SPORT_IDS_NORM = Object.keys(SPORT_IDS).reduce(function (map, name) {
  map[normSportName(name)] = SPORT_IDS[name];
  return map;
}, {});
function normSportName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}
function sportIdOf(name) {
  return SPORT_IDS_NORM[normSportName(name)] || '';
}

/**
 * กีฬาที่ไม่ได้ส่งแข่ง — ตัดออกทั้งหน้าชนิดกีฬาและตารางแข่งขัน แม้ชีตจะยังมีแถวของกีฬานั้นอยู่
 * เทียบแบบ "มีคำนี้อยู่ในชื่อ" เพราะชีตเขียนชื่อประเภทต่อท้ายบ้าง (เช่น "อีสปอร์ต (RoV)")
 */
const SPORTS_NOT_ENTERED = ['อีสปอร์ต'];
function isSportNotEntered(name) {
  const text = String(name || '');
  return SPORTS_NOT_ENTERED.some(function (word) { return text.indexOf(word) > -1; });
}

const WEEKDAYS_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function shortSchoolName(name) {
  return String(name || '').trim()
    .replace(/^โรงเรียน/, '')
    .replace(/แห่งมหาวิทยาลัย/, 'ม.')
    .replace(/มหาวิทยาลัยศรีนครินทรวิโรฒ/, 'มศว')
    .replace(/มหาวิทยาลัย/, 'ม.')
    .trim();
}

function cellText(cell) {
  if (!cell) return '';
  return String(cell.f != null ? cell.f : cell.v != null ? cell.v : '').trim();
}
function cellNum(cell) {
  if (!cell || cell.v == null) return 0;
  var n = Number(cell.v);
  return isNaN(n) ? 0 : n;
}

/**
 * ดึงและแปลง JSON จาก Google Visualization API (gviz)
 * ใช้กับ Google Sheet ที่แชร์แบบ "ทุกคนที่มีลิงก์ดูได้" เท่านั้น — ไม่ต้องใช้ API key
 * รับได้ทั้ง gid (ตัวเลข) และชื่อแท็บ — ระวังว่า gviz ตอบชีตแรกกลับมาเงียบ ๆ เมื่อชื่อแท็บไม่มีจริง
 */
async function fetchGvizTable(source) {
  const key = /^\d+$/.test(String(source)) ? 'gid' : 'sheet';
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&${key}=${encodeURIComponent(source)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gviz ${key}=${source} ตอบกลับ ${res.status}`);
  const raw = await res.text();
  const match = raw.match(/setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) throw new Error(`gviz ${key}=${source} รูปแบบข้อมูลไม่ถูกต้อง`);
  const json = JSON.parse(match[1]);
  if (json.status !== 'ok') throw new Error(`gviz ${key}=${source} status=${json.status}`);
  return json.table;
}

function parseSheetDate(cell) {
  if (!cell || cell.v == null) return null;
  const m = /^Date\((\d+),(\d+),(\d+)\)/.exec(cell.v);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]), Number(m[3]));
}

function formatTimeValue(cell) {
  if (!cell || cell.v == null) return '';
  // ช่องที่ตั้งรูปแบบเป็น datetime ส่งมาเป็นสตริง "Date(2026,9,20,9,0,0)"
  const d = /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+))?/.exec(String(cell.v));
  if (d) return pad2(Number(d[4] || 0)) + ':' + pad2(Number(d[5] || 0));
  const v = Number(cell.v);
  // เติมศูนย์หน้าชั่วโมงหลักเดียวเสมอ ไม่ใช่แค่ให้สวย — ตารางเรียงเวลาด้วยการเทียบข้อความ
  // ถ้าปล่อยเป็น "9:00" มันจะถูกจัดไปอยู่หลัง "19:00"
  if (isNaN(v)) {
    const t = /^(\d{1,2}):(\d{2})/.exec(cellText(cell));
    return t ? pad2(Number(t[1])) + ':' + t[2] : cellText(cell);
  }
  if (v > 0 && v < 1) {
    const totalMin = Math.round(v * 24 * 60);
    return pad2(Math.floor(totalMin / 60)) + ':' + pad2(totalMin % 60);
  }
  if (v >= 100) return pad2(Math.floor(v / 100)) + ':' + pad2(v % 100);
  return pad2(Math.floor(v)) + ':00';
}
function pad2(n) { return String(n).padStart(2, '0'); }

/**
 * สถานะของรายการแข่ง
 * ช่อง "สถานะ" ในชีตกรอกได้หลายแบบ (เสร็จสิ้น / ไม่เป็นทางการ / เว้นว่าง) จึงยึด
 * "มีผลการแข่งขันกรอกไว้แล้วหรือยัง" เป็นหลัก: มีสกอร์ = แข่งจบและประกาศผลแล้ว
 * ยกเว้นชีตระบุว่ากำลังแข่งอยู่ ซึ่งสกอร์คือคะแนนสด
 */
function normalizeStatus(raw, score) {
  const s = String(raw || '').trim();
  if (/สด|กำลัง|live/i.test(s)) return 'live';
  if (/จบ|เสร็จ|done|เรียบร้อย/i.test(s)) return 'done';
  if (String(score || '').trim()) return 'done';
  return 'upcoming';
}
/** ชีตทำเครื่องหมายไว้ว่าผลยังไม่เป็นทางการ ต้องบอกผู้อ่านด้วย ไม่กลืนไปกับผลที่รับรองแล้ว */
function isUnofficial(raw) {
  return /ไม่เป็นทางการ|unofficial/i.test(String(raw || ''));
}

/* ---------- ตารางเหรียญรวมรายโรงเรียน ---------- */
function buildMedalTable(table) {
  // gviz ไม่แจ้ง error เวลาหาแท็บตามชื่อไม่เจอ แต่ส่ง "แท็บแรกของไฟล์" กลับมาแทนเงียบ ๆ
  // ถ้าไม่ตรวจ ตารางเหรียญจะกลายเป็นข้อมูลของแท็บอื่นโดยที่หน้าเว็บยังขึ้นเป็นปกติ
  const head = ((table.cols || [])[0] || {}).label || '';
  if (!/โรงเรียน/.test(head)) {
    throw new Error(
      'แท็บ "' + SHEET_MEDAL_TABLE + '" ไม่ใช่ตารางเหรียญรายโรงเรียน ' +
      '(คอลัมน์แรกคือ "' + head + '" ไม่ใช่ "โรงเรียน") — ตรวจว่าแท็บถูกเปลี่ยนชื่อหรือลบไปหรือไม่');
  }

  const rows = (table.rows || [])
    .map(function (r) {
      const c = r.c || [];
      const fullName = cellText(c[0]);
      if (!fullName) return null;
      return {
        fullName: fullName,
        school: shortSchoolName(fullName),
        isSelf: fullName === SELF_SCHOOL_NAME,
        gold: cellNum(c[1]), silver: cellNum(c[2]), bronze: cellNum(c[3])
      };
    })
    .filter(Boolean)
    .sort(function (a, b) { return (b.gold - a.gold) || (b.silver - a.silver) || (b.bronze - a.bronze); });

  rows.forEach(function (r, i) { r.rank = i + 1; });
  return rows;
}

/* ---------- เหรียญแยกตามชนิดกีฬา ---------- */
function buildSports(table) {
  return (table.rows || [])
    .map(function (r) {
      const c = r.c || [];
      const name = cellText(c[4]);
      if (!name || isSportNotEntered(name) || !sportIdOf(name)) return null;
      const gold = cellNum(c[0]), silver = cellNum(c[1]), bronze = cellNum(c[2]);
      return {
        id: sportIdOf(name), name: name,
        status: (gold + silver + bronze) > 0 ? 'done' : 'upcoming',
        gold: gold, silver: silver, bronze: bronze
      };
    })
    .filter(Boolean);
}

/* ---------- ตารางแข่งขัน/ผลการแข่งขัน จัดกลุ่มตามวัน ---------- */
function buildDays(table) {
  const byDate = new Map();

  (table.rows || []).forEach(function (r) {
    const c = r.c || [];
    const date = parseSheetDate(c[0]);
    const sportName = cellText(c[1]);
    if (!date || !sportName || isSportNotEntered(sportName)) return;

    const key = date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
    if (!byDate.has(key)) {
      byDate.set(key, {
        date: date,
        weekday: WEEKDAYS_TH[date.getDay()],
        label: date.getDate() + ' ' + MONTHS_TH[date.getMonth()],
        items: []
      });
    }

    const teamA = cellText(c[4]);
    const teamB = cellText(c[6]);
    const statusText = cellText(c[8]);
    const score = cellText(c[7]);

    byDate.get(key).items.push({
      time: formatTimeValue(c[3]),
      sportId: sportIdOf(sportName),
      event: [sportName, cellText(c[2])].filter(Boolean).join(' — '),
      teams: [teamA, teamB].filter(Boolean).join(' พบ '),
      status: normalizeStatus(statusText, score),
      unofficial: isUnofficial(statusText),
      score: score
    });
  });

  return Array.from(byDate.values())
    .sort(function (a, b) { return a.date - b.date; })
    .map(function (d, i) {
      d.items.sort(function (a, b) { return a.time.localeCompare(b.time); });
      return { id: i + 1, weekday: d.weekday, date: d.label, note: '', items: d.items };
    });
}

/* ---------- ภาพบรรยากาศ (แถบสไลด์บนหน้าหลัก) ---------- */

/**
 * ลิงก์ Drive เอาไปใส่ <img> ตรง ๆ ไม่ได้: เบราว์เซอร์แนบ Referer ไปด้วยทุกครั้ง
 * แล้ว Drive ตอบ 429 กลับมาแทนรูป (กันการฝังรูปข้ามเว็บ) — รูปจะแตกทั้งที่ลิงก์แชร์สาธารณะแล้ว
 * จึงชี้ไปที่ /api/photo/:id ให้เซิร์ฟเวอร์เราไปดึงมาให้แทน
 */
function driveFileId(url) {
  const m = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?(?:[\w=&]*&)?id=)([\w-]{10,})/.exec(url);
  return m ? m[1] : '';
}
function directImageUrl(url) {
  const id = driveFileId(url);
  return id ? '/api/photo/' + id : url;
}

function buildPhotos(table) {
  return (table.rows || [])
    .map(function (r, idx) {
      // หยิบ URL จากช่องไหนก็ได้ในแถว — แถวหัวตาราง ("img link") กับช่องว่างจะไม่ผ่านเงื่อนไขนี้เอง
      const src = (r.c || []).map(cellText).filter(function (t) { return /^https?:\/\//i.test(t); })[0];
      if (!src) return null;
      return { id: 'p' + idx, src: directImageUrl(src) };
    })
    .filter(Boolean);
}

/** อ่านแท็บภาพแยกจากแท็บหลัก: แท็บนี้พังไม่ควรทำให้ทั้งแดชบอร์ดตกไปใช้ข้อมูลตัวอย่าง */
async function loadPhotos() {
  if (!SHEET_PHOTOS) return [];
  try {
    return buildPhotos(await fetchGvizTable(SHEET_PHOTOS));
  } catch (err) {
    console.error('อ่านแท็บภาพ (' + SHEET_PHOTOS + ') ไม่สำเร็จ:', err.message);
    return [];
  }
}

/* ---------- โหลดข้อมูลจาก Google Sheets (มี cache สั้น ๆ กันยิงถี่เกินไป) ---------- */
let cache = { data: null, at: 0 };
const CACHE_MS = 15000;

async function loadFromSheets() {
  const [medalTable, sportTable, scheduleTable, planTable] = await Promise.all([
    fetchGvizTable(SHEET_MEDAL_TABLE),
    fetchGvizTable(GID_SPORT_MEDALS),
    fetchGvizTable(GID_SCHEDULE),
    fetchGvizTable(GID_SCHEDULE_PLAN)
  ]);

  const medals = buildMedalTable(medalTable);
  const self = medals.filter(function (m) { return m.isSelf; })[0] || null;
  const leader = medals[0] || null;
  const days = buildDays(scheduleTable);
  const schedule = buildDays(planTable);
  const photos = await loadPhotos();

  return {
    meta: {
      title: 'กีฬาสาธิตสามัคคี',
      subtitle: 'การแข่งขันกีฬานักเรียนสาธิตสัมพันธ์แห่งประเทศไทย'
    },
    school: self ? {
      name: self.school, fullName: self.fullName, rank: self.rank, totalSchools: medals.length,
      gold: self.gold, silver: self.silver, bronze: self.bronze, keyword: SELF_SCHOOL_KEYWORD
    } : { name: shortSchoolName(SELF_SCHOOL_NAME), fullName: SELF_SCHOOL_NAME, rank: 0, totalSchools: medals.length, gold: 0, silver: 0, bronze: 0, keyword: SELF_SCHOOL_KEYWORD },
    leaderName: leader ? leader.school : '',
    medalTable: medals,
    sports: buildSports(sportTable),
    days: days,
    schedule: schedule,
    photos: photos,
    syncedAt: new Date().toISOString()
  };
}

function loadFromMock() {
  const file = path.join(__dirname, 'data', 'mock.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  data.meta = data.meta || {};
  data.syncedAt = new Date().toISOString();
  data.source = 'mock';
  return data;
}

async function loadData() {
  const now = Date.now();
  if (cache.data && (now - cache.at) < CACHE_MS) return cache.data;

  try {
    const data = await loadFromSheets();
    data.source = 'sheets';
    cache = { data: data, at: now };
    return data;
  } catch (err) {
    console.error('เชื่อมต่อ Google Sheets ไม่สำเร็จ, ใช้ข้อมูลตัวอย่างแทน:', err.message);
    if (cache.data) return cache.data; // ยังมีของเก่าอยู่ ใช้ต่อดีกว่าล่ม
    return loadFromMock();
  }
}

app.get('/api/dashboard', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await loadData());
  } catch (err) {
    console.error('อ่านข้อมูลไม่สำเร็จ:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลการแข่งขันได้' });
  }
});

/* =========================================================
   พร็อกซีรูปจาก Google Drive
   ดึงฝั่งเซิร์ฟเวอร์ (ไม่มี Referer จึงไม่โดน 429) แล้วเก็บไว้ในหน่วยความจำ
   คนเปิดหน้าเว็บกี่คน หน้ารีเฟรชกี่รอบ ก็ยิงไป Drive แค่ครั้งเดียวต่อรูป
   ========================================================= */
const photoCache = new Map();                 // id -> { buf, type, at }
const PHOTO_CACHE_MS = 6 * 60 * 60 * 1000;    // 6 ชั่วโมง

app.get('/api/photo/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^[\w-]{10,100}$/.test(id)) return res.status(400).json({ error: 'รหัสไฟล์ไม่ถูกต้อง' });

  const hit = photoCache.get(id);
  const fresh = hit && (Date.now() - hit.at) < PHOTO_CACHE_MS;
  if (fresh) return sendPhoto(res, hit);

  try {
    const r = await fetch(`https://drive.google.com/thumbnail?id=${id}&sz=w1600`);
    if (!r.ok) throw new Error('Drive ตอบ ' + r.status);
    const type = r.headers.get('content-type') || '';
    // Drive ตอบหน้า HTML แจ้ง error กลับมาด้วย status 200 ได้ ถ้าไฟล์ไม่ได้แชร์สาธารณะ
    if (!/^image\//.test(type)) throw new Error('ไม่ใช่ไฟล์รูป (' + type + ') — ไฟล์อาจยังไม่ได้แชร์แบบทุกคนที่มีลิงก์');
    const entry = { buf: Buffer.from(await r.arrayBuffer()), type: type, at: Date.now() };
    photoCache.set(id, entry);
    sendPhoto(res, entry);
  } catch (err) {
    console.error('ดึงรูป ' + id + ' ไม่สำเร็จ:', err.message);
    if (hit) return sendPhoto(res, hit);   // ของเก่าหมดอายุแล้วยังดีกว่าปล่อยรูปแตก
    res.status(502).json({ error: 'ดึงรูปจาก Google Drive ไม่สำเร็จ' });
  }
});

function sendPhoto(res, entry) {
  res.set('Content-Type', entry.type);
  res.set('Cache-Control', 'public, max-age=21600');
  res.send(entry.buf);
}

// health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`\n  แดชบอร์ดกีฬาสาธิตสามัคคี พร้อมใช้งาน`);
  console.log(`  เปิดที่  http://localhost:${PORT}\n`);
});
