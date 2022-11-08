# Permissions

Objective: restrict certain operations to some users only.

Examples:

- We may not want to allow users with knowledge of a key name (and algorithm)
  to be able to rotate it.
- We may not want to allow users to share a particular key, even if they have
  a copy of it.
- We may want to restrict who can delete keys for others (banning)
- We may want to restrict who can grant/revoke permissions

## Operations

- Sharing: allow a user to distribute copies of the key to others
- Rotation: allow a user to "update" a key by adding a new entry in their keychain
- Deletion: allow a user to ban another user by deleting their keys
- Management: allow a user to change permissions for other users

All operations are scoped to a key name.

## Default rules

- Anyone can create a key with a new name
- By default, only the key creator can share and rotate this key
- The key creator can allow some users to share the key, rotate the key,
  delete the key for others, or administer the key entirely.
