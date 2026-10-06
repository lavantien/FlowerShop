SHELL := /usr/bin/sh

JDK27_HOME ?= $(subst \,/,$(USERPROFILE))/dev/jdk/jdk-27_oracle
JAVA_HOME ?= $(JDK27_HOME)
export JAVA_HOME

MVNW := sh ./mvnw
MVN_ARGS ?=
NPM := npm
FRONTEND := frontend
DB_USER := root
DB_PASS := flowershop

.DEFAULT_GOAL := help
.PHONY: help env db-up db-down db-nuke db-seed frontend-install frontend-build frontend-lint frontend-test frontend-serve backend-test build package run audit clean

help: ## show targets
	@grep -E '^[a-zA-Z][a-zA-Z0-9_-]*:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "%-18s %s\n", $$1, $$2}'

env: ## print resolved toolchain versions
	@echo "JAVA_HOME=$(JAVA_HOME)"
	@if [ -x "$(JDK27_HOME)/bin/java.exe" ]; then "$(JDK27_HOME)/bin/java.exe" -version; else echo "JDK27 not installed at $(JDK27_HOME)"; fi
	@$(MVNW) -v
	@docker --version
	@if [ -x "$(FRONTEND)/node/node.exe" ]; then "$(FRONTEND)/node/node.exe" -v; else node -v; fi

db-up: ## start MySQL 8.4 container and wait until healthy
	@docker compose up -d
	@id=$$(docker compose ps -q mysql); i=0; until [ "$$(docker inspect --format '{{.State.Health.Status}}' $$id)" = "healthy" ]; do if [ $$i -ge 60 ]; then echo "mysql health wait timed out"; exit 1; fi; sleep 2; i=$$((i+1)); done; echo "mysql healthy"

db-down: ## stop MySQL container (keeps volume)
	@docker compose down

db-nuke: ## stop MySQL container and drop the volume
	@docker compose down -v

db-seed: ## seed the database from db/run.sql
	@docker compose exec -T mysql mysql -u$(DB_USER) -p$(DB_PASS) flowershop < db/run.sql

frontend-install: ## npm install in frontend
	@$(NPM) install --prefix $(FRONTEND)

frontend-build: ## production build of the Angular app into src/main/resources/public
	@$(NPM) run build --prefix $(FRONTEND)

frontend-lint: ## lint the Angular app
	@$(NPM) run lint --prefix $(FRONTEND)

frontend-test: ## run the vitest suite
	@$(NPM) run test --prefix $(FRONTEND)

frontend-serve: ## dev server on :4200 proxying /api to :8080
	@$(NPM) run start-dev --prefix $(FRONTEND)

backend-test: db-up ## run backend tests (contextLoads needs live MySQL)
	@$(MVNW) $(MVN_ARGS) test

build: db-up ## build the jar, skipping tests
	@$(MVNW) $(MVN_ARGS) -DskipTests package

package: db-up ## full clean build: frontend + backend + tests + repackaged jar
	@$(MVNW) $(MVN_ARGS) clean package

run: db-up ## run the packaged jar against the compose MySQL
	@LOCAL_MYSQL_DB_HOST=localhost LOCAL_MYSQL_DB_PORT=3306 LOCAL_MYSQL_DB_USERNAME=$(DB_USER) LOCAL_MYSQL_DB_PASSWORD=$(DB_PASS) "$(JDK27_HOME)/bin/java.exe" -jar target/flowershop-1.1.jar

audit: ## npm audit, prod and dev, 0 vulnerabilities or fail
	@$(NPM) audit --omit=dev --prefix $(FRONTEND)
	@$(NPM) audit --prefix $(FRONTEND)

clean: ## maven clean and drop node_modules
	@$(MVNW) $(MVN_ARGS) clean
	@rm -rf $(FRONTEND)/node_modules
