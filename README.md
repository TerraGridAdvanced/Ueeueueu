# NeuroBody Lab 4 — Fruit Fly World

A lightweight 3D fruit-fly embodied neural-world experiment.

## Core loop

WORLD SENSORS → NEURAL NETWORK → MOTOR NEURONS → BODY PHYSICS → WORLD

The code intentionally does not contain a destination selector, pathfinder, wander routine, navigation AI, reinforcement learner, or "move to food" behavior.

The world provides measurements (food proximity, hazard proximity, light, wall proximity/touch). Those measurements are injected into sensory neurons. Neural activity propagates through the loaded network. Motor-neuron spikes are the only source of thrust/turn. The body physics then moves the fly.

## Important scientific caveat

The public connectome data available here is not a complete Drosophila brain simulation. A full fruit-fly connectome and biological dynamics require substantially more data and modeling than a simple browser demo. This project is an embodied computational showcase, not a validated biological emulation.

## Render

Build command: `npm install`
Start command: `node server.js`

Root directory: blank when repository files are at root.

## Note

This version uses a recognizable low-poly fruit-fly body and a deliberately visible open world. It does not require a GLB/OBJ asset; Three.js constructs the fly and environment at runtime.

If the public upstream endpoint is unavailable, the UI switches to DEMO NEURAL WORLD so the 3D environment remains visible and functional.
