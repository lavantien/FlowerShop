SHELL := /usr/bin/sh

JDK27_HOME ?= $(subst \,/,$(USERPROFILE))/dev/jdk/jdk-27_oracle
# Prefer the local JDK 27 install when present; otherwise leave JAVA_HOME alone so
# mvnw falls back to the java found on PATH (env or command-line JAVA_HOME still wins).
ifneq ($(wildcard $(JDK27_HOME)/bin/java.exe),)
  export JAVA_HOME := $(JDK27_HOME)
endif
# java.exe only on Windows: on the Linux CI runner the same expansion must
# name java, or every JAVA_BIN consumer (run, screenshots, fuzz, db-hash)
# spawns a nonexistent binary.
ifeq ($(OS),Windows_NT)
  JAVA_EXE := java.exe
else
  JAVA_EXE := java
endif
JAVA_BIN := $(if $(JAVA_HOME),$(JAVA_HOME)/bin/$(JAVA_EXE),java)

MVNW := sh ./mvnw
MVN_ARGS ?=
NPM := npm
FRONTEND := frontend
NODE := $(if $(wildcard $(FRONTEND)/node/node.exe),$(FRONTEND)/node/node.exe,node)
DB_USER := root
DB_PASS := flowershop
DB_HOST := localhost
DB_PORT := 3306
export LOCAL_MYSQL_DB_HOST := $(DB_HOST)
export LOCAL_MYSQL_DB_PORT := $(DB_PORT)
export LOCAL_MYSQL_DB_USERNAME := $(DB_USER)
export LOCAL_MYSQL_DB_PASSWORD := $(DB_PASS)

.DEFAULT_GOAL := help
.PHONY: help env db-up db-down db-nuke db-seed db-seed-tcp db-reset db-hash seeds frontend-install frontend-build frontend-lint frontend-test test-coverage frontend-serve backend-test build package run screenshots audit memguard fuzz mutate mutate-front diagrams clean

# Set SKIP_DB_UP=1 when MySQL already runs elsewhere (CI service container);
# every target below then skips its db-up prerequisite.

help: ## show targets
	@grep -E '^[a-zA-Z][a-zA-Z0-9_-]*:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "%-18s %s\n", $$1, $$2}'

env: ## print resolved toolchain versions
	@echo "JAVA_HOME=$(JAVA_HOME)"
	@if [ -x "$(JDK27_HOME)/bin/java.exe" ]; then "$(JDK27_HOME)/bin/java.exe" -version; else echo "JDK27 not installed at $(JDK27_HOME)"; fi
	@$(MVNW) -v
	@docker --version
	@if [ -x "$(FRONTEND)/node/node.exe" ]; then "$(FRONTEND)/node/node.exe" -v; else node -v; fi

# The socket healthcheck passes against the entrypoint's temporary init server,
# so db-up also waits on a TCP ping only the final server answers.
db-up: ## start MySQL 9.7 container and wait until healthy
	@docker compose up -d
	@id=$$(docker compose ps -q mysql); i=0; until [ "$$(docker inspect --format '{{.State.Health.Status}}' $$id)" = "healthy" ]; do if [ $$i -ge 60 ]; then echo "mysql health wait timed out"; exit 1; fi; sleep 2; i=$$((i+1)); done; \
	until docker compose exec -T mysql mysqladmin ping -h 127.0.0.1 -u$(DB_USER) -p$(DB_PASS) >/dev/null 2>&1; do if [ $$i -ge 90 ]; then echo "mysql readiness wait timed out"; exit 1; fi; sleep 2; i=$$((i+1)); done; echo "mysql healthy"

db-down: ## stop MySQL container (keeps volume)
	@docker compose down

db-nuke: ## stop MySQL container and drop the volume
	@docker compose down -v

db-seed: ## seed schema, users, taxonomy, branches, coupons (run.sql) plus products and stock (seed.sql)
	@{ sed -E '/^(CREATE DATABASE|USE)[[:space:]]/Id' db/run.sql; cat db/seed.sql; } | docker compose exec -T mysql mysql --default-character-set=utf8mb4 -u$(DB_USER) -p$(DB_PASS) flowershop

# The CI path: the MySQL there is a service container, not the compose service
# db-seed execs into, so the same strip rule and seed stream run through the
# pinned client image over the host network. Linux only, like CI.
db-seed-tcp: ## seed the TCP MySQL at DB_HOST:DB_PORT through the pinned mysql client image (CI service container)
	@{ sed -E '/^(CREATE DATABASE|USE)[[:space:]]/Id' db/run.sql; cat db/seed.sql; } | docker run --rm -i --network host mysql:9.7.2 mysql --default-character-set=utf8mb4 -h$(DB_HOST) -P$(DB_PORT) -u$(DB_USER) -p$(DB_PASS) flowershop

db-reset: db-nuke db-up db-seed ## drop the volume, boot MySQL fresh, and seed everything

DB_HASH_PASSWORDS ?= 1234qwer 12345678

seeds: ## regenerate db/product.json and db/seed.sql from the committed product source
	@$(NODE) scripts/tools/regenerate-product-seeds.mjs

