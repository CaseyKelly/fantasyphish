import 'dart:io' show Platform;
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'api_service.dart';

final logger = Logger();

// Top-level function for background message handling
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  logger.i('Background message received: ${message.messageId}');
}

class PushNotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final ApiService _apiService;

  bool _isInitialized = false;
  String? _currentToken;

  PushNotificationService(this._apiService);

  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      // Initialize Firebase
      await Firebase.initializeApp();

      // Set up background message handler
      FirebaseMessaging.onBackgroundMessage(
          _firebaseMessagingBackgroundHandler);

      // Initialize local notifications for foreground display
      await _initializeLocalNotifications();

      // Request permissions
      await requestPermissions();

      // Set up message handlers
      _setupMessageHandlers();

      // Get and register FCM token
      await refreshToken();

      // Listen for token refresh
      _messaging.onTokenRefresh.listen((token) {
        logger.i('FCM token refreshed: $token');
        registerToken(token);
      });

      _isInitialized = true;
      logger.i('Push notification service initialized successfully');
    } catch (e) {
      logger.e('Failed to initialize push notifications: $e');
    }
  }

  Future<void> _initializeLocalNotifications() async {
    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      settings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );

    // Create Android notification channel
    const androidChannel = AndroidNotificationChannel(
      'pick_reminders',
      'Pick Reminders',
      description: 'Notifications reminding you to make your picks',
      importance: Importance.high,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);
  }

  Future<void> requestPermissions() async {
    if (Platform.isIOS) {
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );
      logger.i(
          'iOS notification permission status: ${settings.authorizationStatus}');
    } else if (Platform.isAndroid) {
      // Android 13+ requires runtime permission
      final plugin = _localNotifications.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      await plugin?.requestNotificationsPermission();
    }
  }

  void _setupMessageHandlers() {
    // Foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      logger.i('Foreground message received: ${message.notification?.title}');
      _showLocalNotification(message);
    });

    // Message opened from background/terminated state
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      logger.i('Message opened from background: ${message.messageId}');
      _handleNotificationTap(message.data);
    });

    // Check if app was opened from a terminated state notification
    _messaging.getInitialMessage().then((RemoteMessage? message) {
      if (message != null) {
        logger.i('App opened from terminated state: ${message.messageId}');
        _handleNotificationTap(message.data);
      }
    });
  }

  Future<void> _showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    const androidDetails = AndroidNotificationDetails(
      'pick_reminders',
      'Pick Reminders',
      channelDescription: 'Notifications reminding you to make your picks',
      importance: Importance.high,
      priority: Priority.high,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      details,
      payload: message.data['showId'],
    );
  }

  void _onNotificationTapped(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null) {
      _handleNotificationTap({'showId': payload});
    }
  }

  void _handleNotificationTap(Map<String, dynamic> data) {
    // TODO: Navigate to the show/picks screen when tapped
    // This will be implemented when integrating with the router
    final showId = data['showId'];
    logger.i('Notification tapped for show: $showId');
    // Example: ref.read(goRouterProvider).go('/shows/$showId/picks');
  }

  Future<String?> getToken() async {
    try {
      _currentToken = await _messaging.getToken();
      logger.i('FCM token: $_currentToken');
      return _currentToken;
    } catch (e) {
      logger.e('Failed to get FCM token: $e');
      return null;
    }
  }

  Future<void> refreshToken() async {
    final token = await getToken();
    if (token != null) {
      await registerToken(token);
    }
  }

  Future<void> registerToken(String token) async {
    try {
      _currentToken = token;
      final platform = Platform.isIOS ? 'ios' : 'android';

      await _apiService.registerPushToken({
        'token': token,
        'platform': platform,
      });

      logger.i('Push token registered successfully');
    } catch (e) {
      logger.e('Failed to register push token: $e');
    }
  }

  Future<void> unregisterToken() async {
    if (_currentToken == null) return;

    try {
      await _apiService.unregisterPushToken({'token': _currentToken});
      logger.i('Push token unregistered successfully');
      _currentToken = null;
    } catch (e) {
      logger.e('Failed to unregister push token: $e');
    }
  }

  Future<void> dispose() async {
    await unregisterToken();
  }
}

// Provider for push notification service
final pushNotificationServiceProvider =
    Provider<PushNotificationService>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  return PushNotificationService(apiService);
});
