import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:logger/logger.dart';

class DioClient {
  static final DioClient _instance = DioClient._internal();
  factory DioClient() => _instance;

  late Dio dio;
  final logger = Logger();
  final storage = const FlutterSecureStorage();
  late CookieJar cookieJar;

  DioClient._internal() {
    cookieJar = CookieJar();
    dio = Dio(_getBaseOptions());
    print('🔧 DioClient initialized with baseUrl: ${dio.options.baseUrl}');
    _setupInterceptors();
  }

  BaseOptions _getBaseOptions() {
    // For iOS Simulator, use 127.0.0.1 or localhost should work
    // For Android Emulator, use 10.0.2.2
    // For physical device, use your computer's IP address (192.168.50.166)
    const baseUrl = String.fromEnvironment(
      'API_URL',
      defaultValue: 'http://192.168.50.166:3000',
    );

    return BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      validateStatus: (status) {
        // Accept all status codes so we can handle errors properly
        return status != null && status < 500;
      },
    );
  }

  void _setupInterceptors() {
    // Cookie manager for NextAuth session
    dio.interceptors.add(CookieManager(cookieJar));

    // Logging interceptor
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          logger.d('REQUEST[${options.method}] => URL: ${options.baseUrl}${options.path}');
          logger.d('Headers: ${options.headers}');
          return handler.next(options);
        },
        onResponse: (response, handler) {
          logger.d(
            'RESPONSE[${response.statusCode}] => PATH: ${response.requestOptions.path}',
          );
          logger.d('Response data: ${response.data}');
          return handler.next(response);
        },
        onError: (error, handler) {
          logger.e(
            'ERROR[${error.response?.statusCode}] => URL: ${error.requestOptions.baseUrl}${error.requestOptions.path}',
          );
          logger.e('Error type: ${error.type}');
          logger.e('Error message: ${error.message}');
          logger.e('Response data: ${error.response?.data}');
          return handler.next(error);
        },
      ),
    );
  }

  void updateBaseUrl(String newBaseUrl) {
    dio.options.baseUrl = newBaseUrl;
  }
}
