import 'package:json_annotation/json_annotation.dart';
import 'tour.dart';

part 'leaderboard.g.dart';

@JsonSerializable()
class LeaderboardEntry {
  final int rank;
  final String userId;
  final String? email;
  final String? displayName;
  final String? username;
  final int totalPoints;
  final int? showCount;
  final int? showsPlayed;
  final double avgPoints;
  final double? accuracy;
  final bool? isCurrentUser;

  LeaderboardEntry({
    required this.rank,
    required this.userId,
    this.email,
    this.displayName,
    this.username,
    required this.totalPoints,
    this.showCount,
    this.showsPlayed,
    required this.avgPoints,
    this.accuracy,
    this.isCurrentUser,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) =>
      _$LeaderboardEntryFromJson(json);
  Map<String, dynamic> toJson() => _$LeaderboardEntryToJson(this);
  
  String get displayUsername => username ?? displayName ?? email ?? 'Unknown';
  int get displayShowCount => showCount ?? showsPlayed ?? 0;
}

@JsonSerializable()
class LeaderboardResponse {
  @JsonKey(name: 'leaderboard')
  final List<LeaderboardEntry>? entries;
  final List<Tour>? tours;
  final Tour? currentTour;
  final String? error;

  LeaderboardResponse({
    this.entries,
    this.tours,
    this.currentTour,
    this.error,
  });

  factory LeaderboardResponse.fromJson(Map<String, dynamic> json) =>
      _$LeaderboardResponseFromJson(json);
  Map<String, dynamic> toJson() => _$LeaderboardResponseToJson(this);
}
