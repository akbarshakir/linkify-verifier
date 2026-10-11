export async function onRequest(context) {
    const { request, env } = context;
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        if (request.method === "GET") {
            const { results } = await env.DB.prepare("SELECT * FROM master_links").all();
            return new Response(JSON.stringify(results), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        if (request.method === "POST") {
            const records = await request.json();
            if (!Array.isArray(records) || records.length === 0) {
                return new Response(JSON.stringify({ error: "Invalid data" }), { 
                    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            const stmt = env.DB.prepare(`
                INSERT INTO master_links (date, site_name, live_url, vendor_name, client_name, vendor_price, client_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            const batch = records.map(r => stmt.bind(
                r.date || '', r.site_name || '', r.live_url || '',
                r.vendor_name || '', r.client_name || '',
                r.vendor_price || 0, r.client_price || 0
            ));

            await env.DB.batch(batch);

            return new Response(JSON.stringify({ success: true, count: records.length }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        return new Response("Method not allowed", { status: 405, headers: corsHeaders });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }
}