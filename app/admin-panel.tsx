"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, Building2, FileText, Mail, Megaphone, MessageSquare, Package, Plus, RefreshCw, Search, Settings, ShoppingBag, Tag, Trash2, Users, X, Pencil, ExternalLink } from "lucide-react";

type Row = Record<string, any>;
type Section = "Dashboard"|"Products"|"Orders"|"Customers"|"Categories"|"Brands"|"Coupons"|"Blog"|"Messages"|"Newsletter"|"Settings";

const sections: Array<[Section, any]> = [
  ["Dashboard",BarChart3],["Products",Package],["Orders",ShoppingBag],["Customers",Users],
  ["Categories",Boxes],["Brands",Building2],["Coupons",Tag],["Blog",FileText],
  ["Messages",MessageSquare],["Newsletter",Megaphone],["Settings",Settings],
];

const entityFor = (section: Section) => section.toLowerCase() === "blog" ? "blog" : section.toLowerCase();
const money = (n: number) => `PKR ${Number(n||0).toLocaleString("en-PK")}`;

const emptyProduct = {
  title:"", slug:"", sku:"", category:"", brand:"", description:"", price:"",
  old_price:"", stock_quantity:0, image:"", image_2:"", image_3:"", video_url:"", badge:"", rating:5, status:"active", featured:false, color:"",
};

const genericFields: Record<string,string[]> = {
  orders:["title","customer","email","phone","total","payment_status","fulfillment_status"],
  customers:["name","email","phone","status","notes"],
  categories:["name","slug","description","image","status"],
  brands:["name","slug","description","image","status"],
  coupons:["code","type","value","minimum_order","usage_limit","starts_at","expires_at","status"],
  blog:["title","slug","excerpt","content","cover_image","status"],
};

