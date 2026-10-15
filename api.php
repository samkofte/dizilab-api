<?php
/**
 * Dizilab Reverse Engineered API Client & Standalone Endpoints (PHP)
 * Compatible with standard PHP shared hosting (cURL + JSON).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Dizilab-Domain');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 1. Domain configuration (Changeable via query, header, or textbox in UI)
$domain = isset($_GET['domain']) ? trim($_GET['domain']) : (isset($_SERVER['HTTP_X_DIZILAB_DOMAIN']) ? trim($_SERVER['HTTP_X_DIZILAB_DOMAIN']) : 'https://dizilab.to');
$domain = rtrim($domain, '/');
if (!preg_match('#^https?://#i', $domain)) {
    $domain = 'https://' . $domain;
}

function curlFetch($url, $referer = '') {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    if ($referer) {
        curl_setopt($ch, CURLOPT_REFERER, $referer);
    }
    $res = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $status, 'data' => $res];
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

// --- ROUTE 0: Embed Proxy (Fixes Referer & Access Denied for rplayer/embeds) ---
if ($action === 'proxy_embed') {
    $targetUrl = isset($_GET['url']) ? trim($_GET['url']) : '';
    $referer = isset($_GET['referer']) ? trim($_GET['referer']) : $domain . '/';
    if (!$targetUrl) {
        http_response_code(400);
        echo 'Missing url';
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    $res = curlFetch($targetUrl, $referer);
    $html = $res['data'];
    if (is_string($html)) {
        $html = preg_replace('#<script[^>]*src=["\'][^"\']*devdetect\.js["\'][^>]*></script>#is', '', $html);
        $html = preg_replace('#window\.location\.hostname\s*===\s*[\'"][^\'"]+[\'"]#is', 'true', $html);
        $html = preg_replace('#window\.top\s*===\s*window\.self#is', 'false', $html);
        $html = preg_replace('#top\.location\s*===\s*self\.location#is', 'false', $html);

        if (strpos($html, 'var SOURCE =') !== false) {
            $html = preg_replace_callback('#var\s+SOURCE\s*=\s*(["\'][^"\']+["\']);#is', function($m) {
                return "var SOURCE = '?action=proxy_hls&url=' + encodeURIComponent(" . $m[1] . ") + '&referer=' + encodeURIComponent('https://ksdpictures.site/');";
            }, $html);
            $html = preg_replace_callback('#var\s+TRACKS\s*=\s*(\[[\s\S]*?\]);#is', function($m) {
                return "var TRACKS = (" . $m[1] . ").map(function(t){ return Object.assign({}, t, { file: '?action=proxy_vtt&url=' + encodeURIComponent(t.file) + '&referer=' + encodeURIComponent('https://ksdpictures.site/') }); });";
            }, $html);
        }

        $parsed = parse_url($targetUrl);
        $origin = (isset($parsed['scheme']) ? $parsed['scheme'] : 'https') . '://' . (isset($parsed['host']) ? $parsed['host'] : '');
        $injection = '<base href="' . $origin . '/"><meta name="referrer" content="no-referrer-when-downgrade">';
        if (strpos($html, '<head>') !== false) {
            $html = str_replace('<head>', '<head>' . $injection, $html);
        } else {
            $html = $injection . $html;
        }
    }
    echo $html;
    exit;
}

// --- ROUTE 0.5: HLS Stream Proxy ---
if ($action === 'proxy_hls') {
    $targetUrl = isset($_GET['url']) ? trim($_GET['url']) : '';
    $referer = isset($_GET['referer']) ? trim($_GET['referer']) : 'https://ksdpictures.site/';
    if (!$targetUrl) {
        http_response_code(400);
        echo 'Missing url';
        exit;
    }

    $isM3u8 = (strpos($targetUrl, '.m3u8') !== false);
    $res = curlFetch($targetUrl, $referer);

    if ($isM3u8) {
        header('Content-Type: application/vnd.apple.mpegurl; charset=utf-8');
        $lines = explode("\n", $res['data']);
        $baseUrl = substr($targetUrl, 0, strrpos($targetUrl, '/') + 1);
        $rewritten = [];
        foreach ($lines as $line) {
            $l = trim($line);
            if (empty($l)) { $rewritten[] = $line; continue; }
            if (strpos($l, '#EXT-X-MEDIA') === 0 && strpos($l, 'URI=') !== false) {
                $l = preg_replace_callback('#URI=["\']([^"\']+)["\']#', function($m) use ($baseUrl, $targetUrl, $referer) {
                    $abs = (strpos($m[1], 'http') === 0) ? $m[1] : ((strpos($m[1], '/') === 0) ? 'https://ksdpictures.site' . $m[1] : $baseUrl . $m[1]);
                    return 'URI="?action=proxy_hls&url=' . urlencode($abs) . '&referer=' . urlencode($referer) . '"';
                }, $l);
                $rewritten[] = $l;
                continue;
            }
            if (strpos($l, '#') !== 0) {
                $abs = (strpos($l, 'http') === 0) ? $l : ((strpos($l, '/') === 0) ? 'https://ksdpictures.site' . $l : $baseUrl . $l);
                $rewritten[] = '?action=proxy_hls&url=' . urlencode($abs) . '&referer=' . urlencode($referer);
                continue;
            }
            $rewritten[] = $line;
        }
        echo implode("\n", $rewritten);
    } else {
        header('Content-Type: video/MP2T');
        echo $res['data'];
    }
    exit;
}

// --- ROUTE 0.6: VTT Subtitle Proxy ---
if ($action === 'proxy_vtt') {
    $targetUrl = isset($_GET['url']) ? trim($_GET['url']) : '';
    $referer = isset($_GET['referer']) ? trim($_GET['referer']) : 'https://ksdpictures.site/';
    if (!$targetUrl) {
        http_response_code(400);
        echo 'Missing url';
        exit;
    }
    header('Content-Type: text/vtt; charset=utf-8');
    $res = curlFetch($targetUrl, $referer);
    echo $res['data'];
    exit;
}

// --- ROUTE 1: Search shows ---
if ($action === 'search') {
    $query = isset($_GET['q']) ? trim($_GET['q']) : '';
    if (!$query) {
        echo json_encode(['success' => false, 'error' => 'Missing q param']);
        exit;
    }
    $targetUrl = $domain . '/wp-json/wstream/v1/search?s=' . urlencode($query);
    $res = curlFetch($targetUrl, $domain);
    if ($res['status'] === 200) {
        $json = json_decode($res['data'], true);
        echo json_encode([
            'success' => true,
            'domain' => $domain,
            'query' => $query,
            'results' => isset($json['results']) ? $json['results'] : []
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['success' => false, 'error' => 'Upstream search failed: HTTP ' . $res['status']]);
    }
    exit;
}

// --- ROUTE 2: Series Detail ---
if ($action === 'show' || $action === 'series') {
    $slug = isset($_GET['slug']) ? trim($_GET['slug']) : '';
    if (!$slug) {
        echo json_encode(['success' => false, 'error' => 'Missing slug param']);
        exit;
    }
    $targetUrl = (strpos($slug, 'http') === 0) ? $slug : $domain . '/dizi/' . trim($slug, '/') . '/';
    $res = curlFetch($targetUrl, $domain);
    if ($res['status'] !== 200 || empty($res['data'])) {
        echo json_encode(['success' => false, 'error' => 'Show not found or blocked: HTTP ' . $res['status']]);
        exit;
    }

    $html = $res['data'];
    preg_match('#<h1[^>]*>(.*?)</h1>#is', $html, $mTitle);
    $title = isset($mTitle[1]) ? trim(strip_tags($mTitle[1])) : 'Dizi';

    preg_match('#<div[^>]*class=["\'][^"\']*desc[^"\']*["\'][^>]*>(.*?)</div>#is', $html, $mDesc);
    $desc = isset($mDesc[1]) ? trim(strip_tags($mDesc[1])) : '';

    preg_match('#<img[^>]*src=["\']([^"\']+poster[^"\']*)["\']#is', $html, $mPoster);
    $poster = isset($mPoster[1]) ? $mPoster[1] : '';

    preg_match_all('#<article[^>]*class=["\'][^"\']*card--episode[^"\']*["\'].*?<a[^>]*href=["\']([^"\']+)["\'].*?</h3>#is', $html, $mEps, PREG_SET_ORDER);
    $episodes = [];
    foreach ($mEps as $ep) {
        $epUrl = $ep[1];
        preg_match('#(\d+)-sezon-(\d+)-bolum#', $epUrl, $mSE);
        $sNum = isset($mSE[1]) ? (int)$mSE[1] : 1;
        $eNum = isset($mSE[2]) ? (int)$mSE[2] : 1;
        $episodes[] = [
            'season' => $sNum,
            'episode' => $eNum,
            'url' => $epUrl
        ];
    }

    echo json_encode([
        'success' => true,
        'domain' => $domain,
        'title' => $title,
        'poster' => $poster,
        'description' => $desc,
        'total_episodes' => count($episodes),
        'episodes' => $episodes
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// --- ROUTE 3: Episode Stream & Decryption ---
if ($action === 'stream') {
    $epUrl = isset($_GET['url']) ? trim($_GET['url']) : '';
    if (!$epUrl) {
        echo json_encode(['success' => false, 'error' => 'Missing url param']);
        exit;
    }
    $targetUrl = (strpos($epUrl, 'http') === 0) ? $epUrl : $domain . '/' . trim($epUrl, '/');
    $res = curlFetch($targetUrl, $domain);
    if ($res['status'] !== 200 || empty($res['data'])) {
        echo json_encode(['success' => false, 'error' => 'Target error: HTTP ' . $res['status']]);
        exit;
    }

    $html = $res['data'];
    $players = [];

    // Check if main show page and grab episodes
    preg_match_all('#href=["\']([^"\']*?/bolum/[^"\']+)["\']#is', $html, $mAllBolum);
    $foundEpisodes = !empty($mAllBolum[1]) ? array_values(array_unique($mAllBolum[1])) : [];

    preg_match_all('#<iframe[^>]*src=["\']([^"\']+)["\']#is', $html, $mIframes);
    $iframes = !empty($mIframes[1]) ? $mIframes[1] : [];

    if (empty($iframes) && !empty($foundEpisodes)) {
        $firstEp = end($foundEpisodes);
        $epFull = (strpos($firstEp, 'http') === 0) ? $firstEp : $domain . $firstEp;
        $resEp = curlFetch($epFull, $domain);
        if ($resEp['status'] === 200) {
            preg_match_all('#<iframe[^>]*src=["\']([^"\']+)["\']#is', $resEp['data'], $mSubIframes);
            if (!empty($mSubIframes[1])) {
                $iframes = $mSubIframes[1];
            }
        }
    }

    foreach ($iframes as $iframeSrc) {
        $fullIframe = (strpos($iframeSrc, 'http') === 0) ? $iframeSrc : ((strpos($iframeSrc, '//') === 0) ? 'https:' . $iframeSrc : $domain . '/' . ltrim($iframeSrc, '/'));

        if (strpos($fullIframe, 'dzembed.php') !== false || strpos($fullIframe, 'ksdpictures') !== false) {
            $resEmbed = curlFetch($fullIframe, $targetUrl);
            preg_match('#var\s+SOURCE\s*=\s*["\']([^"\']+)["\']#is', $resEmbed['data'], $mSource);
            preg_match('#var\s+TRACKS\s*=\s*(\[.*?\]);#is', $resEmbed['data'], $mTracks);
            $streamUrl = isset($mSource[1]) ? $mSource[1] : '';
            $rawTracks = isset($mTracks[1]) ? json_decode($mTracks[1], true) : [];

            $proxiedTracks = [];
            foreach ($rawTracks as $t) {
                $t['file'] = '?action=proxy_vtt&url=' . urlencode($t['file']) . '&referer=' . urlencode('https://ksdpictures.site/');
                $proxiedTracks[] = $t;
            }

            if (!empty($streamUrl)) {
                $players[] = [
                    'name' => 'Direct HLS Stream (Altyazılı & Dublajlı)',
                    'type' => 'hls',
                    'stream_url' => '?action=proxy_hls&url=' . urlencode($streamUrl) . '&referer=' . urlencode('https://ksdpictures.site/'),
                    'embed_url' => $fullIframe,
                    'subtitles' => $proxiedTracks,
                    'playable' => true
                ];
            }

            $players[] = [
                'name' => 'KSD / UXPlayer (Full UI Dub/Sub)',
                'type' => 'iframe',
                'stream_url' => null,
                'embed_url' => '?action=proxy_embed&url=' . urlencode($fullIframe) . '&referer=' . urlencode($domain . '/'),
                'playable' => true
            ];
            continue;
        }

        // Proxied embed link for rplayer and web players to bypass Referer 403
        $proxied = '?action=proxy_embed&url=' . urlencode($fullIframe) . '&referer=' . urlencode($domain . '/');
        $players[] = [
            'name' => (strpos($fullIframe, 'rplayer') !== false || strpos($fullIframe, 'psource') !== false) ? 'Decrypted Stream Player (RPlayer / PSource)' : 'Web Embed Player',
            'type' => 'iframe',
            'stream_url' => null,
            'embed_url' => $proxied,
            'playable' => true
        ];
    }

    $primary = !empty($players[0]['stream_url']) ? $players[0]['stream_url'] : null;

    echo json_encode([
        'success' => count($players) > 0,
        'domain' => $domain,
        'primary_stream' => $primary,
        'primary_embed' => !empty($players[0]['embed_url']) ? $players[0]['embed_url'] : null,
        'episodes' => $foundEpisodes,
        'all_players' => $players
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// --- ROUTE 4: All Categorized Feed ---
if ($action === 'all') {
    $res = curlFetch($domain . '/', $domain);
    $html = $res['data'];
    $movies = [];
    $series = [];
    $recent_episodes = [];
    $seen = [];

    preg_match_all('#<article[^>]*class=["\'][^"\']*card[^"\']*["\'].*?<a[^>]*href=["\']([^"\']+)["\'].*?</h3>.*?article>#is', $html, $matches, PREG_SET_ORDER);
    foreach ($matches as $m) {
        $fullCard = $m[0];
        $href = $m[1];
        if (isset($seen[$href])) continue;
        $seen[$href] = true;

        preg_match('#<h3[^>]*>(.*?)</h3>#is', $fullCard, $mTitle);
        $title = isset($mTitle[1]) ? trim(strip_tags($mTitle[1])) : '';

        preg_match('#<img[^>]*src=["\']([^"\']+)["\']#is', $fullCard, $mImg);
        $poster = isset($mImg[1]) ? $mImg[1] : '';

        $fullUrl = (strpos($href, 'http') === 0) ? $href : $domain . $href;

        if (strpos($href, '/bolum/') !== false) {
            $recent_episodes[] = ['title' => $title, 'url' => $fullUrl, 'poster' => $poster];
        } elseif (strpos($href, '/film/') !== false) {
            $movies[] = ['title' => $title, 'url' => $fullUrl, 'poster' => $poster];
        } elseif (strpos($href, '/dizi/') !== false) {
            $series[] = ['title' => $title, 'url' => $fullUrl, 'poster' => $poster];
        }
    }

    echo json_encode([
        'success' => true,
        'domain' => $domain,
        'counts' => [
            'recent_episodes' => count($recent_episodes),
            'series' => count($series),
            'movies' => count($movies)
        ],
        'recent_episodes' => $recent_episodes,
        'series' => $series,
        'movies' => $movies
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// Default info
echo json_encode([
    'api' => 'Dizilab Reverse Engineered API (PHP Version)',
    'status' => 'online',
    'active_domain' => $domain,
    'endpoints' => [
        'all' => '?action=all&domain=' . urlencode($domain),
        'search' => '?action=search&q={query}&domain=' . urlencode($domain),
        'show' => '?action=show&slug={show-slug}&domain=' . urlencode($domain),
        'stream' => '?action=stream&url={episode-url}&domain=' . urlencode($domain),
        'proxy_embed' => '?action=proxy_embed&url={embed-url}&referer=' . urlencode($domain),
        'proxy_hls' => '?action=proxy_hls&url={m3u8-url}',
        'proxy_vtt' => '?action=proxy_vtt&url={vtt-url}'
    ]
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
