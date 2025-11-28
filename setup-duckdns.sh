#!/bin/bash

# DuckDNS 자동 설정 스크립트

echo "🦆 DuckDNS 자동 설정 시작..."
echo ""

# DuckDNS 토큰 입력 받기
read -p "DuckDNS 토큰을 입력하세요: " DUCKDNS_TOKEN
read -p "도메인 이름을 입력하세요 (예: sokdak): " DOMAIN_NAME

if [ -z "$DUCKDNS_TOKEN" ] || [ -z "$DOMAIN_NAME" ]; then
    echo "❌ 토큰과 도메인 이름을 모두 입력해야 합니다."
    exit 1
fi

# DuckDNS 디렉토리 생성
mkdir -p ~/duckdns
cd ~/duckdns

# 업데이트 스크립트 생성
cat > duck.sh <<EOF
#!/bin/bash
DOMAIN="${DOMAIN_NAME}"
TOKEN="${DUCKDNS_TOKEN}"
CURRENT_IP=\$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null)
RESPONSE=\$(curl -s "https://www.duckdns.org/update?domains=\${DOMAIN}&token=\${TOKEN}&ip=\${CURRENT_IP}")
if [ "\$RESPONSE" = "OK" ]; then
    echo "\$(date): IP 업데이트 성공 - \${CURRENT_IP}" >> ~/duckdns/duck.log
else
    echo "\$(date): IP 업데이트 실패 - \${RESPONSE}" >> ~/duckdns/duck.log
fi
EOF

# 실행 권한 부여
chmod +x duck.sh

# 즉시 실행 (테스트)
echo "🧪 테스트 실행 중..."
./duck.sh

# 로그 확인
if [ -f ~/duckdns/duck.log ]; then
    echo ""
    echo "📋 최근 로그:"
    tail -n 3 ~/duckdns/duck.log
fi

# Crontab에 추가
echo ""
echo "⏰ 자동 업데이트 설정 중..."
(crontab -l 2>/dev/null | grep -v "duckdns/duck.sh"; echo "*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1") | crontab -

# 현재 IP 확인
CURRENT_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null)

echo ""
echo "=========================================="
echo "✅ DuckDNS 설정 완료!"
echo "=========================================="
echo ""
echo "📱 접속 주소:"
echo "   http://${DOMAIN_NAME}.duckdns.org:3000"
echo ""
echo "🌐 현재 IP: ${CURRENT_IP}"
echo "⏰ 5분마다 자동으로 IP 업데이트됩니다"
echo ""
echo "🔍 로그 확인:"
echo "   tail -f ~/duckdns/duck.log"
echo ""
echo "🔄 수동 업데이트:"
echo "   ~/duckdns/duck.sh"
echo ""



