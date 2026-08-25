/**
 * netlify/functions/photo.js — /api/photo/:id เวอร์ชัน serverless
 * รหัสไฟล์ส่งมาเป็นส่วนท้ายของ path (/api/photo/<id> → ถูก rewrite เป็น .../photo/<id>)
 * เผื่อกรณีเรียก function ตรง ๆ ก็รับแบบ ?id=<id> ด้วย
 * รูปเป็นไบนารี จึงต้องส่งกลับเป็น base64 พร้อม isBase64Encoded ตามรูปแบบของ Netlify
 */

const { fetchPhoto, isPhotoId } = require('../../lib/dashboard');

/** ดึงรหัสไฟล์จาก event: ?id=... มาก่อน ไม่มีก็เอาส่วนท้ายสุดของ path */
function photoIdOf(event) {
  const q = ((event && event.queryStringParameters) || {}).id;
  if (q) return q;
  return String((event && event.path) || '').split('/').filter(Boolean).pop() || '';
}

exports.handler = async (event) => {
  const id = photoIdOf(event);
  if (!isPhotoId(id)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'รหัสไฟล์ไม่ถูกต้อง' })
    };
  }

  try {
    const entry = await fetchPhoto(id);
    return {
      statusCode: 200,
      headers: { 'Content-Type': entry.type, 'Cache-Control': 'public, max-age=21600' },
      body: entry.buf.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'ดึงรูปจาก Google Drive ไม่สำเร็จ' })
    };
  }
};
