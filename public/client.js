// Socket.io 연결
const socket = io();

// URL에서 파라미터 추출
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const isCreator = urlParams.get('create') === 'true';

// DOM 요소
const roomName = document.getElementById('roomName');
const connectionStatus = document.getElementById('connectionStatus');
const userCount = document.getElementById('userCount');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const imageBtn = document.getElementById('imageBtn');
const imageInput = document.getElementById('imageInput');
const deleteTimer = document.getElementById('deleteTimer');
const showQRBtn = document.getElementById('showQRBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const qrModal = document.getElementById('qrModal');
const sessionExpired = document.getElementById('sessionExpired');

// 상태 관리
let mySocketId = null;
let peers = new Map(); // { peerId: RTCPeerConnection }
let dataChannels = new Map(); // { peerId: RTCDataChannel }
let currentUserCount = 0;
const MAX_USERS = 3; // 최대 사용자 수

// WebRTC 설정
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function init() {
    if (!roomId) {
        alert('방 ID가 없습니다.');
        window.location.href = '/';
        return;
    }
    
    roomName.textContent = `방: ${roomId}`;
    initializeRoom();
}

init();

// 모바일 브라우저 자동완성 제안 숨기기
if (messageInput) {
    // 추가 속성 설정
    messageInput.setAttribute('autocomplete', 'off');
    messageInput.setAttribute('autocapitalize', 'off');
    messageInput.setAttribute('autocorrect', 'off');
    messageInput.setAttribute('spellcheck', 'false');
    
    // 모바일에서 입력창 클릭 시 키보드 올라오도록 보장
    messageInput.addEventListener('touchstart', (e) => {
        e.target.focus();
    }, { passive: true });
    
    messageInput.addEventListener('click', (e) => {
        e.target.focus();
    });
}

// 방 초기화
function initializeRoom() {
    if (isCreator) {
        socket.emit('create-room', roomId);
    } else {
        socket.emit('join-room', roomId);
    }
}

// Socket.io 이벤트 핸들러
socket.on('connect', () => {
    mySocketId = socket.id;
    console.log('Connected to server:', mySocketId);
});

socket.on('room-created', async (data) => {
    console.log('Room created:', data.roomId);
    connectionStatus.textContent = '연결됨';
    connectionStatus.className = 'status connected';
    showSystemMessage('방이 생성되었습니다. 다른 사용자를 초대하세요.');
    
    // 기존 사용자들과 WebRTC 연결 시작 (있는 경우)
    if (data.existingUsers && data.existingUsers.length > 0) {
        console.log('Connecting to existing users:', data.existingUsers);
        for (const userId of data.existingUsers) {
            await createPeerConnection(userId, true);
        }
    }
});

socket.on('room-joined', async (data) => {
    console.log('Room joined:', data.roomId);
    
    // 최대 인원 초과 체크
    if (data.userCount > MAX_USERS) {
        alert(`이 방은 최대 ${MAX_USERS}명까지만 입장할 수 있습니다.`);
        window.location.href = '/';
        return;
    }
    
    connectionStatus.textContent = '연결됨';
    connectionStatus.className = 'status connected';
    currentUserCount = data.userCount;
    userCount.textContent = `👥 ${currentUserCount}/${MAX_USERS}`;
    showSystemMessage('방에 입장했습니다.');
    
    // 기존 사용자들과 WebRTC 연결 시작
    if (data.existingUsers && data.existingUsers.length > 0) {
        console.log('Connecting to existing users:', data.existingUsers);
        for (const userId of data.existingUsers) {
            await createPeerConnection(userId, true);
        }
    }
});

socket.on('room-not-found', () => {
    alert('방을 찾을 수 없습니다.');
    window.location.href = '/';
});

socket.on('room-full', (data) => {
    alert(`이 방은 가득 찼습니다. (최대 ${data.maxUsers}명)`);
    window.location.href = '/';
});

socket.on('user-joined', async (data) => {
    console.log('User joined:', data.userId);
    
    // 최대 인원 체크
    if (data.userCount > MAX_USERS) {
        showSystemMessage(`최대 인원(${MAX_USERS}명)을 초과했습니다.`);
        return;
    }
    
    currentUserCount = data.userCount;
    userCount.textContent = `👥 ${currentUserCount}/${MAX_USERS}`;
    showSystemMessage('사용자가 입장했습니다.');
    
    // WebRTC 연결 시작 (offer 생성)
    await createPeerConnection(data.userId, true);
});

socket.on('user-left', (data) => {
    console.log('User left:', data.userId);
    currentUserCount = data.userCount;
    userCount.textContent = `👥 ${currentUserCount}/${MAX_USERS}`;
    showSystemMessage('사용자가 나갔습니다.');
    
    // WebRTC 연결 정리
    closePeerConnection(data.userId);
    
    // 사용자가 나가면 3초 후 자동 종료
    showSessionExpired();
});

// WebRTC 시그널링
socket.on('offer', async (data) => {
    console.log('Received offer from:', data.from);
    await createPeerConnection(data.from, false);
    const pc = peers.get(data.from);
    
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socket.emit('answer', {
            to: data.from,
            answer: answer
        });
    } catch (err) {
        console.error('Error handling offer:', err);
    }
});

