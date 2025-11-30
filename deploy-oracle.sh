#!/bin/bash

# Secure Chat 배포 스크립트 (Oracle Cloud)
# Ubuntu 22.04 기준

set -e

echo "=========================================="
echo "Secure Chat 배포 시작"
echo "=========================================="

# 시스템 업데이트
echo "시스템 업데이트 중..."
sudo apt-get update -y
sudo apt-get upgrade -y

# Node.js 설치 (18.x LTS)
if ! command -v node &> /dev/null; then
    echo "Node.js 설치 중..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Node.js 버전: $(node --version)"
echo "npm 버전: $(npm --version)"

# Git 설치
if ! command -v git &> /dev/null; then
    echo "Git 설치 중..."
    sudo apt-get install -y git
fi

# PM2 설치
if ! command -v pm2 &> /dev/null; then
    echo "PM2 설치 중..."
    sudo npm install -g pm2
fi

# 프로젝트 디렉토리로 이동
if [ ! -d "$HOME/secure-chat" ]; then
    echo "프로젝트 클론 중..."
    cd ~
    git clone https://github.com/Gyu-kor/secure-chat.git
fi

cd ~/secure-chat

# 의존성 설치
echo "의존성 설치 중..."
npm install --production

# PM2로 앱 시작/재시작
echo "PM2로 앱 시작 중..."
pm2 delete secure-chat 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# PM2 자동 시작 설정
echo "PM2 자동 시작 설정 중..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# 방화벽 설정
echo "방화벽 설정 중..."
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw --force enable

# iptables 설정 (Oracle Cloud용)
echo "iptables 설정 중..."
sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null 2>&1 || true

echo "=========================================="
echo "배포 완료!"
echo "=========================================="
echo ""
echo "서버 상태 확인:"
pm2 status
echo ""
echo "Public IP 확인:"
curl -s ifconfig.me
echo ""
echo ""
echo "접속 URL: http://$(curl -s ifconfig.me):3000"
echo ""
echo "유용한 명령어:"
echo "  - 로그 확인: pm2 logs secure-chat"
echo "  - 재시작: pm2 restart secure-chat"
echo "  - 상태 확인: pm2 status"
echo ""

