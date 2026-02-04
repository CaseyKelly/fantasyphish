import 'package:json_annotation/json_annotation.dart';

part 'achievement.g.dart';

@JsonSerializable()
class Achievement {
  final String id;
  final String slug;
  final String name;
  final String description;
  final String icon;
  final String category;
  final DateTime earnedAt;
  final Map<String, dynamic>? metadata;

  Achievement({
    required this.id,
    required this.slug,
    required this.name,
    required this.description,
    required this.icon,
    required this.category,
    required this.earnedAt,
    this.metadata,
  });

  factory Achievement.fromJson(Map<String, dynamic> json) =>
      _$AchievementFromJson(json);

  Map<String, dynamic> toJson() => _$AchievementToJson(this);
}

@JsonSerializable()
class AchievementsResponse {
  final List<Achievement> achievements;

  AchievementsResponse({required this.achievements});

  factory AchievementsResponse.fromJson(Map<String, dynamic> json) =>
      _$AchievementsResponseFromJson(json);

  Map<String, dynamic> toJson() => _$AchievementsResponseToJson(this);
}
