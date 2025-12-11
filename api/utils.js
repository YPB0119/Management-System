const { json } = require('./db');

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const raw = await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', (err) => reject(err));
  });

  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('請提供合法的 JSON 請求體');
  }
}

function methodNotAllowed(res, allow = []) {
  if (allow.length) {
    res.setHeader('Allow', allow.join(', '));
  }
  return json(res, 405, { error: '不支援的請求方法' });
}

function badRequest(res, message) {
  return json(res, 400, { error: message || '參數錯誤' });
}

module.exports = {
  parseBody,
  methodNotAllowed,
  badRequest,
};


