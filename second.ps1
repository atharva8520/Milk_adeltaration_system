Set-Location "c:\Users\91942\free_fire_khelega\milkguard-ai\backend"
Remove-Item -Force _final_check.db -ErrorAction SilentlyContinue
$env:DATABASE_URL="sqlite:///./_final_check.db"
$proc = Start-Process c:\tmp\check_venv\Scripts\uvicorn.exe -ArgumentList "app.main:app", "--port", "8199" -PassThru -NoNewWindow
Start-Sleep -Seconds 3
$B="http://localhost:8199"
Write-Host "--- Fix 1 check: server booted ---"
(Invoke-WebRequest -Uri "$B/health" -UseBasicParsing).Content
Write-Host ""
Write-Host "--- Fix 2 check: GET /users must NOT contain any email ---"
Invoke-RestMethod -Uri "$B/register" -Method Post -ContentType "application/json" -Body '{"email":"checkuser@t.com","password":"pw","role":"farmer","name":"Check User"}' | Out-Null
$RESULT = (Invoke-WebRequest -Uri "$B/users" -UseBasicParsing).Content
Write-Host $RESULT
if ($RESULT -match "email") {
    Write-Host "FAIL: email field still present in GET /users response"
} else {
    Write-Host "PASS: no email field in response"
}
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Remove-Item -Force _final_check.db -ErrorAction SilentlyContinue
