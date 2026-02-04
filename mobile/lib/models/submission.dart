import 'package:json_annotation/json_annotation.dart';
import 'pick.dart';

part 'submission.g.dart';

@JsonSerializable()
class UserSubmission {
  final String id;
  final String userId;
  final String showId;
  final int? totalPoints;
  final int? lastSongCount;
  final bool isScored;
  final String createdAt;
  final String updatedAt;
  final List<Pick>? picks;

  UserSubmission({
    required this.id,
    required this.userId,
    required this.showId,
    this.totalPoints,
    this.lastSongCount,
    required this.isScored,
    required this.createdAt,
    required this.updatedAt,
    this.picks,
  });

  factory UserSubmission.fromJson(Map<String, dynamic> json) =>
      _$UserSubmissionFromJson(json);
  Map<String, dynamic> toJson() => _$UserSubmissionToJson(this);
}

@JsonSerializable()
class SubmissionRequest {
  final String showId;
  final List<PickRequest> picks;

  SubmissionRequest({
    required this.showId,
    required this.picks,
  });

  Map<String, dynamic> toJson() => _$SubmissionRequestToJson(this);
}

@JsonSerializable()
class PickRequest {
  final String songId;
  final String pickType;

  PickRequest({
    required this.songId,
    required this.pickType,
  });

  factory PickRequest.fromJson(Map<String, dynamic> json) =>
      _$PickRequestFromJson(json);
  Map<String, dynamic> toJson() => _$PickRequestToJson(this);
}

@JsonSerializable()
class SubmissionResponse {
  final UserSubmission? submission;
  final String? message;
  final String? error;

  SubmissionResponse({
    this.submission,
    this.message,
    this.error,
  });

  factory SubmissionResponse.fromJson(Map<String, dynamic> json) =>
      _$SubmissionResponseFromJson(json);
  Map<String, dynamic> toJson() => _$SubmissionResponseToJson(this);
}
