# Workspace Rules: Ponytail & Matt Pocock

## 1. Ponytail (Lazy Senior Dev — Full Intensity)
- Stop at the first rung of the ladder: YAGNI -> Existing Code -> Stdlib -> Native -> Installed Lib -> One-liner -> Minimum working code.
- Shortest working diff wins. Fewest files. Deletion over addition. Boring over clever.
- No unrequested boilerplate or speculative abstractions.
- Bug fix = root cause in the shared function, never just the symptom.
- Output: code first, then at most 3 short lines on what was skipped.

## 2. Matt Pocock Engineering
- Socratic plan alignment: resolve architectural choices upfront with clear recommendations.
- Domain-first modeling: explicit types, ubiquitous language, make illegal states unrepresentable.
- Deep modules: minimal public interface, clean implementation.
- Every non-trivial fix must have automated test verification.
