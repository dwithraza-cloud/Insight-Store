import { env } from "cloudflare:workers";
import { can, currentStaff } from "../staff-auth";

const imageTypes = new Set(["image/jpeg","image/png","image/webp","image/svg+xml"]);
const proofTypes = new Set(["image/jpeg","image/png","image/webp"]);
const videoTypes = new Set(["video/mp4","video/webm"]);

function identity(request:Request) {
  const host=new URL(request.url).hostname;
  return request.headers.get("oai-authenticated-user-id") || (host==="localhost"||host==="127.0.0.1" ? "local-admin" : null);
}
function safeName(name:string){return name.toLowerCase().replace(/[^a-z0-9.]+/g,"-").replace(/-+/g,"-").slice(-80)}
async function limited(request:Request){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS upload_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, updated_at INTEGER NOT NULL)`).run();
  const actor=identity(request)||request.headers.get("cf-connecting-ip")||"anonymous", bucket=`${actor}:${Math.floor(Date.now()/60000)}`;
  const current=await env.DB.prepare("SELECT count FROM upload_limits WHERE bucket=?").bind(bucket).first<any>();
  if(Number(current?.count||0)>=20)return true;
  await env.DB.prepare("INSERT INTO upload_limits (bucket,count,updated_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1,updated_at=excluded.updated_at").bind(bucket,Date.now()).run();return false;
}

export async function POST(request:Request){
  if(await limited(request))return Response.json({error:"Too many uploads. Please wait one minute."},{status:429});
  const form=await request.formData();
  const file=form.get("file");
  const kind=String(form.get("kind")||"product");
  if(!(file instanceof File)) return Response.json({error:"Choose a file to upload."},{status:400});
  const isProof=kind==="payment-proof";
  const staff=isProof?null:await currentStaff(request);
  if(!isProof && (!staff||!can(staff,"upload_media"))) return Response.json({error:"Staff media-upload permission required."},{status:403});
  const allowed=isProof?proofTypes:new Set([...imageTypes,...videoTypes]);
  const max=videoTypes.has(file.type)?50*1024*1024:5*1024*1024;
  if(!allowed.has(file.type)) return Response.json({error:"Unsupported file format."},{status:415});
  if(file.size>max) return Response.json({error:`File is larger than ${max/1024/1024} MB.`},{status:413});
  const id=crypto.randomUUID();
  const key=`${isProof?"payment-proofs":"catalog"}/${new Date().toISOString().slice(0,10)}/${id}-${safeName(file.name||"upload")}`;
  await (env as any).MEDIA.put(key,file.stream(),{httpMetadata:{contentType:file.type},customMetadata:{originalName:file.name,kind}});
  const now=Date.now();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS media_assets (id TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, width INTEGER, height INTEGER, kind TEXT NOT NULL, created_by TEXT, created_at INTEGER NOT NULL)`).run();
  await env.DB.prepare("INSERT INTO media_assets (id,object_key,original_name,mime_type,size,kind,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id,key,file.name,file.type,file.size,kind,staff?.id||null,now).run();
  return Response.json({id,url:`/api/media/${key}`,name:file.name,type:file.type,size:file.size,created_at:now},{status:201});
}

export async function GET(request:Request){
  const staff=await currentStaff(request);if(!staff) return Response.json({error:"Staff access required."},{status:403});
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS media_assets (id TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, width INTEGER, height INTEGER, kind TEXT NOT NULL, created_by TEXT, created_at INTEGER NOT NULL)`).run();
  const q=new URL(request.url).searchParams.get("q")||"";
  const rows=staff.role==="super_admin"
    ? await env.DB.prepare("SELECT * FROM media_assets WHERE original_name LIKE ? ORDER BY created_at DESC LIMIT 250").bind(`%${q}%`).all()
    : await env.DB.prepare("SELECT * FROM media_assets WHERE created_by=? AND original_name LIKE ? ORDER BY created_at DESC LIMIT 250").bind(staff.id,`%${q}%`).all();
  return Response.json({items:rows.results.map((x:any)=>({...x,url:`/api/media/${x.object_key}`}))},{headers:{"cache-control":"no-store"}});
}

export async function DELETE(request:Request){
  const staff=await currentStaff(request);if(!staff) return Response.json({error:"Staff access required."},{status:403});
  const id=new URL(request.url).searchParams.get("id");
  const row=await env.DB.prepare("SELECT object_key,created_by FROM media_assets WHERE id=?").bind(id).first<any>();
  if(!row)return Response.json({error:"Media not found."},{status:404});
  if(staff.role!=="super_admin"&&row.created_by!==staff.id)return Response.json({error:"Editors can only delete media they uploaded."},{status:403});
  await (env as any).MEDIA.delete(row.object_key);
  await env.DB.prepare("DELETE FROM media_assets WHERE id=?").bind(id).run();
  return Response.json({ok:true});
}
