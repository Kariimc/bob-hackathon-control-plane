# Security

## Design boundary

- The server listens on `127.0.0.1` only.
- The application makes no outbound requests.
- Data is generic, in-memory, and resets when the process restarts.
- The project reads only its own static files.
- The project uses no credentials, user profiles, machine inventory, or private
  service configuration.
- Browser policy headers allow scripts, styles, and API calls only from the
  same local origin.

## Safe contribution rules

- Never commit `.env` files, credentials, personal data, identifying paths,
  private messages, runtime output, or internal documents.
- Keep examples fictional and reusable.
- Run `npm run scan` before every commit.
- Treat a scanner failure as a block. Remove the unsafe value rather than adding
  an exception for it.
- Report a security concern privately to the project owner before publication.

## Scanner limits

The scanner checks repository text and unsafe filenames deterministically. It
does not prove that every possible private detail is absent. A human review is
still required before publication.
