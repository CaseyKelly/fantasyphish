import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/biometric_service.dart';
import '../services/push_notification_service.dart';

final authServiceProvider = Provider<AuthService>((ref) => AuthService());

final authStateProvider =
    StateNotifierProvider<AuthStateNotifier, AsyncValue<User?>>((ref) {
  return AuthStateNotifier(
    ref.watch(authServiceProvider),
    ref.watch(pushNotificationServiceProvider),
  );
});

class AuthStateNotifier extends StateNotifier<AsyncValue<User?>> {
  final AuthService _authService;
  final PushNotificationService _pushService;
  final BiometricService _biometricService = BiometricService();

  AuthStateNotifier(this._authService, this._pushService)
      : super(const AsyncValue.loading()) {
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    state = const AsyncValue.loading();
    try {
      final user = await _authService.getCurrentUser();
      state = AsyncValue.data(user);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> login(String email, String password) async {
    try {
      final user = await _authService.login(email, password);
      if (user != null) {
        state = AsyncValue.data(user);
        // Register push token after successful login
        await _pushService.refreshToken();
      } else {
        throw 'Invalid email or password';
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<void> register(RegisterRequest request) async {
    try {
      final response = await _authService.register(request);
      if (response.error != null) {
        throw response.error!;
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<void> logout() async {
    // Unregister push token before logout
    await _pushService.unregisterToken();
    await _authService.logout();
    // Don't clear biometric credentials on logout - keep them for next login
    state = const AsyncValue.data(null);
  }

  Future<void> refreshUser() async {
    await _checkAuth();
  }
}
