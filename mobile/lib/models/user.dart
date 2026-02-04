import 'package:json_annotation/json_annotation.dart';

part 'user.g.dart';

@JsonSerializable()
class User {
  final String id;
  final String email;
  final String username;
  final bool? isAdmin;
  final bool? emailVerified;

  User({
    required this.id,
    required this.email,
    required this.username,
    this.isAdmin,
    this.emailVerified,
  });

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
  Map<String, dynamic> toJson() => _$UserToJson(this);
}

@JsonSerializable()
class AuthResponse {
  final User? user;
  final String? message;
  final String? error;

  AuthResponse({
    this.user,
    this.message,
    this.error,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) =>
      _$AuthResponseFromJson(json);
  Map<String, dynamic> toJson() => _$AuthResponseToJson(this);
}

@JsonSerializable()
class RegisterRequest {
  final String email;
  final String username;
  final String password;
  final String? showId;
  final List<PickData>? picks;

  RegisterRequest({
    required this.email,
    required this.username,
    required this.password,
    this.showId,
    this.picks,
  });

  Map<String, dynamic> toJson() => _$RegisterRequestToJson(this);
}

@JsonSerializable()
class PickData {
  final String songId;
  final String pickType;

  PickData({
    required this.songId,
    required this.pickType,
  });

  factory PickData.fromJson(Map<String, dynamic> json) =>
      _$PickDataFromJson(json);
  Map<String, dynamic> toJson() => _$PickDataToJson(this);
}

@JsonSerializable()
class LoginRequest {
  final String email;
  final String password;

  LoginRequest({
    required this.email,
    required this.password,
  });

  Map<String, dynamic> toJson() => _$LoginRequestToJson(this);
}
