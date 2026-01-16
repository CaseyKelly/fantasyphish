import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/leaderboard.dart';
import '../../models/tour.dart';
import '../../services/api_service.dart';
import '../../services/dio_client.dart';
import '../../widgets/loading_donut.dart';
import '../../widgets/error_view.dart';
import '../../theme/app_theme.dart';

final leaderboardProvider = FutureProvider<LeaderboardResponse>((ref) async {
  final apiService = ApiService(DioClient().dio);
  return await apiService.getLeaderboard(null); // Always fetch active tour
});

class LeaderboardScreen extends ConsumerWidget {
  const LeaderboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leaderboardAsync = ref.watch(leaderboardProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Leaderboard'),
      ),
      body: leaderboardAsync.when(
        loading: () => const Center(child: LoadingDonut()),
        error: (error, stack) => ErrorView(
          message: 'Failed to load leaderboard',
          onRetry: () => ref.refresh(leaderboardProvider),
        ),
        data: (data) {
          final entries = data.entries ?? [];
          final currentTour = data.currentTour;

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(leaderboardProvider);
            },
            child: Column(
              children: [
                _buildTourHeader(currentTour),
                if (entries.isEmpty)
                  Expanded(
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.leaderboard,
                              size: 64,
                              color: Colors.grey.shade400,
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'No Leaderboard Data',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Check back after the first show',
                              style: TextStyle(color: Colors.grey.shade400),
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                else
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: entries.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        return _buildLeaderboardEntry(entries[index]);
                      },
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildTourHeader(Tour? tour) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        border: Border(
          bottom: BorderSide(
            color: AppTheme.borderColor.withValues(alpha: 0.5),
          ),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.emoji_events,
            color: AppTheme.accentColor,
            size: 20,
          ),
          const SizedBox(width: 8),
          Text(
            tour?.name ?? 'All Shows',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLeaderboardEntry(LeaderboardEntry entry) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: (entry.isCurrentUser == true)
          ? BoxDecoration(
              color: AppTheme.surfaceColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: AppTheme.accentColor,
                width: 2,
              ),
            )
          : AppTheme.cardDecoration,
      child: Row(
        children: [
          // Rank
          SizedBox(
            width: 40,
            child: Text(
              '#${entry.rank}',
              style: TextStyle(
                fontSize: entry.rank <= 3 ? 20 : 16,
                fontWeight: FontWeight.bold,
                color: entry.rank == 1
                    ? Colors.amber
                    : entry.rank == 2
                        ? Colors.grey.shade400
                        : entry.rank == 3
                            ? Colors.orange.shade300
                            : Colors.white70,
              ),
            ),
          ),
          const SizedBox(width: 12),
          
          // Username and stats
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        entry.displayUsername,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (entry.isCurrentUser == true) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.accentColor,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'YOU',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${entry.displayShowCount} shows • ${entry.avgPoints.toStringAsFixed(1)} avg${entry.accuracy != null ? ' • ${(entry.accuracy! * 100).toStringAsFixed(1)}% accuracy' : ''}',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade400,
                  ),
                ),
              ],
            ),
          ),
          
          // Total points
          Text(
            '${entry.totalPoints}',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: AppTheme.accentColor,
            ),
          ),
        ],
      ),
    );
  }
}
