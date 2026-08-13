import { env } from "cloudflare:workers";

export async function GET(request:Request,{params}:{params:Promise<{key:string[]}>}){
  const {key}=await params;
  const object=await (env as any).MEDIA.get(key.join("/"));
  if(!object)return new Response("Not found",{status:404});
  const headers=new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag",object.httpEtag);
  headers.set("cache-control","public, max-age=31536000, immutable");
  headers.set("x-content-type-options","nosniff");
  return new Response(object.body,{headers});
}
