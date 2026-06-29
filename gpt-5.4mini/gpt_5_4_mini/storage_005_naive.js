<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>API Cache with localStorage</title>
</head>
<body>
  <script>
    /**
     * Create a cached fetch helper using localStorage.
     *
     * @param {Object} options
     * @param {string} [options.prefix='apiCache:'] - Key prefix for localStorage entries.
     * @param {number} [options.defaultTTL=300000] - Default time-to-live in ms.
     * @returns {Function} cachedFetch(url, fetchOptions = {}, cacheOptions = {})
     */
    function createCachedFetch(options = {}) {
      const prefix = options.prefix || 'apiCache:';
      const defaultTTL = typeof options.defaultTTL === 'number' ? options.defaultTTL : 300000;

      function makeKey(url, fetchOptions) {
        return prefix + url + '::' + JSON.stringify(fetchOptions || {});
      }

      function readCache(key) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return null;

          const entry = JSON.parse(raw);
          if (!entry || typeof entry !== 'object') return null;

          if (typeof entry.expiresAt === 'number' && Date.now() > entry.expiresAt) {
            localStorage.removeItem(key);
            return null;
          }

          return entry.data;
        } catch (err) {
          return null;
        }
      }

      function writeCache(key, data, ttl) {
        try {
          const entry = {
            expiresAt: Date.now() + ttl,
            data: data
          };
          localStorage.setItem(key, JSON.stringify(entry));
        } catch (err) {
          // Ignore storage errors (quota exceeded, unavailable, etc.)
        }
      }

      return async function cachedFetch(url, fetchOptions = {}, cacheOptions = {}) {
        const ttl = typeof cacheOptions.ttl === 'number' ? cacheOptions.ttl : defaultTTL;
        const forceRefresh = cacheOptions.forceRefresh === true;
        const key = makeKey(url, fetchOptions);

        if (!forceRefresh) {
          const cached = readCache(key);
          if (cached !== null) {
            return cached;
          }
        }

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        writeCache(key, data, ttl);
        return data;
      };
    }

    // Example usage:
    const cachedFetch = createCachedFetch({
      prefix: 'myApp:',
      defaultTTL: 5 * 60 * 1000 // 5 minutes
    });

    // Example call:
    // cachedFetch('https://jsonplaceholder.typicode.com/todos/1')
    //   .then(data => console.log('Data:', data))
    //   .catch(err => console.error(err));
  </script>
</body>
</html>