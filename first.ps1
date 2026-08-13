Set-Location "c:\Users\91942\free_fire_khelega\milkguard-ai\backend"
python -m venv c:\tmp\check_venv
c:\tmp\check_venv\Scripts\pip.exe install -q -r requirements.txt
$env:DATABASE_URL="sqlite:///./_check.db"
& c:\tmp\check_venv\Scripts\python.exe -c "from app import main; print('IMPORT OK')"
Remove-Item -Force _check.db
