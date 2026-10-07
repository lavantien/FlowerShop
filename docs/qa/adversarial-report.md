# Adversarial review report

Scope: the full v3.0 diff, v2.0..5f2dda1, including the QA harnesses and committed reports. Two independent agents attacked the tree in parallel, neither saw the other's work. Alpha attacked correctness (money, stock, payment, taxonomy, error paths), beta attacked the seams (harnesses, build, CI, frontend, docs, seeds). 30 findings landed, 13 alpha plus 17 beta, 2 pairs converged on the same defect, 28 unique. Every confirmed defect routed to a fix lane and landed as an atomic commit on top of 5f2dda1. The combined tree passes `make backend-test` clean: 348 tests, 0 failures, jacoco checks met.

## Findings and dispositions

| id | sev | verdict | claim | disposition |
|---|---|---|---|---|
| A1 | major | confirmed | product prices accept zero and negative values, breaking every downstream money invariant, a negative total can be signed and paid | fixed, 812e3bd: @Positive on price, create, put, and bulk legs tested with 0, negative, null. CheckoutRequest.Item bounds and CouponInput.value audited, already guarded |
| A2 | major | confirmed | admin cancel through the status endpoint leaves the payment session PENDING, a later confirm captures money for a cancelled order. Converged with B1 | fixed, d01baf9: changeStatus cancels a PENDING session exactly like cancel(), one restoreStock. The test that pinned the wrong behavior now asserts CANCELLED, a new confirm-after-admin-cancel case answers 409 |
| A3 | major | confirmed | an explicit branchId without coordinates NPEs to a 500, and a branch PUT silently wipes coordinates | fixed, 34ee4c4: lat/lng @NotNull with globe bounds on create and update, update preserves omitted coordinates, resolveBranch refuses inactive or coordinate-less branches with 404 |
| A4 | minor | confirmed | taxonomy bulk delete bypassed the NAME_IN_USE product guard, both the ids and no-body forms | fixed, 9ae754a: both forms refuse 409 NAME_IN_USE when any candidate is referenced. ff812c4 documents the bulk routes and their 200 |
| A5 | minor | confirmed | taxonomy renames never propagated to products, stranding them in ghost names and defeating the delete guard. Converged with B5 | fixed, 9ae754a: renames update product rows in the same transaction. Residual recorded below |
| A6 | minor | confirmed | problem+json was not everywhere: malformed JSON, type mismatches, 405, unmatched routes answered the Boot legacy body | fixed, 3ada91d: handler extends ResponseEntityExceptionHandler with six overrides, all rendering code fields, validation keeps the errors map. Deliberate deviation: spring.mvc.problemdetails stays off, verified against Spring 7.0.9 that Boot's ProblemDetailsExceptionHandler registers at HIGHEST_PRECEDENCE and would shadow the overrides, dropping code and errors |
| A7 | minor | confirmed | duplicate-key races answered 400 instead of the documented 409 for user email and coupon code | fixed, 564935d: unique keys pinned with the schema's generated names, the handler parses the key name from the cause chain, email maps 409 EMAIL_IN_USE, coupon code maps 409 NAME_IN_USE, one code per condition since the deterministic preflight already answers NAME_IN_USE |
| A8 | minor | confirmed | a coupon expiring exactly at the current instant still resolved | fixed, 6be9170: !expiresAt.isAfter(now), exact-instant test |
| A9 | minor | plausible | opposing stock-row lock order across mirrored carts could deadlock into a transient 500 | fixed, f88430b: checkout lines and restoreStock items both visit rows lowest product id first, InOrder tests pin both |
| A10 | minor | confirmed | deliveryFee clamped before rounding, so a non-step maxFee could round above the cap | fixed, 1ea2afa: ShopProperties.Delivery compact constructor validates round-to positive, no negative fees, base-fee and max-fee step multiples, message names the field |
| A11 | minor | plausible | wishlist toggle was check-then-act, a legal concurrent insert answered 400 | fixed, 153caf3: the insert catches DataIntegrityViolationException and answers added true |
| A12a | minor | confirmed | the money property oracle never generated a nonpositive price | sealed at the input by A1. The property domain now matches the legal domain, a nonpositive price is a validation failure, not a computation case |
| A12b | minor | confirmed | mutation map skipped ReportService, ReportController, TokenInterceptor, BranchController, CouponController | routed: map extension plus a full zero-survivor rerun run over the final tree |
| A12c | minor | confirmed | capture.mjs asserted no money numbers end to end | routed: numeric fee, discount, subtotal, and total assertions plus a screenshot rerun |
| A12d | minor | confirmed | fuzz asserted statuses only and its corpus could not construct the states behind the two 5xx findings | routed: coordinate-less branch and nonpositive price templates, 2xx body assertions, fuzz rerun on the final jar. A nonpositive price now contracts to 400 with a field error |
| A12e | minor | confirmed | GET /api/user/{id} existed undocumented | fixed, ff812c4: own-or-admin semantics documented |
| A13 | minor | confirmed | the api doc's fee example contradicted its own formula, 40000 shown for 41000 | fixed, ff812c4: 41000 fee, 266000 total |
| B2 | major | confirmed | both mutation gates passed green on a broken environment: any nonzero exit counted as a kill, no unmutated control pass, mutate-front had no install prerequisite | fixed, f34b579 plus caac22b: both harnesses run the mapped tests unmutated first, a red control aborts exit 3, the frontend gate keys its install on a stamp inside node_modules. Proven with a disposable clone and a PATH-stripped node |
| B3 | major | confirmed | the frontend map culled a non-equivalent mutant: dropping the cart persistence guard's ! wiped every persisted cart on reload | fixed, 8258ce9: mutant un-culled, the gate ran 91 mutants with zero survivors, a save-then-reload spec kills it. The other culls verified sound and kept |
| B4 | major | confirmed | a carried-forward v2 volume broke db-seed on the legacy schema and legacy rows NPE'd the login mint | fixed in halves, 316fd0d: db-seed strips create database and use by pattern instead of line position, 1a65789: a null role answers 401 at the mint point before the session store, so no orphaned session |
| B6 | minor | confirmed | a payment sig 401 logged the buyer out mid-purchase | fixed, d887d34: the interceptor skips session teardown on payment paths, the pay page owns that error |
| B7 | minor | confirmed | the fuzz coupon walk's 409 fallback read created.id off a problem body and PUT /api/coupon/undefined | fixed, c6913b3 |
| B8 | minor | confirmed | the byte-for-byte fuzz replay claim was false, the second run rotated a password the first run reused | fixed, c6913b3: HMAC-derived run-tagged credentials, replay proven deterministic across two consecutive green runs |
| B9 | minor | confirmed | the traversal probe normalized dot segments client-side and certified nothing | fixed, c6913b3: raw node:http socket probe sends the dot segments verbatim, verified with a one-off server |
| B10 | minor | confirmed | the corpus emails and sigs pools were never read | fixed, c6913b3: both pools wired into their templates |
| B11 | minor | confirmed | the memguard missed the maven wrapper launcher JVM, and a mid-run kill counted as a mutation kill | fixed, 2597320: includePatterns match the wrapper launcher. The kill race is closed by construction, every lane JVM runs constrained through MAVEN_OPTS, and the B2 control pass now catches a dead runner before the sweep |
| B12 | minor | confirmed | compile and timeout kills inflate the headline mutation number | routed: README splits the QA numbers by kill class |
| B13 | minor | confirmed | both mutation reports stamp finishedAt at run start | routed: stamp at sweep end alongside the already-honest seconds |
| B14 | minor | confirmed | db-seed stripped run.sql by line position, any header comment would shift it | fixed, 316fd0d |
| B15 | minor | plausible | pom still says 2.0 across the v3 work | deliberate: the release commit bumps pom and the jar name per the plan |
| B16 | minor | confirmed | CI skipped the entire QA layer | routed: a CI fuzz job runs on every push. Mutation stays a local gate by design, its runtime does not fit CI, the committed reports are the evidence |
| B17 | minor | confirmed | the fuzz server log grew unboundedly across reruns | fixed, c6913b3: the log truncates per run |

