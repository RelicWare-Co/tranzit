To install dependencies:
```sh
bun install
```

To run:
```sh
bun run dev
```

open http://localhost:3000

## Local email testing

Use MailDev to catch Better Auth OTP emails locally.

From the repository root:

```sh
npm run maildev
```

MailDev web UI:

```txt
http://127.0.0.1:1080
```

The backend sends email using the SMTP values from the root `.env` file:

- `SMTP_HOST=127.0.0.1`
- `SMTP_PORT=1025`
- `SMTP_SECURE=false`
- `MAIL_FROM=SIMUT Tulua <no-reply@simut.local>`
