import 'package:json_annotation/json_annotation.dart';
import 'song.dart';

part 'pick.g.dart';

enum PickType {
  @JsonValue('OPENER')
  opener,
  @JsonValue('ENCORE')
  encore,
  @JsonValue('REGULAR')
  regular,
}

@JsonSerializable()
class Pick {
  final String id;
  final String submissionId;
  final String songId;
  final PickType pickType;
  final bool? wasPlayed;
  final int? pointsEarned;
  final String createdAt;
  final String updatedAt;
  final Song? song;

  Pick({
    required this.id,
    required this.submissionId,
    required this.songId,
    required this.pickType,
    this.wasPlayed,
    this.pointsEarned,
    required this.createdAt,
    required this.updatedAt,
    this.song,
  });

  factory Pick.fromJson(Map<String, dynamic> json) => _$PickFromJson(json);
  Map<String, dynamic> toJson() => _$PickToJson(this);
}
