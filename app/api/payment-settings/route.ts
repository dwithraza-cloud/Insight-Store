import { env } from "cloudflare:workers";

const defaults={payment_method_name:"Easypaisa",account_holder_name:"Insight Store",easypaisa_number:"03145338340",payment_instructions:"Send the exact total to this Easypaisa account, then enter your transaction ID and upload the payment screenshot.",payment_enabled:"yes"};
export async function GET(){
  try{
    const row=await env.DB.prepare("SELECT value_json FROM store_settings WHERE key='general'").first<any>();
    const stored=row?.value_json?JSON.parse(row.value_json):{};
    return Response.json({...defaults,...Object.fromEntries(Object.keys(defaults).map(k=>[k,stored[k]??(defaults as any)[k]]))},{headers:{"cache-control":"no-store"}});
  }catch{return Response.json(defaults,{headers:{"cache-control":"no-store"}})}
}
