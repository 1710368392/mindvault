// @ts-nocheck

const https = require('https');
const http = require('http');
const { URL } = require('url');

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
  'Accept': '*/*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: { ...DEFAULT_HEADERS, ...options.headers },
      timeout: options.timeout || 10000,
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            if (data.startsWith('{') || data.startsWith('[')) {
              resolve(JSON.parse(data));
            } else {
              resolve(data);
            }
          } catch (e) {
            resolve(data);
          }
        } else if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request(res.headers.location, options).then(resolve).catch(reject);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

const urlCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

function getCachedUrlCheck(url) {
  const cached = urlCache.get(url);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    urlCache.delete(url);
    return null;
  }
  return cached;
}

function setCachedUrlCheck(url, entry) {
  if (urlCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = urlCache.keys().next().value;
    urlCache.delete(oldestKey);
  }
  urlCache.set(url, entry);
}

async function checkUrlAvailable(url, options = {}) {
  const { checkContentType = true, useCache = true, timeout = 8000 } = options;

  if (useCache) {
    const cached = getCachedUrlCheck(url);
    if (cached) {
      return {
        available: cached.available,
        contentType: cached.contentType,
        contentLength: cached.contentLength,
      };
    }
  }

  try {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const headResult = await new Promise((resolve) => {
      const req = client.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'HEAD',
        timeout,
        headers: {
          ...DEFAULT_HEADERS,
          'Range': 'bytes=0-1',
        },
      }, (res) => {
        const success = !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 400);
        resolve({ available: success, headers: res.headers });
      });
      req.on('error', () => resolve({ available: false }));
      req.on('timeout', () => { req.destroy(); resolve({ available: false }); });
      req.end();
    });

    if (headResult.available && checkContentType && headResult.headers) {
      const contentType = headResult.headers['content-type'] || '';
      const contentLength = parseInt(headResult.headers['content-length']) || 0;

      const isAudio = contentType.includes('audio/') ||
        contentType.includes('application/octet-stream') ||
        contentType.includes('video/mp4');

      const isValidSize = contentLength === 0 || contentLength > 1024;

      const result = {
        available: isAudio && isValidSize,
        contentType,
        contentLength,
      };

      if (useCache) {
        setCachedUrlCheck(url, {
          available: result.available,
          timestamp: Date.now(),
          contentType,
          contentLength,
        });
      }

      return result;
    }

    if (!headResult.available) {
      const rangeResult = await new Promise((resolve) => {
        const req = client.request({
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          timeout,
          headers: {
            ...DEFAULT_HEADERS,
            'Range': 'bytes=0-1023',
          },
        }, (res) => {
          const success = !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 400);
          resolve({ available: success, headers: res.headers });
        });
        req.on('error', () => resolve({ available: false }));
        req.on('timeout', () => { req.destroy(); resolve({ available: false }); });
        req.end();
      });

      if (rangeResult.available && rangeResult.headers) {
        const contentType = rangeResult.headers['content-type'] || '';
        const contentLength = parseInt(rangeResult.headers['content-length']) ||
          parseInt(rangeResult.headers['content-range']?.split('/')[1]) || 0;

        const result = {
          available: true,
          contentType,
          contentLength,
        };

        if (useCache) {
          setCachedUrlCheck(url, {
            available: true,
            timestamp: Date.now(),
            contentType,
            contentLength,
          });
        }

        return result;
      }
    }

    if (useCache) {
      setCachedUrlCheck(url, { available: false, timestamp: Date.now() });
    }

    return { available: false };
  } catch (e) {
    return { available: false };
  }
}

module.exports = {
  DEFAULT_HEADERS,
  request,
  checkUrlAvailable,
};
