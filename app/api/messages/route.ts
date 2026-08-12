import { env } from "cloudflare:workers";

async function ready() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS contact_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'New', created_at INTEGER NOT NULL)`).run();
}
export async function POST(request: Request) {
  const data = await request.json() as Record<string, string>;
  if (!data.name || !data.email || !data.subject || !data.message) return Response.json({ error: "Missing required fields" }, { status: 400 });
  await ready();
  await env.DB.prepare("INSERT INTO contact_messages (name,email,phone,subject,message,status,created_at) VALUES (?,?,?,?,?,'New',?)").bind(data.name, data.email, data.phone || "", data.subject, data.message, Date.now()).run();
  return Response.json({ ok: true }, { status: 201 });
}
export async function GET() { await ready(); const result = await env.DB.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100").all(); return Response.json(result.results); }
