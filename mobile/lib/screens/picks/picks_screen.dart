import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/show.dart';
import '../../models/song.dart';
import '../../models/submission.dart';
import '../../models/pick.dart';
import '../../services/api_service.dart';
import '../../services/dio_client.dart';
import '../../widgets/loading_donut.dart';
import '../../widgets/error_view.dart';
import '../../widgets/live_badge.dart';
import '../../utils/date_utils.dart' as app_date_utils;
import '../../theme/app_theme.dart';
import 'song_picker_widget.dart';

final apiServiceProvider = Provider<ApiService>((ref) {
  return ApiService(DioClient().dio);
});

final nextShowProvider = FutureProvider<Show?>((ref) async {
  final apiService = ref.watch(apiServiceProvider);
  final response = await apiService.getShows(true);
  return response.nextShow;
});

final songsProvider = FutureProvider<List<Song>>((ref) async {
  final apiService = ref.watch(apiServiceProvider);
  final response = await apiService.getSongs();
  return response.songs ?? [];
});

class PicksScreen extends ConsumerStatefulWidget {
  const PicksScreen({super.key});

  @override
  ConsumerState<PicksScreen> createState() => _PicksScreenState();
}

class _PicksScreenState extends ConsumerState<PicksScreen> {
  Map<String, SelectedSong> _selectedSongs = {};
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  Widget build(BuildContext context) {
    final nextShowAsync = ref.watch(nextShowProvider);
    final songsAsync = ref.watch(songsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('FantasyPhish'),
      ),
      body: nextShowAsync.when(
        loading: () => const Center(child: LoadingDonut()),
        error: (error, stack) {
          print('❌ Picks screen error: $error');
          print('Stack: $stack');
          return ErrorView(
            message: 'Failed to load show data\n\n${error.toString()}',
            onRetry: () => ref.refresh(nextShowProvider),
          );
        },
        data: (nextShow) {
          if (nextShow == null) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.event_busy, size: 64, color: Colors.grey),
                    SizedBox(height: 16),
                    Text(
                      'No Upcoming Shows',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Check back later for the next show',
                      style: TextStyle(color: Colors.white70),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          }

          // Initialize picks from existing submission
          if (nextShow.userSubmission != null && _selectedSongs.isEmpty) {
            _initializePicksFromSubmission(nextShow.userSubmission!);
          }

          return songsAsync.when(
            loading: () => const Center(child: LoadingDonut()),
            error: (error, stack) => ErrorView(
              message: 'Failed to load songs',
              onRetry: () => ref.refresh(songsProvider),
            ),
            data: (songs) {
              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(nextShowProvider);
                  ref.invalidate(songsProvider);
                },
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildShowCard(nextShow),
                      const SizedBox(height: 24),
                      if (_errorMessage != null) ...[
                        _buildErrorBanner(),
                        const SizedBox(height: 16),
                      ],
                      SongPickerWidget(
                        songs: songs,
                        selectedSongs: _selectedSongs,
                        isLocked: nextShow.isLocked,
                        onSelectionChanged: (selections) {
                          setState(() {
                            _selectedSongs = selections;
                          });
                        },
                      ),
                      const SizedBox(height: 24),
                      if (!nextShow.isLocked)
                        _buildSubmitButton(nextShow),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildShowCard(Show show) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: AppTheme.cardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  show.isLocked ? 'Show In Progress' : 'Make Your Picks',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              if (show.isLocked) const LiveBadge(),
            ],
          ),
          const SizedBox(height: 16),
          if (show.tour != null) ...[
            Text(
              show.tour!.name,
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey.shade400,
              ),
            ),
            const SizedBox(height: 8),
          ],
          Text(
            show.venue,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${show.city}${show.state != null ? ', ${show.state}' : ''}',
            style: TextStyle(color: Colors.grey.shade400),
          ),
          const SizedBox(height: 4),
          Text(
            app_date_utils.DateUtils.formatShowDate(show.showDate),
            style: TextStyle(color: Colors.grey.shade400),
          ),
          if (show.lockTime != null) ...[
            const SizedBox(height: 12),
            if (show.isLocked)
              Text(
                'Picks are locked',
                style: TextStyle(
                  color: AppTheme.accentColor,
                  fontWeight: FontWeight.w600,
                ),
              )
            else
              Row(
                children: [
                  Icon(Icons.lock_clock, size: 16, color: Colors.grey.shade400),
                  const SizedBox(width: 6),
                  Text(
                    'Locks in ${app_date_utils.DateUtils.getTimeUntilLock(show.lockTime!)}',
                    style: TextStyle(
                      color: Colors.grey.shade400,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildErrorBanner() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.red.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.red),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: Colors.red),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _errorMessage!,
              style: const TextStyle(color: Colors.red),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, color: Colors.red),
            onPressed: () {
              setState(() {
                _errorMessage = null;
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSubmitButton(Show show) {
    final opener = _selectedSongs['opener'];
    final encore = _selectedSongs['encore'];
    final regularCount = _selectedSongs.values
        .where((s) => s.pickType == 'REGULAR')
        .length;

    final isValid = opener != null && encore != null && regularCount == 11;

    return SizedBox(
      height: 56,
      child: ElevatedButton(
        onPressed: isValid && !_isSubmitting
            ? () => _handleSubmit(show.id)
            : null,
        child: _isSubmitting
            ? const LoadingDonut(size: 24)
            : Text(
                isValid
                    ? (show.userSubmission != null
                        ? 'Update Picks'
                        : 'Submit Picks')
                    : 'Select All Picks (${1 + 1 + regularCount}/13)',
              ),
      ),
    );
  }

  void _initializePicksFromSubmission(UserSubmission submission) {
    if (submission.picks == null) return;

    final Map<String, SelectedSong> picks = {};
    for (final pick in submission.picks!) {
      final song = pick.song;
      if (song == null) continue;

      final key = pick.pickType == PickType.opener
          ? 'opener'
          : pick.pickType == PickType.encore
              ? 'encore'
              : 'regular_${pick.songId}';

      picks[key] = SelectedSong(
        song: song,
        pickType: pick.pickType == PickType.opener
            ? 'OPENER'
            : pick.pickType == PickType.encore
                ? 'ENCORE'
                : 'REGULAR',
      );
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() {
          _selectedSongs = picks;
        });
      }
    });
  }

  Future<void> _handleSubmit(String showId) async {
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final picks = _selectedSongs.values.map((s) {
        return PickRequest(
          songId: s.song.id,
          pickType: s.pickType,
        );
      }).toList();

      final request = SubmissionRequest(
        showId: showId,
        picks: picks,
      );

      final apiService = ref.read(apiServiceProvider);
      await apiService.submitPicks(request);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Picks submitted successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        
        // Refresh the show data
        ref.invalidate(nextShowProvider);
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }
}

class SelectedSong {
  final Song song;
  final String pickType;

  SelectedSong({
    required this.song,
    required this.pickType,
  });
}
