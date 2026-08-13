import { env } from "cloudflare:workers";

function clean(value:unknown,max=500){return String(value||"").trim().slice(0,max)}
async function schema(){
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS store_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT NOT NULL UNIQUE, access_token TEXT, customer_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, city TEXT NOT NULL, postal_code TEXT, address TEXT NOT NULL, subtotal REAL NOT NULL, shipping REAL NOT NULL, tax REAL NOT NULL, total REAL NOT NULL, payment_method TEXT NOT NULL, payment_status TEXT NOT NULL, order_status TEXT NOT NULL, transaction_reference TEXT NOT NULL, proof_url TEXT NOT NULL, admin_note TEXT, verified_by TEXT, verified_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, title TEXT NOT NULL, sku TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, image TEXT, FOREIGN KEY(order_id) REFERENCES store_orders(id))`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_store_orders_status_created ON store_orders(payment_status,created_at)"),
  ]);
  try{await env.DB.prepare("ALTER TABLE store_orders ADD COLUMN access_token TEXT").run()}catch{}
}
export async function POST(request:Request){
  await schema();
  const body=await request.json() as any;
  if(!Array.isArray(body.items)||!body.items.length)return Response.json({error:"Your cart is empty."},{status:400});
  const ids=body.items.map((x:any)=>Number(x.id)).filter(Number.isFinite);
  if(!ids.length)return Response.json({error:"Invalid cart."},{status:400});
  const placeholders=ids.map(()=>"?").join(",");
  const result=await env.DB.prepare(`SELECT * FROM catalog_products WHERE id IN (${placeholders}) AND status='active'`).bind(...ids).all<any>();
  const byId=new Map(result.results.map((p:any)=>[Number(p.id),p]));
  const items=body.items.map((x:any)=>({p:byId.get(Number(x.id)),qty:Math.max(1,Math.min(99,Math.floor(Number(x.quantity)||1)))})).filter((x:any)=>x.p);
  if(items.length!==body.items.length)return Response.json({error:"One or more products are unavailable."},{status:409});
  const subtotal=items.reduce((s:number,x:any)=>s+Number(x.p.price)*x.qty,0);
  const shipping=subtotal>=100000?0:500, tax=Math.round(subtotal*.02), total=subtotal+shipping+tax;
  const transaction=clean(body.transaction_reference,100);
  const proof=clean(body.proof_url,700);
  if(!transaction||!proof.startsWith("/api/media/payment-proofs/"))return Response.json({error:"Transaction ID and payment screenshot are required."},{status:400});
  for(const field of ["customer_name","email","phone","city","address"])if(!clean(body[field]))return Response.json({error:"Complete all required customer details."},{status:400});
  const existing=await env.DB.prepare("SELECT id FROM store_orders WHERE transaction_reference=?").bind(transaction).first();
  if(existing)return Response.json({error:"This transaction ID has already been submitted."},{status:409});
  const now=Date.now(), number=`IS-${String(now).slice(-8)}`, accessToken=crypto.randomUUID();
  const inserted=await env.DB.prepare(`INSERT INTO store_orders (order_number,access_token,customer_name,email,phone,city,postal_code,address,subtotal,shipping,tax,total,payment_method,payment_status,order_status,transaction_reference,proof_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(number,accessToken,clean(body.customer_name,120),clean(body.email,180),clean(body.phone,30),clean(body.city,80),clean(body.postal_code,20),clean(body.address,500),subtotal,shipping,tax,total,"Easypaisa","Verification Pending","Payment Pending",transaction,proof,now,now).run();
  const orderId=Number(inserted.meta.last_row_id);
  await env.DB.batch(items.map((x:any)=>env.DB.prepare("INSERT INTO order_items (order_id,product_id,title,sku,quantity,unit_price,image) VALUES (?,?,?,?,?,?,?)").bind(orderId,x.p.id,x.p.title,x.p.sku,x.qty,x.p.price,x.p.image)));
  return Response.json({order_id:orderId,order_number:number,access_token:accessToken,total,payment_status:"Verification Pending",order_status:"Payment Pending"},{status:201});
}

export async function GET(request:Request){
  await schema();
  const url=new URL(request.url),number=url.searchParams.get("order_number"),token=url.searchParams.get("token");
  if(!number||!token)return Response.json({error:"Order credentials required."},{status:400});
  const order=await env.DB.prepare("SELECT * FROM store_orders WHERE order_number=? AND access_token=?").bind(number,token).first<any>();
  if(!order)return Response.json({error:"Order not found."},{status:404});
  const items=await env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(order.id).all();
  return Response.json({order,items:items.results},{headers:{"cache-control":"no-store"}});
}

export async function PATCH(request:Request){await schema();const body=await request.json() as any;const order=await env.DB.prepare("SELECT * FROM store_orders WHERE order_number=? AND access_token=?").bind(clean(body.order_number,40),clean(body.access_token,80)).first<any>();if(!order)return Response.json({error:"Order not found."},{status:404});if(order.payment_status!=="Payment Rejected")return Response.json({error:"New proof can only be submitted for a rejected payment."},{status:409});const ref=clean(body.transaction_reference,100),proof=clean(body.proof_url,700);if(!ref||!proof.startsWith("/api/media/payment-proofs/"))return Response.json({error:"New transaction ID and screenshot are required."},{status:400});await env.DB.prepare("UPDATE store_orders SET transaction_reference=?,proof_url=?,payment_status='Verification Pending',order_status='Payment Pending',admin_note=NULL,verified_by=NULL,verified_at=NULL,updated_at=? WHERE id=?").bind(ref,proof,Date.now(),order.id).run();return Response.json({ok:true})}
