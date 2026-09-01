import { env } from "cloudflare:workers";

export type StaffUser = {
  id: string; email: string; name: string; role: "super_admin"|"editor"; status: string;
  permissions: Record<string, boolean>;
};

const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
const randomToken = () => crypto.randomUUID().replaceAll("-","") + crypto.randomUUID().replaceAll("-","");
const sha256 = async(value:string) => hex(await crypto.subtle.digest("SHA-256",encoder.encode(value)));

async function passwordHash(password:string,salt:string){
  const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:encoder.encode(salt),iterations:120000},key,256));
}

export async function ensureStaffSchema(){
  const db=env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS staff_users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
      password_hash TEXT, password_salt TEXT, role TEXT NOT NULL DEFAULT 'editor', status TEXT NOT NULL DEFAULT 'active',
      permissions_json TEXT NOT NULL DEFAULT '{}', last_login_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS staff_sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS staff_invitations (
      id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE, token_hash TEXT NOT NULL UNIQUE,
      permissions_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'pending', invited_by TEXT NOT NULL,
      expires_at INTEGER NOT NULL, accepted_at INTEGER, created_at INTEGER NOT NULL
    )`),
  ]);
  for(const sql of [
    "ALTER TABLE catalog_products ADD COLUMN owner_user_id TEXT",
    "ALTER TABLE catalog_products ADD COLUMN created_by_email TEXT",
  ]){try{await db.prepare(sql).run()}catch{}}
}

function cookie(request:Request,name:string){
  const raw=request.headers.get("cookie")||"";
  return raw.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${name}=`))?.slice(name.length+1)||"";
}

export async function currentStaff(request:Request):Promise<StaffUser|null>{
  await ensureStaffSchema();
  const token=cookie(request,"insight_staff_session");
  if(token){
    const hash=await sha256(token);
    const row=await env.DB.prepare(`SELECT u.* FROM staff_sessions s JOIN staff_users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'`).bind(hash,Date.now()).first<any>();
    if(row)return {...row,permissions:JSON.parse(row.permissions_json||"{}")};
  }
  const platformId=request.headers.get("oai-authenticated-user-id");
  const platformEmail=request.headers.get("oai-authenticated-user-email")?.toLowerCase();
  if(platformId&&platformEmail){
    const count=await env.DB.prepare("SELECT COUNT(*) count FROM staff_users").first<any>();
    if(!count?.count){
      const now=Date.now();
      await env.DB.prepare("INSERT INTO staff_users (id,email,name,role,status,permissions_json,created_at,updated_at) VALUES (?,?,?,'super_admin','active','{}',?,?)")
        .bind(platformId,platformEmail,platformEmail.split("@")[0],now,now).run();
    }
    const row=await env.DB.prepare("SELECT * FROM staff_users WHERE (id=? OR email=?) AND status='active'").bind(platformId,platformEmail).first<any>();
    if(row)return {...row,permissions:JSON.parse(row.permissions_json||"{}")};
  }
  const host=new URL(request.url).hostname;
  if(host==="localhost"||host==="127.0.0.1"){
    const row=await env.DB.prepare("SELECT * FROM staff_users WHERE role='super_admin' AND status='active' ORDER BY created_at LIMIT 1").first<any>();
    if(row)return {...row,permissions:JSON.parse(row.permissions_json||"{}")};
    const now=Date.now(),id="local-admin";
    await env.DB.prepare("INSERT OR IGNORE INTO staff_users (id,email,name,role,status,permissions_json,created_at,updated_at) VALUES (?,?,?,'super_admin','active','{}',?,?)")
      .bind(id,"admin@localhost","Store Admin",now,now).run();
    return {id,email:"admin@localhost",name:"Store Admin",role:"super_admin",status:"active",permissions:{}};
  }
  return null;
}

export const can=(user:StaffUser,permission:string)=>user.role==="super_admin"||user.permissions[permission]===true;
export const ownsProduct=(user:StaffUser,row:any)=>user.role==="super_admin"||String(row?.owner_user_id||"")===String(user.id);

export async function createSession(userId:string){
  const token=randomToken(),now=Date.now(),expires=now+30*24*60*60*1000;
  await env.DB.prepare("INSERT INTO staff_sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(),userId,await sha256(token),expires,now).run();
  return {token,expires};
}

export async function login(email:string,password:string){
  await ensureStaffSchema();
  const row=await env.DB.prepare("SELECT * FROM staff_users WHERE email=? AND status='active'").bind(email.trim().toLowerCase()).first<any>();
  if(!row?.password_hash||!row?.password_salt)return null;
  if(await passwordHash(password,row.password_salt)!==row.password_hash)return null;
  await env.DB.prepare("UPDATE staff_users SET last_login_at=?,updated_at=? WHERE id=?").bind(Date.now(),Date.now(),row.id).run();
  return {...row,permissions:JSON.parse(row.permissions_json||"{}")};
}

export async function acceptInvitation(token:string,name:string,password:string){
  await ensureStaffSchema();
  const invitation=await env.DB.prepare("SELECT * FROM staff_invitations WHERE token_hash=? AND status='pending' AND expires_at>?")
    .bind(await sha256(token),Date.now()).first<any>();
  if(!invitation)return null;
  if(password.length<8)throw new Error("Password must contain at least 8 characters.");
  const now=Date.now(),id=crypto.randomUUID(),salt=randomToken().slice(0,32),hash=await passwordHash(password,salt);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO staff_users (id,email,name,password_hash,password_salt,role,status,permissions_json,created_at,updated_at)
      VALUES (?,?,?,?,?,'editor','active',?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,password_hash=excluded.password_hash,password_salt=excluded.password_salt,role='editor',status='active',permissions_json=excluded.permissions_json,updated_at=excluded.updated_at`)
      .bind(id,invitation.email,name.trim(),hash,salt,invitation.permissions_json,now,now),
    env.DB.prepare("UPDATE staff_invitations SET status='accepted',accepted_at=? WHERE id=?").bind(now,invitation.id),
  ]);
  return await env.DB.prepare("SELECT * FROM staff_users WHERE email=?").bind(invitation.email).first<any>();
}

export async function createInvitation(email:string,permissions:Record<string,boolean>,invitedBy:string){
  await ensureStaffSchema();
  const token=randomToken(),now=Date.now(),id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO staff_invitations (id,email,token_hash,permissions_json,status,invited_by,expires_at,created_at)
    VALUES (?,?,?,?, 'pending',?,?,?)`).bind(id,email.trim().toLowerCase(),await sha256(token),JSON.stringify(permissions),invitedBy,now+7*24*60*60*1000,now).run();
  return {id,token};
}

export const sessionCookie=(token:string,expires:number)=>`insight_staff_session=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expires).toUTCString()}`;
export const clearSessionCookie=()=>"insight_staff_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
export async function revokeSession(request:Request){const token=cookie(request,"insight_staff_session");if(token)await env.DB.prepare("DELETE FROM staff_sessions WHERE token_hash=?").bind(await sha256(token)).run()}
