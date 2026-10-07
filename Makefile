SHELL := /usr/bin/sh

JDK27_HOME ?= $(subst \,/,$(USERPROFILE))/dev/jdk/jdk-27_oracle
# Prefer the local JDK 27 install when present; otherwise leave JAVA_HOME alone so
# mvnw falls back to the java found on PATH (env or command-line JAVA_HOME still wins).
ifneq ($(wildcard $(JDK27_HOME)/bin/java.exe),)
  export JAVA_HOME := $(JDK27_HOME)
endif
JAVA_BIN := $(if $(JAVA_HOME),$(JAVA_HOME)/bin/java.exe,java)

MVNW := sh ./mvnw
MVN_ARGS ?=
NPM := npm
FRONTEND := frontend
DB_USER := root
DB_PASS := flowershop
DB_HOST := localhost
DB_PORT := 3306
export LOCAL_MYSQL_DB_HOST := $(DB_HOST)
export LOCAL_MYSQL_DB_PORT := $(DB_PORT)
export LOCAL_MYSQL_DB_USERNAME := $(DB_USER)
export LOCAL_MYSQL_DB_PASSWORD := $(DB_PASS)

.DEFAULT_GOAL := help
.PHONY: help env db-up db-down db-nuke db-seed db-hash frontend-install frontend-build frontend-lint frontend-test test-coverage frontend-serve backend-test build package run screenshots audit memguard clean

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

db-up: ## start MySQL 9.7 container and wait until healthy
	@docker compose up -d
	@id=$$(docker compose ps -q mysql); i=0; until [ "$$(docker inspect --format '{{.State.Health.Status}}' $$id)" = "healthy" ]; do if [ $$i -ge 60 ]; then echo "mysql health wait timed out"; exit 1; fi; sleep 2; i=$$((i+1)); done; echo "mysql healthy"

db-down: ## stop MySQL container (keeps volume)
	@docker compose down

db-nuke: ## stop MySQL container and drop the volume
	@docker compose down -v

db-seed: ## seed the database from db/run.sql (skips its create-database preamble)
	@tail -n +3 db/run.sql | docker compose exec -T mysql mysql --default-character-set=utf8mb4 -u$(DB_USER) -p$(DB_PASS) flowershop

DB_HASH_PASSWORDS ?= 1234qwer 12345678

db-hash: ## print bcrypt hashes for DB_HASH_PASSWORDS (defaults: seed passwords)
	@$(MVNW) -q $(MVN_ARGS) dependency:build-classpath -Dmdep.outputFile=target/cp.txt
	@"$(JAVA_BIN)" --class-path "$$(cat target/cp.txt)" db/tools/BcryptHash.java $(DB_HASH_PASSWORDS)

frontend-install: ## clean install of the frontend lockfile (npm ci)
	@$(NPM) ci --prefix $(FRONTEND)

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

run: $(if $(SKIP_DB_UP),,db-up) ## run the packaged jar against the compose MySQL
	@"$(JAVA_BIN)" -jar target/flowershop-2.0.jar

screenshots: db-up ## capture the current UI into project-pictures (runs the packaged jar headlessly)
	@$(NPM) install --prefix scripts/screenshots
	@JAVA_BIN="$(JAVA_BIN)" node scripts/screenshots/capture.mjs

audit: ## npm audit, prod and dev, 0 vulnerabilities or fail
	@$(NPM) audit --omit=dev --prefix $(FRONTEND)
	@$(NPM) audit --prefix $(FRONTEND)
	@$(NPM) audit --prefix scripts/screenshots

memguard: ## enforce the 4 GB aggregated project-process cap, kill the largest offender on breach
	@pwsh.exe -NoProfile -File scripts/tools/memguard.ps1

clean: ## maven clean and drop node_modules
	@$(MVNW) $(MVN_ARGS) clean
	@rm -rf $(FRONTEND)/node_modules
