/** netlify/functions/health.js — /api/health ไว้เช็กว่า function ฝั่ง Netlify ยังรันอยู่ */
exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ ok: true })
});
