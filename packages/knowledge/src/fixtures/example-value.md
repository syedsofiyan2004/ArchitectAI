# Rate Limiter Example

To configure the rate limiter, set a limit on the number of requests.
Example:
```javascript
const limiter = new RateLimiter({
  maxRequests: 10
});
```
This restricts the user to 10 requests per minute.
