const ipCache = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Retrieve client IP
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  if (ipCache.has(clientIp)) {
    const lastSubmitTime = ipCache.get(clientIp);
    if (now - lastSubmitTime < COOLDOWN_MS) {
      const remainingMinutes = Math.ceil((COOLDOWN_MS - (now - lastSubmitTime)) / 60000);
      return res.status(429).json({ 
        message: `Too many requests. Please wait ${remainingMinutes} minute(s) before sending another commission.` 
      });
    }
  }

  const { contact, details } = req.body;

  if (!contact || !details) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const payload = {
    username: "Commission Bot",
    embeds: [
      {
        title: "New Commission Request",
        color: 45768,
        fields: [
          { name: "Contact Info", value: contact, inline: false },
          { name: "Request Details", value: details, inline: false },
          { name: "Client IP", value: clientIp, inline: true }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (discordRes.ok) {
      ipCache.set(clientIp, now);
      return res.status(200).json({ message: 'Success' });
    } else {
      return res.status(500).json({ message: 'Failed to dispatch webhook' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
