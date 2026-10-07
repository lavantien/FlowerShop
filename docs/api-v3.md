# api v3 contract

Frozen before implementation. Both sides build against this document. Field names, status codes, and the signature scheme are binding. Anything not written here is free to move.

## conventions

Authentication: `X-Auth-Token` header holding base64 of `id + "+" + role + "+" + secret`, minted by login, rotated on every fresh login, invalidated by logout and restart. Public endpoints skip the header.

Money: integer VND, JSON numbers with no decimal part, `DECIMAL(12,0)` storage. Computed amounts round `HALF_UP` to 1000 dong.

Timestamps: ISO 8601 instant strings, for example `2026-10-07T04:00:00Z`.

Enums: `role` in `USER`, `ADMIN`. `status` on orders in `PENDING`, `PAID`, `SHIPPED`, `COMPLETED`, `CANCELLED`. Payment `status` in `PENDING`, `CONFIRMED`, `CANCELLED`. Coupon `kind` in `PERCENT`, `FIXED`.

Errors: `application/problem+json` everywhere.

```
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "human readable english sentence",
  "instance": "/api/order",
  "code": "OUT_OF_STOCK",
  "errors": {"field": "message"}
}
```

`code` is the machine readable key clients branch on. `errors` appears only on 400 validation failures and maps field to first message. Codes in use: `VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `EMAIL_IN_USE`, `NAME_IN_USE`, `OUT_OF_STOCK`, `ILLEGAL_TRANSITION`, `PAYMENT_CANCELLED`, `PAYMENT_CONFIRMED`, `HAS_ORDERS`, `COUPON_INACTIVE`, `STOCK_ROWS_EXIST`, `WRONG_SECRET`.

Role gates below: `public` needs no token, `USER` needs any valid session, `ADMIN` needs role `ADMIN`. Own-or-admin means the path id must equal the token id or the role must be `ADMIN`.

## authentication

`POST /api/auth/login` public. Body `{"email": "a@b.c", "password": "..."}` with both fields required. 200 `{"token": "...", "user": {user}}`. 401 for unknown email, wrong password, or disabled account, after the constant time bcrypt burn. 400 validation.

`POST /api/auth/logout` with the token header. 204 and the session dies. 401 when the header is missing or invalid.

`{user}` shape, shared by every endpoint returning one: `{"id": 4, "name": "...", "email": "...", "phone": "...", "address": "...", "district": "...", "city": "...", "role": "USER", "enable": true}`. Password and security answer never serialize.

`POST /api/user/resetPassword` public. Body `{"email": "...", "answer": "...", "newPassword": "..."}`. 200 `{"token": "...", "user": {user}}` and the new session is live. 401 for unknown email or wrong answer, indistinguishable. 400 validation.

## users

`POST /api/user/create` public, self registration. Body `{"name", "email", "password", "phone", "address", "district", "city", "answer"}` with name, email, and password required. Role is forced `USER`. 201 `{user}`. 409 `EMAIL_IN_USE`. 400 validation.

`GET /api/user/me` USER. 200 `{user}`.

`PUT /api/user/me` USER. Body `{"name", "phone", "address", "district", "city"}`. 200 `{user}`.

`POST /api/user/me/password` USER. Body `{"currentPassword", "newPassword"}`. 204 on success, all sessions for the user die. 401 wrong current password.

`GET /api/user` ADMIN. 200 `[{user}]`.

`GET /api/user/{id}` own-or-admin. 200 `{user}`. 403. 404.

`PUT /api/user/{id}` ADMIN. Body `{"name", "phone", "role", "enable"}`. 200 `{user}`. 404.

`DELETE /api/user/{id}` ADMIN. 204. 404. 409 `HAS_ORDERS` when any order references the user.

## catalog

`GET /api/product` public. Query: `search` substring on name, `category` exact name, `type` exact name, `sort` one of `name-asc` default, `name-desc`, `price-asc`, `price-desc`, `page` from 0, `size` from 1 to 48 default 12, clamped silently. 200 page: `{"content": [{productView}], "totalElements": 79, "totalPages": 7, "page": 0, "size": 12}`.

`{productView}`: `{"id", "name", "description", "imgUrl", "price", "typeName", "categoryName", "stock"}` where `stock` is the sum of all branch stock levels.

`GET /api/product/{id}` public. 200 `{productView}` or 404.

`POST /api/product` ADMIN, bulk upsert used by seeding and excel import. Body `[{productInput}]`. 200 `[{productView}]`.

`{productInput}`: `{"id"?, "name", "description", "imgUrl", "price", "typeName", "categoryName"}` with id optional, present meaning upsert.

`POST /api/product/create` ADMIN. Body `{productInput}`. 200 `{productView}`.

`PUT /api/product/{id}` ADMIN. Body `{productInput}`. 200 `{productView}`. 404.

`DELETE /api/product/{id}` ADMIN. 204. 404.

`DELETE /api/product` ADMIN. Body `[ids]` or empty body for all. 204.

Category and type mirror this shape. `GET /api/category` public, `[{id, name}]`. `POST /api/category/create` ADMIN `{"name"}` 200, 409 `NAME_IN_USE`. `PUT /api/category/{id}` ADMIN 200, 404, 409. `DELETE /api/category/{id}` ADMIN 204, 404. Type adds `categoryName`: `[{id, name, categoryName}]`, same codes, delete refuses 409 `NAME_IN_USE` when products still reference the name. Bulk delete mirrors the product route: `DELETE /api/category` and `DELETE /api/type` ADMIN take `[ids]` or no body for all, answer 200 with an empty body, and refuse 409 `NAME_IN_USE` when products still reference any addressed name.

`GET /api/branch` public. `[{"id", "name", "address", "district", "city", "lat", "lng", "active"}]`.

`POST /api/branch` ADMIN. Body the branch fields. 200 `{branch}`.

`PUT /api/branch/{id}` ADMIN. 200 `{branch}`. 404.

`DELETE /api/branch/{id}` ADMIN. 204. 404. 409 `STOCK_ROWS_EXIST`.

`GET /api/branch/{id}/stock` ADMIN. `[{"productId", "quantity"}]` for every product, 0 when absent.

`PUT /api/branch/{id}/stock` ADMIN. Body `{"productId", "quantity"}` absolute set, floor 0. 200 `{"productId", "quantity"}`. 404 branch or product.

## orders

`POST /api/order` USER. Body:

```
{
  "items": [{"productId": 1, "quantity": 2}],
  "phone": "...",
  "address": "...",
  "district": "...",
  "city": "...",
  "branchId": 3,
  "couponCode": "WELCOME10"
}
```

Items non-empty, quantities at least 1, address fields required, `branchId` and `couponCode` optional. When `branchId` is absent the server picks the nearest active branch to the district then city then default point. One transaction prices every line from the database, decrements stock with a conditional update, computes the distance and delivery fee, applies the coupon, writes the order `PENDING` with item snapshots, and creates the payment session.

201:

```
{
  "order": {order},
  "payment": {"id": "uuid", "redirectUrl": "/pay/uuid?sig=hex"}
}
```

400 validation. 404 unknown product or branch. 409 `OUT_OF_STOCK` with `detail` naming the failing items. 409 `COUPON_INACTIVE`.

`{order}`:

```
{
  "id": 12,
  "userId": 4,
  "status": "PENDING",
  "placedAt": "...", "paidAt": null, "shippedAt": null, "completedAt": null, "cancelledAt": null,
  "phone": "...", "address": "...", "district": "...", "city": "...",
  "branchId": 3, "branchName": "Binh Thanh",
  "distanceKm": 4.2,
  "deliveryFee": 41000,
  "couponCode": "WELCOME10",
  "discountAmount": 25000,
  "subtotal": 250000,
  "total": 266000,
  "items": [{"id", "productId", "productName", "unitPrice", "quantity", "lineTotal"}]
}
```

`subtotal` is the item sum, `discountAmount` the coupon cut, `total` = subtotal minus discount plus deliveryFee.

`GET /api/order/me` USER, paged with `page` and `size` as in the catalog. 200 page of `{order}` newest first.

`GET /api/order` ADMIN. Query `status`, `from`, `to` ISO dates, `page`, `size`. 200 page of `{order}`.

`GET /api/order/{id}` own-or-admin. 200 `{order}`. 403. 404.

`POST /api/order/{id}/cancel` own-or-admin with rules: the owner may cancel while `PENDING`, admin may cancel anything non terminal. Restores stock atomically. 200 `{order}`. 403. 404. 409 `ILLEGAL_TRANSITION`.

`POST /api/order/{id}/status` ADMIN. Body `{"status": "SHIPPED"}`. Legal arcs: `PENDING` to `PAID` happens only through payment confirm, `PAID` to `SHIPPED` restores nothing, `SHIPPED` to `COMPLETED`, `PAID` to `CANCELLED` restores stock. 200 `{order}`. 404. 409 `ILLEGAL_TRANSITION`.

## payments

Signature: `sig` = lowercase hex of HMAC-SHA256 over the UTF-8 bytes of `paymentId + ":" + orderId + ":" + amount`, amount as its plain integer decimal form. The secret lives server side in `shop.payment.secret`. Verification is constant time and recomputed from stored values, never from request claims.

`GET /api/payment/{id}?sig=...` public, sig gated. 200 `{"paymentId", "orderId", "amount", "status", "summary"}` where summary is a short display line for the gateway page. 401 bad signature. 404 unknown id.

`POST /api/payment/{id}/confirm?sig=...` public, sig gated, idempotent. One transaction: `CONFIRMED` already returns 200 unchanged, `CANCELLED` returns 409 `PAYMENT_CANCELLED`, `PENDING` flips to `CONFIRMED, sets paidAt, moves the order PENDING to PAID. 200 `{"orderId", "status": "CONFIRMED"}`.

