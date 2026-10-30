# Local AI without provider keys

Nova defaults to `NOVA_AI_PROVIDER=ollama`. Run Nova and Ollama on the **same machine**. No API key is needed and the adapter never falls back to OpenRouter. It calls only `http://127.0.0.1:11434`, rejects redirects, and checks model metadata before generation to reject cloud-backed models. A cloud Nova server's localhost does not refer to your laptop.

## Initial hardware target

The user has 16 GB RAM and an RTX 5070. Exact VRAM, OS and available disk are not yet verified. `qwen2.5-coder:7b` is an initial coding-model candidate, not a claim of best quality. Verify the downloaded model's license and size. A larger model or context needs measured VRAM/RAM headroom; local weights are free to download under their license, while hardware, electricity and hosting have costs.

## Setup on your computer

1. Install a current NVIDIA driver, Node 22 and Ollama from its official [download page](https://ollama.com/download). Use the official checks/signatures; do not disable TLS or artifact verification.
2. Configure Ollama with `OLLAMA_NO_CLOUD=1` and keep it listening on loopback. Restart the Ollama process after changing this setting. Start it with `ollama serve` only if the desktop application is not already running its server.
3. Download the model with `ollama pull qwen2.5-coder:7b`. The download needs Internet access and several GB of disk. After downloading, the local inference path requires no external service or subscription. Inspect it with `ollama show qwen2.5-coder:7b` and `ollama list`.
4. In the Nova checkout, run `npm ci` and `npm run setup:local`. Add the following non-secret settings to the existing private `.env.local` without replacing its auth secret or database settings:

```dotenv
NOVA_AI_PROVIDER=ollama
NOVA_OLLAMA_MODEL=qwen2.5-coder:7b
NOVA_AI_ENABLED=0
```

5. Run `npm run ai:smoke`. It makes one actual generation, validates the two static files, builds a sanitized preview without executing source, and prints validation metadata only. A failure is not an activation success. Inspect `ollama ps` during the run to check memory/device placement.
6. Only after a successful smoke check, set `NOVA_AI_ENABLED=1` and run `npm run dev` (or `npm run build` then `npm start`). Validate Arabic and English create/edit examples and record latency and preservation quality before choosing the final model.

The current local adapter requests 16,384 context tokens and at most 4,096 output tokens. It rejects messages above 10,000 UTF-8 bytes before any runtime request, leaving conservative room for output and the model template. It never silently drops source. Large contexts return a visible context-limit error. The existing run deadline is 90 seconds; a slow model may fail it. Longer jobs require the planned durable-worker/lease changes. Generation remains HTML/CSS until isolated full-stack execution is implemented.

## Validation status

Fixture tests cover local configuration, key-free generation, loopback request construction, cloud-model rejection, response/context limits, cancellation and output validation. An HTTP fixture test uses an ephemeral loopback port and does not disturb an installed Ollama server. These tests prove integration behavior, not real model quality or GPU readiness. No Ollama runtime/model/GPU was available in the current cloud environment.

The legacy OpenRouter adapter is still available only with explicit `NOVA_AI_PROVIDER=openrouter`, its credential and a verified free model. It is never an automatic fallback and is not required for this local workflow.
