cd milkguard-ai/backend
python -m venv /tmp/check_venv
/tmp/check_venv/Scripts/pip install -q -r requirements.txt
DATABASE_URL="sqlite:///./_check.db" /tmp/check_venv/Scripts/python -c "from app import main; print('IMPORT OK')"
rm -f _check.db
