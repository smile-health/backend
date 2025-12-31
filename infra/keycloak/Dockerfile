ARG KC_VERSION

# image: quay.io/keycloak/keycloak:${KC_VERSION}
FROM quay.io/keycloak/keycloak:${KC_VERSION}

# Switch to the non-root keycloak user
USER keycloak

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health/ready || exit 1

CMD ["start-dev", "--import-realm"]