import 'package:json_annotation/json_annotation.dart';

part 'song.g.dart';

@JsonSerializable()
class Song {
  final String id;
  final String name;
  final String slug;
  final String artist;
  final int timesPlayed;
  final int? gap;
  final String? lastPlayed;

  Song({
    required this.id,
    required this.name,
    required this.slug,
    required this.artist,
    required this.timesPlayed,
    this.gap,
    this.lastPlayed,
  });

  factory Song.fromJson(Map<String, dynamic> json) => _$SongFromJson(json);
  Map<String, dynamic> toJson() => _$SongToJson(this);
}

@JsonSerializable()
class SongsResponse {
  final List<Song>? songs;
  final String? error;

  SongsResponse({
    this.songs,
    this.error,
  });

  factory SongsResponse.fromJson(Map<String, dynamic> json) =>
      _$SongsResponseFromJson(json);
  Map<String, dynamic> toJson() => _$SongsResponseToJson(this);
}
