import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz;

class DateUtils {
  /// Format a UTC date string to a readable format
  static String formatShowDate(String utcDate) {
    try {
      final date = DateTime.parse(utcDate);
      return DateFormat('MMMM d, yyyy').format(date);
    } catch (e) {
      return utcDate;
    }
  }

  /// Format lock time with timezone
  static String formatLockTime(String lockTime, String? timezone) {
    try {
      final date = DateTime.parse(lockTime);
      
      if (timezone != null) {
        final location = tz.getLocation(timezone);
        final tzDate = tz.TZDateTime.from(date, location);
        return DateFormat('h a').format(tzDate);
      }
      
      return DateFormat('h:mm a').format(date.toLocal());
    } catch (e) {
      return lockTime;
    }
  }

  /// Get timezone abbreviation
  static String getTimezoneAbbr(String timezone) {
    final abbrs = {
      'America/New_York': 'ET',
      'America/Chicago': 'CT',
      'America/Denver': 'MT',
      'America/Phoenix': 'MST',
      'America/Los_Angeles': 'PT',
      'America/Anchorage': 'AKT',
      'Pacific/Honolulu': 'HT',
      'Europe/London': 'GMT',
      'Europe/Paris': 'CET',
    };
    
    return abbrs[timezone] ?? 'Local';
  }

  /// Check if a show is locked
  static bool isShowLocked(String? lockTime) {
    if (lockTime == null) return false;
    try {
      final lock = DateTime.parse(lockTime);
      return DateTime.now().isAfter(lock);
    } catch (e) {
      return false;
    }
  }

  /// Get time remaining until lock
  static String getTimeUntilLock(String lockTime) {
    try {
      final lock = DateTime.parse(lockTime);
      final now = DateTime.now();
      
      if (now.isAfter(lock)) {
        return 'Locked';
      }
      
      final difference = lock.difference(now);
      
      if (difference.inDays > 0) {
        return '${difference.inDays}d ${difference.inHours % 24}h';
      } else if (difference.inHours > 0) {
        return '${difference.inHours}h ${difference.inMinutes % 60}m';
      } else if (difference.inMinutes > 0) {
        return '${difference.inMinutes}m';
      } else {
        return 'Locking soon...';
      }
    } catch (e) {
      return '';
    }
  }
}
