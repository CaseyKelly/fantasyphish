import 'package:flutter/material.dart';
import 'donut_logo.dart';

class LoadingDonut extends StatefulWidget {
  final double size;

  const LoadingDonut({
    super.key,
    this.size = 48,
  });

  @override
  State<LoadingDonut> createState() => _LoadingDonutState();
}

class _LoadingDonutState extends State<LoadingDonut>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RotationTransition(
      turns: _controller,
      child: DonutLogo(size: widget.size),
    );
  }
}
