import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import '../models/user.dart';
import 'api_service.dart';
import 'dio_client.dart';

class AuthService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final ApiService _apiService;

  static const String _userKey = 'user_data';
  static const String _emailKey = 'user_email';

  AuthService() : _apiService = ApiService(DioClient().dio);

  // Login with email and password
  Future<User?> login(String email, String password) async {
    try {
      // First, get CSRF token
      final csrfResponse = await DioClient().dio.get('/api/auth/csrf');
      final csrfToken = csrfResponse.data['csrfToken'] as String?;
      
      if (csrfToken == null) {
        throw 'Failed to get CSRF token';
      }

      // NextAuth uses credential provider, need to POST to the credentials endpoint
      final response = await DioClient().dio.post(
            '/api/auth/callback/credentials',
            data: {
              'email': email,
              'password': password,
              'csrfToken': csrfToken,
              'json': true,
            },
            options: Options(
              contentType: Headers.formUrlEncodedContentType,
              followRedirects: false,
              validateStatus: (status) => status! < 400,
            ),
          );

      if (response.statusCode == 200 || response.statusCode == 302) {
        // Get the session to retrieve user data
        final sessionResponse = await DioClient().dio.get('/api/auth/session');
        
        if (sessionResponse.data != null && sessionResponse.data['user'] != null) {
          final user = User.fromJson(sessionResponse.data['user']);
          await _saveUser(user);
          return user;
        }
      }

      return null;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Register new user
  Future<AuthResponse> register(RegisterRequest request) async {
    try {
      final response = await _apiService.register(request);
      
      if (response.user != null) {
        await _storage.write(key: _emailKey, value: request.email);
      }
      
      return response;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Verify email with token
  Future<bool> verifyEmail(String token) async {
    try {
      final response = await _apiService.verifyEmail({'token': token});
      
      if (response.user != null) {
        await _saveUser(response.user!);
        return true;
      }
      
      return false;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Get current user from session
  Future<User?> getCurrentUser() async {
    try {
      final response = await DioClient().dio.get('/api/auth/session');
      
      if (response.data != null && response.data['user'] != null) {
        final user = User.fromJson(response.data['user']);
        await _saveUser(user);
        return user;
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }

  // Logout
  Future<void> logout() async {
    try {
      await DioClient().dio.post('/api/auth/signout');
      await _clearStorage();
    } catch (e) {
      // Even if the API call fails, clear local storage
      await _clearStorage();
    }
  }

  // Check if user is logged in
  Future<bool> isLoggedIn() async {
    final user = await getCurrentUser();
    return user != null;
  }

  // Forgot password
  Future<String> forgotPassword(String email) async {
    try {
      final response = await _apiService.forgotPassword({'email': email});
      return response['message'] ?? 'Password reset email sent';
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Reset password
  Future<String> resetPassword(String token, String password) async {
    try {
      final response = await _apiService.resetPassword({
        'token': token,
        'password': password,
      });
      return response['message'] ?? 'Password reset successful';
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Resend verification email
  Future<String> resendVerification(String email) async {
    try {
      final response = await _apiService.resendVerification({'email': email});
      return response['message'] ?? 'Verification email sent';
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Private helper methods
  Future<void> _saveUser(User user) async {
    await _storage.write(key: _userKey, value: user.toJson().toString());
    await _storage.write(key: _emailKey, value: user.email);
  }

  Future<void> _clearStorage() async {
    await _storage.delete(key: _userKey);
    await _storage.delete(key: _emailKey);
  }

  String _handleError(DioException e) {
    if (e.response?.data != null && e.response?.data is Map) {
      final data = e.response!.data as Map<String, dynamic>;
      return data['error'] ?? data['message'] ?? 'An error occurred';
    }
    
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Connection timeout. Please check your internet connection.';
    }
    
    if (e.type == DioExceptionType.connectionError) {
      return 'Cannot connect to server. Please check your internet connection.';
    }
    
    return 'An unexpected error occurred';
  }
}
