import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'theme/app_theme.dart';
import 'router/app_router.dart';
import 'services/push_notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize timezone database
  tz.initializeTimeZones();

  runApp(
    const ProviderScope(
      child: FantasyPhishApp(),
    ),
  );
}

class FantasyPhishApp extends ConsumerStatefulWidget {
  const FantasyPhishApp({super.key});

  @override
  ConsumerState<FantasyPhishApp> createState() => _FantasyPhishAppState();
}

class _FantasyPhishAppState extends ConsumerState<FantasyPhishApp> {
  @override
  void initState() {
    super.initState();
    // Initialize push notifications after first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final pushService = ref.read(pushNotificationServiceProvider);
      pushService.initialize();
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(goRouterProvider);

    return MaterialApp.router(
      title: 'FantasyPhish',
      theme: AppTheme.darkTheme,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
