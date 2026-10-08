# FlowerShop

[![ci](https://raw.githubusercontent.com/lavantien/FlowerShop/badges/ci.svg)](https://github.com/lavantien/FlowerShop/actions/workflows/ci.yml)
[![backend coverage](https://raw.githubusercontent.com/lavantien/FlowerShop/badges/backend-coverage.svg)](https://github.com/lavantien/FlowerShop/actions/workflows/ci.yml)
[![frontend coverage](https://raw.githubusercontent.com/lavantien/FlowerShop/badges/frontend-coverage.svg)](https://github.com/lavantien/FlowerShop/actions/workflows/ci.yml)
[![qa](https://raw.githubusercontent.com/lavantien/FlowerShop/badges/qa.svg)](https://github.com/lavantien/FlowerShop#qa-harness)
![aws ready](https://raw.githubusercontent.com/lavantien/FlowerShop/badges/aws-ready.svg)

eCommerce web system with full backoffice: a Spring Boot 4 REST API with JPA, BCrypt password hashing, and token auth, an Angular 22 storefront with an admin console, and MySQL 9.7 LTS storage. v3 adds server-priced orders with an atomic stock guard, HMAC-signed payment sessions, coupons, wishlists, and sales reports. The Maven wrapper and `make` targets wrap every build, test, and run step, and the build provisions its own Node 24 for the Angular bundle, so the host needs a JDK, Docker, make, and Node for the tooling scripts. For a simpler legacy architecture, check the [v2.0 tag](https://github.com/lavantien/FlowerShop/tree/v2.0).

## Table of contents

1. [Pictures](#pictures)
2. [v3 quickstart](#v3-quickstart)
3. [QA harness](#qa-harness)
4. [Build logs](#build-logs)
5. [Architecture and flows](#architecture-and-flows)

## Pictures

The v3 user journey first, then the admin console. Regenerate the set against the current build with `make screenshots`.

1. Guest shop page
![Guest shop page](./project-pictures/01-shop-page.png)
2. Product details
![Product details](./project-pictures/11-product-details.png)
3. Guest shopping cart
![Guest shopping cart](./project-pictures/02-shopping-cart.png)
4. Checkout with a coupon applied
![Checkout with a coupon applied](./project-pictures/12-checkout-coupon.png)
5. Payment gateway page
![Payment gateway page](./project-pictures/13-pay-gateway.png)
6. Member account details
![Member account details](./project-pictures/03-member-account-details.png)
7. Order history with cancel while pending
![Order history](./project-pictures/14-info-order-history.png)
8. Wishlist
![Wishlist](./project-pictures/15-info-wishlist.png)
9. Not-found page
![Not-found page](./project-pictures/19-not-found.png)
10. Admin dashboard with the sales report
![Admin dashboard](./project-pictures/18-admin-dashboard.png)
11. Admin products listing
![Admin products listing](./project-pictures/04-admin-products.png)
12. Admin create new product
![Admin create new product](./project-pictures/06-admin-create-product.png)
13. Admin edit product
![Admin edit product](./project-pictures/09-admin-edit-product.png)
14. Admin batch delete
![Admin batch delete](./project-pictures/10-admin-batch-delete.png)
15. Admin import products from Excel
![Admin import products from Excel](./project-pictures/07-admin-import-excel.png)
16. Admin export products to Excel
![Admin export products to Excel](./project-pictures/08-admin-export-excel.png)
17. Admin orders with the status filter
![Admin orders](./project-pictures/05-admin-transaction-summary.png)
18. Admin coupons
![Admin coupons](./project-pictures/16-admin-coupons.png)
19. Admin branch stock editor
![Admin branch stock editor](./project-pictures/17-admin-branch-stock.png)

Shot 17 keeps its legacy filename `05-admin-transaction-summary.png`, the v3 capture regenerated it as the admin orders screen.

## v3 quickstart

Prerequisites: `JDK 27`, `Docker`, `make`, and `Node 24` with npm on PATH. CURL or Postman helps for ad hoc API calls, and any editor works.

1. Start MySQL and seed it: `make db-up` then `make db-seed`, or `make db-reset` to drop the volume and redo both in one step. The seed writes the schema, 4 demo users, the taxonomy, 79 products, 6 Ho Chi Minh City branches with stock rows, and 3 coupons (`WELCOME10` percent, `SHIP50K` fixed, `EXPIRED5` inactive).
2. Build and run: `make package` runs the full clean build with tests, then `make run` starts the newest `target/flowershop-*.jar` against the compose MySQL and serves the built SPA. The Makefile exports the `LOCAL_MYSQL_DB_*` variables matching compose, so no `application.yml` edit is needed unless you run your own MySQL.
3. Log in over JSON as the seeded admin (password `1234qwer`):

    ```sh
    curl -s -X POST http://localhost:8080/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email": "admin@flowershop.example", "password": "1234qwer"}'
    ```

    The 200 body is `{"token": "...", "user": {user}}`. Tokens are minted by login, rotated on every fresh login, and die on logout or restart, since sessions live in memory.
4. Send the token in the `X-Auth-Token` header on every authenticated call:

    ```sh
    curl -s http://localhost:8080/api/user/me -H "X-Auth-Token: <token>"
    ```

    The whole contract, including the error code list and the payment signature scheme, is frozen in [docs/api-v3.md](docs/api-v3.md).
5. For frontend work: `make frontend-install` then `make frontend-serve` serves the dev build at `http://localhost:4200`, proxying `/api` to `:8080`.
6. To deploy elsewhere, copy the jar from `make package` and run `java -jar target/flowershop-*.jar` against your own MySQL 9.7. On AWS an EC2 instance or a Lightsail VPS runs the jar, RDS serves MySQL, and S3 holds backups and static assets.

## QA harness

Every gate runs through a make target, and the committed reports under [docs/qa/](docs/qa) hold the numbers below.

1. `make backend-test`: `mvn verify` with a JaCoCo bundle gate at 0.90 covered ratio on lines and instructions, plus the concurrency suites for oversell, payment replay, and signature tamper.
2. `make test-coverage`: the vitest suite with thresholds at 90 percent on statements, branches, functions, and lines.
3. `make fuzz`: boots the packaged jar on a scratch port and fires the committed corpus plus seeded generated variants at every endpoint, asserting documented statuses only, problem+json with contract codes on errors, and zero 5xx, hangs, or run-budget breaches. Baseline run: 350 requests over 54 endpoint templates, zero assertion failures, seed 20261007. Report: [docs/qa/fuzz-report.md](docs/qa/fuzz-report.md).
4. `make mutate`: source-level mutation harness sweeping 23 operators over the logic-dense backend classes, one mutant per run against its mapped test classes, tree restored and verified between runs. Baseline run over 17 targets: 192 mutants, 188 killed by failing tests, 4 by compile rejection, 0 by timeout, 0 survivors. Report: [docs/qa/mutation-report.md](docs/qa/mutation-report.md).
5. `make mutate-front`: the same conventions over the TypeScript core and services classes with 19 operators. Baseline run: 93 mutants, 71 killed by failing specs, 22 by compile rejection, 0 by timeout, 0 survivors. Report: [docs/qa/mutation-front-report.md](docs/qa/mutation-front-report.md).
6. CI runs four gate jobs on every push and pull request: backend tests and the API fuzz gate, both against a MySQL 9.7.2 service container on JDK 27, frontend lint, coverage, and build on Node 24, and the npm audit zero-vulnerability gate. A badges job needs all four and publishes the ci and coverage badges above from master pushes, uploading the fuzz report and server log when the fuzz gate fails.

Both mutation runs open with an unmutated control pass over the mapped tests and abort when it comes back red, refuse to start on a dirty source tree, restore and verify every mutant with git before the next, and run only the mapped test classes per target. The maps pin line numbers, so any line shift in a mapped file needs a map recalibration. The fuzz harness derives deterministic HMAC-tagged credentials per run, keyed on the run tag, and truncates its server log per run.

## Build logs

### Build log (historical, Aug 7 2020)
```
[INFO] Results:
[INFO] 
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] 
[INFO] --- maven-jar-plugin:3.2.0:jar (default-jar) @ flowershop ---
[INFO] Building jar: /home/lavantien/Documents/dev/flowershop/target/flowershop-1.1.jar
[INFO] 
[INFO] --- spring-boot-maven-plugin:2.3.2.RELEASE:repackage (repackage) @ flowershop ---
[INFO] Replacing main artifact with repackaged archive
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  44.918 s
[INFO] Finished at: 2020-08-07T00:57:12+07:00
[INFO] ------------------------------------------------------------------------
```

### Build log (v2.0)
```
[INFO] Results:
[INFO] 
[INFO] Tests run: 119, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] 
[INFO] --- jar:3.5.1:jar (default-jar) @ flowershop ---
[INFO] Building jar: C:\Users\lavantien\dev\github\FlowerShop\target\flowershop-2.0.jar
[INFO] 
[INFO] --- spring-boot:4.1.1:repackage (repackage) @ flowershop ---
[INFO] Replacing main artifact C:\Users\lavantien\dev\github\FlowerShop\target\flowershop-2.0.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] The original artifact has been renamed to C:\Users\lavantien\dev\github\FlowerShop\target\flowershop-2.0.jar.original
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  35.854 s
[INFO] Finished at: 2026-10-07T10:51:45+07:00
[INFO] ------------------------------------------------------------------------
```

### Build log (v3.0 release)

```
[INFO] Results:
[INFO]
[INFO] Tests run: 351, Failures: 0, Errors: 0, Skipped: 0
[INFO]
[INFO]
[INFO] --- jar:3.5.1:jar (default-jar) @ flowershop ---
[INFO] Building jar: C:\Users\lavantien\dev\github\FlowerShop\target\flowershop-3.0.jar
[INFO]
[INFO] --- spring-boot:4.1.1:repackage (repackage) @ flowershop ---
[INFO] Replacing main artifact C:\Users\lavantien\dev\github\FlowerShop\target\flowershop-3.0.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] The original artifact has been renamed to C:\Users\lavantien\dev\github\FlowerShop\target\flowershop-3.0.jar.original
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  58.556 s
[INFO] Finished at: 2026-10-08T01:11:01+07:00
[INFO] ------------------------------------------------------------------------
```

## Architecture and flows

<details>
<summary>Expand for the 4 structural graphs and 14 sequence diagrams</summary>

System overview, the whole stack at a glance:

![System overview](./docs/diagrams/system-overview.png)

Backend component graph, the controller, service, and repository layering with the token interceptor:

![Backend components](./docs/diagrams/backend-components.png)

Frontend component graph, the shell, routed feature areas, core services, and guards:

![Frontend components](./docs/diagrams/frontend-components.png)

Data model graph, the JPA entities with order, payment session, stock, coupon, and wishlist:

![Data model](./docs/diagrams/data-model.png)

Login and logout, token mint and burn:

![Login and logout](./docs/diagrams/seq-login-logout.png)

Register and password reset:

![Register and reset](./docs/diagrams/seq-register-reset.png)

Browse and catalog query, paging, filters, and the sort whitelist:

![Browse and catalog query](./docs/diagrams/seq-browse-catalog.png)

Add to cart, the persisted client cart:

![Add to cart](./docs/diagrams/seq-add-to-cart.png)

Checkout with payment confirm, server-side pricing, the stock guard, and the signed gateway redirect:

![Checkout with payment confirm](./docs/diagrams/seq-checkout-confirm.png)

Payment cancel, order cancellation and stock restore:

![Payment cancel](./docs/diagrams/seq-payment-cancel.png)

User order cancel while pending:

![User order cancel](./docs/diagrams/seq-order-cancel.png)

Admin fulfillment transitions across order statuses:

![Fulfillment transitions](./docs/diagrams/seq-fulfillment.png)

Coupon lifecycle, create, validate, and checkout integration:

![Coupon lifecycle](./docs/diagrams/seq-coupon-lifecycle.png)

Wishlist toggle:

![Wishlist toggle](./docs/diagrams/seq-wishlist-toggle.png)

User admin, listing, edits, and the delete guard:

![User admin](./docs/diagrams/seq-user-admin.png)

Excel import and export of the catalog:

![Excel import and export](./docs/diagrams/seq-excel-import-export.png)

Stock and branch admin:

![Stock and branch admin](./docs/diagrams/seq-stock-branch-admin.png)

Dashboard report, the sales aggregates:

![Dashboard report](./docs/diagrams/seq-dashboard-report.png)

</details>

Regenerate the PNG files from the committed PlantUML sources with `make diagrams`.
