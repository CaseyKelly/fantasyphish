import 'package:json_annotation/json_annotation.dart';
import 'tour.dart';
import 'submission.dart';

part 'show.g.dart';

@JsonSerializable()
class Show {
  final String id;
  final String venue;
  final String city;
  final String? state;
  final String country;
  final String showDate;
  final bool isComplete;
  final String? lockTime;
  final String? timezone;
  final Tour? tour;
  final UserSubmission? userSubmission;

  Show({
    required this.id,
    required this.venue,
    required this.city,
    this.state,
    required this.country,
    required this.showDate,
    required this.isComplete,
    this.lockTime,
    this.timezone,
    this.tour,
    this.userSubmission,
  });

  factory Show.fromJson(Map<String, dynamic> json) => _$ShowFromJson(json);
  Map<String, dynamic> toJson() => _$ShowToJson(this);

  bool get isLocked {
    if (lockTime == null) return false;
    final lock = DateTime.parse(lockTime!);
    return DateTime.now().isAfter(lock);
  }
}

@JsonSerializable()
class ShowsResponse {
  final List<Show>? shows;
  final Show? nextShow;
  final String? error;

  ShowsResponse({
    this.shows,
    this.nextShow,
    this.error,
  });

  factory ShowsResponse.fromJson(Map<String, dynamic> json) =>
      _$ShowsResponseFromJson(json);
  Map<String, dynamic> toJson() => _$ShowsResponseToJson(this);
}
