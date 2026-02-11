# Logging Configuration Guide

## ✅ Logging is Always Enabled

**No configuration needed!** Logging is enabled by default and will work out of the box.

## Optional Environment Variables

If you want to adjust the log level (default is 'info'):

```bash
# Set log level (optional, default: 'info')
LOG_LEVEL=debug   # Most verbose - shows all details including request bodies
LOG_LEVEL=info    # Standard - shows requests, responses, decisions (default)
LOG_LEVEL=warn    # Only warnings and errors
LOG_LEVEL=error   # Only errors
```

## Default Behavior

- **Logging**: Always **enabled** (no configuration needed)
- **Log Level**: `info` by default (shows important logs, not too verbose)

## What Gets Logged

### Always Logged
- `[KW-BOT] Mega ogudor` - Required by game server
- Incoming requests (method, path, IP, user agent)
- Request bodies (full game state) - if LOG_LEVEL=debug
- Decision-making process (threats, allies, targets)
- Resource usage tracking
- Combat actions
- Responses (status, time, body)
- Errors and warnings

## Quick Reference

| LOG_LEVEL | What You See |
|-----------|--------------|
| debug | Everything (requests, bodies, all decisions, debug info) |
| info | Standard logs (requests, responses, decisions) - **Default** |
| warn | Only warnings and errors |
| error | Only errors |

## No Configuration Required

Just start the server - logging works automatically! 🚀
