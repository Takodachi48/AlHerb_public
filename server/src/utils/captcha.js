const verifyTurnstile = async (token, secret, remoteip = '') => {
  try {
    if (!token || !secret) {
      return false;
    }

    const body = new URLSearchParams({
      secret,
      response: token,
      ...(remoteip ? { remoteip } : {}),
    });

    // Turnstile siteverify expects x-www-form-urlencoded payload.
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const rawText = await response.text();
      console.error(`Turnstile verification non-JSON response (${response.status}): ${rawText}`);
      return false;
    }

    const data = await response.json();
    return Boolean(data.success);
  } catch (error) {
    console.error('Error verifying Turnstile captcha:', error);
    return false;
  }
};

module.exports = {
  verifyTurnstile,
};
