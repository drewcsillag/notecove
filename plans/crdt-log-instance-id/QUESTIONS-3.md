# Questions - Part 3: Final Clarifications

## Q11: Dense UUID Encoding

You mentioned wanting a "more dense encoding of the UUIDs that's filesystem naming safe."

Options:

- **Hex without dashes**: `8f5c0e1a4b2e4d7f8c3b9a1d2e3f4a5b` (32 chars) - simple, readable
- **Base64url**: `j1wOGksuTX-MOzqR0uPzSg` (22 chars) - compact, uses only `a-zA-Z0-9-_`
- **Base32**: `R5OA4GSFVZGX7DA3TIPC4PZ2LM` (26 chars) - all alphanumeric, very safe

**ANSWERED**: Base64url (22 chars) - per fastuuid.com reference. Two UUIDs + delimiter = 45 chars vs 73 chars with dashes.

---

## Q12: Vector Clock Keying

You said vector clocks should be "by profile, or we could do by instance and profile."

Since profiles are locked (only one instance can run a profile at a time), keying by profile ID alone should be sufficient. The instance ID doesn't add disambiguation value if profiles are locked.

**Should vector clocks be keyed by profile ID alone?**

My recommendation: **Yes, profile ID alone** - simpler and sufficient given profile locking.
