#!/bin/bash

# 업데이트 배포 스크립트

set -e

echo "=========================================="
echo "Secure Chat 업데이트 배포"
echo "=========================================="

cd ~/secure-chat

# 최신 코드 가져오기
echo "최신 코드 가져오는 중..."
git pull origin main || git pull origin master

# 의존성 업데이트
echo "의존성 업데이트 중..."
npm install --production

# PM2 재시작
echo "앱 재시작 중..."
pm2 restart secure-chat

echo "=========================================="
echo "업데이트 완료!"
echo "=========================================="
pm2 status
