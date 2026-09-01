import { acceptInvitation, clearSessionCookie, createSession, currentStaff, login, revokeSession, sessionCookie } from "../staff-auth";

const reply=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{"cache-control":"no-store",...headers}});

export async function GET(request:Request){
  const user=await currentStaff(request);
  return user?reply({user:{id:user.id,email:user.email,name:user.name,role:user.role,permissions:user.permissions}}):reply({user:null},401);
}

export async function POST(request:Request){
  try{
    const body=await request.json() as any;
    if(body.action==="login"){
      const user=await login(String(body.email||""),String(body.password||""));
      if(!user)return reply({error:"Invalid email or password, or this staff account is inactive."},401);
      const session=await createSession(user.id);
      return reply({user:{id:user.id,email:user.email,name:user.name,role:user.role,permissions:user.permissions}},200,{"set-cookie":sessionCookie(session.token,session.expires)});
    }
    if(body.action==="accept-invite"){
      const user=await acceptInvitation(String(body.token||""),String(body.name||""),String(body.password||""));
      if(!user)return reply({error:"This invitation is invalid or has expired."},400);
      const session=await createSession(user.id);
      return reply({user:{id:user.id,email:user.email,name:user.name,role:user.role,permissions:JSON.parse(user.permissions_json||"{}")}},201,{"set-cookie":sessionCookie(session.token,session.expires)});
    }
    return reply({error:"Unknown authentication action."},400);
  }catch(error:any){return reply({error:error?.message||"Unable to authenticate."},400)}
}

export async function DELETE(request:Request){await revokeSession(request);return reply({ok:true},200,{"set-cookie":clearSessionCookie()})}
