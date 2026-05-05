---
'astro': patch
---

Fixes `computePreferredLocale` violating its "first match wins" semantics when the `i18n.locales` config contains object-form entries (`{ path, codes }`). The inner `break` only exited the codes-array loop, so a later normalize-equivalent code could overwrite the earlier match. The function now correctly returns the first matching code across both string and object entries.
