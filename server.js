/**
 * server.js — เว็บเซิร์ฟเวอร์แดชบอร์ดกีฬาสาธิตสามัคคี (ใช้ตอนรันบนเครื่อง / โฮสต์ที่รัน Node ได้)
 * -------------------------------------------------------------
 * หน้าที่:
 *   1) เสิร์ฟไฟล์หน้าเว็บ (public/) — HTML / CSS / JS / assets
 *   2) ให้ API endpoint /api/dashboard และ /api/photo/:id
 *
 * ตรรกะการดึงข้อมูลทั้งหมดอยู่ใน lib/dashboard.js — ไฟล์นี้เป็นแค่เปลือก HTTP
 * เพราะบน Netlify ไม่มี Express มารัน แต่ใช้ lib ตัวเดียวกันผ่าน netlify/functions/
 */

const express = require('express');
const path = require('path');
const { loadData, fetchPhoto, isPhotoId } = require('./lib/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- เสิร์ฟไฟล์ static ทั้งหมดจากโฟลเดอร์ public ----
app.use(express.static(path.join(__dirname, 'public')));
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));
app.use('/data', express.static(path.join(__dirname, 'data')));

app.get('/api/dashboard', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await loadData());
  } catch (err) {
    console.error('อ่านข้อมูลไม่สำเร็จ:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลการแข่งขันได้' });
  }
});

// พร็อกซีรูปจาก Google Drive (ดึงฝั่งเซิร์ฟเวอร์ + แคชไว้ ดูรายละเอียดใน lib/dashboard.js)
app.get('/api/photo/:id', async (req, res) => {
  const id = req.params.id;
  if (!isPhotoId(id)) return res.status(400).json({ error: 'รหัสไฟล์ไม่ถูกต้อง' });

  try {
    const entry = await fetchPhoto(id);
    res.set('Content-Type', entry.type);
    res.set('Cache-Control', 'public, max-age=21600');
    res.send(entry.buf);
  } catch (err) {
    res.status(502).json({ error: 'ดึงรูปจาก Google Drive ไม่สำเร็จ' });
  }
});

// health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`\n  แดชบอร์ดกีฬาสาธิตสามัคคี พร้อมใช้งาน`);
  console.log(`  เปิดที่  http://localhost:${PORT}\n`);
});
