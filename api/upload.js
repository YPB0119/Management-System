const { put } = require('@vercel/blob');
const { json } = require('./db');
const { methodNotAllowed } = require('./utils');

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOW_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

function streamToBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  try {
    const contentType = req.headers['content-type'] || '';
    if (!ALLOW_TYPES.some((t) => contentType.includes(t))) {
      return json(res, 400, { error: '仅支持 JPG/PNG 图片上传' });
    }

    const size = Number(req.headers['content-length'] || 0);
    if (size > MAX_SIZE) {
      return json(res, 400, { error: '图片大小需不超过 5MB' });
    }

    const buffer = await streamToBuffer(req);
    if (!buffer.length) {
      return json(res, 400, { error: '未收到文件数据' });
    }

    const filename =
      (req.query && req.query.filename) || `product-${Date.now()}.${contentType.includes('png') ? 'png' : 'jpg'}`;

    const { url } = await put(filename, buffer, {
      access: 'public',
      contentType,
    });

    return json(res, 200, { url });
  } catch (err) {
    console.error('upload error', err);
    return json(res, 500, { error: '图片上传失败，请稍后再试' });
  }
};

