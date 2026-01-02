# Authentication & Authorization Implementation

## Summary

Implemented comprehensive authentication and authorization for the Todo List API, addressing critical security vulnerabilities identified in the code analysis.

## Changes Made

### 1. Authentication Middleware (`src/lib/auth.ts`)

Created two middleware modules:

#### `authMiddleware` (Required Authentication)

- Verifies JWT tokens from Authorization header or cookies
- Injects `userId` into request context
- Returns 401 error if token is missing/invalid
- Used by all protected routes

#### `optionalAuth` (Optional Authentication)

- Same token verification but doesn't require authentication
- Returns `userId: undefined` if not authenticated
- Useful for public endpoints that enhance behavior when authenticated

**Key Features**:

- Dual auth source support: Bearer token (API) or HttpOnly cookie (browser)
- Priority: Authorization header > Cookie
- Secure token verification with proper error codes
- Type-safe context injection

### 2. Todo Router Authorization (`src/routers/todo.ts`)

**All endpoints now require authentication**:

| Endpoint                | Method     | Authorization Rule                   |
| ----------------------- | ---------- | ------------------------------------ |
| `GET /api/todos`        | List todos | Users see only their own todos       |
| `GET /api/todos/:id`    | Get single | 403 if accessing another user's todo |
| `POST /api/todos`       | Create     | Auto-assigns to authenticated user   |
| `PUT /api/todos/:id`    | Update     | 403 if not owner                     |
| `DELETE /api/todos/:id` | Delete     | 403 if not owner                     |

**Security Improvements**:

- Removed manual `userId` from query params (was insecure)
- `userId` now injected from verified JWT token
- All operations filtered by authenticated user
- Proper 404 vs 403 distinction (resource not found vs access denied)
- Input validation: title length (1-200 chars)
- Better error messages with consistent format

**Before** (Vulnerable):

```typescript
GET /api/todos?userId=abc123  // ❌ User could fake this
```

**After** (Secure):

```typescript
GET / api / todos;
Authorization: Bearer<token>; // ✅ userId from verified token
```

### 3. User Router Security (`src/routers/user.ts`)

**Fixed Critical Issues**:

- ✅ Removed password from API responses (was exposed in schema)
- ✅ Added authentication to all user endpoints
- ✅ Implemented ownership checks
- ✅ Added HttpOnly cookie on login

**New Endpoints**:

- `GET /api/users/me` - Get current user profile (recommended)
- `GET /api/users` - List users (returns counts instead of full relations)
- `GET /api/users/:id` - Get user by ID (can only access own profile)

**Login Improvements**:

```typescript
// Before: Only returned token
{ token: "..." }

// After: Token + cookie + user info
{
  message: "Login successful",
  status: "success",
  data: {
    token: "...",
    userId: "...",
    email: "..."
  }
}
// + HttpOnly cookie set automatically
```

**Cookie Configuration**:

- `httpOnly: true` - Prevents XSS attacks
- `maxAge: 7 days` - Auto-expires after 7 days
- `sameSite: lax` - CSRF protection
- `path: /` - Available to all routes

### 4. Performance Optimization

**Fixed N+1 Query Issue**:

```typescript
// Before: Loaded ALL todos/posts for ALL users
const users = await prisma.user.findMany({
  select: { id: true, email: true, todos: true, posts: true },
});

// After: Only counts
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    _count: { select: { todos: true, posts: true } },
  },
});
```

## Security Fixes Applied

| Issue                       | Severity | Status   | Fix                                    |
| --------------------------- | -------- | -------- | -------------------------------------- |
| Password exposed in API     | CRITICAL | ✅ Fixed | Removed from select queries            |
| No authentication on todos  | CRITICAL | ✅ Fixed | Added authMiddleware                   |
| No authentication on users  | CRITICAL | ✅ Fixed | Added authMiddleware                   |
| No authorization checks     | HIGH     | ✅ Fixed | Ownership validation on all operations |
| Inconsistent error handling | MEDIUM   | ✅ Fixed | Standardized 401/403/404 responses     |
| Input validation missing    | MEDIUM   | ✅ Fixed | Added length constraints               |
| N+1 query performance       | MEDIUM   | ✅ Fixed | Using counts instead of full relations |

## API Usage Examples

### 1. Authentication Flow

