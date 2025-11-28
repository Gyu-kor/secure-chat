# DuckDNS 도메인 연결 가이드

## 1. DuckDNS 도메인 확인

DuckDNS에서 받은 도메인 형식:
```
sokdak.duckdns.org
```

## 2. DuckDNS에 IP 등록

### 방법 1: 웹에서 수동 등록
1. [DuckDNS 웹사이트](https://www.duckdns.org/) 접속
2. 로그인
3. My Domains에서 `sokdak` 도메인 선택
4. 현재 IP 주소 확인: `152.67.209.254`
5. Update IP 클릭

### 방법 2: API로 자동 등록 (권장)
서버에서 자동으로 IP를 업데이트하도록 설정:

```bash
# 서버에 SSH 접속 후
curl "https://www.duckdns.org/update?domains=sokdak&token=YOUR_TOKEN&ip=152.67.209.254"
```

## 3. DuckDNS 클라이언트 설치 (자동 IP 업데이트)

Oracle Cloud 서버에 DuckDNS 클라이언트를 설치하여 IP가 변경될 때 자동으로 업데이트:

```bash
# 서버에 SSH 접속 후

# DuckDNS 클라이언트 디렉토리 생성
mkdir -p ~/duckdns
cd ~/duckdns

# DuckDNS 스크립트 생성
nano duck.sh
```

다음 내용 입력:
```bash
#!/bin/bash
echo url="https://www.duckdns.org/update?domains=sokdak&token=YOUR_TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -
```

**YOUR_TOKEN을 DuckDNS에서 받은 토큰으로 변경**

```bash
# 실행 권한 부여
chmod +x duck.sh

# 테스트 실행
./duck.sh

# 로그 확인
cat duck.log
```

## 4. 자동 업데이트 설정 (cron)

```bash
# crontab 편집
crontab -e

# 다음 줄 추가 (5분마다 IP 업데이트)
*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1
```

## 5. 도메인으로 접속하기

### 현재 설정 (포트 3000 필요)
```
http://sokdak.duckdns.org:3000
```

### 포트 없이 접속하려면 (Nginx 리버스 프록시 설정)

## 6. Nginx 설정 (포트 80/443 사용, 선택사항)

포트 번호 없이 `http://sokdak.duckdns.org`로 접속하려면 Nginx를 설정:

```bash
# Nginx 설치
sudo apt update
sudo apt install -y nginx

# Nginx 설정 파일 생성
sudo nano /etc/nginx/sites-available/secure-chat
```

다음 내용 입력:
```nginx
server {
    listen 80;
    server_name sokdak.duckdns.org;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket 지원
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/secure-chat /etc/nginx/sites-enabled/

# 기본 설정 제거 (선택사항)
sudo rm /etc/nginx/sites-enabled/default

# Nginx 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Oracle Cloud Security List에 포트 80 추가
1. Oracle Cloud Console
2. Networking → Virtual Cloud Networks → VCN
3. Security Lists → Default Security List
4. Ingress Rules → Add Ingress Rules
   - Source CIDR: `0.0.0.0/0`
   - Destination Port: `80`
   - Protocol: `TCP`

### UFW 방화벽에 포트 80 추가
```bash
sudo ufw allow 80/tcp
sudo ufw reload
```

## 7. 완료!

이제 다음 주소로 접속 가능:
- **포트 포함**: `http://sokdak.duckdns.org:3000`
- **포트 없음** (Nginx 설정 시): `http://sokdak.duckdns.org`

## 8. SSL 인증서 설정 (HTTPS, 선택사항)

Let's Encrypt로 무료 SSL 인증서 발급:

```bash
# Certbot 설치
sudo apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d sokdak.duckdns.org

# 자동 갱신 설정
sudo certbot renew --dry-run
```

이제 `https://sokdak.duckdns.org`로 접속 가능합니다!


