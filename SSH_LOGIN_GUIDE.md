# Oracle Cloud SSH 로그인 가이드

## 1. 필요한 정보

- **공인 IP 주소**: `152.67.209.254`
- **사용자명**: `ubuntu` 또는 `opc` (이미지에 따라 다름)
- **SSH 키 파일**: Oracle Cloud에서 다운로드한 `.pem` 또는 `.key` 파일

## 2. Windows에서 SSH 접속

### 방법 1: PowerShell 사용 (권장)

```powershell
# 기본 명령어
ssh -i "경로\키파일.pem" ubuntu@152.67.209.254

# 예시
ssh -i "C:\Users\kym70\Downloads\oracle-key.pem" ubuntu@152.67.209.254
```

### 방법 2: 명령 프롬프트(CMD)

```cmd
ssh -i "C:\Users\kym70\Downloads\oracle-key.pem" ubuntu@152.67.209.254
```

### 권한 오류 발생 시

Windows에서 SSH 키 권한 오류가 발생하면:

```powershell
# PowerShell 관리자 권한으로 실행 후
icacls "C:\Users\kym70\Downloads\oracle-key.pem" /inheritance:r
icacls "C:\Users\kym70\Downloads\oracle-key.pem" /grant:r "%username%:R"
```

또는:

```powershell
# 현재 사용자에게만 읽기 권한 부여
$acl = Get-Acl "C:\Users\kym70\Downloads\oracle-key.pem"
$acl.SetAccessRuleProtection($true, $false)
$permission = "$env:USERNAME","Read","Allow"
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
$acl.SetAccessRule($accessRule)
$acl | Set-Acl "C:\Users\kym70\Downloads\oracle-key.pem"
```

## 3. 사용자명 확인

Oracle Cloud 인스턴스의 이미지에 따라 사용자명이 다릅니다:

- **Ubuntu**: `ubuntu`
- **Oracle Linux**: `opc`
- **CentOS**: `centos`

확인 방법:
1. Oracle Cloud Console에서 인스턴스 정보 확인
2. 또는 둘 다 시도:
   ```powershell
   ssh -i "키파일.pem" ubuntu@152.67.209.254
   ssh -i "키파일.pem" opc@152.67.209.254
   ```

## 4. SSH 키 파일 위치

일반적으로 다음 위치에 있습니다:
- `C:\Users\kym70\Downloads\`
- `C:\Users\kym70\Desktop\`
- `C:\Users\kym70\.ssh\`

## 5. 전체 예시

```powershell
# 1. 키 파일이 있는 디렉토리로 이동
cd C:\Users\kym70\Downloads

# 2. SSH 접속
ssh -i "oracle-key.pem" ubuntu@152.67.209.254

# 또는 전체 경로 사용
ssh -i "C:\Users\kym70\Downloads\oracle-key.pem" ubuntu@152.67.209.254
```

## 6. 첫 접속 시 확인 메시지

처음 접속하면 다음과 같은 메시지가 나옵니다:
```
The authenticity of host '152.67.209.254 (152.67.209.254)' can't be established.
ECDSA key fingerprint is SHA256:...
Are you sure you want to continue connecting (yes/no)?
```

`yes` 입력 후 Enter

## 7. 접속 성공 후

접속이 성공하면 다음과 같은 프롬프트가 나타납니다:
```
ubuntu@instance-name:~$
```

이제 서버에서 명령어를 실행할 수 있습니다.

## 8. 자주 사용하는 명령어

```bash
# 현재 위치 확인
pwd

# 파일 목록 확인
ls
ls -la

# secure-chat 디렉토리로 이동
cd ~/secure-chat

# PM2 상태 확인
pm2 status

# 로그 확인
pm2 logs phantom-chat

# 서버 재시작
pm2 restart all
```

## 9. 접속 끊기

```bash
exit
# 또는
Ctrl + D
```

## 10. 문제 해결

### "Permission denied" 오류
- 키 파일 경로가 올바른지 확인
- 키 파일 권한 설정 (위의 icacls 명령어 실행)
- 사용자명이 올바른지 확인 (ubuntu 또는 opc)

### "Connection timed out" 오류
- Oracle Cloud Security List에서 SSH 포트(22)가 열려있는지 확인
- 공인 IP 주소가 올바른지 확인
- 인스턴스가 실행 중인지 확인

### "Host key verification failed" 오류
```powershell
# known_hosts 파일에서 해당 IP 제거
ssh-keygen -R 152.67.209.254
```

## 11. SSH 설정 파일 사용 (선택사항)

자주 접속한다면 SSH 설정 파일을 만들어 편리하게 사용:

```powershell
# .ssh 디렉토리 생성 (없는 경우)
mkdir $HOME\.ssh

# config 파일 생성/편집
notepad $HOME\.ssh\config
```

다음 내용 추가:
```
Host oracle
    HostName 152.67.209.254
    User ubuntu
    IdentityFile C:\Users\kym70\Downloads\oracle-key.pem
```

이제 간단하게 접속:
```powershell
ssh oracle
```

## 12. 빠른 참조

```powershell
# 기본 SSH 명령어 형식
ssh -i "키파일경로" 사용자명@IP주소

# 예시
ssh -i "C:\Users\kym70\Downloads\oracle-key.pem" ubuntu@152.67.209.254
```