async function api(entity:string, init?:RequestInit, id?:number|string) {
  const response = await fetch(`/api/admin?entity=${encodeURIComponent(entity)}${id != null ? `&id=${id}` : ""}`, {
    ...init, headers: { "content-type":"application/json", ...(init?.headers||{}) }, cache:"no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function AdminPanel({ seedProducts, setToast }: { seedProducts:Row[]; setToast:(message:string)=>void }) {
  const [view,setView] = useState<Section>("Dashboard");
  const [items,setItems] = useState<Row[]>([]);
  const [loading,setLoading] = useState(true);
  const [query,setQuery] = useState("");
  const [editor,setEditor] = useState<Row|null>(null);
  const [remove,setRemove] = useState<Row|null>(null);
  const [admin,setAdmin] = useState<Row|null>(null);
  const [counts,setCounts] = useState<Record<string,number>>({});

  const load = async(section=view) => {
    setLoading(true);
    try {
      const entity=entityFor(section);
      if(section==="Dashboard") {
        const names=["products","orders","customers","messages","newsletter"];
        const results=await Promise.all(names.map(n=>api(n)));
        setCounts(Object.fromEntries(names.map((n,i)=>[n,results[i].items.length])));
        setItems(results[1].items.slice(0,6));
        setAdmin(results[0].admin);
      } else {
        const data=await api(entity);
        setItems(data.items); setAdmin(data.admin);
      }
    } catch(error:any) { setToast(error.message); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ (async()=>{
    try { await api("products",{method:"POST",body:JSON.stringify({action:"seed",items:seedProducts})}); }
    catch {}
    await load(view);
  })(); },[view]);

  const openNew=()=>setEditor(view==="Products"?{...emptyProduct}:Object.fromEntries((genericFields[entityFor(view)]||["title","status"]).map(k=>[k,k==="status"?"active":""])));
  const visibleItems=useMemo(()=>query?items.filter(row=>JSON.stringify(row).toLowerCase().includes(query.toLowerCase())):items,[items,query]);
  const submit=async(data:Row)=>{
    try {
      const entity=entityFor(view);
      await api(entity,{method:data.id?"PATCH":"POST",body:JSON.stringify(data)},data.id);
      setEditor(null); setToast(data.id?"Changes saved":"Record created"); await load();
    } catch(error:any){setToast(error.message);}
  };
  const confirmDelete=async()=>{
    if(!remove)return;
    try{await api(entityFor(view),{method:"DELETE"},remove.id);setRemove(null);setToast("Record deleted");await load();}
    catch(error:any){setToast(error.message);}
  };

  return <div className="admin functional-admin">
    <aside>
      <img src="/insight-store-logo.png" alt="Insight Store"/>
      <small>STORE ADMIN</small>
      {sections.map(([label,Icon])=><button className={view===label?"active":""} key={label} onClick={()=>{setView(label);setQuery("");setEditor(null)}}><span><Icon size={18}/>{label}</span><b>›</b></button>)}
      <a href="/"><ExternalLink size={16}/> View storefront</a>
    </aside>
    <main>
      <header><div><small>INSIGHT STORE</small><h1>{view}</h1></div><button aria-label="Refresh" onClick={()=>load()}><RefreshCw size={18}/></button><b>{admin?.name||admin?.email||"Admin User"}</b></header>
      {view==="Dashboard" ? <Dashboard counts={counts} orders={items} loading={loading} go={setView}/> :
       view==="Settings" ? <SettingsPanel setToast={setToast}/> :
       <section className="admin-table admin-crud">
        <div className="admin-toolbar"><div><h2>{view} management</h2><p>Persistent records connected to the Insight Store database.</p></div>
          {!["Messages","Newsletter"].includes(view)&&<button className="primary" onClick={openNew}><Plus size={17}/> Add {view==="Blog"?"post":view.slice(0,-1).toLowerCase()}</button>}
        </div>
        <div className="admin-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} placeholder={`Search ${view.toLowerCase()}`}/><button onClick={()=>load()}>Search</button></div>
        {loading?<div className="admin-state">Loading {view.toLowerCase()}…</div>:visibleItems.length?<EntityTable section={view} items={visibleItems} edit={setEditor} remove={setRemove} reload={load} setToast={setToast}/>:<div className="admin-state"><Package size={38}/><h3>No {view.toLowerCase()} found</h3><p>Create a record or change your search.</p></div>}
      </section>}
    </main>
    {editor&&<EditorModal section={view} initial={editor} close={()=>setEditor(null)} submit={submit}/>}
    {remove&&<ConfirmModal row={remove} close={()=>setRemove(null)} confirm={confirmDelete}/>}
  </div>;
}

function Dashboard({counts,orders,loading,go}:any){
  const cards=[["Products",counts.products||0,"Products"],["Orders",counts.orders||0,"Orders"],["Customers",counts.customers||0,"Customers"],["Unread messages",counts.messages||0,"Messages"]];
  return <>{loading?<div className="admin-state">Loading dashboard…</div>:<><div className="admin-stats">{cards.map(([label,value,target])=><article key={label} onClick={()=>go(target)}><span>{label}</span><b>{value}</b><small>View management →</small></article>)}</div><div className="chart-card"><h2>Store operations</h2><div className="admin-metrics"><div><b>{counts.newsletter||0}</b><span>Newsletter subscribers</span></div><div><b>{counts.products||0}</b><span>Catalogue items</span></div><div><b>{counts.orders||0}</b><span>Recorded orders</span></div></div></div><section className="admin-table"><div><h2>Recent orders</h2><button onClick={()=>go("Orders")}>View all</button></div>{orders.length?<SimpleRows items={orders}/>:<p className="admin-state">No orders have been recorded yet.</p>}</section></>}</>;
}

function EntityTable({section,items,edit,remove,reload,setToast}:any){
  if(section==="Products")return <div className="table-scroll"><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((p:Row)=><tr key={p.id}><td><img src={p.image||"/images/category-electronics.png"} alt=""/><b>{p.title}</b></td><td>{p.sku}</td><td>{p.category}</td><td>{money(p.price)}</td><td>{p.stock_quantity}</td><td><span className={p.status==="active"?"green":"pill"}>{p.status}</span></td><td><button onClick={()=>edit({...p,featured:!!p.featured})}><Pencil size={15}/> Edit</button><button className="danger" onClick={()=>remove(p)}><Trash2 size={15}/> Delete</button></td></tr>)}</tbody></table></div>;
  if(section==="Messages")return <div className="table-scroll"><table><thead><tr><th>Sender</th><th>Subject</th><th>Message</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((m:Row)=><tr key={m.id}><td><b>{m.name}</b><small>{m.email}</small></td><td>{m.subject}</td><td>{String(m.message).slice(0,80)}</td><td>{m.status}</td><td><button onClick={async()=>{await api("messages",{method:"PATCH",body:JSON.stringify({status:m.status==="Read"?"New":"Read"})},m.id);setToast("Message status updated");reload()}}>{m.status==="Read"?"Mark new":"Mark read"}</button><button className="danger" onClick={()=>remove(m)}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>;
  if(section==="Newsletter")return <div className="table-scroll"><table><thead><tr><th>Email</th><th>Subscribed</th><th>Actions</th></tr></thead><tbody>{items.map((m:Row)=><tr key={m.id}><td><Mail size={16}/> {m.email}</td><td>{new Date(m.created_at).toLocaleDateString()}</td><td><button className="danger" onClick={()=>remove(m)}><Trash2 size={15}/> Remove</button></td></tr>)}</tbody></table></div>;
  return <div className="table-scroll"><table><thead><tr><th>Name / title</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{items.map((r:Row)=><tr key={r.id}><td><b>{r.title||r.name||r.code||r.email}</b><small>{r.description||r.excerpt||r.customer||""}</small></td><td><span className="pill">{r.status||"active"}</span></td><td>{new Date(r.updated_at||r.created_at).toLocaleDateString()}</td><td><button onClick={()=>edit(r)}><Pencil size={15}/> Edit</button><button className="danger" onClick={()=>remove(r)}><Trash2 size={15}/> Delete</button></td></tr>)}</tbody></table></div>;
}

function SimpleRows({items}:any){return <div className="table-scroll"><table><thead><tr><th>Record</th><th>Status</th><th>Date</th></tr></thead><tbody>{items.map((r:Row)=><tr key={r.id}><td><b>{r.title||r.order_number||`#${r.id}`}</b></td><td>{r.status}</td><td>{new Date(r.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>}

function EditorModal({section,initial,close,submit}:any){
  const [form,setForm]=useState<Row>({...initial});
  const [saving,setSaving]=useState(false);
  const entity=entityFor(section);
  const fields=section==="Products"?["title","slug","sku","category","brand","description","price","old_price","stock_quantity","image","image_2","image_3","video_url","badge","rating","color","status","featured"]:(genericFields[entity]||["title","status"]);
  const save=async(e:FormEvent)=>{e.preventDefault();if(section==="Products"&&!String(form.image||"").trim())return;setSaving(true);await submit(form);setSaving(false)};
  return <div className="modal-backdrop"><form className="admin-editor" onSubmit={save}><header><div><small>{form.id?"EDIT":"NEW"} RECORD</small><h2>{form.id?`Edit ${form.title||form.name||form.code}`:`Add ${section}`}</h2></div><button type="button" onClick={close} aria-label="Close"><X/></button></header><div className="admin-form-grid">{fields.map(name=>{
    if(name==="featured")return <label className="admin-check" key={name}><input type="checkbox" checked={!!form[name]} onChange={e=>setForm({...form,[name]:e.target.checked})}/> Featured product</label>;
    if(name==="status")return <label key={name}>Status<select value={form[name]||"active"} onChange={e=>setForm({...form,[name]:e.target.value})}><option>active</option><option>draft</option><option>archived</option></select></label>;
    const multiline=["description","content","excerpt","notes"].includes(name);
    const numeric=["price","old_price","stock_quantity","rating","total","value","minimum_order","usage_limit"].includes(name);
    const label=name==="image"?"image 1 (required)":name==="image_2"?"image 2 (optional)":name==="image_3"?"image 3 (optional)":name==="video_url"?"product video (optional)":name.replaceAll("_"," ");
    return <label className={multiline?"wide":""} key={name}>{label}{multiline?<textarea rows={name==="content"?8:4} value={form[name]||""} onChange={e=>setForm({...form,[name]:e.target.value})}/>:<input required={["title","name","sku","code","image"].includes(name)} placeholder={name.startsWith("image")||name==="video_url"?"Paste a public media URL":""} type={numeric?"number":name.includes("email")?"email":"text"} value={form[name]??""} onChange={e=>setForm({...form,[name]:numeric?e.target.value:e.target.value})}/>}</label>
  })}</div><footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving?"Saving…":"Save changes"}</button></footer></form></div>;
}

function ConfirmModal({row,close,confirm}:any){return <div className="modal-backdrop"><div className="confirm-card"><Trash2 size={30}/><h2>Delete this record?</h2><p><b>{row.title||row.name||row.code||row.email||`Record #${row.id}`}</b> will be permanently removed. This action cannot be undone.</p><div><button onClick={close}>Cancel</button><button className="danger-solid" onClick={confirm}>Delete permanently</button></div></div></div>}

function SettingsPanel({setToast}:any){
  const [form,setForm]=useState({store_name:"Insight Store",support_phone:"03145338340",email:"hello@insightstore.pk",address:"Gulberg III, Lahore, Pakistan",currency:"PKR",delivery_fee:250,free_delivery_threshold:5000});
  const [saving,setSaving]=useState(false);
  useEffect(()=>{api("settings").then((d:any)=>{const general=d.items.find((x:Row)=>x.key==="general");if(general?.value)setForm(f=>({...f,...general.value}))}).catch(()=>{})},[]);
  const save=async(e:FormEvent)=>{e.preventDefault();setSaving(true);try{await api("settings",{method:"POST",body:JSON.stringify({key:"general",value:form})});setToast("Store settings saved")}catch(e:any){setToast(e.message)}finally{setSaving(false)}};
  return <form className="settings-card" onSubmit={save}><h2>General store settings</h2><p>These values persist in the store database.</p><div className="admin-form-grid">{Object.entries(form).map(([k,v])=><label key={k}>{k.replaceAll("_"," ")}<input value={v} type={typeof v==="number"?"number":"text"} onChange={e=>setForm({...form,[k]:typeof v==="number"?Number(e.target.value):e.target.value})}/></label>)}</div><button className="primary" disabled={saving}>{saving?"Saving…":"Save settings"}</button></form>;
}
