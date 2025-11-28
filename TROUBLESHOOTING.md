# 타임아웃 문제 해결 가이드

## 문제: http://152.67.209.254/ 접속 시 타임아웃

### 1. 올바른 접속 주소 확인
서버는 **포트 3000**에서 실행됩니다:
```
✅ 올바른 주소: http://152.67.209.254:3000
❌ 잘못된 주소: http://152.67.209.254/
```

### 2. 서버 실행 상태 확인

SSH로 서버에 접속 후:

```bash
# PM2 상태 확인
pm2 status

# 서버가 실행 중이 아니면 시작
pm2 start ecosystem.config.js
pm2 save

# 로그 확인
pm2 logs phantom-chat
```

### 3. 포트 리스닝 확인

```bash
# 포트 3000이 열려있는지 확인
sudo netstat -tuln | grep 3000
# 또는
sudo ss -tuln | grep 3000

# Node.js 프로세스 확인
ps aux | grep node
```

### 4. Oracle Cloud Security List 설정 확인

**중요**: Oracle Cloud 콘솔에서 포트를 열어야 합니다.

1. Oracle Cloud Console 접속
2. **Networking** → **Virtual Cloud Networks** → VCN 선택
3. **Security Lists** → **Default Security List** 선택
4. **Ingress Rules** 확인/추가:
   - **Source CIDR**: `0.0.0.0/0`
   - **Destination Port Range**: `3000`
   - **Protocol**: `TCP`
   - **Description**: `Phantom Chat`

### 5. Ubuntu 방화벽(UFW) 확인

```bash
# UFW 상태 확인
sudo ufw status

# 포트 3000 열기
sudo ufw allow 3000/tcp
sudo ufw allow 22/tcp  # SSH는 항상 열어두기
sudo ufw enable

# 상태 확인
sudo ufw status verbose
```

### 6. iptables 설정 (Oracle Cloud 특수 설정)

```bash
# iptables 규칙 확인
sudo iptables -L -n -v | grep 3000

# 포트 3000 열기
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT

# 설정 저장
sudo netfilter-persistent save
# 또는
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

### 7. 서버 재시작 및 테스트

```bash
# PM2 재시작
pm2 restart all

# 로컬에서 테스트 (서버 내부에서)
curl http://localhost:3000

# 외부 IP로 테스트
curl http://152.67.209.254:3000
```

### 8. 전체 진단 스크립트

```bash
#!/bin/bash
echo "=== 서버 상태 진단 ==="
echo ""
echo "1. PM2 상태:"
pm2 status
echo ""
echo "2. 포트 리스닝:"
sudo netstat -tuln | grep 3000
echo ""
echo "3. UFW 상태:"
sudo ufw status
echo ""
echo "4. iptables 규칙:"
sudo iptables -L -n -v | grep 3000
echo ""
echo "5. 로컬 테스트:"
curl -I http://localhost:3000
echo ""
echo "6. 외부 IP:"
curl -s ifconfig.me
echo ""
```

## 빠른 해결 방법

```bash
# 1. 서버 시작
pm2 start ecosystem.config.js
pm2 save

# 2. 방화벽 설정
sudo ufw allow 3000/tcp
sudo ufw allow 22/tcp
sudo ufw enable

# 3. iptables 설정
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save

# 4. Oracle Cloud Security List에서 포트 3000 열기 (콘솔에서)
```

## 확인 체크리스트

- [ ] 서버가 실행 중인가? (`pm2 status`)
- [ ] 포트 3000이 리스닝 중인가? (`netstat -tuln | grep 3000`)
- [ ] UFW에서 포트 3000이 열려있는가? (`ufw status`)
- [ ] iptables에서 포트 3000이 열려있는가? (`iptables -L`)
- [ ] Oracle Cloud Security List에서 포트 3000이 열려있는가? (콘솔 확인)
- [ ] 올바른 주소로 접속하는가? (`http://IP:3000`)



