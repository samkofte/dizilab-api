const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Default domain (can be overridden dynamically per request or globally)
let GLOBAL_DOMAIN = 'https://dizilab.to';

function getDomain(req) {
  const d = req.query.domain || req.headers['x-dizilab-domain'] || GLOBAL_DOMAIN;
  return d.trim().replace(/\/+$/, '');
}

function getHeaders(referer = 'https://dizilab.to/') {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': referer,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  };
}

// 1. Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    active_domain: GLOBAL_DOMAIN,
    fallback_domains: ['https://dizilab.to', 'https://dizilab.net', 'https://dizilab.org']
  });
});

app.post('/api/config', (req, res) => {
  if (req.body && req.body.domain) {
    let d = req.body.domain.trim();
    if (!d.startsWith('http')) d = 'https://' + d;
    GLOBAL_DOMAIN = d.replace(/\/+$/, '');
    return res.json({ success: true, message: 'Domain updated', active_domain: GLOBAL_DOMAIN });
  }
  res.status(400).json({ success: false, error: 'Missing domain field' });
});

// 2. Search Endpoint (WordPress Rest API)
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ success: false, error: 'Query parameter q is required' });

  const domain = getDomain(req);
  try {
    const searchUrl = `${domain}/wp-json/wstream/v1/search?s=${encodeURIComponent(q)}`;
    const resp = await axios.get(searchUrl, {
      headers: getHeaders(domain),
      timeout: 8000
    });

    res.json({
      success: true,
      domain,
      query: q,
      results: resp.data.results || []
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Search failed: ${err.message}`,
      domain
    });
  }
});

// 3. Series / Show Detail
app.get('/api/show', async (req, res) => {
  const slug = req.query.slug;
  if (!slug) return res.status(400).json({ success: false, error: 'Slug parameter is required' });

  const domain = getDomain(req);
  const targetUrl = slug.startsWith('http') ? slug : `${domain}/dizi/${slug.replace(/^\/+|\/+$/g, '')}/`;

  try {
    const resp = await axios.get(targetUrl, {
      headers: getHeaders(domain),
      timeout: 10000
    });

    const $ = cheerio.load(resp.data);
    const title = $('h1:not(.logo)').text().trim() || $('title').text().replace(/izle.*/i, '').trim();
    const desc = $('div.desc, p.desc, div.description').text().trim() || $('p').filter((_, el) => $(el).text().length > 60).first().text().trim();
    const poster = $('img[src*="poster"]').attr('src') || $('img.poster').attr('src') || '';

    // Episodes
    const episodes = [];
    $('article.card--episode').each((_, el) => {
      const a = $(el).find('a').attr('href') || '';
      const img = $(el).find('img').attr('src') || '';
      const epTitle = $(el).find('h3').text().trim();

      const m = a.match(/(\d+)-sezon-(\d+)-bolum/);
      episodes.push({
        title: epTitle,
        season: m ? parseInt(m[1]) : 1,
        episode: m ? parseInt(m[2]) : 1,
        url: a,
        image: img
      });
    });

    res.json({
      success: true,
      domain,
      title,
      poster,
      description: desc,
      total_episodes: episodes.length,
      episodes
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to fetch show: ${err.message}`,
      domain
    });
  }
});

