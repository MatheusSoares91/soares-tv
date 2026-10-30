const express = require('express');
const axios = require('axios');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const httpAgent = new http.Agent({ keepAlive: true });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('URL não fornecida.');
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const isHttps = parsedTarget.protocol === 'https:';

    const response = await axios({
      method: 'GET',
      url: targetUrl,
      responseType: 'arraybuffer', // Pegamos como buffer para poder processar o texto se for m3u8
      httpAgent: httpAgent,
      httpsAgent: isHttps ? httpsAgent : undefined,
      headers: {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Referer': parsedTarget.origin,
        'Icy-Metadata': '1'
      },
      timeout: 25000
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    const contentType = response.headers['content-type'] || '';
    const responseBody = Buffer.from(response.data);

    // Se o arquivo for uma playlist HLS (.m3u8), reescrevemos os links internos para passarem pelo proxy
    if (targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('text')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      
      const textContent = responseBody.toString('utf8');
      const lines = textContent.split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        // Se a linha for um comentário ou vazia, mantém
        if (!trimmed || trimmed.startsWith('#')) {
          // Verifica se tem URI interna em tags como #EXT-X-STREAM-INF ou #EXT-X-KEY
          if (trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/, (match, uri) => {
              const absoluteUri = new URL(uri, targetUrl).toString();
              return `URI="/api/proxy?url=${encodeURIComponent(absoluteUri)}"`;
            });
          }
          return line;
        }

        // Se for um link de segmento (.ts, .m3u8, etc.), transformamos em URL absoluta e mandamos pro proxy
        try {
          const absoluteSegmentUrl = new URL(trimmed, targetUrl).toString();
          const hostUrl = `${req.protocol}://${req.get('host')}`;
          return `${hostUrl}/api/proxy?url=${encodeURIComponent(absoluteSegmentUrl)}`;
        } catch (_) {
          return line;
        }
      });

      return res.send(rewrittenLines.join('\n'));
    }

    // Se for um segmento de vídeo (.ts binário), repassa direto
    res.setHeader('Content-Type', contentType || 'video/mp2t');
    return res.send(responseBody);

  } catch (error) {
    return res.status(500).send('Erro no proxy: ' + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
