# Pay-on-Green

**An AI agent that fixes your failing test, and only gets paid if the tests go green.**

Live: https://pay-on-green.timidan.xyz · Built in one day for the CreateOS × Stripe Projects hackathon (17 Oct 2026).

## How it works

1. You pick a failing test and press **Fix it for $5**. Stripe puts a **$5 hold** on the card (a PaymentIntent with `capture_method: "manual"`). Nothing is charged yet.
2. The agent reads the code and the test output, and **writes a patch**.
3. The patch runs inside a **CreateOS Sandbox**: a Firecracker micro-VM whose network can reach one host and nothing else. Stripe keys never enter it.
4. **Green tests capture the $5.** If the agent fails three times, the hold is **cancelled** and you pay nothing.

The agent can't buy a green result by editing the tests. Any patch that touches `test/` is rejected, and the server rewrites the test files from its own copy before every run.

**Who pays:** a developer pays $5 per fixed failing test. Stripe authorizes it up front and captures it only after the suite passes in the sandbox. If the agent fails, the hold is released and they pay $0.

## The stack (provisioned with Stripe Projects)

| Piece | What it does |
|---|---|
| Stripe (test mode) | The $5 hold, then capture on green or cancel on failure |
| CreateOS Sandbox | Runs the agent's code with `node --test`, egress locked to one host |
| OpenRouter (free plan) | The model that writes the patch |

`stripe projects init` + `stripe projects add createos/project` + `stripe projects add openrouter/free` set up the CreateOS and OpenRouter accounts and wrote their keys to `.env`.

## Run it

```bash
npm install
stripe projects env --pull     # CreateOS + OpenRouter keys into .env
echo "STRIPE_SECRET_KEY=sk_test_..." >> .env
npm run dev
```

Open http://localhost:3000. Add `?mock=fix` or `?mock=fail` to replay a recorded run without any keys.

## Design notes

- **One sandbox for the whole demo.** The CreateOS free plan allows one sandbox at a time and ten creations a day, so the server creates it once, saves its id, and wipes `/work` between jobs.
- **Egress.** `[]` and `null` mean *allow all* in the CreateOS SDK, so the sandbox gets a one-host allowlist instead.
- **Every exit path settles the hold exactly once:** green captures; failure, errors and timeouts cancel.
