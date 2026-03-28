const crypto = require('crypto');
const net = require('net');

const normalizeIp = (value = '') => String(value).replace(/^::ffff:/, '');

const ipv4ToInt = (ip) => ip.split('.').reduce((acc, part) => ((acc << 8) + Number(part)) >>> 0, 0);

const isIpv4InCidr = (ip, cidr) => {
  const [range, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  if (!range || Number.isNaN(bits) || bits < 0 || bits > 32) return false;
  if (net.isIP(ip) !== 4 || net.isIP(range) !== 4) return false;

  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range) & mask);
};

const getAllowedCidrs = () => {
  const configured = process.env.INTERNAL_ALLOWED_CIDRS;
  if (!configured) {
    return ['127.0.0.1/32', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
  }

  return configured
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const isInternalIp = (ip = '') => {
  const normalized = normalizeIp(ip);
  if (normalized === '::1') return true;
  if (net.isIP(normalized) !== 4) return false;

  return getAllowedCidrs().some((cidr) => isIpv4InCidr(normalized, cidr));
};

const hasTrustedProxy = (req) => {
  const trustProxy = req.app.get('trust proxy');
  return Boolean(trustProxy);
};

const getRequestIp = (req) => {
  if (hasTrustedProxy(req)) {
    return normalizeIp(req.ip || '');
  }
  return normalizeIp(req.socket?.remoteAddress || req.connection?.remoteAddress || '');
};

const secureCompare = (left, right) => {
  const a = Buffer.from(left || '', 'utf8');
  const b = Buffer.from(right || '', 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const requireInternalKey = (req, res, next) => {
  const configuredKey = process.env.INTERNAL_API_KEY;
  if (!configuredKey || configuredKey.length < 32) {
    return res.status(500).json({ error: 'INTERNAL_API_KEY is invalid or not configured' });
  }

  const incoming = req.get('X-Internal-Key');
  if (!incoming || !secureCompare(incoming, configuredKey)) {
    return res.status(401).json({ error: 'Invalid internal API key' });
  }
  return next();
};

const requireInternalOrigin = (req, res, next) => {
  const enforceOriginCheck = process.env.INTERNAL_ENFORCE_ORIGIN !== 'false';
  if (!enforceOriginCheck) {
    return next();
  }

  const forwardedHeader = req.get('x-forwarded-for');
  if (forwardedHeader && !hasTrustedProxy(req)) {
    return res.status(403).json({ error: 'Untrusted proxy headers for internal endpoint' });
  }

  const requestIp = getRequestIp(req);
  if (isInternalIp(requestIp)) {
    return next();
  }

  return res.status(403).json({ error: 'Endpoint is restricted to localhost/internal network' });
};

module.exports = {
  requireInternalKey,
  requireInternalOrigin,
};
