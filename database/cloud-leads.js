/**
 * Server-to-server client for the SV Real Estate production leads Edge Function.
 * Never expose SV_REAL_ESTATE_EDGE_TOKEN to browser code.
 */
function getEndpoint() {
    const base = (process.env.SV_REAL_ESTATE_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const token = (process.env.SV_REAL_ESTATE_EDGE_TOKEN_V2 || '').trim();
    if (!base.startsWith('https://') || !token) return null;
    return { url: `${base}/functions/v1/leads-api`, token };
}

function cloudLeadsConfigured() {
    return Boolean(getEndpoint());
}

async function callCloud(method, payloadOrQuery) {
    const endpoint = getEndpoint();
    if (!endpoint) return { success: false, error: 'Production leads database is not configured.' };

    const url = new URL(endpoint.url);
    const init = {
        method,
        headers: {
            'x-sv-edge-token': endpoint.token,
            'accept': 'application/json'
        },
        signal: AbortSignal.timeout(12000)
    };

    if (method === 'POST') {
        init.headers['content-type'] = 'application/json';
        init.body = JSON.stringify(payloadOrQuery || {});
    } else if (method === 'PATCH') {
        init.headers['content-type'] = 'application/json';
        Object.entries(payloadOrQuery || {}).forEach(([key, value]) => {
            if (['resource', 'id', 'operation'].includes(key) && value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, String(value));
            }
        });
        const patch = { ...(payloadOrQuery || {}) };
        delete patch.resource;
        delete patch.id;
        delete patch.operation;
        init.body = JSON.stringify(patch);
    } else {
        Object.entries(payloadOrQuery || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
        });
    }

    try {
        const response = await fetch(url, init);
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.success === false) {
            return { success: false, status: response.status, error: body.error || 'Production database request failed.' };
        }
        return { success: true, ...body };
    } catch (error) {
        console.error('[CLOUD LEADS] Edge Function request failed:', error.message);
        return { success: false, error: 'Could not reach the production enquiry database.' };
    }
}

async function submitCloudLead(lead) {
    return callCloud('POST', lead);
}

async function listCloudLeads(options = {}) {
    return callCloud('GET', {
        status: options.status,
        category: options.category,
        search: options.search,
        limit: options.limit || 25,
        offset: options.offset || 0
    });
}

async function listCloudProperties(options = {}) {
    return callCloud('GET', {
        resource: 'properties',
        public: options.public ? 'true' : 'false',
        id: options.id,
        category: options.category,
        purpose: options.purpose,
        city: options.city,
        availability: options.availability,
        min_price: options.min_price,
        max_price: options.max_price,
        bedrooms: options.bedrooms,
        search: options.search,
        limit: options.limit || 24,
        offset: options.offset || 0
    });
}

async function createCloudProperty(property) {
    return callCloud('POST', { resource: 'properties', ...property });
}

async function updateCloudProperty(id, patch) {
    return callCloud('PATCH', { resource: 'properties', id, ...patch });
}

async function setCloudPropertyStatus(id, operation) {
    return callCloud('PATCH', { resource: 'properties', id, operation });
}

async function deleteCloudProperty(id) {
    const endpoint = getEndpoint();
    if (!endpoint) return { success: false, error: 'Production properties database is not configured.' };
    const url = new URL(endpoint.url);
    url.searchParams.set('resource', 'properties');
    url.searchParams.set('id', String(id));
    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'x-sv-edge-token': endpoint.token, accept: 'application/json' },
            signal: AbortSignal.timeout(12000)
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.success === false) return { success: false, error: body.error || 'Could not delete property.' };
        return { success: true, ...body };
    } catch (error) {
        console.error('[CLOUD PROPERTIES] Delete failed:', error.message);
        return { success: false, error: 'Could not reach the production properties database.' };
    }
}

module.exports = {
    cloudLeadsConfigured, submitCloudLead, listCloudLeads,
    listCloudProperties, createCloudProperty, updateCloudProperty,
    setCloudPropertyStatus, deleteCloudProperty
};
