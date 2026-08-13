import { env } from "cloudflare:workers";

type AdminEntity = "products" | "orders" | "payments" | "customers" | "categories" | "brands" | "coupons" | "blog" | "messages" | "newsletter" | "settings";

const allowed = new Set<AdminEntity>(["products","orders","payments","customers","categories","brands","coupons","blog","messages","newsletter","settings"]);

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

function adminIdentity(request: Request) {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  const host = new URL(request.url).hostname;
  if (id && email) return { id, email };
  if (host === "localhost" || host === "127.0.0.1") return { id: "local-admin", email: "admin@localhost" };
  return null;
}

async function ensureSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      authenticated_user_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Admin User',
      role TEXT NOT NULL DEFAULT 'super_admin',
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS catalog_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      sku TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      brand TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL,
      old_price REAL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      image_2 TEXT,
      image_3 TEXT,
      video_url TEXT,
      badge TEXT,
      rating REAL NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'active',
      featured INTEGER NOT NULL DEFAULT 0,
      color TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS admin_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      data_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_by TEXT,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      summary TEXT NOT NULL,
      metadata_json TEXT,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS store_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, city TEXT NOT NULL, postal_code TEXT, address TEXT NOT NULL, subtotal REAL NOT NULL, shipping REAL NOT NULL, tax REAL NOT NULL, total REAL NOT NULL, payment_method TEXT NOT NULL, payment_status TEXT NOT NULL, order_status TEXT NOT NULL, transaction_reference TEXT NOT NULL, proof_url TEXT NOT NULL, admin_note TEXT, verified_by TEXT, verified_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, title TEXT NOT NULL, sku TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, image TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'New',
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )`),
  ]);
  for (const statement of [
    "ALTER TABLE catalog_products ADD COLUMN image_2 TEXT",
    "ALTER TABLE catalog_products ADD COLUMN image_3 TEXT",
    "ALTER TABLE catalog_products ADD COLUMN video_url TEXT",
  ]) { try { await db.prepare(statement).run(); } catch {} }
}

async function requireAdmin(request: Request) {
  const identity = adminIdentity(request);
  if (!identity) return null;
  await ensureSchema();
  const now = Date.now();
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM admin_users").first<{count:number}>();
  if (!count?.count) {
    await env.DB.prepare("INSERT INTO admin_users (authenticated_user_id,email,name,role,active,created_at,updated_at) VALUES (?,?,?,'super_admin',1,?,?)")
      .bind(identity.id, identity.email, identity.email.split("@")[0], now, now).run();
  }
  const user = await env.DB.prepare("SELECT * FROM admin_users WHERE authenticated_user_id=? AND active=1").bind(identity.id).first<Record<string,unknown>>();
  return user ? { ...identity, ...user } : null;
}

async function audit(userId: string, action: string, entity: string, id: unknown, summary: string, metadata?: unknown) {
  await env.DB.prepare("INSERT INTO audit_logs (admin_user_id,action,entity_type,entity_id,summary,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(userId, action, entity, id == null ? null : String(id), summary, metadata ? JSON.stringify(metadata) : null, Date.now()).run();
}

function cleanProduct(input: Record<string, unknown>) {
  const title = String(input.title || "").trim();
  const sku = String(input.sku || "").trim().toUpperCase();
  const slug = String(input.slug || title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")).trim();
  const price = Number(input.price);
  const stockQuantity = Math.max(0, Math.floor(Number(input.stock_quantity ?? input.stock ?? 0)));
  if (!title || !sku || !slug || !Number.isFinite(price) || price < 0) throw new Error("Title, unique SKU, slug and a valid price are required.");
  return {
    source_id: input.source_id == null ? null : Number(input.source_id),
    title, slug, sku,
    category: String(input.category || "Uncategorized").trim(),
    brand: String(input.brand || "Insight").trim(),
    description: String(input.description || "").trim(),
    price,
    old_price: input.old_price == null || input.old_price === "" ? null : Number(input.old_price),
    stock_quantity: stockQuantity,
    image: String(input.image || "").trim() || null,
    image_2: String(input.image_2 || "").trim() || null,
    image_3: String(input.image_3 || "").trim() || null,
    video_url: String(input.video_url || "").trim() || null,
    badge: String(input.badge || "").trim() || null,
    rating: Number(input.rating || 5),
    status: ["active","draft","archived"].includes(String(input.status)) ? String(input.status) : "active",
    featured: input.featured ? 1 : 0,
    color: String(input.color || "").trim() || null,
  };
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: "Admin access required" }, 403);
  const url = new URL(request.url);
  const entity = url.searchParams.get("entity") as AdminEntity;
  if (!allowed.has(entity)) return json({ error: "Unknown admin section" }, 400);
  const q = (url.searchParams.get("q") || "").trim();
  if (entity === "products") {
    const rows = q
      ? await env.DB.prepare("SELECT * FROM catalog_products WHERE title LIKE ? OR sku LIKE ? OR category LIKE ? ORDER BY updated_at DESC LIMIT 250").bind(`%${q}%`,`%${q}%`,`%${q}%`).all()
      : await env.DB.prepare("SELECT * FROM catalog_products ORDER BY updated_at DESC LIMIT 250").all();
    return json({ items: rows.results, admin });
  }
  if (entity === "orders" || entity === "payments") {
    const rows=await env.DB.prepare("SELECT * FROM store_orders ORDER BY created_at DESC LIMIT 250").all<any>();
    const hydrated=[];
    for(const row of rows.results){
      const lines=await env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(row.id).all();
      hydrated.push({...row,items:lines.results});
    }
    return json({items:hydrated,admin});
  }
  if (entity === "messages") {
    const rows = await env.DB.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 250").all();
    return json({ items: rows.results, admin });
  }
  if (entity === "newsletter") {
    const rows = await env.DB.prepare("SELECT * FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 500").all();
    return json({ items: rows.results, admin });
  }
  if (entity === "settings") {
    const rows = await env.DB.prepare("SELECT * FROM store_settings ORDER BY key").all();
    return json({ items: rows.results.map((r:any)=>({ ...r, value: JSON.parse(r.value_json) })), admin });
  }
  const rows = q
    ? await env.DB.prepare("SELECT * FROM admin_records WHERE entity=? AND (title LIKE ? OR data_json LIKE ?) ORDER BY updated_at DESC LIMIT 250").bind(entity,`%${q}%`,`%${q}%`).all()
    : await env.DB.prepare("SELECT * FROM admin_records WHERE entity=? ORDER BY updated_at DESC LIMIT 250").bind(entity).all();
  return json({ items: rows.results.map((r:any)=>({ ...r, ...JSON.parse(r.data_json) })), admin });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: "Admin access required" }, 403);
  const url = new URL(request.url);
  const entity = url.searchParams.get("entity") as AdminEntity;
  if (!allowed.has(entity)) return json({ error: "Unknown admin section" }, 400);
  const body = await request.json() as Record<string, any>;
  const now = Date.now();
  try {
    if (entity === "products" && body.action === "seed") {
      const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM catalog_products").first<{count:number}>();
      if (!count?.count && Array.isArray(body.items)) {
        for (const raw of body.items) {
          const p = cleanProduct({ ...raw, source_id: raw.id, stock_quantity: raw.stock ? 10 : 0, old_price: raw.oldPrice });
          await env.DB.prepare(`INSERT OR IGNORE INTO catalog_products
            (source_id,title,slug,sku,category,brand,description,price,old_price,stock_quantity,image,image_2,image_3,video_url,badge,rating,status,featured,color,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .bind(p.source_id,p.title,p.slug,p.sku,p.category,p.brand,p.description,p.price,p.old_price,p.stock_quantity,p.image,p.image_2,p.image_3,p.video_url,p.badge,p.rating,p.status,p.featured,p.color,now,now).run();
        }
      }
      return json({ ok: true }, 201);
    }
    if (entity === "products") {
      const p = cleanProduct(body);
      const result = await env.DB.prepare(`INSERT INTO catalog_products
        (source_id,title,slug,sku,category,brand,description,price,old_price,stock_quantity,image,image_2,image_3,video_url,badge,rating,status,featured,color,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(p.source_id,p.title,p.slug,p.sku,p.category,p.brand,p.description,p.price,p.old_price,p.stock_quantity,p.image,p.image_2,p.image_3,p.video_url,p.badge,p.rating,p.status,p.featured,p.color,now,now).run();
      await audit(String(admin.authenticated_user_id), "create", entity, result.meta.last_row_id, `Created product ${p.title}`);
      return json({ id: result.meta.last_row_id }, 201);
    }
    if (entity === "orders" || entity === "payments") {
      const paymentStatus=String(body.payment_status||"");
      if(!["Verification Pending","Paid","Payment Rejected"].includes(paymentStatus))throw new Error("Invalid payment status.");
      const orderStatus=paymentStatus==="Paid"?"Order Confirmed":paymentStatus==="Payment Rejected"?"Payment Pending":"Payment Pending";
      await env.DB.prepare("UPDATE store_orders SET payment_status=?,order_status=?,admin_note=?,verified_by=?,verified_at=?,updated_at=? WHERE id=?")
        .bind(paymentStatus,orderStatus,String(body.admin_note||"").slice(0,1000),String(admin.authenticated_user_id),Date.now(),now,id).run();
      await audit(String(admin.authenticated_user_id),paymentStatus==="Paid"?"approve":"reject","payment",id,`${paymentStatus} for order ${id}`);
      return json({ok:true});
    }
    if (entity === "settings") {
      if (!body.key) throw new Error("Setting key is required.");
      await env.DB.prepare("INSERT INTO store_settings (key,value_json,updated_by,updated_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at")
        .bind(String(body.key),JSON.stringify(body.value ?? body),String(admin.authenticated_user_id),now).run();
      await audit(String(admin.authenticated_user_id),"update",entity,body.key,`Updated setting ${body.key}`);
      return json({ ok:true },201);
    }
    const title = String(body.title || body.name || body.code || body.email || "Untitled").trim();
    const status = String(body.status || "active");
    const result = await env.DB.prepare("INSERT INTO admin_records (entity,title,status,data_json,created_at,updated_at) VALUES (?,?,?,?,?,?)")
      .bind(entity,title,status,JSON.stringify(body),now,now).run();
    await audit(String(admin.authenticated_user_id),"create",entity,result.meta.last_row_id,`Created ${entity}: ${title}`);
    return json({ id: result.meta.last_row_id },201);
  } catch (error:any) {
    const duplicate = String(error?.message||"").includes("UNIQUE");
    return json({ error: duplicate ? "SKU or slug already exists." : error?.message || "Unable to save record." }, duplicate ? 409 : 400);
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: "Admin access required" }, 403);
  const url = new URL(request.url);
  const entity = url.searchParams.get("entity") as AdminEntity;
  const id = url.searchParams.get("id");
  if (!id || !allowed.has(entity)) return json({ error: "Entity and id are required" },400);
  const body = await request.json() as Record<string,any>;
  const now = Date.now();
  try {
    if (entity === "products") {
      const p = cleanProduct(body);
      await env.DB.prepare(`UPDATE catalog_products SET title=?,slug=?,sku=?,category=?,brand=?,description=?,price=?,old_price=?,stock_quantity=?,image=?,image_2=?,image_3=?,video_url=?,badge=?,rating=?,status=?,featured=?,color=?,updated_at=? WHERE id=?`)
        .bind(p.title,p.slug,p.sku,p.category,p.brand,p.description,p.price,p.old_price,p.stock_quantity,p.image,p.image_2,p.image_3,p.video_url,p.badge,p.rating,p.status,p.featured,p.color,now,id).run();
      await audit(String(admin.authenticated_user_id),"update",entity,id,`Updated product ${p.title}`);
      return json({ ok:true });
    }
    if (entity === "messages") {
      await env.DB.prepare("UPDATE contact_messages SET status=? WHERE id=?").bind(String(body.status||"Read"),id).run();
      await audit(String(admin.authenticated_user_id),"update",entity,id,`Updated message status`);
      return json({ok:true});
    }
    const title = String(body.title || body.name || body.code || body.email || "Untitled").trim();
    await env.DB.prepare("UPDATE admin_records SET title=?,status=?,data_json=?,updated_at=? WHERE id=? AND entity=?")
      .bind(title,String(body.status||"active"),JSON.stringify(body),now,id,entity).run();
    await audit(String(admin.authenticated_user_id),"update",entity,id,`Updated ${entity}: ${title}`);
    return json({ok:true});
  } catch(error:any) {
    return json({error:error?.message||"Unable to update record."},400);
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: "Admin access required" }, 403);
  const url = new URL(request.url);
  const entity = url.searchParams.get("entity") as AdminEntity;
  const id = url.searchParams.get("id");
  if (!id || !allowed.has(entity)) return json({ error: "Entity and id are required" },400);
  if (entity === "products") await env.DB.prepare("DELETE FROM catalog_products WHERE id=?").bind(id).run();
  else if (entity === "orders" || entity === "payments") return json({error:"Orders and payment records cannot be deleted."},405);
  else if (entity === "messages") await env.DB.prepare("DELETE FROM contact_messages WHERE id=?").bind(id).run();
  else if (entity === "newsletter") await env.DB.prepare("DELETE FROM newsletter_subscribers WHERE id=?").bind(id).run();
  else await env.DB.prepare("DELETE FROM admin_records WHERE id=? AND entity=?").bind(id,entity).run();
  await audit(String(admin.authenticated_user_id),"delete",entity,id,`Deleted ${entity} record`);
  return json({ok:true});
}
