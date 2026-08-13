# Insight Store — Complete Functional Admin Panel Implementation Prompt

You are working inside the existing **Insight Store** full-stack e-commerce project. Upgrade the existing admin panel from a visual demo into a complete, secure, persistent, production-ready administration system.

## Non-negotiable instructions

- Preserve the current storefront, routes, Insight Store branding, Poppins/Roboto typography, navy/blue/cyan palette, generated category imagery, and responsive design.
- Preserve the current Vinext/React/TypeScript architecture and Cloudflare Sites compatibility.
- Do not create fake buttons, placeholder screens, alert-only actions, toast-only actions, or temporary in-memory CRUD.
- Every visible control must perform its real intended action.
- Every create, update, delete, status change, setting, and uploaded image must persist after refresh and across devices.
- Use the existing Cloudflare D1 binding named `DB` for relational data.
- Add an R2 binding for product, category, brand, blog, and settings media uploads if one is not already configured.
- Never store passwords or secrets in frontend code, localStorage, Git, or public environment variables.
- Add accessible labels, loading states, empty states, validation messages, error states, success feedback, confirmations, keyboard support, and responsive layouts.
- Use professional Lucide icons only.
- Keep admin typography consistent: Poppins for headings/actions and Roboto for body/forms/tables.

## Current audited problems to replace

1. **Products**
   - “Add product” only displays a toast.
   - “Edit” only displays a toast.
   - “Delete” only removes an item from temporary React state and returns after refresh.
   - Products are hard-coded in the frontend source.
2. **Dashboard**
   - Revenue, order, customer, low-stock, chart, and recent-order data are hard-coded.
3. **Orders, Customers, Categories, Brands, Coupons, Blog, Messages, Newsletter, Settings**
   - These sections all show the same generic placeholder and fake “Create new” action.
4. **Authentication**
   - `/admin` has no real admin authorization guard.
5. **Storefront integration**
   - Admin changes are not connected to the public product catalogue, category pages, search, prices, stock, banners, blog, checkout, or contact/newsletter data.

## Architecture and data layer

Create D1 migrations and typed repository/service functions for these entities:

### Admin users and audit

- `admin_users`: id, authenticated_user_id, email, name, role, active, created_at, updated_at.
- Roles: `super_admin`, `manager`, `catalog_manager`, `order_manager`, `content_manager`, `support_agent`.
- `audit_logs`: id, admin_user_id, action, entity_type, entity_id, summary, metadata_json, ip_hash, created_at.
- Use the authenticated Sites/ChatGPT user identity from trusted request headers.
- Allow access only when that identity exists in `admin_users` and `active = 1`.
- Unauthorized users must receive a proper 403 page and APIs must independently enforce authorization.
- Implement permission checks per role, not only hidden buttons.

### Catalogue

- `categories`: id, name, slug unique, description, image_url, icon_key, sort_order, active, created_at, updated_at.
- `brands`: id, name, slug unique, description, logo_url, active, created_at, updated_at.
- `products`: id, title, slug unique, sku unique, description, short_description, category_id, brand_id, price, compare_at_price, cost_price, stock_quantity, low_stock_threshold, status, featured, badge, color, specifications_json, seo_title, seo_description, created_at, updated_at.
- `product_images`: id, product_id, image_url, alt_text, sort_order, is_primary, created_at.
- Product status: `draft`, `active`, `archived`.
- Add safe foreign-key behavior. Prevent deletion of a category/brand that is in use unless products are reassigned.

### Commerce

