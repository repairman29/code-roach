# Code Roach Standalone

Self-learning code quality platform extracted from the Smugglers project.

## Status

🚧 **Work in Progress** - This is a parallel development structure.

## Structure

- `src/` - Source code (synced from Smugglers)
- `scripts/` - Utility scripts
- `docs/` - Documentation
- `.standalone-overrides/` - Standalone-specific changes (not synced)

## Syncing

To sync latest Code Roach code from Smugglers:

```bash
npm run sync
```

## Development

This structure allows parallel development:
- Code Roach continues to evolve in Smugglers
- Standalone version can be customized independently
- Changes in `.standalone-overrides/` are preserved

## Note

Files in this directory are synced from the Smugglers project.
Changes may be overwritten on next sync unless in `.standalone-overrides/`.