// Helper: Universal Hunter Packer Unpacker
function unpackHunter(html) {
  try {
    const match = html.match(/eval\(function\(h,u,n,t,e,r\)[\s\S]*?\(("[\s\S]*?"),(\d+),("[\s\S]*?"),(\d+),(\d+),(\d+)\)\)/);
    if (!match) return '';

    const h = JSON.parse(match[1]);
    const u = parseInt(match[2]);
    const n = JSON.parse(match[3]);
    const t = parseInt(match[4]);
    const e = parseInt(match[5]);

    const _0xc69e = ["","split","0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/","slice","indexOf","","",".","pow","reduce","reverse","0"];
    function _0xe36c(d, e_val, f) {
      const g = _0xc69e[2][_0xc69e[1]](_0xc69e[0]);
      const h_arr = g[_0xc69e[3]](0, e_val);
      const i = g[_0xc69e[3]](0, f);
      const j = d[_0xc69e[1]](_0xc69e[0])[_0xc69e[10]]()[_0xc69e[9]](function(a, b, c) {
        if (h_arr[_0xc69e[4]](b) !== -1) return a += h_arr[_0xc69e[4]](b) * (Math[_0xc69e[8]](e_val, c));
      }, 0);
      let k = _0xc69e[0];
      let j_val = j;
      while (j_val > 0) {
        k = i[j_val % f] + k;
        j_val = (j_val - (j_val % f)) / f;
      }
      return k || _0xc69e[11];
    }

    let r = "";
    for (let i = 0, len = h.length; i < len; i++) {
      let s = "";
      while (h[i] !== n[e]) {
        s += h[i];
        i++;
      }
      for (let j = 0; j < n.length; j++) {
        s = s.replace(new RegExp(n[j], "g"), j);
      }
      r += String.fromCharCode(_0xe36c(s, e, 10) - t);
    }
    return decodeURIComponent(escape(r));
  } catch (err) {
    return '';
  }
}

