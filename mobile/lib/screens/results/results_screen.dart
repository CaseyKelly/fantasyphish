import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/api_service.dart';
import '../../services/dio_client.dart';
import '../../widgets/loading_donut.dart';
import '../../widgets/error_view.dart';
import '../../theme/app_theme.dart';
import '../../utils/date_utils.dart' as app_date_utils;

final resultsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final apiService = ApiService(DioClient().dio);
  return await apiService.getHistory();
});

class ResultsScreen extends ConsumerWidget {
  const ResultsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resultsAsync = ref.watch(resultsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Results'),
      ),
      body: resultsAsync.when(
        loading: () => const Center(child: LoadingDonut()),
        error: (error, stack) {
          print('❌ Results screen error: $error');
          print('Stack: $stack');
          return ErrorView(
            message: 'Failed to load results\n\n${error.toString()}',
            onRetry: () => ref.refresh(resultsProvider),
          );
        },
        data: (data) {
          final submissions = data['submissions'] as List<dynamic>? ?? [];
          final stats = data['stats'] as Map<String, dynamic>?;

          if (submissions.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.history,
                      size: 64,
                      color: Colors.grey.shade400,
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'No Results Yet',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Make your first picks to see results here',
                      style: TextStyle(color: Colors.grey.shade400),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(resultsProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (stats != null) _buildStatsCard(stats),
                const SizedBox(height: 24),
                const Text(
                  'Submission History',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                ...submissions.map((s) => _buildSubmissionCard(s)),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildStatsCard(Map<String, dynamic> stats) {
    final totalPoints = stats['totalPoints'] ?? 0;
    final avgPoints = (stats['avgPoints'] ?? 0.0).toStringAsFixed(1);
    final accuracy = (stats['accuracy'] ?? 0.0).toStringAsFixed(1); // Already a percentage from API
    final correctPicks = stats['correctPicks'] ?? 0;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: AppTheme.cardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Your Stats',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildStatItem('Total Points', totalPoints.toString()),
              ),
              Expanded(
                child: _buildStatItem('Avg Points', avgPoints),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildStatItem('Accuracy', '$accuracy%'),
              ),
              Expanded(
                child: _buildStatItem('Correct Picks', correctPicks.toString()),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey.shade400,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: AppTheme.accentColor,
          ),
        ),
      ],
    );
  }

  Widget _buildSubmissionCard(Map<String, dynamic> submission) {
    final show = submission['show'] as Map<String, dynamic>;
    final totalPoints = submission['totalPoints'] ?? 0;
    final isScored = submission['isScored'] ?? false;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: AppTheme.cardDecoration,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  show['venue'] ?? '',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${show['city'] ?? ''}${show['state'] != null ? ', ${show['state']}' : ''}',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey.shade400,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  app_date_utils.DateUtils.formatShowDate(show['showDate'] ?? ''),
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade400,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$totalPoints',
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.accentColor,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                isScored ? 'pts' : 'Locked',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade400,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