`POST /api/payment/{id}/cancel?sig=...` public, sig gated, idempotent. `CANCELLED` already returns 200 unchanged, `CONFIRMED` returns 409 `PAYMENT_CONFIRMED`, `PENDING` flips to `CANCELLED, cancels the order, restores stock. 200 `{"orderId", "status": "CANCELLED"}`.

## coupons

`GET /api/coupon` ADMIN. `[{"id", "code", "kind", "value", "active", "expiresAt"}]`.

`POST /api/coupon` ADMIN. Body those fields, code unique, value positive, `PERCENT` capped at 100. 200 `{coupon}`. 409 duplicate code.

`PUT /api/coupon/{id}` ADMIN. 200 `{coupon}`. 404.

`DELETE /api/coupon/{id}` ADMIN. 204. 404.

`POST /api/coupon/validate` USER. Body `{"code", "subtotal"}`. 200 `{"code", "kind", "value", "discountAmount"}` with percent discounts computed as `min(ceil(subtotal * value / 100), subtotal)` and fixed as `min(value, subtotal)`, both rounded to 1000 at order time. 404 unknown code. 409 `COUPON_INACTIVE` for inactive or expired.

## wishlist

`GET /api/wishlist/me` USER. `[{"product": {productView}, "createdAt"}]` newest first.

`POST /api/wishlist/me/{productId}` USER, toggle. 200 `{"added": true}` or `{"added": false}`. 404 unknown product.

## reports

`GET /api/report/sales?from=&to=` ADMIN, ISO dates, default the last 30 days. 200:

```
{
  "totals": {"revenue": 0, "orders": 0, "avgOrder": 0},
  "revenueByStatus": {"PENDING": 0, "PAID": 0, "SHIPPED": 0, "COMPLETED": 0, "CANCELLED": 0},
  "countsByStatus": {"PENDING": 0, "PAID": 0, "SHIPPED": 0, "COMPLETED": 0, "CANCELLED": 0},
  "revenueByDay": [{"day": "2026-10-07", "revenue": 0}],
  "topProducts": [{"productId": 1, "name": "...", "quantity": 0, "revenue": 0}]
}
```

Revenue counts `PAID`, `SHIPPED`, and `COMPLETED` orders only. `topProducts` ranks by quantity over order items, top 10.

## deleted from v2

Every `/api/bill` endpoint, `POST` and `DELETE /api/user` batch forms, the text/plain base64 `j0z` login, the guest token, and the old 400-for-not-found convention. The frontend seed POST of `db/product.json` moves to `make db-seed`.

## public rules

No token needed for: `GET` on product, category, type, and branch listing; `POST /api/auth/login`; `POST /api/user/create`; `POST /api/user/resetPassword`; `GET` and `POST` on payment paths, which gate on the signature instead. Everything else requires a session.
