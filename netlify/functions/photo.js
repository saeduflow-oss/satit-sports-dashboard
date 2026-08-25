/**
 * netlify/functions/photo.js — /api/photo/:id เวอร์ชัน serverless
 * netlify.toml แปลง /api/photo/:id เป็น ?id=... ให้ก่อน (function อ่าน path param เองไม่ได้)
 * รูปเป็นไบนารี จึงต้องส่งกลับเป็น base64 พร้อม isBase64Encoded ตามรูปแบบของ Netlify
 */

const { fetchPhoto, isPhotoId } = require('../../lib/dashboard');

exports.handler = async (event) => {
  const id = ((event && event.queryStringParameters) || {}).id || '';
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
