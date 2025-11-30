# 빠른 배포 가이드

## 오라클 클라우드 배포 (무료)

### 1단계: 오라클 클라우드 인스턴스 준비
1. 오라클 클라우드 콘솔 접속
2. 인스턴스 생성 (Ubuntu 22.04)
3. **중요**: Public IP 할당 체크
4. SSH 키 다운로드

### 2단계: 서버 접속
```bash
# SSH 접속 (키 경로와 IP 수정)
ssh -i ~/path/to/your-key.key ubuntu@YOUR_PUBLIC_IP
```

### 3단계: 프로젝트 배포
```bash
# 프로젝트 클론
cd ~
git clone https://github.com/Gyu-kor/secure-chat.git
cd secure-chat

# 배포 스크립트 실행
chmod +x deploy-oracle.sh
./deploy-oracle.sh
```

### 4단계: 방화벽 설정 (오라클 콘솔)
1. Networking → Virtual Cloud Networks
2. Security Lists → Default Security List
3. Ingress Rules 추가:
   - Port: 3000
   - Source: 0.0.0.0/0

### 5단계: 접속 확인
```bash
# 서버에서 Public IP 확인
curl ifconfig.me

# 브라우저에서 접속
http://YOUR_PUBLIC_IP:3000
```

---

## 도메인 연결 (선택사항)

### DuckDNS 사용 (무료)
```bash
# DuckDNS 설정 스크립트 실행
chmod +x setup-duckdns.sh
./setup-duckdns.sh
```

### 수동 설정
1. https://www.duckdns.org 접속
2. 서브도메인 생성 (예: mychat)
3. Public IP 입력
4. 완료! `mychat.duckdns.org` 사용 가능

---

## 업데이트 배포

서버에서 다음 명령어 실행:
```bash
cd ~/secure-chat
./deploy.sh
```

또는 수동:
```bash
cd ~/secure-chat
git pull origin main
npm install
pm2 restart secure-chat
```

---

## 유용한 명령어

```bash
# 로그 확인
pm2 logs secure-chat

# 재시작
pm2 restart secure-chat

# 중지
pm2 stop secure-chat

# 상태 확인
pm2 status
```

---

## 문제 해결

### 포트가 열리지 않음
```bash
# 방화벽 확인
sudo ufw status

# 포트 열기
sudo ufw allow 3000/tcp
```

### 서버가 시작되지 않음
```bash
# 로그 확인
pm2 logs secure-chat

# 수동 실행 테스트
cd ~/secure-chat
node server.js
```