## Themes that held

Both adversaries recorded the themes they failed to break. The payment signature: recomputation from the stored row, constant-time compare, cross-session and tampered-amount rejection, scale 0 end to end so no sig drift. Lock ordering: every mutating path takes the payment row before the order row, replay storms serialize, the oversell suite pins exact winner counts on real MySQL. The transition matrix: every status mutation funnels through canTransitionTo, restore happens exactly once per entry into CANCELLED, the sole leak was A2. The coupon formula matches the frozen doc verbatim including the round-then-min clamp. Report aggregation: revenue over PAID, SHIPPED, COMPLETED only, exclusive-end UTC windows, top 10 with id tie-break. Contract drift: models.ts and api-v3.md field-for-field, api.ts the only URL hub, all 177 i18n keys in both locales, seed regeneration byte-identical to the committed seed.

## Residuals

One known residual stands, flagged by the fix lane itself: type.category_name strands if its category is renamed or deleted. The single-delete guard never covered that direction in v2 either, the plan froze taxonomy as name-string coupled with no FK, and the fix lane scoped to the guards the contract documents. Recorded here rather than silently dropped.

## Rerun evidence

`make backend-test` on the combined tree, all 19 fix commits applied: 348 tests, 0 failures, 0 errors, 0 skipped, all jacoco checks met. The frontend gate reran green over the combined tree during the harness fixes: 44 files, 309 tests. The full zero-survivor mutation rerun and the fuzz rerun over the final jar run as the closing gate of the fix series, their reports land in mutation-report.md, mutation-front-report.md, and fuzz-report.md.
