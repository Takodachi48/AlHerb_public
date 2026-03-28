# Location Image Sources

`locationImageService` is provider-based. To add a new source:

1. Add a provider function in `server/src/services/locationImageService.js`.
2. The function should return either `null` or:

```js
{
  provider: 'yourProviderName',
  imageUrl: 'https://...',
  thumbnailUrl: 'https://...',
  distanceMeters: 12.3,
  attribution: 'https://...',
  capturedAt: new Date(),
  raw: {}
}
```

3. Insert the provider in `fetchImageFromProviders(...)` in your preferred priority order.
4. If needed, add environment variables in `.env`.

## Storage Strategy

- Default behavior stores URL references only (low storage).
- Thumbnails are preferred over full images when available.
- Full-resolution download/storage should be implemented in a separate worker if required.

## Rate Limiting

- Global queue enforces one outbound provider request per second.
- Failed lookups are cached with a retry window to avoid repeated misses.