db-hash: ## print bcrypt hashes for DB_HASH_PASSWORDS (defaults: seed passwords)
	@$(MVNW) -q $(MVN_ARGS) dependency:build-classpath -Dmdep.outputFile=target/cp.txt
	@"$(JAVA_BIN)" --class-path "$$(cat target/cp.txt)" db/tools/BcryptHash.java $(DB_HASH_PASSWORDS)

frontend-install: ## clean install of the frontend lockfile (npm ci)
	@$(NPM) ci --prefix $(FRONTEND)

# Fresh-clone guard for the frontend gates: the stamp inside node_modules ties
# the install to the lockfile, dies with any reinstall, and otherwise keeps the
# prerequisite a no-op. Without it a missing install makes every spec run exit
# nonzero, which a mutation sweep would count as kills.
FRONTEND_INSTALL_STAMP := $(FRONTEND)/node_modules/.install-stamp

$(FRONTEND_INSTALL_STAMP): $(FRONTEND)/package-lock.json
	@$(NPM) ci --prefix $(FRONTEND)
	@touch $@

frontend-build: ## production build of the Angular app into src/main/resources/public
	@$(NPM) run build --prefix $(FRONTEND)

frontend-lint: ## lint the Angular app
	@$(NPM) run lint --prefix $(FRONTEND)

frontend-test: ## run the vitest suite
	@$(NPM) run test --prefix $(FRONTEND)

test-coverage: ## run the vitest suite with coverage thresholds enforced at 90 percent
	@$(NPM) run test:coverage --prefix $(FRONTEND)

frontend-serve: ## dev server on :4200 proxying /api to :8080
	@$(NPM) run start-dev --prefix $(FRONTEND)

backend-test: $(if $(SKIP_DB_UP),,db-up) ## run backend tests through verify (needs live MySQL)
	@$(MVNW) $(MVN_ARGS) verify

build: $(if $(SKIP_DB_UP),,db-up) ## build the jar, skipping tests
	@$(MVNW) $(MVN_ARGS) -DskipTests package

package: $(if $(SKIP_DB_UP),,db-up) ## full clean build: frontend + backend + tests + repackaged jar
	@$(MVNW) $(MVN_ARGS) clean package

run: $(if $(SKIP_DB_UP),,db-up) ## run the newest packaged jar against the compose MySQL
	@jar=$$(ls -t target/flowershop-*.jar 2>/dev/null | head -n 1); \
	if [ -z "$$jar" ]; then echo "no target/flowershop-*.jar; run make package first"; exit 1; fi; \
	"$(JAVA_BIN)" -jar $$jar

screenshots: db-up ## capture the current UI into project-pictures (runs the packaged jar headlessly)
	@$(NPM) install --prefix scripts/screenshots
	@JAVA_BIN="$(JAVA_BIN)" node scripts/screenshots/capture.mjs

audit: ## npm audit, prod and dev, 0 vulnerabilities or fail
	@$(NPM) audit --omit=dev --prefix $(FRONTEND)
	@$(NPM) audit --prefix $(FRONTEND)
	@$(NPM) audit --prefix scripts/screenshots

memguard: ## enforce the 4 GB aggregated project-process cap, kill the largest offender on breach
	@pwsh.exe -NoProfile -File scripts/tools/memguard.ps1

fuzz: $(if $(SKIP_DB_UP),,db-up) ## run the API fuzz harness against the packaged jar, write docs/qa/fuzz-report.md
	@JAVA_BIN="$(JAVA_BIN)" node scripts/tools/fuzz-api.mjs

mutate: $(if $(SKIP_DB_UP),,db-up) ## run the source-level mutation harness, write docs/qa/mutation-report.md
	@node scripts/tools/mutate.mjs

mutate-front: $(FRONTEND_INSTALL_STAMP) ## run the frontend source-level mutation harness, write docs/qa/mutation-front-report.md
	@node scripts/tools/mutate-front.mjs

# Pinned PlantUML for the diagram renders; the jar stays in gitignored .tools/
# and the digest pins the download, with the observed checksum logged beside it.
PLANTUML_VERSION ?= 1.2026.8
PLANTUML_SHA256 ?= 5e1ecfa8ecd32c90b03bbf3b1eb6f020943f98ab0fcf4032be31a0002ee2c462
PLANTUML_JAR := .tools/plantuml-$(PLANTUML_VERSION).jar
PLANTUML_URL := https://github.com/plantuml/plantuml/releases/download/v$(PLANTUML_VERSION)/plantuml-$(PLANTUML_VERSION).jar

$(PLANTUML_JAR):
	@mkdir -p .tools
	@curl -fsSL -o $@.part "$(PLANTUML_URL)"
	@echo "$(PLANTUML_SHA256)  $@.part" | sha256sum -c - >/dev/null || { rm -f $@.part; echo "checksum mismatch on $(notdir $@)"; exit 1; }
	@mv $@.part $@
	@sha256sum $@ | tee $@.sha256

diagrams: $(PLANTUML_JAR) ## render every docs/diagrams/*.puml to PNG (Smetana layout, no graphviz)
	@"$(JAVA_BIN)" -jar $(PLANTUML_JAR) -Playout=smetana -tpng docs/diagrams/*.puml
	@echo "rendered $$(ls docs/diagrams/*.png | wc -l) PNGs"

clean: ## maven clean and drop node_modules
	@$(MVNW) $(MVN_ARGS) clean
	@rm -rf $(FRONTEND)/node_modules
