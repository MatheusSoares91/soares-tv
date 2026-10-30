export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send('URL não fornecida.');
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    const targetUrl = new URL(decodedUrl);

    const response = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': targetUrl.origin,
        'Accept': '*/*'
      }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/vnd.apple.mpegurl');

    const arrayBuffer = await response.arrayBuffer();
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    return res.status(500).send('Erro no proxy: ' + error.message);
  }
}
