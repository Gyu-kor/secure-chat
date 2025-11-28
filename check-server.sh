#!/bin/bash

# 서버 상태 진단 스크립트

echo "=========================================="
echo "🔍 Secure Chat 서버 진단"
echo "=========================================="
echo ""

echo "1️⃣ PM2 프로세스 상태:"
pm2 status
echo ""

echo "2️⃣ 포트 3000 리스닝 확인:"
if sudo netstat -tuln | grep -q ":3000 "; then
    echo "   ✅ 포트 3000이 리스닝 중입니다"
    sudo netstat -tuln | grep ":3000 "
else
    echo "   ❌ 포트 3000이 리스닝되지 않습니다"
fi
echo ""

echo "3️⃣ Node.js 프로세스 확인:"
ps aux | grep -E "node|pm2" | grep -v grep
echo ""

echo "4️⃣ UFW 방화벽 상태:"
sudo ufw status | head -5
echo ""

echo "5️⃣ iptables 규칙 (포트 3000):"
if sudo iptables -L -n -v | grep -q "3000"; then
    echo "   ✅ iptables 규칙이 있습니다"
    sudo iptables -L -n -v | grep "3000"
else
    echo "   ⚠️ iptables에 포트 3000 규칙이 없습니다"
fi
echo ""

echo "6️⃣ 로컬 연결 테스트:"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|301\|302"; then
    echo "   ✅ 로컬 서버가 정상 작동 중입니다"
else
    echo "   ❌ 로컬 서버에 연결할 수 없습니다"
fi
echo ""

echo "7️⃣ 외부 IP 주소:"
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null)
echo "   🌐 공인 IP: $PUBLIC_IP"
echo "   📱 접속 주소: http://$PUBLIC_IP:3000"
echo ""

echo "8️⃣ PM2 로그 (최근 10줄):"
pm2 logs phantom-chat --lines 10 --nostream
echo ""

echo "=========================================="
echo "✅ 진단 완료"
echo "=========================================="
echo ""
echo "💡 문제 해결 팁:"
echo "   - 서버가 실행되지 않으면: pm2 start ecosystem.config.js"
echo "   - 포트가 열려있지 않으면: sudo ufw allow 3000/tcp"
echo "   - Oracle Cloud Security List에서 포트 3000 열기 확인"
echo ""


