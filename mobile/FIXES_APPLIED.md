# Fixes Applied to Mobile App

## Issues Fixed

### 1. ✅ Layout Overflow Warning on Onboarding Screen

**Problem**: "BOTTOM OVERFLOWED BY 15 PIXELS" warning on first onboarding screen

**Solution**: Reduced vertical padding on page indicator and buttons

- Page indicator padding: `24.0` → `16.0`
- Buttons top padding: `24.0` → `8.0`

**File**: `lib/screens/onboarding/onboarding_screen.dart`

---

### 2. ✅ CSRF Token Error on Login

**Problem**: Login from mobile app failed with:

```
[auth][error] MissingCSRF: CSRF token was missing during an action callback
```

**Root Cause**: NextAuth v5 requires CSRF tokens for credential-based authentication. The mobile app wasn't including this token in login requests.

**Solution**: Modified login flow to:

1. First call `GET /api/auth/csrf` to get CSRF token
2. Include `csrfToken` in the login request data
3. Then proceed with normal authentication

**File**: `lib/services/auth_service.dart`

**New Login Flow**:

```dart
// 1. Get CSRF token
final csrfResponse = await DioClient().dio.get('/api/auth/csrf');
final csrfToken = csrfResponse.data['csrfToken'];

// 2. Login with CSRF token
final response = await DioClient().dio.post(
  '/api/auth/callback/credentials',
  data: {
    'email': email,
    'password': password,
    'csrfToken': csrfToken,  // ← Added this
    'json': true,
  },
);

// 3. Get session
final sessionResponse = await DioClient().dio.get('/api/auth/session');
```

---

## How to Apply These Fixes

If the app is still running, press **`R`** in your terminal to hot restart and see the changes.

Or restart the app:

```bash
flutter run -d B9909281-26D2-419C-9359-69563DB96BE0 --dart-define=API_URL=http://localhost:3000
```

---

## Testing

### Test Onboarding Screen

1. Launch app
2. Swipe through onboarding pages
3. ✅ No overflow warnings should appear

### Test Login

1. Complete onboarding
2. Tap "Log In"
3. Enter your email and password
4. Tap "Log In"
5. ✅ Should successfully authenticate and redirect to picks screen
6. ✅ No CSRF errors in Next.js logs

---

## Additional Notes

### CSRF Token Security

The CSRF token is a standard security measure that:

- Prevents cross-site request forgery attacks
- Is required by NextAuth for all authentication requests
- Is automatically handled by cookies in web browsers
- Needs to be explicitly fetched for mobile/API clients

### NextAuth Mobile Integration

For mobile apps using NextAuth:

1. ✅ Always get CSRF token before auth actions
2. ✅ Use cookie-based session management (already implemented)
3. ✅ Store session cookies securely (using dio_cookie_manager)
4. ✅ Handle token refresh appropriately

---

## Files Modified

1. `lib/screens/onboarding/onboarding_screen.dart` - Fixed layout overflow
2. `lib/services/auth_service.dart` - Added CSRF token handling

Total changes: 2 files, ~10 lines modified
