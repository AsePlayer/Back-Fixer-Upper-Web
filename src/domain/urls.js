export function youtubeId(input) {
  try {
    const url = new URL(input.trim());
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password || url.port) return;
    const paths = url.pathname.split('/').filter(Boolean);
    const id = url.hostname === 'youtu.be' ? paths[0] : ['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname)
      ? paths[0] === 'watch' ? url.searchParams.get('v') : ['shorts','embed','live'].includes(paths[0]) ? paths[1] : undefined : undefined;
    return /^[A-Za-z0-9_-]{11}$/.test(id ?? '') ? id : undefined;
  } catch { return undefined; }
}
export const youtubeUrl = id => /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : undefined;
export const videoKey = id => `youtube:${id}`;
export function safeHttps(input) { try { const u = new URL(input); return u.protocol === 'https:' && !u.username && !u.password ? u.href : undefined; } catch { return undefined; } }
export function safeThumbnail(input) { const url = safeHttps(input); return url && /(^|\.)ytimg\.com$/.test(new URL(url).hostname) ? url : undefined; }
