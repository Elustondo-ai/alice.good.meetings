# Architecture: how the pieces fit together

This folder will explain the major parts of SpeakerCoach, their responsibilities and how information moves between them. It is where we compare designs against the intended behavior and practical constraints.

![Product behavior → Design alternatives → Components and trade-offs. Diagram of this stage's purpose, not a completion claim.](images/stage-overview.svg)

## SpeakerCoach today

This stage currently contains no architecture assessment beyond its folder scaffolding. That does not mean the existing prototype has no structure; its structure still needs to be described and assessed here.

## What belongs here as we develop

A useful first architecture document would show the path from conversation input to a visible cue, identify component boundaries and explain the trade-offs behind any proposed services or dependencies. Candidate designs must remain clearly distinguished from implemented behavior.

## Explore

- Start from the [system model](../03-system-model-and-use-cases/README.md) and [evaluation strategy](../04-benchmarks-and-eval-strategy/README.md).

Read files in order: **01 Intended**, **02 Current**, **03 Planned**. Additional topics use dotted numbers such as `01.1` or `03.2`; release and sprint plans identify their horizon in the filename and text.
See the [folder guide](../../../asdg/00-governance/docs/stage-layout.md) for consolidation at cycle closeout. Return to [project documentation](../README.md).
