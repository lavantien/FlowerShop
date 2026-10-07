# fuzz report

Baseline run of `make fuzz` per plan decision 13: the in-repo API fuzz harness over the packaged jar.

- jar: target\flowershop-2.0.jar
- seed: 20261007 (scripts/tools/qa.json, fuzz.seed)
- run tag: muxxsvqm (namespaces this run's users; replay with FUZZ_RUN_TAG)
- corpus: scripts/tools/fuzz-corpus.json
- requests fired: 312
- endpoints covered: 54 templates
- duration: 14.5 s
- assertion failures: 0

Invariants asserted on every response: status inside the documented set for the endpoint,
application errors as problem+json carrying a code from the contract list, framework errors
(deserialization, method-not-allowed, unknown paths) as the Spring Boot error JSON with the
same status, and never a 5xx, hang, or run-budget breach. Status unions appear where persistent
state can legitimately flip a case between two documented outcomes, for instance the register
template across tagged reruns (201 versus EMAIL_IN_USE 409) or a variant that may validate or
score a business 404 or 409 depending on which field the seeded mutation strikes.

| endpoint | requests | statuses |
| --- | --- | --- |
| `DELETE /api/branch/{id}` | 2 | 404x1 409x1 |
| `DELETE /api/category/{id}` | 2 | 204x1 404x1 |
| `DELETE /api/coupon/{id}` | 2 | 204x1 404x1 |
| `DELETE /api/payment/x` | 1 | 405x1 |
| `DELETE /api/product` | 4 | 204x3 403x1 |
| `DELETE /api/product/{id}` | 2 | 204x1 404x1 |
| `DELETE /api/type/{id}` | 1 | 204x1 |
| `DELETE /api/user/{id}` | 3 | 204x1 404x1 409x1 |
| `GET /api/auth/login` | 1 | 405x1 |
| `GET /api/branch` | 2 | 200x2 |
| `GET /api/branch/{id}/stock` | 2 | 200x1 403x1 |
| `GET /api/category` | 2 | 200x2 |
| `GET /api/coupon` | 2 | 200x1 403x1 |
| `GET /api/nosuch` | 1 | 404x1 |
| `GET /api/order` | 3 | 200x2 403x1 |
| `GET /api/order/me` | 2 | 200x1 401x1 |
| `GET /api/order/{id}` | 3 | 200x1 403x1 404x1 |
| `GET /api/payment/{id}` | 6 | 200x1 401x4 404x1 |
| `GET /api/product` | 69 | 200x69 |
| `GET /api/product/../user` | 1 | 401x1 |
| `GET /api/product/{id}` | 3 | 200x1 400x1 404x1 |
| `GET /api/report/sales` | 6 | 200x4 401x1 403x1 |
| `GET /api/type` | 2 | 200x2 |
| `GET /api/user` | 5 | 200x2 401x2 403x1 |
| `GET /api/user/me` | 8 | 200x1 401x7 |
| `GET /api/wishlist/me` | 2 | 200x1 401x1 |
| `POST /api/auth/login` | 33 | 200x6 400x19 401x8 |
| `POST /api/auth/logout` | 3 | 204x1 401x2 |
| `POST /api/branch` | 7 | 200x4 400x3 |
| `POST /api/category/create` | 2 | 200x1 409x1 |
| `POST /api/coupon` | 9 | 200x1 400x6 409x2 |
| `POST /api/coupon/validate` | 11 | 200x4 400x1 401x1 404x4 409x1 |
| `POST /api/nosuch/deep/path` | 1 | 404x1 |
| `POST /api/order` | 28 | 201x10 400x12 404x4 409x2 |
| `POST /api/order/{id}/cancel` | 4 | 200x1 404x1 409x2 |
| `POST /api/order/{id}/status` | 4 | 200x2 403x1 409x1 |
| `POST /api/payment/{id}/cancel` | 3 | 200x2 409x1 |
| `POST /api/payment/{id}/confirm` | 3 | 200x2 409x1 |
| `POST /api/product` | 2 | 200x2 |
| `POST /api/product/create` | 1 | 200x1 |
| `POST /api/type/create` | 1 | 200x1 |
| `POST /api/user/create` | 24 | 201x4 400x15 409x5 |
| `POST /api/user/me/password` | 2 | 204x1 401x1 |
| `POST /api/user/resetPassword` | 3 | 200x1 401x2 |
| `POST /api/wishlist/me/{productId}` | 3 | 200x2 404x1 |
| `PUT /api/branch/{id}` | 2 | 200x1 404x1 |
| `PUT /api/branch/{id}/stock` | 12 | 200x6 400x4 404x2 |
| `PUT /api/category/{id}` | 2 | 200x1 404x1 |
| `PUT /api/coupon/{id}` | 2 | 200x1 404x1 |
| `PUT /api/order/me` | 1 | 405x1 |
| `PUT /api/product/{id}` | 2 | 200x1 404x1 |
| `PUT /api/type/{id}` | 1 | 200x1 |
| `PUT /api/user/me` | 7 | 200x5 400x2 |
| `PUT /api/user/{id}` | 2 | 200x1 404x1 |

