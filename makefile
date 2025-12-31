# Platform Backend Environment Management Makefile
# This makefile helps switch between different environment configurations
# for all services (excluding 3.0 and platform folders)

# Define the services to manage
SERVICES := auth-service core main sync-service warehouse-service

# Environment file mappings
# .env = production (default)
# .env.production.local = production (shared from root)
# .env.test.local = development (shared from root)
# .env.staging.local = staging (shared from root)

# Colors for output
RED := \033[31m
GREEN := \033[32m
YELLOW := \033[33m
BLUE := \033[34m
RESET := \033[0m

.PHONY: help env-prod env-dev env-staging env-status env-backup env-restore clean-env

# Default target
help:
	@echo "$(BLUE)Platform Backend Environment Management$(RESET)"
	@echo ""
	@echo "$(YELLOW)Available commands:$(RESET)"
	@echo "  $(GREEN)env-prod$(RESET)     - Switch all services to production environment (.env)"
	@echo "  $(GREEN)env-dev$(RESET)      - Switch all services to development environment (.env.test.local)"
	@echo "  $(GREEN)env-staging$(RESET)  - Switch all services to staging environment (.env.staging.local)"
	@echo "  $(GREEN)env-status$(RESET)   - Show current environment status for all services"
	@echo "  $(GREEN)env-backup$(RESET)   - Backup current .env files to .env.backup"
	@echo "  $(GREEN)env-restore$(RESET)  - Restore .env files from .env.backup"
	@echo "  $(GREEN)clean-env$(RESET)    - Remove all .env files (use with caution!)"
	@echo ""
	@echo "$(YELLOW)Services managed:$(RESET) $(SERVICES)"
	@echo ""
	@echo "$(YELLOW)Environment file mapping:$(RESET)"
	@echo "  Production:  .env (default)"
	@echo "  Production:  .env.production.local (shared from root)"
	@echo "  Development: .env.test.local (shared from root)"
	@echo "  Staging:     .env.staging.local (shared from root)"

# Switch to production environment
env-prod:
	@echo "$(BLUE)Switching all services to PRODUCTION environment...$(RESET)"
	@if [ -f ".env.production.local" ]; then \
		echo "$(GREEN)✓$(RESET) Found shared .env.production.local in root"; \
		for service in $(SERVICES); do \
			echo "$(GREEN)✓$(RESET) Distributing production env to $$service"; \
			cp ".env.production.local" "apps/$$service/.env"; \
		done; \
	else \
		echo "$(RED)✗$(RESET) No shared .env.production.local found in root directory"; \
		echo "$(YELLOW)ℹ$(RESET) Falling back to individual service files..."; \
		for service in $(SERVICES); do \
			if [ -f "apps/$$service/.env.production.local" ]; then \
				echo "$(GREEN)✓$(RESET) Setting up production env for $$service"; \
				cp "apps/$$service/.env.production.local" "apps/$$service/.env"; \
			elif [ -f "apps/$$service/.env.example" ]; then \
				echo "$(YELLOW)⚠$(RESET) No .env.production.local found for $$service, using .env.example"; \
				cp "apps/$$service/.env.example" "apps/$$service/.env"; \
			else \
				echo "$(RED)✗$(RESET) No production env file found for $$service"; \
			fi; \
		done; \
	fi
	@echo "$(GREEN)Production environment setup complete!$(RESET)"

# Switch to development environment
env-dev:
	@echo "$(BLUE)Switching all services to DEVELOPMENT environment...$(RESET)"
	@if [ -f ".env.test.local" ]; then \
		echo "$(GREEN)✓$(RESET) Found shared .env.test.local in root"; \
		for service in $(SERVICES); do \
			echo "$(GREEN)✓$(RESET) Distributing development env to $$service"; \
			cp ".env.test.local" "apps/$$service/.env"; \
		done; \
	else \
		echo "$(RED)✗$(RESET) No shared .env.test.local found in root directory"; \
		echo "$(YELLOW)ℹ$(RESET) Falling back to individual service files..."; \
		for service in $(SERVICES); do \
			if [ -f "apps/$$service/.env.test.local" ]; then \
				echo "$(GREEN)✓$(RESET) Setting up development env for $$service"; \
				cp "apps/$$service/.env.test.local" "apps/$$service/.env"; \
			elif [ -f "apps/$$service/.env.test" ]; then \
				echo "$(GREEN)✓$(RESET) Setting up development env for $$service (using .env.test)"; \
				cp "apps/$$service/.env.test" "apps/$$service/.env"; \
			else \
				echo "$(RED)✗$(RESET) No development env file found for $$service"; \
			fi; \
		done; \
	fi
	@echo "$(GREEN)Development environment setup complete!$(RESET)"

# Switch to staging environment
env-staging:
	@echo "$(BLUE)Switching all services to STAGING environment...$(RESET)"
	@if [ -f ".env.staging.local" ]; then \
		echo "$(GREEN)✓$(RESET) Found shared .env.staging.local in root"; \
		for service in $(SERVICES); do \
			echo "$(GREEN)✓$(RESET) Distributing staging env to $$service"; \
			cp ".env.staging.local" "apps/$$service/.env"; \
		done; \
	else \
		echo "$(RED)✗$(RESET) No shared .env.staging.local found in root directory"; \
		echo "$(YELLOW)ℹ$(RESET) Falling back to individual service files..."; \
		for service in $(SERVICES); do \
			if [ -f "apps/$$service/.env.staging.local" ]; then \
				echo "$(GREEN)✓$(RESET) Setting up staging env for $$service"; \
				cp "apps/$$service/.env.staging.local" "apps/$$service/.env"; \
			else \
				echo "$(RED)✗$(RESET) No staging env file found for $$service"; \
				echo "$(YELLOW)ℹ$(RESET) Creating staging env from .env.example for $$service"; \
				if [ -f "apps/$$service/.env.example" ]; then \
					cp "apps/$$service/.env.example" "apps/$$service/.env.staging.local"; \
					cp "apps/$$service/.env.staging.local" "apps/$$service/.env"; \
					echo "$(YELLOW)⚠$(RESET) Please edit apps/$$service/.env.staging.local with staging values"; \
				else \
					echo "$(RED)✗$(RESET) No .env.example found for $$service"; \
				fi; \
			fi; \
		done; \
	fi
	@echo "$(GREEN)Staging environment setup complete!$(RESET)"

# Show current environment status
env-status:
	@echo "$(BLUE)Current Environment Status:$(RESET)"
	@echo ""
	@for service in $(SERVICES); do \
		echo "$(YELLOW)$$service:$(RESET)"; \
		if [ -f "apps/$$service/.env" ]; then \
			echo "  $(GREEN)✓$(RESET) .env exists"; \
			if [ -f "apps/$$service/.env.test.local" ] && cmp -s "apps/$$service/.env" "apps/$$service/.env.test.local"; then \
				echo "  $(BLUE)→$(RESET) Currently using: DEVELOPMENT (.env.test.local)"; \
			elif [ -f "apps/$$service/.env.test" ] && cmp -s "apps/$$service/.env" "apps/$$service/.env.test"; then \
				echo "  $(BLUE)→$(RESET) Currently using: DEVELOPMENT (.env.test)"; \
			elif [ -f "apps/$$service/.env.staging.local" ] && cmp -s "apps/$$service/.env" "apps/$$service/.env.staging.local"; then \
				echo "  $(BLUE)→$(RESET) Currently using: STAGING (.env.staging.local)"; \
			elif [ -f ".env.production.local" ] && cmp -s "apps/$$service/.env" ".env.production.local"; then \
				echo "  $(BLUE)→$(RESET) Currently using: PRODUCTION (shared .env.production.local)"; \
			elif [ -f ".env.test.local" ] && cmp -s "apps/$$service/.env" ".env.test.local"; then \
				echo "  $(BLUE)→$(RESET) Currently using: DEVELOPMENT (shared .env.test.local)"; \
			elif [ -f ".env.staging.local" ] && cmp -s "apps/$$service/.env" ".env.staging.local"; then \
				echo "  $(BLUE)→$(RESET) Currently using: STAGING (shared .env.staging.local)"; \
			elif [ -f "apps/$$service/.env.production.local" ] && cmp -s "apps/$$service/.env" "apps/$$service/.env.production.local"; then \
				echo "  $(BLUE)→$(RESET) Currently using: PRODUCTION (.env.production.local)"; \
			elif [ -f "apps/$$service/.env.example" ] && cmp -s "apps/$$service/.env" "apps/$$service/.env.example"; then \
				echo "  $(BLUE)→$(RESET) Currently using: PRODUCTION (.env.example)"; \
			else \
				echo "  $(BLUE)→$(RESET) Currently using: CUSTOM/UNKNOWN"; \
			fi; \
		else \
			echo "  $(RED)✗$(RESET) .env missing"; \
		fi; \
		echo ""; \
	done

# Backup current environment files
env-backup:
	@echo "$(BLUE)Backing up current .env files...$(RESET)"
	@for service in $(SERVICES); do \
		if [ -f "apps/$$service/.env" ]; then \
			echo "$(GREEN)✓$(RESET) Backing up $$service/.env"; \
			cp "apps/$$service/.env" "apps/$$service/.env.backup"; \
		else \
			echo "$(YELLOW)⚠$(RESET) No .env file to backup for $$service"; \
		fi; \
	done
	@echo "$(GREEN)Backup complete!$(RESET)"

# Restore environment files from backup
env-restore:
	@echo "$(BLUE)Restoring .env files from backup...$(RESET)"
	@for service in $(SERVICES); do \
		if [ -f "apps/$$service/.env.backup" ]; then \
			echo "$(GREEN)✓$(RESET) Restoring $$service/.env"; \
			cp "apps/$$service/.env.backup" "apps/$$service/.env"; \
		else \
			echo "$(RED)✗$(RESET) No backup file found for $$service"; \
		fi; \
	done
	@echo "$(GREEN)Restore complete!$(RESET)"

# Clean all .env files (use with caution)
clean-env:
	@echo "$(RED)⚠ WARNING: This will remove all .env files!$(RESET)"
	@echo "$(YELLOW)Press Ctrl+C to cancel, or Enter to continue...$(RESET)"
	@read dummy
	@for service in $(SERVICES); do \
		if [ -f "apps/$$service/.env" ]; then \
			echo "$(RED)✗$(RESET) Removing $$service/.env"; \
			rm "apps/$$service/.env"; \
		fi; \
	done
	@echo "$(RED)All .env files removed!$(RESET)"

# Individual service commands
auth-prod:
	@echo "$(BLUE)Setting auth-service to production...$(RESET)"
	@cp ".env.production.local" "apps/auth-service/.env" 2>/dev/null || cp "apps/auth-service/.env.production.local" "apps/auth-service/.env" 2>/dev/null || cp "apps/auth-service/.env.example" "apps/auth-service/.env" 2>/dev/null || echo "$(RED)✗$(RESET) Failed to set production env for auth-service"

auth-dev:
	@echo "$(BLUE)Setting auth-service to development...$(RESET)"
	@cp ".env.test.local" "apps/auth-service/.env" 2>/dev/null || cp "apps/auth-service/.env.test.local" "apps/auth-service/.env" 2>/dev/null || cp "apps/auth-service/.env.test" "apps/auth-service/.env" 2>/dev/null || echo "$(RED)✗$(RESET) No dev env file found for auth-service"

core-prod:
	@echo "$(BLUE)Setting core to production...$(RESET)"
	@cp ".env.production.local" "apps/core/.env" 2>/dev/null || cp "apps/core/.env.production.local" "apps/core/.env" 2>/dev/null || cp "apps/core/.env.example" "apps/core/.env" 2>/dev/null || echo "$(RED)✗$(RESET) Failed to set production env for core"

core-dev:
	@echo "$(BLUE)Setting core to development...$(RESET)"
	@cp ".env.test.local" "apps/core/.env" 2>/dev/null || cp "apps/core/.env.test.local" "apps/core/.env" 2>/dev/null || cp "apps/core/.env.test" "apps/core/.env" 2>/dev/null || echo "$(RED)✗$(RESET) No dev env file found for core"

main-prod:
	@echo "$(BLUE)Setting main to production...$(RESET)"
	@cp ".env.production.local" "apps/main/.env" 2>/dev/null || cp "apps/main/.env.production.local" "apps/main/.env" 2>/dev/null || cp "apps/main/.env.example" "apps/main/.env" 2>/dev/null || echo "$(RED)✗$(RESET) Failed to set production env for main"

main-dev:
	@echo "$(BLUE)Setting main to development...$(RESET)"
	@cp ".env.test.local" "apps/main/.env" 2>/dev/null || cp "apps/main/.env.test.local" "apps/main/.env" 2>/dev/null || cp "apps/main/.env.test" "apps/main/.env" 2>/dev/null || echo "$(RED)✗$(RESET) No dev env file found for main"

sync-prod:
	@echo "$(BLUE)Setting sync-service to production...$(RESET)"
	@cp ".env.production.local" "apps/sync-service/.env" 2>/dev/null || cp "apps/sync-service/.env.production.local" "apps/sync-service/.env" 2>/dev/null || cp "apps/sync-service/.env.example" "apps/sync-service/.env" 2>/dev/null || echo "$(RED)✗$(RESET) Failed to set production env for sync-service"

sync-dev:
	@echo "$(BLUE)Setting sync-service to development...$(RESET)"
	@cp ".env.test.local" "apps/sync-service/.env" 2>/dev/null || cp "apps/sync-service/.env.test.local" "apps/sync-service/.env" 2>/dev/null || cp "apps/sync-service/.env.test" "apps/sync-service/.env" 2>/dev/null || echo "$(RED)✗$(RESET) No dev env file found for sync-service"

warehouse-prod:
	@echo "$(BLUE)Setting warehouse-service to production...$(RESET)"
	@cp ".env.production.local" "apps/warehouse-service/.env" 2>/dev/null || cp "apps/warehouse-service/.env.production.local" "apps/warehouse-service/.env" 2>/dev/null || cp "apps/warehouse-service/.env.example" "apps/warehouse-service/.env" 2>/dev/null || echo "$(RED)✗$(RESET) Failed to set production env for warehouse-service"

warehouse-dev:
	@echo "$(BLUE)Setting warehouse-service to development...$(RESET)"
	@cp ".env.test.local" "apps/warehouse-service/.env" 2>/dev/null || cp "apps/warehouse-service/.env.test.local" "apps/warehouse-service/.env" 2>/dev/null || cp "apps/warehouse-service/.env.test" "apps/warehouse-service/.env" 2>/dev/null || echo "$(RED)✗$(RESET) No dev env file found for warehouse-service"

auth-staging:
	@echo "$(BLUE)Setting auth-service to staging...$(RESET)"
	@cp ".env.staging.local" "apps/auth-service/.env" 2>/dev/null || cp "apps/auth-service/.env.staging.local" "apps/auth-service/.env" 2>/dev/null || cp "apps/auth-service/.env.staging" "apps/auth-service/.env" 2>/dev/null || echo "$(RED)✗$(RESET) No staging env file found for auth-service"

core-staging:
	@echo "$(BLUE)Setting core to staging...$(RESET)"
	@cp ".env.staging.local" "apps/core/.env" 2>/dev/null || cp "apps/core/.env.staging.local" "apps/core/.env" 2>/dev/null || cp "apps/core/.env.staging" "apps/core/.env" 2>/dev/null || echo "$(RED)✗$(RESET) No staging env file found for core"

main-staging:
	@echo "$(BLUE)Setting main to staging...$(RESET)"
	@cp ".env.staging.local" "apps/main/.env" 2>/dev/null || cp "apps/main/.env.staging.local" "apps/main/.env" 2>/dev/null || cp "apps/main/.env.staging" "apps/main/.env" 2>/dev/null || echo "$(RED)✗$(RESET) No staging env file found for main"

sync-staging:
	@echo "$(BLUE)Setting sync-service to staging...$(RESET)"
	@cp ".env.staging.local" "apps/sync-service/.env" 2>/dev/null || cp "apps/sync-service/.env.staging.local" "apps/sync-service/.env" 2>/dev/null || cp "apps/sync-service/.env.staging" "apps/sync-service/.env" 2>/dev/null || echo "$(RED)✗$(RESET) No staging env file found for sync-service"

warehouse-staging:
	@echo "$(BLUE)Setting warehouse-service to staging...$(RESET)"
	@cp ".env.staging.local" "apps/warehouse-service/.env" 2>/dev/null || cp "apps/warehouse-service/.env.staging.local" "apps/warehouse-service/.env" 2>/dev/null || cp "apps/warehouse-service/.env.staging" "apps/warehouse-service/.env" 2>/dev/null || echo "$(RED)✗$(RESET) No staging env file found for warehouse-service"