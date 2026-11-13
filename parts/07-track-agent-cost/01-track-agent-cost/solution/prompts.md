# How Claude Code got here: track agent cost with LiteLLM

These are the prompts that produce `compose.yml`, `litellm.yaml` and the `evidence/` files in this folder.
Start Claude Code in your own copy of the starter, which is the `assignment/` folder at the repo root.

The files in `evidence/` are shaped from the LiteLLM documentation for key info and budget errors. They were
not recorded from a live run. Replace them with what your own run saves.

## Prompt 1: write the gateway config

```text
The starter compose.yml runs LiteLLM and Postgres. Write litellm.yaml with one model named factory. Read the real model id from the UPSTREAM_MODEL variable and the provider key from ANTHROPIC_API_KEY, both set in .env. Set the master key and database url from variables too. Never print a secret.
```

## Prompt 2: start it and make a small key

```text
Make a .env with a new LITELLM_MASTER_KEY made by openssl, without printing it. I will add my provider key and model id myself. Then start the stack with docker compose and wait until the proxy is ready. Use the master key to make a virtual key named factory-run-cap with max_budget 0.05 and the model factory. Keep the new key in .env as FACTORY_KEY. Do not print it.
```

## Prompt 3: run one stage through the proxy

```text
Run the triage stage on issue 1 with ANTHROPIC_BASE_URL set to http://localhost:4000 and ANTHROPIC_AUTH_TOKEN set from FACTORY_KEY in .env. Use the model name factory. Save evidence/stage.json with the stage, the issue, the exit code and the base url.
```

## Prompt 4: show the spend, then hit the cap

```text
Call the key info route with the master key and save the answer to evidence/key-info.json, with the key itself replaced by the masked form. Then send small requests with FACTORY_KEY until the proxy refuses one. Save the status and the error body to evidence/refused.json.
```

## Prompt 5: tidy up

```text
Stop the stack with docker compose down -v. Search the folder for anything that starts with sk- outside .env and tell me what you find. Do not print .env.
```

## What to check

- `evidence/key-info.json` shows `max_budget` and a `spend` above zero.
- `evidence/refused.json` has status 400 and the type `budget_exceeded`.
- No file outside `.env` holds a key.
