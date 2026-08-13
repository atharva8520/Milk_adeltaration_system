cd milkguard-ai/backend
rm -f _final_check.db
DATABASE_URL="sqlite:///./_final_check.db" /tmp/check_venv/bin/uvicorn app.main:app --port 8199 &
UVPID=$!
sleep 3
B=http://localhost:8199

echo "--- Fix 1 check: server booted ---"
curl -s $B/health
echo

echo "--- Fix 2 check: GET /users must NOT contain any email ---"
curl -s -X POST $B/register -H 'Content-Type: application/json' -d '{"email":"checkuser@t.com","password":"pw","role":"farmer","name":"Check User"}' > /dev/null
RESULT=$(curl -s "$B/users")
echo "$RESULT"
if echo "$RESULT" | grep -q "email"; then
  echo "FAIL: email field still present in GET /users response"
else
  echo "PASS: no email field in response"
fi

kill $UVPID 2>/dev/null
rm -f _final_check.db
