/**
 * netlify/functions/dashboard.js — /api/dashboard เวอร์ชัน serverless
 * Netlify ไม่รัน Express ให้ จึงห่อ loadData() จาก lib/dashboard.js เป็น function แทน
 * เส้นทาง /api/dashboard → function นี้ ตั้งไว้ใน netlify.toml (ส่วน redirects)
 */

const { loadData } = require('../../lib/dashboard');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

exports.handler = async () => {
  try {
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(await loadData()) };
  } catch (err) {
    console.error('อ่านข้อมูลไม่สำเร็จ:', err);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'ไม่สามารถโหลดข้อมูลการแข่งขันได้' })
    };
  }
};
