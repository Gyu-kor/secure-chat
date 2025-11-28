#!/bin/bash

# 타임아웃 문제 빠른 해결 스크립트

echo "🔧 타임아웃 문제 해결 중..."
echo ""

# 1. PM2로 서버 시작
echo "1️⃣ 서버 시작 중..."
cd ~/secure-chat
pm2 start ecosystem.config.js
pm2 save
echo "   ✅ 서버 시작 완료"
echo ""

# 2. UFW 방화벽 설정
echo "2️⃣ 방화벽 설정 중..."
sudo ufw allow 3000/tcp
sudo ufw allow 22/tcp
sudo ufw --force enable
echo "   ✅ 방화벽 설정 완료"
echo ""

# 3. iptables 설정
echo "3️⃣ iptables 설정 중..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT

# iptables-persistent 설치 확인
if ! command -v netfilter-persistent &> /dev/null; then
    echo "   📦 iptables-persistent 설치 중..."
    sudo apt-get update
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
fi

sudo netfilter-persistent save 2>/dev/null || echo "   ⚠️ iptables-persistent 저장 실패 (수동 저장 필요)"
echo "   ✅ iptables 설정 완료"
echo ""

# 4. 상태 확인
echo "4️⃣ 상태 확인 중..."
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null)

echo ""
echo "=========================================="
echo "✅ 설정 완료!"
echo "=========================================="
echo ""
echo "📱 접속 주소:"
echo "   http://$PUBLIC_IP:3000"
echo ""
echo "⚠️  중요: Oracle Cloud 콘솔에서도 포트를 열어야 합니다!"
echo ""
echo "  1. Oracle Cloud Console 접속"
echo "  2. Networking → Virtual Cloud Networks → VCN 선택"
echo "  3. Security Lists → Default Security List"
echo "  4. Ingress Rules → Add Ingress Rules"
echo "     - Source CIDR: 0.0.0.0/0"
echo "     - Destination Port: 3000"
echo "     - Protocol: TCP"
echo ""
echo "🔍 서버 상태 확인:"
echo "   pm2 status"
echo "   pm2 logs phantom-chat"
echo ""



