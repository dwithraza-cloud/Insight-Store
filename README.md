# Insight Store

A responsive full-stack ecommerce storefront inspired by the supplied Nexmart references and rebranded with the supplied Insight Store identity.

## Included

- Responsive home, shop, product, about, blog, contact, authentication, cart, checkout, wishlist, compare, account, admin and 404 views
- Product search suggestions, filters, sorting, quick view, persistent guest cart, wishlist and comparison
- D1-backed contact messages and newsletter subscribers
- Customer and admin dashboard experiences
- Accessible controls, mobile navigation, loading-friendly imagery and reduced-motion support

## Local development

Install dependencies, copy `.env.example` to `.env`, then run the development script. The Sites/Vinext runtime provisions a local D1 binding from `.openai/hosting.json`.

## Production configuration

Set real SMTP, OAuth and payment credentials in the hosting environment. Replace the example metadata URL in `app/layout.tsx` with the production domain. Admin and customer identity should use the hosting platform authentication policy before accepting real orders.
