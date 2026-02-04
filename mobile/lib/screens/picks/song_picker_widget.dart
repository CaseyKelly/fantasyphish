import 'package:flutter/material.dart';
import '../../models/song.dart';
import '../../theme/app_theme.dart';
import 'picks_screen.dart';

class SongPickerWidget extends StatefulWidget {
  final List<Song> songs;
  final Map<String, SelectedSong> selectedSongs;
  final bool isLocked;
  final Function(Map<String, SelectedSong>) onSelectionChanged;

  const SongPickerWidget({
    super.key,
    required this.songs,
    required this.selectedSongs,
    required this.isLocked,
    required this.onSelectionChanged,
  });

  @override
  State<SongPickerWidget> createState() => _SongPickerWidgetState();
}

class _SongPickerWidgetState extends State<SongPickerWidget> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Song> get filteredSongs {
    if (_searchQuery.isEmpty) return widget.songs;
    final query = _searchQuery.toLowerCase();
    return widget.songs
        .where((song) => song.name.toLowerCase().contains(query))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!widget.isLocked) ...[
          TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              labelText: 'Search songs',
              prefixIcon: Icon(Icons.search),
              suffixIcon: null,
            ),
            onChanged: (value) {
              setState(() {
                _searchQuery = value;
              });
            },
          ),
          const SizedBox(height: 16),
        ],
        _buildPickSection(
          'Opener',
          'opener',
          '3 points',
          'First song of Set 1',
        ),
        const SizedBox(height: 16),
        _buildPickSection(
          'Encore',
          'encore',
          '3 points',
          'Any song in encore',
        ),
        const SizedBox(height: 16),
        _buildRegularPicksSection(),
      ],
    );
  }

  Widget _buildPickSection(
    String title,
    String key,
    String points,
    String description,
  ) {
    final selection = widget.selectedSongs[key];

    return Container(
      decoration: AppTheme.cardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: AppTheme.borderColor.withOpacity(0.5),
                ),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  title == 'Opener' ? Icons.play_circle : Icons.star,
                  color: AppTheme.accentColor,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        description,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade400,
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  points,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.accentColor,
                  ),
                ),
              ],
            ),
          ),
          if (selection != null)
            ListTile(
              leading: const Icon(Icons.check_circle, color: AppTheme.accentColor),
              title: Text(selection.song.name),
              trailing: widget.isLocked
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => _removePick(key),
                    ),
            )
          else if (!widget.isLocked)
            Padding(
              padding: const EdgeInsets.all(16),
              child: OutlinedButton(
                onPressed: () => _showSongPicker(key, title),
                child: Text('Select $title'),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'No pick selected',
                style: TextStyle(
                  color: Colors.grey.shade400,
                  fontStyle: FontStyle.italic,
                ),
                textAlign: TextAlign.center,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildRegularPicksSection() {
    final regularPicks = widget.selectedSongs.entries
        .where((e) => e.value.pickType == 'REGULAR')
        .map((e) => e.value)
        .toList();

    return Container(
      decoration: AppTheme.cardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: AppTheme.borderColor.withOpacity(0.5),
                ),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.music_note,
                  color: Colors.grey.shade400,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Regular Picks',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        'Any song played in the show',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade400,
                        ),
                      ),
                    ],
                  ),
                ),
                const Text(
                  '1 pt each',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white70,
                  ),
                ),
              ],
            ),
          ),
          if (regularPicks.isEmpty && widget.isLocked)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'No picks selected',
                style: TextStyle(
                  color: Colors.grey.shade400,
                  fontStyle: FontStyle.italic,
                ),
                textAlign: TextAlign.center,
              ),
            )
          else ...[
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: regularPicks.length,
              separatorBuilder: (context, index) => Divider(
                height: 1,
                color: AppTheme.borderColor.withOpacity(0.5),
              ),
              itemBuilder: (context, index) {
                final pick = regularPicks[index];
                return ListTile(
                  leading: Text(
                    '${index + 1}',
                    style: TextStyle(
                      color: Colors.grey.shade400,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  title: Text(pick.song.name),
                  trailing: widget.isLocked
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () =>
                              _removePick('regular_${pick.song.id}'),
                        ),
                );
              },
            ),
            if (!widget.isLocked && regularPicks.length < 11) ...[
              Divider(
                height: 1,
                color: AppTheme.borderColor.withOpacity(0.5),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: OutlinedButton(
                  onPressed: () => _showSongPicker('regular', 'Regular Pick'),
                  child: Text(
                    'Add Song (${regularPicks.length}/11)',
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  void _showSongPicker(String key, String title) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.backgroundColor,
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.9,
          minChildSize: 0.5,
          maxChildSize: 0.9,
          expand: false,
          builder: (context, scrollController) {
            return Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceColor,
                    border: Border(
                      bottom: BorderSide(
                        color: AppTheme.borderColor.withOpacity(0.5),
                      ),
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Select $title',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: TextField(
                    decoration: const InputDecoration(
                      labelText: 'Search songs',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (value) {
                      setState(() {
                        _searchQuery = value;
                      });
                    },
                    autofocus: true,
                  ),
                ),
                Expanded(
                  child: ListView.separated(
                    controller: scrollController,
                    itemCount: filteredSongs.length,
                    separatorBuilder: (context, index) => Divider(
                      height: 1,
                      color: AppTheme.borderColor.withOpacity(0.3),
                    ),
                    itemBuilder: (context, index) {
                      final song = filteredSongs[index];
                      final isSelected = _isSongSelected(song.id);

                      return ListTile(
                        title: Text(song.name),
                        subtitle: Text(
                          'Played ${song.timesPlayed}x${song.gap != null ? ' • Gap: ${song.gap}' : ''}',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade400,
                          ),
                        ),
                        trailing: isSelected
                            ? const Icon(
                                Icons.check_circle,
                                color: AppTheme.accentColor,
                              )
                            : null,
                        enabled: !isSelected,
                        onTap: isSelected
                            ? null
                            : () {
                                _selectSong(key, song);
                                Navigator.pop(context);
                              },
                      );
                    },
                  ),
                ),
              ],
            );
          },
        );
      },
    ).then((_) {
      // Clear search when bottom sheet closes
      setState(() {
        _searchQuery = '';
        _searchController.clear();
      });
    });
  }

  bool _isSongSelected(String songId) {
    return widget.selectedSongs.values.any((s) => s.song.id == songId);
  }

  void _selectSong(String key, Song song) {
    final pickType = key == 'opener'
        ? 'OPENER'
        : key == 'encore'
            ? 'ENCORE'
            : 'REGULAR';

    final actualKey = pickType == 'REGULAR' ? 'regular_${song.id}' : key;

    final updatedSelections = Map<String, SelectedSong>.from(widget.selectedSongs);
    updatedSelections[actualKey] = SelectedSong(
      song: song,
      pickType: pickType,
    );

    widget.onSelectionChanged(updatedSelections);
  }

  void _removePick(String key) {
    final updatedSelections = Map<String, SelectedSong>.from(widget.selectedSongs);
    updatedSelections.remove(key);
    widget.onSelectionChanged(updatedSelections);
  }
}
