const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
    const { request, env, params } = context;
    const { id } = params;

    // Validate ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
        return new Response('Invalid ID', { status: 400, headers: CORS_HEADERS });
    }

    // Handle CORS Preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
    }

    const firebaseUrl = env.FIREBASE_DB_URL;
    if (!firebaseUrl) {
        return new Response('Server Error: FIREBASE_DB_URL not configured', { status: 500, headers: CORS_HEADERS });
    }

    // Build the Firebase URL
    let url = `${firebaseUrl.replace(/\/$/, '')}/sessions/${id}.json`;
    if (env.FIREBASE_SECRET) {
        url += `?auth=${env.FIREBASE_SECRET}`;
    }

    if (request.method === 'GET') {
        try {
            const res = await fetch(url);
            const data = await res.text();
            return new Response(data, {
                status: res.status,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        } catch (e) {
            return new Response('Failed to fetch from DB', { status: 502, headers: CORS_HEADERS });
        }
    }

    if (request.method === 'PUT') {
        // Size limitation to prevent abuse (e.g., max 2KB)
        const contentLength = request.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > 2048) {
            return new Response('Payload too large', { status: 413, headers: CORS_HEADERS });
        }

        try {
            const body = await request.text();
            
            // Basic JSON validation to ensure valid data structure
            const parsed = JSON.parse(body);
            if (!parsed.payload || !parsed.timestamp) {
                return new Response('Invalid payload format', { status: 400, headers: CORS_HEADERS });
            }

            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed) // rewrite to sanitize
            });

            const data = await res.text();
            return new Response(data, {
                status: res.status,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        } catch (e) {
            return new Response('Failed to write to DB', { status: 502, headers: CORS_HEADERS });
        }
    }

    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
}
