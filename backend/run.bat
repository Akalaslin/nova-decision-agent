@echo off
cd /d D:\Nova_AI\backend
call venv\Scripts\activate
python -m uvicorn app.main:app --reload