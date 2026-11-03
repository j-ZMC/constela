// Anyone can read these routes: they hold public data only, and the app has no cookies to send along.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export const publicJson = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
export const publicOptions = () => new Response(null, { status: 204, headers: CORS });
