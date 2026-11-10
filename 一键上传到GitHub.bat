@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在打包并上传最新代码到 GitHub (zzfun123/zzfun-homepage)...
git add .
git commit -m "Update homepage" 2>nul
git push -u origin main
echo.
echo ====================================================
echo 如果上方显示 branch 'main' set up to track... 说明已上传成功！
echo Cloudflare 会自动检测到更新并重新部署你的网站。
echo ====================================================
pause
