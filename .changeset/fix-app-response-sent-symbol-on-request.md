---
'astro': patch
---

Fixes `Astro.cookies.set` and similar response-mutating APIs silently dropping their effects in production when called after the response has been sent (for example, from an unawaited async function continuing past the render phase). A `ResponseSentError` is now thrown in production in these cases, matching the existing development-mode behavior.