socket.on('answer', async (data) => {
    console.log('Received answer from:', data.from);
    const pc = peers.get(data.from);
    
    if (pc) {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (err) {
            console.error('Error handling answer:', err);
        }
    }
});

socket.on('ice-candidate', async (data) => {
    const pc = peers.get(data.from);
    
    if (pc && data.candidate) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
            console.error('Error adding ICE candidate:', err);
        }
    }
});

// 백업 메시지 수신 (P2P 실패 시)
socket.on('chat-message', (data) => {
    displayMessage(data.message, false, data.type, data.deleteAfter);
});

// WebRTC Peer Connection 생성
async function createPeerConnection(peerId, isInitiator) {
    if (peers.has(peerId)) {
        console.log(`Peer connection already exists for ${peerId}`);
        return;
    }
    
    console.log(`Creating peer connection with ${peerId} (initiator: ${isInitiator})`);
    
    const pc = new RTCPeerConnection(configuration);
    peers.set(peerId, pc);
    
    // ICE candidate 이벤트
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                to: peerId,
                candidate: event.candidate
            });
            console.log(`Sent ICE candidate to ${peerId}`);
        }
    };
    
    // 연결 상태 변경
    pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${peerId}:`, pc.connectionState);
        
        if (pc.connectionState === 'connected') {
            connectionStatus.textContent = 'P2P 연결됨';
            connectionStatus.className = 'status connected';
            console.log(`✅ P2P connected with ${peerId}`);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            connectionStatus.textContent = '연결 끊김';
            connectionStatus.className = 'status disconnected';
            console.warn(`❌ Connection lost with ${peerId}: ${pc.connectionState}`);
        }
    };
    
    // Data Channel 설정
    if (isInitiator) {
        const dataChannel = pc.createDataChannel('chat');
        setupDataChannel(peerId, dataChannel);
        console.log(`Created data channel with ${peerId}`);
        
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            socket.emit('offer', {
                to: peerId,
                offer: offer
            });
            console.log(`Sent offer to ${peerId}`);
        } catch (err) {
            console.error(`Error creating offer for ${peerId}:`, err);
        }
    } else {
        pc.ondatachannel = (event) => {
            console.log(`📨 Received data channel from ${peerId}`);
            setupDataChannel(peerId, event.channel);
        };
    }
}

// Data Channel 설정
function setupDataChannel(peerId, channel) {
    console.log(`Setting up data channel with ${peerId}, state: ${channel.readyState}`);
    dataChannels.set(peerId, channel);
    
    channel.onopen = () => {
        console.log(`✅ Data channel opened with ${peerId}`);
        connectionStatus.textContent = 'P2P 연결됨';
        connectionStatus.className = 'status connected';
    };
    
    channel.onclose = () => {
        console.log(`❌ Data channel closed with ${peerId}`);
        dataChannels.delete(peerId);
    };
    
    channel.onerror = (error) => {
        console.error(`Data channel error with ${peerId}:`, error);
    };
    
    channel.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log(`📩 Received message from ${peerId}, type: ${data.type}`);
            displayMessage(data.message, false, data.type, data.deleteAfter);
        } catch (err) {
            console.error('Error parsing message:', err);
        }
    };
}

// Peer Connection 종료
function closePeerConnection(peerId) {
    const pc = peers.get(peerId);
    const dc = dataChannels.get(peerId);
    
    if (dc) {
        dc.close();
        dataChannels.delete(peerId);
    }
    
    if (pc) {
        pc.close();
        peers.delete(peerId);
    }
}

function sendMessageData(message, type = 'text') {
    const deleteAfterSeconds = parseInt(deleteTimer.value);
    const messageData = { message, type, deleteAfter: deleteAfterSeconds };
    
    console.log(`Sending message, type: ${type}, channels: ${dataChannels.size}, socket connected: ${socket.connected}`);
    
    let sentViaP2P = false;
    let hasOpenChannel = false;
    
    dataChannels.forEach((channel, peerId) => {
        console.log(`Channel ${peerId} state: ${channel.readyState}`);
        if (channel.readyState === 'open') {
            hasOpenChannel = true;
            try {
                channel.send(JSON.stringify(messageData));
                sentViaP2P = true;
                console.log(`✅ Sent via P2P to ${peerId}`);
            } catch (err) {
                console.error(`Failed to send via P2P to ${peerId}:`, err);
            }
        }
    });
    
    // P2P 연결이 없거나 실패한 경우 Socket.io로 전송
    if (!sentViaP2P) {
        if (!socket.connected) {
            console.error('Socket.io not connected!');
            alert('서버 연결이 끊어졌습니다. 페이지를 새로고침해주세요.');
            return;
        }
        console.log('Sending via Socket.io (no P2P connection)');
        try {
            socket.emit('chat-message', messageData);
            console.log('✅ Sent via Socket.io');
        } catch (err) {
            console.error('Failed to send via Socket.io:', err);
            alert('메시지 전송에 실패했습니다.');
        }
    }
    
    // 내 화면에 표시
    displayMessage(message, true, type, deleteAfterSeconds);
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    sendMessageData(message, 'text');
    messageInput.value = '';
    
    // 키보드 유지 (포커스 유지) - 강화
    // preventDefault로 기본 동작 막기
    messageInput.focus({ preventScroll: true });
    
    // iOS에서 확실히 키보드 유지
    setTimeout(() => {
        messageInput.focus({ preventScroll: true });
    }, 0);
}

// 메시지 표시
function displayMessage(message, isMine, type = 'text', deleteAfter = 0) {
    // 현재 사용자가 스크롤을 아래쪽에 있는지 확인
    const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMine ? 'mine' : 'theirs'}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    if (type === 'image') {
        const img = document.createElement('img');
        img.src = message;
        img.className = 'message-image';
        img.onclick = () => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                cursor: pointer;
            `;
            
            const largeImg = document.createElement('img');
            largeImg.src = message;
            largeImg.style.cssText = `
                max-width: 95%;
                max-height: 95%;
                object-fit: contain;
                border-radius: 8px;
            `;
            
            overlay.appendChild(largeImg);
            overlay.onclick = () => overlay.remove();
            document.body.appendChild(overlay);
        };
        messageContent.appendChild(img);
    } else {
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = message;
        messageContent.appendChild(textDiv);
    }
    
    const metaDiv = document.createElement('div');
    metaDiv.className = 'message-meta';
    
    const timeSpan = document.createElement('span');
    timeSpan.textContent = new Date().toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    metaDiv.appendChild(timeSpan);
    
    // 자동 삭제 타이머 표시
    let timerSpan = null;
    if (deleteAfter > 0) {
        timerSpan = document.createElement('span');
        timerSpan.className = 'delete-timer';
        timerSpan.textContent = `🔥 ${deleteAfter}초`;
        metaDiv.appendChild(timerSpan);
    }
    
    messageContent.appendChild(metaDiv);
    messageDiv.appendChild(messageContent);
    
    messagesContainer.appendChild(messageDiv);
    
    // 사용자가 맨 아래에 있거나, 내가 보낸 메시지인 경우에만 자동 스크롤
    if (isNearBottom || isMine) {
        // 모바일에서 스크롤이 끝까지 내려가도록 보장 (여러 번 시도)
        const scrollToBottom = () => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        };
        
        // 즉시 스크롤
        scrollToBottom();
        
        // 약간의 지연 후 다시 스크롤 (DOM 업데이트 대기)
        setTimeout(scrollToBottom, 50);
        setTimeout(scrollToBottom, 150);
        setTimeout(scrollToBottom, 300);
    }
    
    // 자동 삭제 타이머 (카운트다운)
    if (deleteAfter > 0) {
        let remainingTime = deleteAfter;
        
        const countdownInterval = setInterval(() => {
            remainingTime--;
            
            if (remainingTime > 0 && timerSpan) {
                timerSpan.textContent = `🔥 ${remainingTime}초`;
            } else {
                clearInterval(countdownInterval);
            }
        }, 1000);
        
        setTimeout(() => {
            clearInterval(countdownInterval);
            messageDiv.style.opacity = '0';
            messageDiv.style.transform = 'scale(0.8)';
            setTimeout(() => {
                messageDiv.remove();
            }, 500);
        }, deleteAfter * 1000);
    }
}

