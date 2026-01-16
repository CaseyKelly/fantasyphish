import 'package:json_annotation/json_annotation.dart';

part 'tour.g.dart';

@JsonSerializable()
class Tour {
  final String id;
  final String name;
  final String startDate;
  final String? endDate;
  final String? status;
  final String? createdAt;
  final String? updatedAt;

  Tour({
    required this.id,
    required this.name,
    required this.startDate,
    this.endDate,
    this.status,
    this.createdAt,
    this.updatedAt,
  });

  factory Tour.fromJson(Map<String, dynamic> json) => _$TourFromJson(json);
  Map<String, dynamic> toJson() => _$TourToJson(this);
}
