import { env } from "cloudflare:workers";
import { createInvitation, currentStaff, ensureStaffSchema } from "../staff-auth";

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store"}});
async function superAdmin(request:Request){const user=await currentStaff(request);return user?.role==="super_admin"?user:null}

export async function GET(request:Request){
  const admin=await superAdmin(request);if(!admin)return json({error:"Super admin access required."},403);
  await ensureStaffSchema();
  const users=await env.DB.prepare("SELECT id,email,name,role,status,permissions_json,last_login_at,created_at FROM staff_users ORDER BY created_at DESC").all<any>();
  const invites=await env.DB.prepare("SELECT id,email,permissions_json,status,expires_at,created_at FROM staff_invitations ORDER BY created_at DESC LIMIT 100").all<any>();
  return json({items:users.results.map(x=>({...x,permissions:JSON.parse(x.permissions_json||"{}")})),invitations:invites.results.map(x=>({...x,permissions:JSON.parse(x.permissions_json||"{}")})),admin});
}

export async function POST(request:Request){
  const admin=await superAdmin(request);if(!admin)return json({error:"Super admin access required."},403);
  try{
    const body=await request.json() as any,email=String(body.email||"").trim().toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw new Error("Enter a valid editor email address.");
    const existing=await env.DB.prepare("SELECT id FROM staff_users WHERE email=?").bind(email).first();
    if(existing)throw new Error("A staff account already exists for this email.");
    const permissions={create_products:true,edit_own_products:true,delete_own_products:true,upload_media:true,...(body.permissions||{})};
    const invite=await createInvitation(email,permissions,admin.id);
    const origin=new URL(request.url).origin;
    return json({ok:true,invite_url:`${origin}/accept-invite?token=${encodeURIComponent(invite.token)}`},201);
  }catch(error:any){return json({error:error?.message||"Unable to create invitation."},400)}
}

export async function PATCH(request:Request){
  const admin=await superAdmin(request);if(!admin)return json({error:"Super admin access required."},403);
  const body=await request.json() as any,id=String(body.id||"");
  if(!id||id===admin.id)return json({error:"This staff account cannot be changed here."},400);
  const status=body.status==="disabled"?"disabled":"active";
  await env.DB.prepare("UPDATE staff_users SET status=?,permissions_json=?,updated_at=? WHERE id=? AND role='editor'")
    .bind(status,JSON.stringify(body.permissions||{}),Date.now(),id).run();
  return json({ok:true});
}

export async function DELETE(request:Request){
  const admin=await superAdmin(request);if(!admin)return json({error:"Super admin access required."},403);
  const id=new URL(request.url).searchParams.get("id");if(!id||id===admin.id)return json({error:"Invalid staff account."},400);
  await env.DB.batch([
    env.DB.prepare("UPDATE staff_users SET status='disabled',updated_at=? WHERE id=? AND role='editor'").bind(Date.now(),id),
    env.DB.prepare("DELETE FROM staff_sessions WHERE user_id=?").bind(id),
  ]);
  return json({ok:true});
}
