let app;
let initError = null;

try {
    app = require('../server');
} catch (err) {
    initError = err;
    console.error('Fatal server boot error:', err);
}

module.exports = (req, res) => {
    function sendError(code, title, body) {
        const html = `<!DOCTYPE html><html><head><title>${code} - ${title}</title></head><body style="font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;padding:40px;line-height:1.6;"><div style="max-width:800px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:32px;"><h2 style="color:#f43f5e;margin-top:0;">${title}</h2><pre style="background:#090d16;color:#e2e8f0;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;border:1px solid #1e293b;">${body}</pre></div></body></html>`;
        if (typeof res.status === 'function') {
            return res.status(code).send(html);
        }
        res.statusCode = code;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(html);
    }

    if (initError) {
        return sendError(500, 'Server Boot Notice', initError.stack || initError.message);
    }

    // Normalize path if Vercel serverless rewrite prepends /api/index.js or /api
    const matchedPath = req.headers['x-matched-path'] || req.headers['x-vercel-matched-path'];
    if (matchedPath && (req.url === '/api' || req.url.startsWith('/api/index.js'))) {
        req.url = matchedPath;
    } else if (req.url && req.url.startsWith('/api/index.js')) {
        req.url = req.url.replace(/^\/api\/index\.js/, '') || '/';
    } else if (req.url === '/api') {
        req.url = '/';
    } else if (req.url && req.url.startsWith('/api/admin')) {
        req.url = req.url.replace(/^\/api/, '');
    }

    try {
        return app(req, res);
    } catch (reqErr) {
        console.error('Serverless request error:', reqErr);
        return sendError(500, 'Request Execution Error', reqErr.stack || reqErr.message);
    }
};
