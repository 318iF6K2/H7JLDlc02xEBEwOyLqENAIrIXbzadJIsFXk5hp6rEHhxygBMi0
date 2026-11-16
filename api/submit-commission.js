
const ipCache = new Map();

const COOLDOWN_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      message: 'Method not allowed'
    });
  }

  try {
    // Get client IP
    const forwardedFor = req.headers['x-forwarded-for'];

    const clientIp = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : req.socket?.remoteAddress || 'unknown';

    const now = Date.now();

    // Check cooldown
    const lastSubmitTime = ipCache.get(clientIp);

    if (lastSubmitTime && now - lastSubmitTime < COOLDOWN_MS) {
      const remainingMinutes = Math.ceil(
        (COOLDOWN_MS - (now - lastSubmitTime)) / 60000
      );

      return res.status(429).json({
        message: `Too many requests. Please wait ${remainingMinutes} minute(s).`
      });
    }

    // Validate input
    const { contact, details } = req.body || {};

    if (
      typeof contact !== 'string' ||
      typeof details !== 'string' ||
      !contact.trim() ||
      !details.trim()
    ) {
      return res.status(400).json({
        message: 'Missing or invalid fields'
      });
    }

    if (contact.length > 1024 || details.length > 1024) {
      return res.status(400).json({
        message: 'Contact and details must be under 1024 characters.'
      });
    }

    // Get webhook
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      console.error('Missing DISCORD_WEBHOOK_URL');

      return res.status(500).json({
        message: 'Server configuration error'
      });
    }

    // Discord payload
    const payload = {
      username: 'Commission Bot',
      embeds: [
        {
          title: 'New Commission Request',
          color: 45768,
          fields: [
            {
              name: 'Contact Info',
              value: contact.trim(),
              inline: false
            },
            {
              name: 'Request Details',
              value: details.trim(),
              inline: false
            },
            {
              name: 'Client IP',
              value: clientIp.slice(0, 100),
              inline: false
            }
          ],
          timestamp: new Date().toISOString()
        }
      ]
    };

    // Send to Discord
    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!discordRes.ok) {
      const errorText = await discordRes.text();

      console.error('Discord webhook error:', discordRes.status, errorText);

      return res.status(502).json({
        message: 'Failed to send commission request'
      });
    }

    // Save cooldown only after successful delivery
    ipCache.set(clientIp, now);

    return res.status(200).json({
      message: 'Success'
    });

  } catch (error) {
    console.error('Commission API error:', error);

    return res.status(500).json({
      message: 'Internal Server Error'
    });
  }
}
