import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../services/dio_client.dart';
import '../../services/biometric_service.dart';
import '../../models/achievement.dart';
import '../../widgets/loading_donut.dart';
import '../../widgets/error_view.dart';
import '../../theme/app_theme.dart';

final achievementsProvider = FutureProvider<AchievementsResponse>((ref) async {
  final apiService = ApiService(DioClient().dio);
  final data = await apiService.getUserAchievements();
  return AchievementsResponse.fromJson(data);
});

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _biometricService = BiometricService();
  bool _biometricEnabled = false;

  @override
  void initState() {
    super.initState();
    _checkBiometricStatus();
  }

  Future<void> _checkBiometricStatus() async {
    final enabled = await _biometricService.isBiometricEnabled();
    if (mounted) {
      setState(() {
        _biometricEnabled = enabled;
      });
    }
  }

  Future<void> _toggleBiometric() async {
    if (_biometricEnabled) {
      await _biometricService.disableBiometricLogin();
      setState(() {
        _biometricEnabled = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Biometric login disabled')),
        );
      }
    }
  }

  // Map achievement icon strings to Material Icons
  IconData _getAchievementIcon(String iconString) {
    // Try to match common emoji/text to icons
    final iconMap = {
      '🏆': Icons.emoji_events,
      '⭐': Icons.star,
      '🔥': Icons.local_fire_department,
      '🎯': Icons.gps_fixed,
      '💯': Icons.verified,
      '👑': Icons.workspace_premium,
      '🎉': Icons.celebration,
      '🌟': Icons.stars,
      '💪': Icons.fitness_center,
      '🎸': Icons.music_note,
      '🎵': Icons.audiotrack,
      '📅': Icons.calendar_today,
      'trophy': Icons.emoji_events,
      'star': Icons.star,
      'fire': Icons.local_fire_department,
      'target': Icons.gps_fixed,
      'perfect': Icons.verified,
      'crown': Icons.workspace_premium,
      'party': Icons.celebration,
      'music': Icons.music_note,
      'calendar': Icons.calendar_today,
      'medal': Icons.military_tech,
      'achievement': Icons.emoji_events,
    };

    // Try exact match first
    if (iconMap.containsKey(iconString)) {
      return iconMap[iconString]!;
    }

    // Try case-insensitive match
    final lowerIcon = iconString.toLowerCase();
    for (var entry in iconMap.entries) {
      if (entry.key.toLowerCase() == lowerIcon) {
        return entry.value;
      }
    }

    // Default icon
    return Icons.emoji_events;
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
      ),
      body: authState.when(
        loading: () => const Center(child: LoadingDonut()),
        error: (error, stack) => Center(
          child: Text('Error: $error'),
        ),
        data: (user) {
          if (user == null) {
            return const Center(
              child: Text('Not logged in'),
            );
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // User info card
              Container(
                padding: const EdgeInsets.all(24),
                decoration: AppTheme.cardDecoration,
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 48,
                      backgroundColor: AppTheme.accentColor,
                      child: Text(
                        user.username[0].toUpperCase(),
                        style: const TextStyle(
                          fontSize: 36,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      user.username,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user.email,
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey.shade400,
                      ),
                    ),
                    if (user.emailVerified == true) ...[
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.verified,
                            size: 16,
                            color: Colors.green.shade400,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Verified',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.green.shade400,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Achievement Badges section
              const Text(
                'Achievement Badges',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              _buildAchievementBadges(ref),
              const SizedBox(height: 24),

              // Settings section
              const Text(
                'Settings',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),

              // Settings cards
              if (_biometricEnabled)
                _buildSettingsCard(
                  context,
                  icon: Icons.fingerprint,
                  title: 'Biometric Login',
                  subtitle: 'Enabled - Tap to disable',
                  onTap: _toggleBiometric,
                ),
              if (_biometricEnabled) const SizedBox(height: 8),
              _buildSettingsCard(
                context,
                icon: Icons.help_outline,
                title: 'How to Play',
                subtitle: 'Learn about the scoring system',
                onTap: () {
                  _showHowToPlayDialog(context);
                },
              ),
              const SizedBox(height: 8),
              _buildSettingsCard(
                context,
                icon: Icons.info_outline,
                title: 'About',
                subtitle: 'Version 1.0.0',
                onTap: () {
                  _showAboutDialog(context);
                },
              ),
              const SizedBox(height: 24),

              // Logout button
              SizedBox(
                height: 56,
                child: OutlinedButton(
                  onPressed: () async {
                    await ref.read(authStateProvider.notifier).logout();
                    if (context.mounted) {
                      context.go('/onboarding');
                    }
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: const BorderSide(color: Colors.red),
                  ),
                  child: const Text('Log Out'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildAchievementBadges(WidgetRef ref) {
    final achievementsAsync = ref.watch(achievementsProvider);

    return achievementsAsync.when(
      loading: () => Container(
        padding: const EdgeInsets.all(32),
        decoration: AppTheme.cardDecoration,
        child: const Center(child: LoadingDonut()),
      ),
      error: (error, stack) => Container(
        padding: const EdgeInsets.all(16),
        decoration: AppTheme.cardDecoration,
        child: ErrorView(
          message: 'Failed to load achievements',
          onRetry: () => ref.refresh(achievementsProvider),
        ),
      ),
      data: (achievementsResponse) {
        final achievements = achievementsResponse.achievements;

        if (achievements.isEmpty) {
          return Container(
            padding: const EdgeInsets.all(24),
            decoration: AppTheme.cardDecoration,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.emoji_events_outlined,
                  size: 48,
                  color: Colors.grey.shade600,
                ),
                const SizedBox(height: 12),
                Text(
                  'No achievements yet',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey.shade400,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Keep playing to earn badges!',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade500,
                  ),
                ),
              ],
            ),
          );
        }

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: AppTheme.cardDecoration,
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 16,
              crossAxisSpacing: 16,
              childAspectRatio: 1,
            ),
            itemCount: achievements.length,
            itemBuilder: (context, index) {
              final achievement = achievements[index];
              
              return GestureDetector(
                onTap: () => _showAchievementDialog(
                  context,
                  achievement.name,
                  achievement.description,
                  achievement.earnedAt,
                ),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final size = constraints.maxWidth;
                    return Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: size * 0.6,
                          height: size * 0.6,
                          decoration: BoxDecoration(
                            color: AppTheme.accentColor.withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: AppTheme.accentColor,
                              width: 2,
                            ),
                          ),
                          child: Icon(
                            _getAchievementIcon(achievement.icon),
                            size: size * 0.4,
                            color: AppTheme.accentColor,
                          ),
                        ),
                        SizedBox(height: size * 0.05),
                        Expanded(
                          child: Center(
                            child: Text(
                              achievement.name,
                              style: TextStyle(
                                fontSize: size * 0.11,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              );
            },
          ),
        );
      },
    );
  }

  void _showAchievementDialog(BuildContext context, String title, String description, DateTime earnedAt) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.surfaceColor,
        title: Row(
          children: [
            const Icon(
              Icons.emoji_events,
              color: AppTheme.accentColor,
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(title)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(description),
            const SizedBox(height: 16),
            Text(
              'Unlocked on ${earnedAt.month}/${earnedAt.day}/${earnedAt.year}',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.green,
                fontSize: 12,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: AppTheme.cardDecoration,
      child: ListTile(
        leading: Icon(icon),
        title: Text(title),
        subtitle: Text(
          subtitle,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey.shade400,
          ),
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }

  void _showHowToPlayDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.surfaceColor,
        title: const Text('How to Play'),
        content: const SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Scoring',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.accentColor,
                ),
              ),
              SizedBox(height: 12),
              Text('• Opener: 3 points (first song of Set 1)'),
              SizedBox(height: 8),
              Text('• Encore: 3 points (any song in encore)'),
              SizedBox(height: 8),
              Text('• Regular: 1 point each (11 songs, played anywhere)'),
              SizedBox(height: 16),
              Text(
                'Maximum: 17 points per show',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: 16),
              Text(
                'Tips',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.accentColor,
                ),
              ),
              SizedBox(height: 12),
              Text('• Submit picks before the show starts'),
              SizedBox(height: 8),
              Text('• Picks lock at 7 PM in the venue\'s timezone'),
              SizedBox(height: 8),
              Text('• Scores update live during the show'),
              SizedBox(height: 8),
              Text('• Climb the leaderboard with consistent picks'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Got It'),
          ),
        ],
      ),
    );
  }

  void _showAboutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.surfaceColor,
        title: const Text('About FantasyPhish'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Version 1.0.0',
              style: TextStyle(
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 16),
            Text(
              'A fantasy game for Phish fans. Pick 13 songs before each show, score points when they\'re played, and compete on the leaderboard.',
            ),
            SizedBox(height: 16),
            Text(
              'Setlist data provided by phish.net',
              style: TextStyle(
                fontSize: 12,
                color: Colors.white70,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}
