@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set PY=python
where python >nul 2>nul || set PY=py
echo === 1/2 单条用例（依赖缺失，看它自己修好） ===
%PY% -m harness run --case T-07
echo.
echo === 2/2 全部 10 条 × 三档基线 ===
%PY% -m harness suite
echo.
echo 产物在 artifacts\ 目录；看单条详情： %PY% -m harness show --case T-07
pause
