# AI Facilitator

**AI Facilitator** that helps guide a business discussion between two users.

- **Initiate Conversation API**: generates an initial AI message for each user.
- **Facilitate Conversation API (Intervention)**: decides whether the AI should intervene, plus an optional AI message targeted to one user.

> ships with a **rule-based** facilitator (no external AI key needed).  
> swap the logic in `server/src/facilitator/engine.js` with a real LLM call in future.

## Project structure

- `server/` – Express API (port **3000**)
- `client/` – Vite + React UI (port **5173**, proxies `/api` to server)

## Quick start

```bash
# from project root
npm install
npm run dev
```

Open the UI:

- http://localhost:5173

API base:

- http://localhost:3000

## Endpoint 1: Initiate Conversation API

**POST** `/api/initiate-conversation`

Body:

```json
{
  "users_info": "string"
}
```

Response:

```json
{
  "data": {
    "ai_messages": [
      { "ai_message": "…", "target": "PROFILE_ID_1" },
      { "ai_message": "…", "target": "PROFILE_ID_2" }
    ]
  }
}
```

Example curl:

```bash
curl -X POST http://localhost:3000/api/initiate-conversation   -H "Content-Type: application/json"   -d '{"users_info":"User 1:\nProfile ID: 111\nUser Name: Alice\n\nUser 2:\nProfile ID: 222\nUser Name: Bob\n"}'
```

## Endpoint 2: Facilitate Conversation API (Intervention)

**POST** `/api/facilitate-conversation`

Body:

```json
{
  "users_info": "string",
  "conversation": "string"
}
```

Response:

```json
{
  "data": {
    "should_intervene": true,
    "urgency": "high",
    "ai_message": { "ai_message": "…", "target": "PROFILE_ID_1" }
  }
}
```

If no intervention:

```json
{
  "data": {
    "should_intervene": false,
    "urgency": "none",
    "ai_message": null
  }
}
```

Example curl:

```bash
curl -X POST http://localhost:3000/api/facilitate-conversation   -H "Content-Type: application/json"   -d '{
    "users_info":"User 1:\nProfile ID: 111\nUser Name: Alice\n\nUser 2:\nProfile ID: 222\nUser Name: Bob\n",
    "conversation":"Alice: Hi Bob\nBob: Hello!\nAlice: I don\u0027t have any topic\n"
  }'
```

## Notes

- The API accepts `users_info` and `conversation` as **strings** (same as your screenshots).
- The server returns a stable response format under a `data` key.
- `client` uses Vite proxy, so in development you can call `/api/*` from the browser without CORS.
