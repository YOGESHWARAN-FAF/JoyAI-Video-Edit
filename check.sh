#!/bin/bash
# ==========================================================
#         JoyAI-Video-Edit Live Health & Status Check
# ==========================================================

echo "=========================================================="
echo "          🔍 JoyAI Server Diagnostics                     "
echo "=========================================================="

PORT=${1:-8090}

# 1. Check if server process is running
echo -n "[1] Server Process: "
SERVER_PID=$(pgrep -f "serve_joyomni_streaming" | head -n 1)
if [ -n "$SERVER_PID" ]; then
    echo "RUNNING (PID: $SERVER_PID)"
else
    echo "NOT RUNNING ❌"
fi

# 2. Check if Port is listening
echo -n "[2] Port $PORT Status: "
PORT_CHECK=$(ss -tlnp 2>/dev/null | grep ":$PORT " || netstat -tlnp 2>/dev/null | grep ":$PORT " || true)
if [ -n "$PORT_CHECK" ]; then
    echo "LISTENING (Active) ✅"
else
    echo "NOT LISTENING ❌ (Server is either starting or crashed)"
fi

# 3. Check Local HTTP Response
echo -n "[3] Local HTTP Test (http://127.0.0.1:$PORT/): "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "HTTP 200 OK ✅"
elif [ "$HTTP_CODE" = "000" ]; then
    echo "NO RESPONSE ❌ (Connection refused)"
else
    echo "HTTP $HTTP_CODE"
fi

# 4. Check Cloudflare Tunnel
echo -n "[4] Cloudflare Tunnel: "
CF_PID=$(pgrep -f "cloudflared" | head -n 1)
if [ -n "$CF_PID" ]; then
    echo "RUNNING (PID: $CF_PID) ✅"
else
    echo "NOT RUNNING ❌"
fi

# 5. Check Pinggy Tunnel
echo -n "[5] Pinggy Tunnel: "
PG_PID=$(pgrep -f "a.pinggy.io" | head -n 1)
if [ -n "$PG_PID" ]; then
    echo "RUNNING (PID: $PG_PID) ✅"
else
    echo "NOT RUNNING ❌"
fi

echo "=========================================================="
if [ "$HTTP_CODE" = "200" ]; then
    echo "  🎉 JoyAI Server is healthy and running on port $PORT!"
else
    echo "  ⚠️ Server is not responding locally yet."
    echo "     Run 'bash run.sh' to start it."
fi
echo "=========================================================="

