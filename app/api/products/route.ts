import { env } from "cloudflare:workers";

export async function GET() {
  try {
    const rows = await env.DB.prepare("SELECT * FROM catalog_products WHERE status='active' ORDER BY featured DESC, updated_at DESC LIMIT 500").all<Record<string,any>>();
    return Response.json({ items: rows.results.map(p=>({
      id:p.id,
      title:p.title,
      category:p.category,
      brand:p.brand,
      price:p.price,
      oldPrice:p.old_price,
      rating:p.rating,
      stock:Number(p.stock_quantity)>0,
      stockQuantity:p.stock_quantity,
      isDigital:Boolean(p.is_digital),
      image:p.image,
      images:[p.image,p.image_2,p.image_3].filter(Boolean),
      videoUrl:p.video_url||undefined,
      badge:p.badge||undefined,
      sku:p.sku,
      color:p.color||"",
      description:p.description,
    })) }, { headers:{ "cache-control":"no-store" } });
  } catch {
    return Response.json({ items:[] }, { headers:{ "cache-control":"no-store" } });
  }
}
