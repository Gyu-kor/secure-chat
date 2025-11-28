#!/bin/bash

# DuckDNS IP 업데이트 스크립트
# 사용법: bash duckdns-update.sh

# 설정 (DuckDNS에서 받은 정보로 변경)
DOMAIN="sokdak"
TOKEN="YOUR_DUCKDNS_TOKEN"  # DuckDNS에서 받은 토큰으로 변경

# 현재 공인 IP 가져오기
CURRENT_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null)

# DuckDNS API 호출
RESPONSE=$(curl -s "https://www.duckdns.org/update?domains=${DOMAIN}&token=${TOKEN}&ip=${CURRENT_IP}")

# 결과 확인
if [ "$RESPONSE" = "OK" ]; then
    echo "✅ DuckDNS 업데이트 성공!"
    echo "   도메인: ${DOMAIN}.duckdns.org"
    echo "   IP: ${CURRENT_IP}"
    echo "   접속 주소: http://${DOMAIN}.duckdns.org:3000"
else
    echo "❌ DuckDNS 업데이트 실패: $RESPONSE"
    exit 1
fi