- `customers`: id, name, email unique, phone, status, total_orders, total_spent, created_at, updated_at.
- `orders`: id, order_number unique, customer_id nullable, customer_name, email, phone, shipping_address_json, billing_address_json, subtotal, discount, delivery_fee, total, payment_method, payment_status, fulfillment_status, notes, created_at, updated_at.
- `order_items`: id, order_id, product_id nullable, sku, title, unit_price, quantity, line_total.
- `order_status_history`: id, order_id, status_type, from_status, to_status, note, admin_user_id, created_at.
- Payment statuses: `pending`, `paid`, `failed`, `refunded`.
- Fulfillment statuses: `new`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`, `returned`.

### Promotions and content

- `coupons`: id, code unique, type, value, minimum_order, maximum_discount, usage_limit, per_customer_limit, starts_at, expires_at, active, created_at, updated_at.
- Coupon type: `percentage` or `fixed`.
- `blog_posts`: id, title, slug unique, excerpt, content, cover_image_url, author_name, status, published_at, seo_title, seo_description, created_at, updated_at.
- Blog status: `draft`, `published`, `archived`.
- Keep and integrate the existing `contact_messages` and `newsletter_subscribers` tables.
- Add message status: `new`, `read`, `replied`, `closed`.
- Add subscriber status: `subscribed`, `unsubscribed`.

### Store configuration

- `store_settings`: key primary key, value_json, updated_by, updated_at.
- Support store name, logo, support phone `03145338340`, email, addresses, currency `PKR`, delivery fee, free-delivery threshold, social links, SEO defaults, low-stock default, order notification preference, and homepage visibility controls.

## Required admin pages and functionality

Use real route-addressable admin pages such as:

- `/admin`
- `/admin/products`
- `/admin/products/new`
- `/admin/products/:id/edit`
- `/admin/orders`
- `/admin/orders/:id`
- `/admin/customers`
- `/admin/customers/:id`
- `/admin/categories`
- `/admin/brands`
- `/admin/coupons`
- `/admin/blog`
- `/admin/blog/new`
- `/admin/blog/:id/edit`
- `/admin/messages`
- `/admin/newsletter`
- `/admin/settings`
- `/admin/audit-log` for super admins.

### Dashboard

- Fetch live totals from D1.
- Date-range selector: today, 7 days, 30 days, 12 months, custom range.
- Show revenue, orders, average order value, customers, low-stock items, top products, order-status breakdown, recent orders, recent messages, and newsletter growth.
- Charts must use real query results and sensible empty states.
- Every summary card should link to its relevant filtered page.

### Products

- Paginated searchable table with filters for category, brand, status, stock, featured, and price.
- Sort by title, price, stock, created date, and updated date.
- Create/edit form fields for all product columns.
- Upload multiple images; select primary image; reorder and delete images.
- Validate unique SKU/slug, non-negative pricing, compare price logic, required title/category, and stock quantity.
- Auto-generate a slug but allow editing.
- Specifications editor as repeatable key/value rows.
- Save draft, publish, archive, duplicate product, and preview storefront product.
- Persist create/update/delete through authenticated APIs.
- Delete must show a confirmation containing the product name and explain the impact.
- Prefer soft deletion/archive for products referenced by orders.
- Support bulk publish, archive, category change, stock update, and deletion.
- Update the public storefront immediately after successful changes.

### Orders

- Search by order number, customer, email, and phone.
- Filter by date, fulfillment status, payment status, and payment method.
- Detail view with items, amounts, addresses, customer, timeline, and notes.
- Change payment and fulfillment status with confirmation.
- Add internal notes and status-history entries.
- Print-friendly invoice and packing slip.
- Export filtered orders as CSV.
- Prevent invalid transitions where appropriate.
- Order totals and historical product values must not change when a product is later edited.

### Customers

- Search, filter, paginate, view customer details and order history.
- Edit name, phone, email, and status.
- Show total orders, total spent, average order value, first order, and last order.
- Allow admin notes.
- Customer deletion should anonymize personally identifying data when order history must be retained.

### Categories

- Create, edit, activate/deactivate, reorder, upload category image, select icon, and set description/slug.
- Show product count.
- Prevent unsafe deletion when products use the category; offer reassignment.
- Changes must update storefront navigation, category cards, filters, and banners where used.

### Brands

- Full create/edit/delete with name, slug, description, logo, active status, and product count.
- Prevent unsafe deletion or offer product reassignment.

### Coupons

- Full CRUD with live validation.
- Show usage count, validity dates, status, and restrictions.
- Checkout must validate coupons server-side, calculate the discount safely, and record usage.
- Expired, disabled, over-limit, and invalid coupons must be rejected with clear messages.

### Blog

- Full CRUD with draft/publish/archive workflow.
- Rich content editor with safe HTML handling or structured blocks.
- Cover image upload, excerpt, slug, SEO title/description, publish date, and preview.
- Published changes must appear on the public blog.

### Messages

- Read real records from `contact_messages`.
- Search/filter by status/date.
- Open full message detail; mark read/unread; close; delete with confirmation.
- Add internal notes.
- “Reply” should open a prepared `mailto:` action unless a real email provider is configured; do not claim email was sent when it was not.
- Show an unread badge in the admin navigation.

### Newsletter

- List real subscribers with search, status, subscribed date, and pagination.
- Add/import subscribers with validation and duplicate handling.
- Unsubscribe/reactivate and delete with confirmation.
- Export filtered subscribers as CSV.
- Do not add fake campaign sending unless an email service is actually connected.

### Settings

- Functional forms grouped into General, Contact, Commerce, Delivery, Social, SEO, Homepage, and Admin Users.
- Save each group independently with validation.
- Logo/media changes must persist in R2 and update the storefront.
- Super admin can invite/allowlist admin identities, assign roles, deactivate access, and review audit logs.

## API requirements

Implement authenticated, validated endpoints for every entity using consistent conventions:

- `GET /api/admin/<entity>` for filtered/paginated lists.
- `POST /api/admin/<entity>` for creation.
- `GET /api/admin/<entity>/:id` for detail.
- `PATCH /api/admin/<entity>/:id` for updates.
- `DELETE /api/admin/<entity>/:id` for deletion/archive.
- Dedicated endpoints for bulk actions, uploads, exports, order status transitions, and settings.
- Return structured JSON errors with appropriate HTTP status codes.
- Validate and normalize all server inputs. Never trust prices, totals, roles, filenames, MIME types, or IDs from the browser.
- Use parameterized D1 queries and database transactions for multi-table writes.
- Add pagination limits and protect against unbounded list requests.
- Record all material mutations in `audit_logs`.

## Media uploads

- Configure a private R2 bucket with a logical binding such as `MEDIA`.
- Validate file type, extension, MIME signature, and maximum size.
- Accept JPEG, PNG, and WebP only unless SVG sanitization is explicitly implemented.
- Generate collision-safe object keys.
- Store only object references/served URLs in D1.
- Delete replaced media only after the database update succeeds and only when no other record uses it.
- Provide upload progress, preview, alt text, primary image selection, and graceful failures.

## UX and responsive behavior

- Preserve the existing high-quality admin visual style.
- Desktop: fixed/collapsible sidebar, sticky toolbar where useful, readable tables.
- Mobile/tablet: drawer sidebar, card-based table alternatives or safe horizontal scrolling, touch-sized controls, responsive forms and modals.
- Use reusable modal/drawer/form/table/pagination/filter/confirmation components.
- Disable submit while saving and prevent duplicate requests.
- Prompt before navigating away from unsaved forms.
- Keep filters and pagination in URL query parameters.
- Show skeletons/spinners only while genuinely loading.
- Use clear empty states with useful actions.
- Never use native browser `alert()`, `confirm()`, or `prompt()`.

## Storefront integration

- Replace the hard-coded frontend catalogue with data from D1.
- Category, brand, price, availability, product images, search, detail pages, related products, and badges must use current database values.
- Checkout must create real orders and order items in D1 using server-calculated totals.
- Customer-facing stock must update from admin inventory.
- Published blog posts, settings, phone number, homepage controls, and category visibility must update from admin changes.
- Avoid exposing drafts, archived products/posts, inactive categories, or internal cost prices publicly.

## Seed and migration strategy

- Write idempotent migrations.
- Migrate/seed all current Insight Store products, eight requested catalogue categories, blog samples, settings, and existing demo orders into D1 without duplicates.
- Preserve the generated category images and three category hero banners already present in the project.
- Add one documented initial super-admin bootstrap mechanism based on an authenticated user email or user ID supplied through a secure server-side environment variable or one-time migration input.
- Do not hard-code a universal admin password.

## Testing and verification

Complete all of these before declaring success:

1. Build passes with no TypeScript or Vinext errors.
2. Unauthorized user cannot access admin UI or any admin API.
3. Authorized role permissions are enforced server-side.
4. Create a product with multiple images; confirm it appears on storefront and remains after refresh.
5. Edit its title, price, stock, category, description, and image; confirm storefront updates.
6. Archive/delete it; confirm storefront behavior and referential integrity.
7. Create/edit/reorder/deactivate a category and confirm storefront navigation/cards update.
8. Create a brand and coupon; validate coupon in checkout.
9. Place a storefront order and confirm it appears in admin with immutable order items and correct totals.
10. Change order status and confirm history/audit entries.
11. Submit contact and newsletter forms and confirm records appear in their admin sections.
12. Create and publish a blog post and confirm public visibility.
13. Save store settings and confirm storefront values update.
14. Verify loading, empty, error, and validation states.
15. Verify mobile admin navigation, forms, tables, dialogs, and product image workflow.
16. Verify delete confirmations and database persistence after reload.

## Definition of done

The work is complete only when:

- No admin sidebar section is a placeholder.
- No visible button is fake or toast-only.
- Product add/edit/delete is persistent and connected to the storefront.
- Dashboard and tables use real database data.
- Admin authorization and role checks work on UI and APIs.
- Images upload and persist safely.
- All CRUD workflows survive refresh.
- Responsive behavior works on desktop, tablet, and mobile.
- The production build passes and the complete site is deployed successfully.

Do not stop at scaffolding, mock data, UI-only interactions, partial CRUD, or a written plan. Implement, migrate, test, fix, and verify the complete flow end to end.