// 시스템 메시지 표시
function showSystemMessage(message) {
    // 현재 사용자가 스크롤을 아래쪽에 있는지 확인
    const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = message;
    messagesContainer.appendChild(messageDiv);
    
    // 사용자가 맨 아래에 있는 경우에만 자동 스크롤
    if (isNearBottom) {
        // 모바일에서 스크롤이 끝까지 내려가도록 보장
        const scrollToBottom = () => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        };
        
        scrollToBottom();
        setTimeout(scrollToBottom, 50);
        setTimeout(scrollToBottom, 150);
    }
}

// 이미지 전송
imageBtn.addEventListener('click', () => {
    imageInput.click();
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    
    if (file && file.type.startsWith('image/')) {
        compressAndSendImage(file);
    }
    
    imageInput.value = '';
});

// 이미지 압축 및 전송
function compressAndSendImage(file) {
    const reader = new FileReader();
    
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 최대 크기 설정 (긴 변 기준 1200px)
            const maxSize = 1200;
            let width = img.width;
            let height = img.height;
            
            if (width > height && width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
            } else if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // JPEG로 압축 (품질 0.7)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            console.log('Original size:', event.target.result.length, 'Compressed:', compressedDataUrl.length);
            sendMessageData(compressedDataUrl, 'image');
        };
        
        img.onerror = () => {
            console.error('Image load failed');
            alert('이미지를 불러올 수 없습니다.');
        };
        
        img.src = event.target.result;
    };
    
    reader.onerror = () => {
        console.error('File read failed');
        alert('파일을 읽을 수 없습니다.');
    };
    
    reader.readAsDataURL(file);
}

