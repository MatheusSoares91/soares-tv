const express = require('express');
const axios = require('axios');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Agentes para ignorar erros de certificado em servidores HTTP/HTTPS antigos
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const httpAgent = new http.Agent({ keepAlive: true });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('URL não fornecida.');
  }

  try {
    const isHttps = targetUrl.startsWith('https');
    const response = await axios({
      method: 'GET',
      url: targetUrl,
      responseType: 'stream',
      httpAgent: httpAgent,
      httpsAgent: isHttps ? httpsAgent : undefined,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': new URL(targetUrl).origin,
        'Accept': '*/*'
      },
      timeout: 25000
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', response.headers['content-type'] || 'application/vnd.apple.mpegurl');
    
    response.data.pipe(res);
  } catch (error) {
    res.status(500).send('Erro no proxy: ' + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
