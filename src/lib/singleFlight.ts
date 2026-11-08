/**
 * Coalesces concurrent asynchronous operations with the same key.
 *
 * If an operation for the given key is already in progress (represented by a Promise),
 * that same Promise is returned. Otherwise, the provided asynchronous function `fn` is executed,
 * and its Promise is stored in the map.
 * When the Promise resolves or rejects, the key is automatically deleted from the map using `.finally()`,
 * ensuring that failed or stale results are not permanently cached.
 */
export function singleFlight<K, V>(
  map: Map<K, Promise<V>>,
  key: K,
  fn: () => Promise<V>
): Promise<V> {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const promise = fn().finally(() => {
    map.delete(key);
  });

  map.set(key, promise);
  return promise;
}