```bash
# Step 1: Sign up
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Step 2: Login (get token)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Response:
{
  "message": "Login successful",
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": "cm1abc123",
    "email": "user@example.com"
  }
}
```

### 2. Using Protected Endpoints

```bash
# Get current user profile
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer <your-token>"

# Get user's todos (only their own)
curl http://localhost:3000/api/todos \
  -H "Authorization: Bearer <your-token>"

# Create a todo (auto-assigned to authenticated user)
curl -X POST http://localhost:3000/api/todos \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy groceries", "categoryId": 1}'

# Update own todo
curl -X PUT http://localhost:3000/api/todos/cm1xyz789 \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

# Try to access another user's todo (will fail with 403)
curl http://localhost:3000/api/todos/another-users-todo-id \
  -H "Authorization: Bearer <your-token>"
# Response: { "message": "Access denied" }
```

### 3. Browser Usage (Cookie-based)

```javascript
// Login sets cookie automatically
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: '...', password: '...' }),
  credentials: 'include', // Important for cookies
});

// Future requests use cookie automatically
fetch('http://localhost:3000/api/todos', {
  credentials: 'include',
});
```

## Error Responses

### 401 Unauthorized

```json
{
  "message": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

**Cause**: No token provided or invalid token

### 403 Forbidden

```json
{
  "message": "Access denied"
}
```

**Cause**: Valid token but trying to access another user's resource

### 404 Not Found

```json
{
  "message": "Todo not found"
}
```

**Cause**: Resource doesn't exist (regardless of ownership)

## Testing the Implementation

### Manual Testing Checklist

- [ ] Sign up new user
- [ ] Login with correct credentials
- [ ] Login with wrong credentials (should fail)
- [ ] Access protected endpoint without token (should return 401)
- [ ] Access protected endpoint with valid token (should succeed)
- [ ] Create todo (should auto-assign to authenticated user)
- [ ] Try to update another user's todo (should return 403)
- [ ] Try to delete another user's todo (should return 403)
- [ ] Verify password not returned in user endpoints
- [ ] Verify cookie is set on login (check browser DevTools)
- [ ] Test both Bearer token and cookie authentication

### Quick Test Script

```bash
# 1. Sign up
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test12345"}'

# 2. Login and save token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test12345"}' \
  | jq -r '.data.token')

# 3. Test protected endpoint
curl http://localhost:3000/api/todos \
  -H "Authorization: Bearer $TOKEN"

# 4. Create a todo
curl -X POST http://localhost:3000/api/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test todo", "categoryId": 1}'
```

## Files Modified

1. ✅ `src/lib/auth.ts` - **NEW** Authentication middleware
2. ✅ `src/routers/todo.ts` - Added auth + ownership checks
3. ✅ `src/routers/user.ts` - Fixed password exposure + added auth
4. ✅ `CLAUDE.md` - Updated documentation

## Files NOT Modified (Future Work)

- `src/routers/category.ts` - Still public (consider if categories should be user-specific)
- `src/routers/leetcode.ts` - Status unknown, may need auth
- No rate limiting implemented yet (recommended for production)

## Remaining Security Recommendations

### High Priority

1. **Rate Limiting**: Add to prevent brute force attacks
2. **Password Requirements**: Enforce stronger password policies
3. **Token Expiration**: Implement token refresh mechanism
4. **Account Enumeration**: Use same error for "user not found" and "wrong password"

### Medium Priority

5. **Database Indexes**: Add to `userId` and `categoryId` fields
6. **Category Authorization**: Decide if categories should be user-specific
7. **Audit Logging**: Log authentication attempts and authorization failures

### Low Priority

8. **CORS Configuration**: Configure allowed origins for production
9. **HTTPS Only**: Ensure cookies are secure in production
10. **Session Management**: Implement logout endpoint to invalidate tokens

## Migration Notes

**Breaking Changes**:

- All todo endpoints now require authentication
- User endpoints now require authentication
- `userId` query parameter removed from todo endpoints
- User response schemas changed (no more password field)

**Backward Compatibility**:

- Old clients without authentication will receive 401 errors
- API consumers must update to include Authorization header or cookies

## Next Steps

1. ✅ Test the implementation manually
2. ⏳ Add automated tests for authentication flows
3. ⏳ Implement rate limiting for auth endpoints
4. ⏳ Add token refresh mechanism
5. ⏳ Consider adding role-based access control (RBAC)
