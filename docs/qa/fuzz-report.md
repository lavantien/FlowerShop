# fuzz report

Baseline run of `make fuzz` per plan decision 13: the in-repo API fuzz harness over the packaged jar.

- jar: target\flowershop-2.0.jar
- seed: 20261007 (scripts/tools/qa.json, fuzz.seed)
- run tag: replay-h1 (namespaces this run's users; replay with FUZZ_RUN_TAG)
- corpus: scripts/tools/fuzz-corpus.json
- requests fired: 329
- endpoints covered: 54 templates
- duration: 20.0 s
- assertion failures: 0

Invariants asserted on every response: status inside the documented set for the endpoint,
and every error body, application and framework alike (deserialization, method-not-allowed,
unknown paths, traversal), is problem+json carrying a code from the contract list, and never
a 5xx, hang, or run-budget breach. Status unions appear where persistent
state can legitimately flip a case between two documented outcomes, for instance the register
template across tagged reruns (201 versus EMAIL_IN_USE 409) or a variant that may validate or
score a business 404 or 409 depending on which field the seeded mutation strikes. Replaying a
completed run with FUZZ_RUN_TAG is green end to end: every credential derives from the tag, so
setup login falls back to the rotated password and the taxonomy rename scores NAME_IN_USE
against the previous run residue instead of failing.

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
| `GET /api/payment/{id}` | 13 | 200x1 401x11 404x1 |
| `GET /api/product` | 69 | 200x69 |
| `GET /api/product/../user` | 1 | 404x1 |
| `GET /api/product/{id}` | 3 | 200x1 400x1 404x1 |
| `GET /api/report/sales` | 6 | 200x4 401x1 403x1 |
| `GET /api/type` | 2 | 200x2 |
| `GET /api/user` | 5 | 200x2 401x2 403x1 |
| `GET /api/user/me` | 8 | 200x1 401x7 |
| `GET /api/wishlist/me` | 2 | 200x1 401x1 |
| `POST /api/auth/login` | 42 | 200x6 400x21 401x15 |
| `POST /api/auth/logout` | 3 | 204x1 401x2 |
| `POST /api/branch` | 7 | 200x5 400x2 |
| `POST /api/category/create` | 2 | 200x1 409x1 |
| `POST /api/coupon` | 9 | 200x1 400x4 409x4 |
| `POST /api/coupon/validate` | 11 | 200x5 400x2 401x1 404x2 409x1 |
| `POST /api/nosuch/deep/path` | 1 | 404x1 |
| `POST /api/order` | 28 | 201x8 400x15 404x3 409x2 |
| `POST /api/order/{id}/cancel` | 4 | 200x1 404x1 409x2 |
| `POST /api/order/{id}/status` | 4 | 200x2 403x1 409x1 |
| `POST /api/payment/{id}/cancel` | 3 | 200x2 409x1 |
| `POST /api/payment/{id}/confirm` | 3 | 200x2 409x1 |
| `POST /api/product` | 2 | 200x2 |
| `POST /api/product/create` | 1 | 200x1 |
| `POST /api/type/create` | 1 | 200x1 |
| `POST /api/user/create` | 24 | 201x1 400x16 409x7 |
| `POST /api/user/me/password` | 2 | 204x1 401x1 |
| `POST /api/user/resetPassword` | 3 | 200x1 401x2 |
| `POST /api/wishlist/me/{productId}` | 3 | 200x2 404x1 |
| `PUT /api/branch/{id}` | 3 | 200x1 400x1 404x1 |
| `PUT /api/branch/{id}/stock` | 12 | 200x5 400x4 404x3 |
| `PUT /api/category/{id}` | 2 | 200x1 404x1 |
| `PUT /api/coupon/{id}` | 2 | 200x1 404x1 |
| `PUT /api/order/me` | 1 | 405x1 |
| `PUT /api/product/{id}` | 2 | 200x1 404x1 |
| `PUT /api/type/{id}` | 1 | 200x1 |
| `PUT /api/user/me` | 7 | 200x5 400x2 |
| `PUT /api/user/{id}` | 2 | 200x1 404x1 |