// 메시지 전송 이벤트
sendBtn.addEventListener('click', (e) => {
    e.preventDefault(); // 기본 동작 방지
    sendMessage();
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); // 기본 동작 방지
        sendMessage();
    }
});

// 입력창 포커스 시 스크롤 (키보드가 올라올 때)
messageInput.addEventListener('focus', () => {
    // 모바일에서 키보드가 올라오도록 보장
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 300); // 키보드 애니메이션 대기
}, { passive: true });

// 키보드 표시/숨김 시 스크롤 조정
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
});

// 초기 로드 시 스크롤을 맨 아래로
window.addEventListener('load', () => {
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
});

// 현재 접속 URL 사용 (QR 코드에 현재 링크 사용)
let serverURL = window.location.origin;
fetch('/api/server-info')
    .then(res => res.json())
    .then(data => {
        // 서버에서 반환한 URL이 현재 접속 URL과 다르면 현재 URL 우선 사용
        const currentOrigin = window.location.origin;
        
        // 현재 접속 URL 사용 (공개 도메인/IP인 경우)
        if (currentOrigin !== 'http://localhost:3000' && !currentOrigin.includes('127.0.0.1') && !currentOrigin.includes('192.168.')) {
            serverURL = currentOrigin;
        } else {
            // 로컬 접속인 경우 서버에서 반환한 URL 사용
            serverURL = data.url;
        }
    })
    .catch(() => {
        console.log('Using current origin:', serverURL);
    });

// QR 코드 표시 (헤더 버튼)
showQRBtn.addEventListener('click', () => {
    showQRCode();
});

// QR 코드 표시 (중앙 버튼)
const generateQRBtn = document.getElementById('generateQRBtn');
if (generateQRBtn) {
    generateQRBtn.addEventListener('click', () => {
        showQRCode();
    });
}

function showQRCode() {
    const roomURL = `${serverURL}/room.html?room=${roomId}`;
    document.getElementById('roomURL').textContent = roomURL;
    
    const qrcodeContainer = document.getElementById('qrcode');
    qrcodeContainer.innerHTML = '';
    new QRCode(qrcodeContainer, {
        text: roomURL,
        width: 256,
        height: 256,
        colorDark: "#8b5cf6",
        colorLight: "#ffffff"
    });
    
    qrModal.style.display = 'flex';
}

// QR 코드 모달 닫기
document.querySelector('.close-modal').addEventListener('click', () => {
    qrModal.style.display = 'none';
});

qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) {
        qrModal.style.display = 'none';
    }
});

// URL 복사
document.getElementById('copyURLBtn').addEventListener('click', () => {
    const roomURL = document.getElementById('roomURL').textContent;
    navigator.clipboard.writeText(roomURL).then(() => {
        alert('URL이 복사되었습니다!');
    });
});

// 방 나가기
leaveRoomBtn.addEventListener('click', () => {
    if (confirm('방을 나가시겠습니까? 모든 대화 내용이 삭제됩니다.')) {
        socket.emit('leave-room');
        window.location.href = '/';
    }
});

// 세션 종료 오버레이
function showSessionExpired() {
    sessionExpired.style.display = 'flex';
    
    let countdown = 3;
    const countdownElement = document.querySelector('.countdown');
    
    const interval = setInterval(() => {
        countdown--;
        countdownElement.textContent = `${countdown}초 후 대화창이 닫힙니다...`;
        
        if (countdown <= 0) {
            clearInterval(interval);
            window.location.href = '/';
        }
    }, 1000);
}

document.getElementById('closeNowBtn').addEventListener('click', () => {
    window.location.href = '/';
});

function cleanup() {
    socket.emit('leave-room');
    peers.forEach((pc) => pc.close());
    dataChannels.forEach((dc) => dc.close());
}

window.addEventListener('beforeunload', cleanup);