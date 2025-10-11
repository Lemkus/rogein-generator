# deploy_local.ps1 - Локальный деплой TrailSpot
param(
    [string]$ServerHost = "31.31.196.9",
    [string]$User = "u3288673",
    [string]$Port = "22",
    [string]$Path = "www/trailspot.app",
    [string]$SSHKey = "~/.ssh/trailspot_deploy"
)

Write-Host "Starting TrailSpot local deployment" -ForegroundColor Green
Write-Host "Host: $ServerHost" -ForegroundColor Yellow
Write-Host "User: $User" -ForegroundColor Yellow
Write-Host "Path: $Path" -ForegroundColor Yellow

# Проверяем SSH ключ
Write-Host "`nChecking SSH key..." -ForegroundColor Cyan
if (-not (Test-Path $SSHKey)) {
    Write-Host "SSH key not found at: $SSHKey" -ForegroundColor Red
    Write-Host "Please create SSH key first:" -ForegroundColor Yellow
    Write-Host "ssh-keygen -t rsa -b 4096 -f ~/.ssh/trailspot_deploy -N '' -C 'trailspot-deploy'" -ForegroundColor Cyan
    Write-Host "ssh-copy-id -i ~/.ssh/trailspot_deploy.pub $User@$ServerHost" -ForegroundColor Cyan
    exit 1
}
Write-Host "SSH key found" -ForegroundColor Green

# Проверяем SSH соединение
Write-Host "`nTesting SSH connection..." -ForegroundColor Cyan
$sshTest = ssh -i $SSHKey -p $Port -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$User@$ServerHost" "echo 'SSH works!'" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "SSH connection failed: $sshTest" -ForegroundColor Red
    Write-Host "Please check SSH key setup:" -ForegroundColor Yellow
    Write-Host "ssh-copy-id -i ~/.ssh/trailspot_deploy.pub $User@$ServerHost" -ForegroundColor Cyan
    exit 1
}
Write-Host "SSH connection works" -ForegroundColor Green

# Создаем файл hello.py локально
$helloPy = @'
from flask import Flask, send_from_directory, jsonify, request
import os
import requests
import json

application = Flask(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

@application.route("/")
def index():
    return send_from_directory(".", "index.html")

@application.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".", filename)

@application.route("/api/health")
def health():
    return jsonify({"status": "ok", "message": "TrailSpot API works"})

@application.route("/api/overpass/paths", methods=["POST"])
def overpass_paths():
    try:
        data = request.get_json()
        bbox = data.get("bbox", "")
        query = f"[out:json][timeout:25];(way[highway=path][bbox:{bbox}];);out geom;"
        response = requests.post(OVERPASS_URL, data=query, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@application.route("/api/overpass/barriers", methods=["POST"])
def overpass_barriers():
    try:
        data = request.get_json()
        bbox = data.get("bbox", "")
        query = f"[out:json][timeout:25];(way[barrier][bbox:{bbox}];);out geom;"
        response = requests.post(OVERPASS_URL, data=query, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@application.route("/api/overpass/closed-areas", methods=["POST"])
def overpass_closed_areas():
    try:
        data = request.get_json()
        bbox = data.get("bbox", "")
        query = f"[out:json][timeout:25];(way[access=private][bbox:{bbox}];way[access=no][bbox:{bbox}];);out geom;"
        response = requests.post(OVERPASS_URL, data=query, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@application.route("/api/overpass/water-areas", methods=["POST"])
def overpass_water_areas():
    try:
        data = request.get_json()
        bbox = data.get("bbox", "")
        query = f"[out:json][timeout:25];(way[natural=water][bbox:{bbox}];way[waterway][bbox:{bbox}];);out geom;"
        response = requests.post(OVERPASS_URL, data=query, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    application.run(host="0.0.0.0")
'@

# Создаем файл passenger_wsgi.py локально
$passengerWsgi = @'
import sys
import os
INTERP = os.path.expanduser("/var/www/u3288673/data/venv/bin/python")
if sys.executable != INTERP:
    os.execl(INTERP, INTERP, *sys.argv)
sys.path.append(os.getcwd())
from hello import application
'@

# Сохраняем файлы локально
$helloPy | Out-File -FilePath "hello.py" -Encoding UTF8
$passengerWsgi | Out-File -FilePath "passenger_wsgi.py" -Encoding UTF8

Write-Host "`nExecuting deployment..." -ForegroundColor Green

# Создаем простой скрипт деплоя
$deployScript = @"
set +e
echo 'Starting TrailSpot deployment'
echo 'User: \$(whoami)'
echo 'Current directory: \$(pwd)'

mkdir -p www/trailspot.app
cd www/trailspot.app
echo 'Working directory: \$(pwd)'

echo 'Installing dependencies'
pip3 install --user uvicorn fastapi flask requests

echo 'Checking if git repo exists'
if [ ! -d .git ]; then
  echo 'Cloning repository'
  git clone https://github.com/your-username/trailspot.git .
else
  echo 'Updating repository'
  git pull origin main
fi

echo 'Checking dependencies'
python3 -c 'import uvicorn, fastapi, flask, requests'

echo 'Checking project structure'
ls -la

echo 'Stopping old processes'
pkill -f 'uvicorn.*fastapi' 2>/dev/null || echo 'No FastAPI processes'
pkill -f 'python.*backend_simple' 2>/dev/null || echo 'No backend_simple processes'
pkill -f 'python.*hello' 2>/dev/null || echo 'No hello.py processes'

echo 'Creating restart file'
touch .restart-app
echo 'Restart file created'

echo 'Checking services'
ps aux | grep python | grep -v grep || echo 'No Python processes'

echo 'TrailSpot website: http://trailspot.app'
echo 'TrailSpot API: http://trailspot.app/api/health'
"@

# Сохраняем скрипт во временный файл
$tempScript = "deploy_script.sh"
$deployScript | Out-File -FilePath $tempScript -Encoding UTF8

# Выполняем скрипт через SSH
Get-Content $tempScript | ssh -i $SSHKey -p $Port -o ConnectTimeout=60 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=no "$User@$ServerHost" "bash -s"

# Копируем файлы на сервер
Write-Host "`nUploading Flask files..." -ForegroundColor Cyan
scp -i $SSHKey -P $Port -o StrictHostKeyChecking=no "hello.py" "$User@$ServerHost`:$Path/"
scp -i $SSHKey -P $Port -o StrictHostKeyChecking=no "passenger_wsgi.py" "$User@$ServerHost`:$Path/"

# Удаляем временные файлы
Remove-Item "hello.py" -Force
Remove-Item "passenger_wsgi.py" -Force
Remove-Item $tempScript -Force

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDeployment completed successfully!" -ForegroundColor Green
    Write-Host "Website: http://trailspot.app" -ForegroundColor Cyan
    Write-Host "API: http://trailspot.app/api/health" -ForegroundColor Cyan
} else {
    Write-Host "`nDeployment failed" -ForegroundColor Red
    exit 1
}