# **Auth Service**

## **Overview**

The Auth Service is a microservice built using the Hono framework, responsible for handling authentication-related tasks. This service is part of the larger `backend` monorepo, managed by Turborepo.

## **Project Structure**

The Auth Service is located within the `backend` monorepo, under the `auth-service` directory.

```
auth-service/
├── src/
│   ├── config/
│   │   └── keycloakConfig.ts
│   ├── controllers/
│   │   └── authController.ts
|   |── routes/
│   │   └── authRoutes.ts
│   ├── schemas/
│   │   └── authSchemas.ts
│   ├── services/
│   │   └── keycloakClient.ts
│   ├── utils/
│   │   └── logger.ts
│   └── index.ts
├── tests/
│   |── authController.test.ts
|   └── setup.ts
├── tsconfig.json
├── .env
├── Dockerfile
├── package.json
└── vitest.config.ts
```

## **Dependencies**

- Hono framework and other listed in `package.json`
- `Keycloak` (containerized using Docker Compose)

## **Setup and Installation**

1. Clone the `backend` monorepo and navigate to the `auth-service` directory to update `.env` if needed.
2. Ensure you have Docker and Docker Compose installed on your machine.
3. From the root of the `backend` repository, run `docker-compose up` to start the Keycloak container. It should come up at http://localhost:8081 by default.
4. Install dependencies using `pnpm install` from the root of `backend` repository.

## **Running the Service**

1. Start the Auth Service using `npm run dev` from the root of `backend` repository for running with turbo repo or from the root directory of the service itself to run individually.
2. The service will be available at `http://localhost:3000` (or a different port specified in the `.env` file).

## **Testing and Debugging**

1. The service has comphrehensive test suite available written using `vitest` library.
2. All the tests can be executed using `npm run test` either from the service root directory or with same command from the `backend` repository root directory.
3. To run individual tests, you can use either the 'vitest VSCode plug-in' or the 'vitest CLI' itself.
4. There is no specific requirement for debugging of this application.

## **Documentation & Development Guidelines**

- The Service has `OpenAPI Specs` and `Swagger UI` available out of the box which can be accessed from `/doc` and `/ui` endpoints respectively.
- For further understanding and documentation, you can visit the [confluence page](https://unicc.atlassian.net/wiki/x/RgDDQwE) of this service.

## **Versioning & Change Log**

- Current Version : 1.0.0 (Under Development)