// 4. Multi-Player Resolver & Decryptor (dzembed, rplayer, psource, ksdpictures, vidmoly)
app.get('/api/stream', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ success: false, error: 'Parameter url is required' });

  const domain = getDomain(req);
  const fullTarget = targetUrl.startsWith('http') ? targetUrl : `${domain}/${targetUrl.replace(/^\/+/, '')}`;

  try {
    const resp = await axios.get(fullTarget, {
      headers: getHeaders(domain),
      timeout: 10000
    });

    const $ = cheerio.load(resp.data);
    let iframes = [];
    $('iframe[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !iframes.includes(src)) iframes.push(src);
    });

    // If main series page, auto-resolve to latest/first episode
    let foundEpisodes = [];
    $('a[href*="/bolum/"]').each((_, el) => {
      const epHref = $(el).attr('href');
      if (epHref && !foundEpisodes.includes(epHref)) foundEpisodes.push(epHref);
    });

    if (iframes.length === 0 && foundEpisodes.length > 0) {
      const firstEp = foundEpisodes[foundEpisodes.length - 1];
      const epUrl = firstEp.startsWith('http') ? firstEp : `${domain}${firstEp}`;
      try {
        const epResp = await axios.get(epUrl, { headers: getHeaders(domain), timeout: 10000 });
        const $ep = cheerio.load(epResp.data);
        $ep('iframe[src]').each((_, el) => {
          const src = $ep(el).attr('src');
          if (src && !iframes.includes(src)) iframes.push(src);
        });
      } catch (e) {}
    }

    const players = [];

    for (const iframeSrc of iframes) {
      const fullIframe = iframeSrc.startsWith('http') ? iframeSrc : (iframeSrc.startsWith('//') ? 'https:' + iframeSrc : new URL(iframeSrc, fullTarget).href);

      // Player Type 1: Ksdpictures (dzembed) -> direct HLS .m3u8 stream + Full Embed Player
      if (fullIframe.includes('dzembed.php') || fullIframe.includes('ksdpictures.site/dzembed')) {
        try {
          const respEmbed = await axios.get(fullIframe, {
            headers: getHeaders(fullTarget),
            timeout: 8000
          });
          const embedHtml = respEmbed.data;
          const sourceMatch = embedHtml.match(/var\s+SOURCE\s*=\s*["']([^"']+)["']/);
          const tracksMatch = embedHtml.match(/var\s+TRACKS\s*=\s*(\[.*?\]);/);
          let rawTracks = [];
          if (tracksMatch) {
            try { rawTracks = JSON.parse(tracksMatch[1]); } catch (e) {}
          }

          const proxiedTracks = rawTracks.map(t => ({
            ...t,
            file: `/api/proxy/vtt?url=${encodeURIComponent(t.file)}&referer=${encodeURIComponent('https://ksdpictures.site/')}`
          }));

          if (sourceMatch) {
            const proxiedStream = `/api/proxy/hls?url=${encodeURIComponent(sourceMatch[1])}&referer=${encodeURIComponent('https://ksdpictures.site/')}`;
            players.push({
              name: 'Direct HLS Stream (Altyazılı & Dublajlı)',
              type: 'hls',
              stream_url: proxiedStream,
              embed_url: fullIframe,
              subtitles: proxiedTracks,
              playable: true
            });
          }

          const proxiedEmbed = `/api/proxy/embed?url=${encodeURIComponent(fullIframe)}&referer=${encodeURIComponent(domain + '/')}`;
          players.push({
            name: 'KSD / UXPlayer (Full UI Dub/Sub)',
            type: 'iframe',
            stream_url: null,
            embed_url: proxiedEmbed,
            playable: true
          });

          continue;
        } catch (e) {}
      }

      // Player Type 2: Yabancidizim psource & rplayer (Hunter Deobfuscator)
      if (fullIframe.includes('psource') || fullIframe.includes('rplayer') || fullIframe.includes('yabancidizim.com')) {
        try {
          const pResp = await axios.get(fullIframe, {
            headers: getHeaders(domain + '/'),
            timeout: 8000
          });
          const deobf = unpackHunter(pResp.data);
          if (deobf) {
            // Check for parts array (e.g. Twitter / Amplify streams in Prens)
            const partsMatch = deobf.match(/const\s+parts\s*=\s*(\[[\s\S]*?\]);/);
            const tracksMatch = deobf.match(/const\s+tracks\s*=\s*(\[[\s\S]*?\]);/);
            let rawParts = [];
            let rawTracks = [];
            if (partsMatch) {
              try { rawParts = JSON.parse(partsMatch[1]); } catch (e) {}
            }
            if (tracksMatch) {
              try { rawTracks = JSON.parse(tracksMatch[1]); } catch (e) {}
            }

            if (rawParts.length > 0 && rawParts[0].url) {
              const streamUrl = rawParts[0].url;
              const proxiedStream = `/api/proxy/hls?url=${encodeURIComponent(streamUrl)}&referer=${encodeURIComponent('https://twitter.com/')}`;
              players.push({
                name: `Native Stream (${rawParts[0].label || 'HLS'})`,
                type: 'hls',
                stream_url: proxiedStream,
                embed_url: fullIframe,
                subtitles: rawTracks,
                playable: true
              });
            }

            // Check for iframe.src in rplayer (e.g. Breaking Bad)
            const iframeMatch = deobf.match(/iframe\.src\s*=\s*["']([^"']+)["']/);
            if (iframeMatch) {
              const innerSrc = iframeMatch[1];
              players.push({
                name: 'Decrypted Stream Player (RPlayer)',
                type: 'iframe',
                stream_url: null,
                embed_url: innerSrc.includes('dzembed.php') ? `/api/proxy/embed?url=${encodeURIComponent(innerSrc)}&referer=${encodeURIComponent('https://yabancidizim.com/')}` : innerSrc,
                playable: true
              });
            }
          }
        } catch (e) {}

        const proxiedEmbed = `/api/proxy/embed?url=${encodeURIComponent(fullIframe)}&referer=${encodeURIComponent(domain + '/')}`;
        players.push({
          name: 'Decrypted RPlayer / PSource (Proxied Unblocker)',
          type: 'iframe',
          stream_url: null,
          embed_url: proxiedEmbed,
          playable: true
        });
        continue;
      }

      // Generic Player: Provide both direct and proxied embed
      const proxiedGeneric = `/api/proxy/embed?url=${encodeURIComponent(fullIframe)}&referer=${encodeURIComponent(domain + '/')}`;
      players.push({
        name: 'Web Embed Player',
        type: 'iframe',
        stream_url: null,
        embed_url: proxiedGeneric,
        playable: true
      });
    }

    const primary = players[0] || null;

    res.json({
      success: players.length > 0,
      domain,
      target_url: fullTarget,
      title: $('h1:not(.logo)').text().trim() || $('title').text().trim(),
      primary_stream: primary ? primary.stream_url : null,
      primary_embed: primary ? primary.embed_url : null,
      episodes: foundEpisodes,
      all_players: players
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Stream extraction failed: ${err.message}`,
      domain
    });
  }
});

// 5. HLS Playlist & TS Chunk Unblocker Proxy
app.get('/api/proxy/hls', async (req, res) => {
  const targetUrl = req.query.url;
  const referer = req.query.referer || 'https://ksdpictures.site/';
  if (!targetUrl) return res.status(400).send('Missing url parameter');

  try {
    const isM3u8 = targetUrl.includes('.m3u8') || targetUrl.includes('/m3u8');
    const upstream = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
        'Referer': referer
      },
      responseType: isM3u8 ? 'text' : 'stream',
      timeout: 15000
    });

    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*'
    });

    if (isM3u8) {
      res.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      const lines = upstream.data.split('\n');
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      const rewritten = lines.map(line => {
        const l = line.trim();
        if (!l) return line;

        // Subtitles or Audio URI in #EXT-X-MEDIA
        if (l.startsWith('#EXT-X-MEDIA') && l.includes('URI=')) {
          return l.replace(/URI=["']([^"']+)["']/, (match, uri) => {
            const abs = uri.startsWith('http') ? uri : (uri.startsWith('/') ? new URL(uri, targetUrl).href : baseUrl + uri);
            return `URI="/api/proxy/hls?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(referer)}"`;
          });
        }

        // Sub-playlist or .ts chunk link
        if (!l.startsWith('#')) {
          const abs = l.startsWith('http') ? l : (l.startsWith('/') ? new URL(l, targetUrl).href : baseUrl + l);
          return `/api/proxy/hls?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(referer)}`;
        }

        return line;
      }).join('\n');

      return res.send(rewritten);
    } else {
      // Stream binary segment (.ts file) directly to client
      if (upstream.headers['content-type']) res.set('Content-Type', upstream.headers['content-type']);
      if (upstream.headers['content-length']) res.set('Content-Length', upstream.headers['content-length']);
      upstream.data.pipe(res);
    }
  } catch (err) {
    res.status(502).send(`HLS Proxy Error: ${err.message}`);
  }
});

// 6. Subtitle VTT Proxy (CORS and Referer Unblocker)
app.get('/api/proxy/vtt', async (req, res) => {
  const targetUrl = req.query.url;
  const referer = req.query.referer || 'https://ksdpictures.site/';
  if (!targetUrl) return res.status(400).send('Missing url parameter');

  try {
    const upstream = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
        'Referer': referer
      },
      responseType: 'text',
      timeout: 10000
    });

    res.set({
      'Content-Type': 'text/vtt; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*'
    });
    res.send(upstream.data);
  } catch (err) {
    res.status(502).send(`VTT Proxy Error: ${err.message}`);
  }
});

// 7. Embed Proxy & Anti-Block Gateway (Fixes Access Denied, 403 Forbidden & Referer Blocks)
app.get('/api/proxy/embed', async (req, res) => {
  const targetUrl = req.query.url;
  const referer = req.query.referer || GLOBAL_DOMAIN + '/';
  if (!targetUrl) return res.status(400).send('Missing target url');

  try {
    const upstream = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000
    });

    let html = upstream.data;

    if (typeof html === 'string') {
      html = html.replace(/<script[^>]*src=["'][^"']*devdetect\.js["'][^>]*><\/script>/gi, '');
      html = html.replace(/window\.location\.hostname\s*===\s*['"][^'"]+['"]/g, 'true');
      html = html.replace(/window\.top\s*===\s*window\.self/g, 'false');
      html = html.replace(/top\.location\s*===\s*self\.location/g, 'false');

      // For dzembed: route the internal video SOURCE and TRACKS through our unblocker proxies
      // so UxPlayer inside the iframe does not get 403 Forbidden on CDN .ts segments!
      if (html.includes('var SOURCE =') && html.includes('var TRACKS =')) {
        // Disable ads causing fetch errors
        html = html.replace(/var\s+ADS\s*=\s*[\s\S]*?;/, 'var ADS = null;');
        html = html.replace(/ads:\s*ADS/, 'ads: null');

        html = html.replace(/var\s+SOURCE\s*=\s*(["'][^"']+["']);/, function(m, p1) {
          return `var SOURCE = '/api/proxy/hls?url=' + encodeURIComponent(${p1}) + '&referer=' + encodeURIComponent('https://ksdpictures.site/');`;
        });
        html = html.replace(/var\s+TRACKS\s*=\s*(\[[\s\S]*?\]);/, function(m, p1) {
          return `var TRACKS = (${p1}).map(function(t){ return Object.assign({}, t, { file: '/api/proxy/vtt?url=' + encodeURIComponent(t.file) + '&referer=' + encodeURIComponent('https://ksdpictures.site/') }); });`;
        });
      }

      // If target is rplayer with relative scripts, inject base href; for dzembed all scripts are absolute so base href is not needed
      const injection = (targetUrl.includes('dzembed.php')) 
        ? `<meta name="referrer" content="no-referrer-when-downgrade">`
        : `<base href="${new URL(targetUrl).origin}/"><meta name="referrer" content="no-referrer-when-downgrade">`;

      if (html.includes('<head>')) {
        html = html.replace('<head>', '<head>' + injection);
      } else {
        html = injection + html;
      }
    }

    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'X-Frame-Options': 'ALLOWALL'
    });
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');

    res.send(html);
  } catch (err) {
    res.status(502).send(`Proxy Error: ${err.message}`);
  }
});

// 8. Categorized All-Feed (Movies, Series, Recent Episodes)
app.get('/api/all', async (req, res) => {
  const domain = getDomain(req);
  try {
    const resp = await axios.get(`${domain}/`, {
      headers: getHeaders(domain),
      timeout: 10000
    });

    const $ = cheerio.load(resp.data);
    const movies = [];
    const series = [];
    const recent_episodes = [];
    const seen = new Set();

    $('article.card').each((_, el) => {
      const a = $(el).find('a').first();
      const href = a.attr('href');
      if (!href || seen.has(href)) return;
      seen.add(href);

      const title = $(el).find('h3').text().trim() || a.attr('title') || $(el).find('img').attr('alt') || '';
      let poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
      if (poster && !poster.startsWith('http')) poster = `${domain}${poster}`;

      const fullUrl = href.startsWith('http') ? href : `${domain}${href}`;

      if (href.includes('/bolum/')) {
        const m = href.match(/(\d+)-sezon-(\d+)-bolum/);
        recent_episodes.push({
          title,
          season: m ? parseInt(m[1]) : 1,
          episode: m ? parseInt(m[2]) : 1,
          url: fullUrl,
          poster
        });
      } else if (href.includes('/film/')) {
        movies.push({
          title,
          url: fullUrl,
          slug: href.replace(domain, '').replace(/^\/film\/|\/$/g, ''),
          poster
        });
      } else if (href.includes('/dizi/')) {
        series.push({
          title,
          url: fullUrl,
          slug: href.replace(domain, '').replace(/^\/dizi\/|\/$/g, ''),
          poster
        });
      }
    });

    res.json({
      success: true,
      domain,
      counts: {
        recent_episodes: recent_episodes.length,
        series: series.length,
        movies: movies.length
      },
      recent_episodes,
      series,
      movies
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, domain });
  }
});

app.listen(PORT, () => {
  console.log(`Dizilab API Server running on http://localhost:${PORT}`);
});
