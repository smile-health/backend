# Base image: Use the official Bun image
FROM oven/bun:1 AS base

# Install Node.js and pnpm
RUN apt-get update && \
    apt-get install -y --no-install-recommends jq wget ca-certificates && \
    update-ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash && \
    apt-get install -y --no-install-recommends nodejs npm && \
#     apt-get install -y --no-install-recommends build-essential python3 g++ make && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm@8.15.6

# Create a non-root user
RUN groupadd -r appuser && useradd -r -g appuser -m appuser

# Set the working directory and change ownership
WORKDIR /app
RUN chown appuser:appuser /app

# Ensure npm, bun, and pnpm are in PATH for the appuser
ENV PATH="/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/appuser/.local/bin:/app/node_modules/.bin"

# Switch to the non-root user
USER appuser

# Copy your application files with proper ownership
COPY --chown=appuser:appuser . .

# Install dependencies (using pnpm instead of npm)
RUN pnpm install

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Set the default command to run your application
CMD ["bun", "run", "src/index.ts"]