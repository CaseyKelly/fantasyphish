import 'package:dio/dio.dart';
import '../models/user.dart';
import '../models/show.dart';
import '../models/song.dart';
import '../models/submission.dart';
import '../models/leaderboard.dart';

class ApiService {
  final Dio _dio;

  ApiService(this._dio);

  // Auth endpoints
  Future<AuthResponse> register(RegisterRequest request) async {
    final response = await _dio.post('/api/auth/register', data: request.toJson());
    return AuthResponse.fromJson(response.data);
  }

  Future<AuthResponse> verifyEmail(Map<String, dynamic> body) async {
    final response = await _dio.post('/api/auth/verify', data: body);
    return AuthResponse.fromJson(response.data);
  }

  Future<Map<String, dynamic>> forgotPassword(Map<String, dynamic> body) async {
    final response = await _dio.post('/api/auth/forgot-password', data: body);
    return response.data;
  }

  Future<Map<String, dynamic>> resetPassword(Map<String, dynamic> body) async {
    final response = await _dio.post('/api/auth/reset-password', data: body);
    return response.data;
  }

  Future<Map<String, dynamic>> resendVerification(Map<String, dynamic> body) async {
    final response = await _dio.post('/api/auth/resend-verification', data: body);
    return response.data;
  }

  // Shows endpoints
  Future<ShowsResponse> getShows(bool? nextOnly) async {
    final response = await _dio.get(
      '/api/shows',
      queryParameters: nextOnly != null ? {'next': nextOnly} : null,
    );
    return ShowsResponse.fromJson(response.data);
  }

  Future<Show> getShow(String showId) async {
    final response = await _dio.get('/api/shows/$showId');
    return Show.fromJson(response.data);
  }

  // Songs endpoint
  Future<SongsResponse> getSongs() async {
    final response = await _dio.get('/api/songs');
    return SongsResponse.fromJson(response.data);
  }

  // Picks endpoints
  Future<SubmissionResponse> getPicks(String showId) async {
    final response = await _dio.get(
      '/api/picks',
      queryParameters: {'showId': showId},
    );
    return SubmissionResponse.fromJson(response.data);
  }

  Future<SubmissionResponse> submitPicks(SubmissionRequest request) async {
    final response = await _dio.post('/api/picks', data: request.toJson());
    return SubmissionResponse.fromJson(response.data);
  }

  // Results endpoints
  Future<Map<String, dynamic>> getResults(String showId) async {
    final response = await _dio.get('/api/results/$showId');
    return response.data;
  }

  Future<Map<String, dynamic>> getHistory() async {
    final response = await _dio.get('/api/user/submissions');
    if (response.data is Map<String, dynamic>) {
      return response.data as Map<String, dynamic>;
    }
    // If response is a string or unexpected type, return error format
    return {
      'submissions': [],
      'stats': null,
      'error': response.data?.toString() ?? 'Unknown error'
    };
  }

  // Leaderboard endpoint
  Future<LeaderboardResponse> getLeaderboard(String? tourId) async {
    final response = await _dio.get(
      '/api/leaderboard',
      queryParameters: tourId != null ? {'tourId': tourId} : null,
    );
    return LeaderboardResponse.fromJson(response.data);
  }

  // User achievements endpoint
  Future<Map<String, dynamic>> getUserAchievements() async {
    final response = await _dio.get('/api/user/achievements');
    return response.data as Map<String, dynamic>;
  }
}
