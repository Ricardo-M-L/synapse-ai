# Synapse AI API Documentation

## Base URL

```
http://localhost:3000
```

## Authentication

When authentication is enabled, include the token in the header:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/chat
```

## Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

### Chat

```http
POST /chat
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "Hello, how are you?",
  "conversationId": "optional-conversation-id",
  "stream": false
}
```

**Response:**
```json
{
  "content": "I'm doing well, thank you! How can I help you today?",
  "toolResults": [],
  "usage": {
    "promptTokens": 25,
    "completionTokens": 15,
    "totalTokens": 40
  }
}
```

**Streaming:**

Set `stream: true` to receive Server-Sent Events:

```
data: {"content": "Hello"}
data: {"content": "!"}
data: [DONE]
```

### List Conversations

```http
GET /conversations
```

**Response:**
```json
[
  {
    "id": "conv-123",
    "messageCount": 10,
    "createdAt": "2026-02-01T10:00:00.000Z",
    "updatedAt": "2026-02-01T11:00:00.000Z"
  }
]
```

### Get Conversation

```http
GET /conversations/:id
```

**Response:**
```json
{
  "id": "conv-123",
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "Hello",
      "timestamp": "2026-02-01T10:00:00.000Z"
    }
  ],
  "createdAt": "2026-02-01T10:00:00.000Z",
  "updatedAt": "2026-02-01T11:00:00.000Z"
}
```

### Delete Conversation

```http
DELETE /conversations/:id
```

**Response:**
```json
{
  "deleted": true
}
```

### Usage Statistics

```http
GET /stats/usage
```

**Response:**
```json
{
  "totalRequests": 100,
  "totalTokens": 5000,
  "totalCost": 0.0125,
  "averageTokensPerRequest": 50
}
```

### Memory Statistics

```http
GET /stats/memory
```

**Response:**
```json
{
  "total": 50,
  "byCategory": {
    "personal": 20,
    "preference": 15,
    "fact": 10,
    "task": 5
  },
  "averageImportance": 0.65
}
```

### List Skills

```http
GET /skills
```

**Response:**
```json
[
  {
    "name": "read_file",
    "description": "Read the contents of a file",
    "parameters": [
      {
        "name": "path",
        "type": "string",
        "required": true,
        "description": "File path"
      }
    ]
  }
]
```

## WebSocket

Connect to `ws://localhost:3000` for real-time communication.

### Messages

**Chat Request:**
```json
{
  "type": "chat",
  "content": "Hello!",
  "stream": false
}
```

**Chat Response:**
```json
{
  "type": "response",
  "content": "Hi there!",
  "usage": {
    "promptTokens": 10,
    "completionTokens": 5,
    "totalTokens": 15
  }
}
```

**Streaming Response:**
```json
{ "type": "stream", "content": "Hello" }
{ "type": "stream", "content": " world" }
{ "type": "stream_end" }
```

**Ping:**
```json
{ "type": "ping" }
```

**Pong:**
```json
{ "type": "pong" }
```

**Error:**
```json
{
  "type": "error",
  "error": "Error message"
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error description"
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

When enabled, responses include rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1643723400
```

## Examples

### cURL

```bash
# Chat
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 2+2?"}'

# With streaming
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me a story", "stream": true}'

# List conversations
curl http://localhost:3000/conversations
```

### JavaScript

```javascript
// Using fetch
const response = await fetch('http://localhost:3000/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello!' })
});

const data = await response.json();
console.log(data.content);
```

### Python

```python
import requests

response = requests.post('http://localhost:3000/chat', json={
    'message': 'Hello!'
})

data = response.json()
print(data['content'])
```
