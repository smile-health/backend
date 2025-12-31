# Auth Service API Documentation

## Authentication Endpoints

### Login

Authenticates a user and returns an access token.

**Endpoint:** `POST /auth/login`

**Request Headers:**

- `Content-Type: application/json`
- `fcm_token` (optional): Firebase Cloud Messaging token
- `device-type` (optional): Device type identifier
- `Accept-Language` (optional): User's preferred language

**Request Body:**

```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200 OK):**

```json
{
  "authDetails": {
    "access_token": "string",
    "token_type": "string",
    "expires_in": number
  }
}
```

**Error Responses:**

- 400 Bad Request: Invalid request body or missing credentials
- 401 Unauthorized: Invalid username or password
- 403 Forbidden: Device not allowed (operators can only login from mobile devices)
- 404 Not Found: User not found in database
- 500 Internal Server Error: Server error during authentication

**Device Type Validation:**

- Users with OPERATOR or OPERATOR COVID roles are restricted from logging in via `web` or `monitor` device types
- These users can only access the system through mobile devices
- Device type is determined by the `device-type` header (defaults to "web" if not provided)

### Validate Token

Validates an access token and returns user information.

**Endpoint:** `GET /auth/validate`

**Request Headers:**

- `Authorization: Bearer <token>`

**Response (200 OK):**

```json
{
  "userInfo": {
    "sub": "string",
    "username": "string",
    "email": "string"
  }
}
```

**Error Responses:**

- 400 Bad Request: Missing or invalid Authorization header
- 401 Unauthorized: Invalid or expired token
- 500 Internal Server Error: Server error during validation

### Logout

Invalidates the current access token.

**Endpoint:** `POST /auth/logout`

**Request Headers:**

- `Authorization: Bearer <token>`

**Response (200 OK):**

```json
{}
```

**Error Responses:**

- 400 Bad Request: Missing or invalid Authorization header
- 401 Unauthorized: Invalid or expired token
- 404 Not Found: User not found
- 500 Internal Server Error: Server error during logout

## User Management Endpoints

### Create User

Creates a new user account.

**Endpoint:** `POST /users`

**Request Headers:**

- `Content-Type: application/json`

**Request Body:**

```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Response (201 Created):**

```json
{
  "id": "string"
}
```

**Response Headers:**

- `Location: /users/{id}`

**Error Responses:**

- 400 Bad Request: Invalid request body
- 500 Internal Server Error: Server error during user creation

### Get User

Retrieves user information by ID.

**Endpoint:** `GET /users/{id}`

**Response (200 OK):**

```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "created_at": "string",
  "updated_at": "string"
}
```

**Error Responses:**

- 400 Bad Request: Invalid user ID
- 404 Not Found: User not found
- 500 Internal Server Error: Server error during retrieval

### Update User

Updates user information.

**Endpoint:** `PUT /users/{id}`

**Request Headers:**

- `Content-Type: application/json`

**Request Body:**

```json
{
  "email": "string",
  "password": "string" (optional)
}
```

**Response (200 OK):**

```json
{
  "id": "string"
}
```

**Error Responses:**

- 400 Bad Request: Invalid request body or user ID
- 404 Not Found: User not found
- 409 Conflict: Email already in use
- 500 Internal Server Error: Server error during update

### Delete User

Deletes a user account.

**Endpoint:** `DELETE /users/{id}`

**Response (200 OK):**

```json
{}
```

**Error Responses:**

- 400 Bad Request: Invalid user ID
- 404 Not Found: User not found
- 500 Internal Server Error: Server error during deletion
