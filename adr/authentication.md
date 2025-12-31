# Authentication

## Login Request

```javascript
const postRequest = {
  url: `${baseUrl}/auth/login`,
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "Device-Type": "web",
  },
  body: {
    mode: "urlencoded",
    urlencoded: [
      { key: "username", value: username },
      { key: "password", value: password },
    ],
  },
};
```

## Using Access Token for Authentication

After a successful login, you'll receive an authentication token in the response. This token should be included in subsequent API requests to authenticate the user.

```javascript
// Example response from login
// The access token is available in responseData.authDetails.access_token

// Use the access token in subsequent requests
const authenticatedRequest = {
  url: `${baseUrl}/some-protected-endpoint`,
  method: "GET",
  headers: {
    Authorization: `Bearer ${responseData.authDetails.access_token}`,
    "Content-Type": "application/json",
  },
};
```

### Token Lifecycle

- The access token has a limited validity period
- Include the token in the Authorization header as a Bearer token
- For any 401 Unauthorized responses, redirect the user to login again
