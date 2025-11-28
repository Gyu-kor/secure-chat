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
const videoBtn = document.getElementById('videoBtn');
const videoInput = document.getElementById('videoInput');
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

// 비디오 청크 관리
const videoChunks = new Map(); // { videoId: { chunks: [], total: 0, deleteAfter: 0 } }

// WebRTC 설정
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

const STATUS_CLASS_MAP = {
    connected: 'status connected',
    connecting: 'status connecting',
    disconnected: 'status disconnected'
};

const STATUS_LABEL_MAP = {
    connected: '연결됨',
    connecting: '연결 중...',
    disconnected: '연결 끊김'
};

function setConnectionStatus(state, label) {
    connectionStatus.textContent = label || STATUS_LABEL_MAP[state] || '';
    connectionStatus.className = STATUS_CLASS_MAP[state] || 'status';
}

function updateUserCountDisplay(count) {
    currentUserCount = count;
    userCount.textContent = `👥 ${currentUserCount}/${MAX_USERS}`;
}

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

socket.on('room-created', (data) => {
    console.log('Room created:', data.roomId);
    setConnectionStatus('connected');
    showSystemMessage('방이 생성되었습니다. 다른 사용자를 초대하세요.');
});

socket.on('room-joined', (data) => {
    console.log('Room joined:', data.roomId);
    
    // 최대 인원 초과 체크
    if (data.userCount > MAX_USERS) {
        alert(`이 방은 최대 ${MAX_USERS}명까지만 입장할 수 있습니다.`);
        window.location.href = '/';
        return;
    }
    
    setConnectionStatus('connected');
    updateUserCountDisplay(data.userCount);
    showSystemMessage('방에 입장했습니다.');
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
    
    updateUserCountDisplay(data.userCount);
    setConnectionStatus('connected', 'P2P 연결 대기 중');
    showSystemMessage('사용자가 입장했습니다.');
    
    // WebRTC 연결 시작 (offer 생성)
    await createPeerConnection(data.userId, true);
});

socket.on('user-left', (data) => {
    console.log('User left:', data.userId);
    updateUserCountDisplay(data.userCount);
    setConnectionStatus('disconnected');
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
    if (data.type === 'video-chunk') {
        handleVideoChunk(data.message, data.deleteAfter);
    } else {
        displayMessage(data.message, false, data.type, data.deleteAfter);
    }
});

// WebRTC Peer Connection 생성
async function createPeerConnection(peerId, isInitiator) {
    if (peers.has(peerId)) {
        return;
    }
    
    const pc = new RTCPeerConnection(configuration);
    peers.set(peerId, pc);
    
    // ICE candidate 이벤트
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                to: peerId,
                candidate: event.candidate
            });
        }
    };
    
    // 연결 상태 변경
    pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${peerId}:`, pc.connectionState);
        
        if (pc.connectionState === 'connected') {
            setConnectionStatus('connected', 'P2P 연결됨');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setConnectionStatus('disconnected');
        }
    };
    
    // Data Channel 설정
    if (isInitiator) {
        const dataChannel = pc.createDataChannel('chat');
        setupDataChannel(peerId, dataChannel);
        
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            socket.emit('offer', {
                to: peerId,
                offer: offer
            });
        } catch (err) {
            console.error('Error creating offer:', err);
        }
    } else {
        pc.ondatachannel = (event) => {
            setupDataChannel(peerId, event.channel);
        };
    }
}

// Data Channel 설정
function setupDataChannel(peerId, channel) {
    dataChannels.set(peerId, channel);
    
    channel.onopen = () => {
        console.log(`Data channel opened with ${peerId}`);
        setConnectionStatus('connected', 'P2P 연결됨');
    };
    
    channel.onclose = () => {
        console.log(`Data channel closed with ${peerId}`);
        setConnectionStatus('disconnected');
        dataChannels.delete(peerId);
    };
    
    channel.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'video-chunk') {
                handleVideoChunk(data.message, data.deleteAfter);
            } else {
                displayMessage(data.message, false, data.type, data.deleteAfter);
            }
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
    
    let sentViaP2P = false;
    dataChannels.forEach((channel) => {
        if (channel.readyState === 'open') {
            channel.send(JSON.stringify(messageData));
            sentViaP2P = true;
        }
    });
    
    if (!sentViaP2P) {
        socket.emit('chat-message', messageData);
    }
    
    displayMessage(message, true, type, deleteAfterSeconds);
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    sendMessageData(message, 'text');
    messageInput.value = '';
}

// 메시지 표시
function displayMessage(message, isMine, type = 'text', deleteAfter = 0) {
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
    } else if (type === 'video') {
        const video = document.createElement('video');
        video.src = message;
        video.className = 'message-video';
        video.controls = true;
        video.style.cssText = `
            max-width: 100%;
            max-height: 400px;
            border-radius: 12px;
            background: rgba(0, 0, 0, 0.2);
        `;
        messageContent.appendChild(video);
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
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
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
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = message;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

// 비디오 전송
videoBtn.addEventListener('click', () => {
    videoInput.click();
});

videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    
    if (file && file.type.startsWith('video/')) {
        // 비디오 크기 체크 (최대 30MB)
        const maxSize = 30 * 1024 * 1024; // 30MB
        if (file.size > maxSize) {
            alert('비디오 파일이 너무 큽니다. 30MB 이하의 파일을 선택해주세요.\n\n팁: 휴대폰에서 낮은 화질로 촬영하거나 편집 앱으로 압축하세요.');
            videoInput.value = '';
            return;
        }
        
        showSystemMessage('비디오 전송 중... (파일 크기: ' + (file.size / 1024 / 1024).toFixed(1) + 'MB)');
        sendVideoFile(file);
    }
    
    videoInput.value = '';
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

// 비디오 전송 (최적화)
function sendVideoFile(file) {
    const reader = new FileReader();
    
    reader.onload = (event) => {
        const videoDataUrl = event.target.result;
        const videoSize = videoDataUrl.length;
        
        console.log('Video size:', (videoSize / 1024 / 1024).toFixed(2), 'MB');
        
        // 작은 파일은 바로 전송
        if (videoSize < 5 * 1024 * 1024) { // 5MB 미만
            sendMessageData(videoDataUrl, 'video');
            showSystemMessage('비디오 전송 완료');
        } else {
            // 큰 파일은 청크로 나눠서 전송
            sendLargeVideo(videoDataUrl);
        }
    };
    
    reader.onerror = () => {
        console.error('Video read failed');
        alert('비디오를 읽을 수 없습니다.');
    };
    
    reader.readAsDataURL(file);
}

// 큰 비디오를 청크로 나눠서 전송
function sendLargeVideo(videoDataUrl) {
    const chunkSize = 1024 * 1024; // 1MB 청크
    const chunks = [];
    
    for (let i = 0; i < videoDataUrl.length; i += chunkSize) {
        chunks.push(videoDataUrl.slice(i, i + chunkSize));
    }
    
    const videoId = Date.now() + '_' + Math.random();
    let sentChunks = 0;
    
    chunks.forEach((chunk, index) => {
        setTimeout(() => {
            const chunkData = {
                videoId: videoId,
                chunk: chunk,
                index: index,
                total: chunks.length,
                isLast: index === chunks.length - 1
            };
            
            dataChannels.forEach((channel) => {
                if (channel.readyState === 'open') {
                    channel.send(JSON.stringify({
                        message: chunkData,
                        type: 'video-chunk',
                        deleteAfter: parseInt(deleteTimer.value)
                    }));
                }
            });
            
            socket.emit('chat-message', {
                message: chunkData,
                type: 'video-chunk',
                deleteAfter: parseInt(deleteTimer.value)
            });
            
            sentChunks++;
            const progress = Math.round((sentChunks / chunks.length) * 100);
            showSystemMessage(`비디오 전송 중... ${progress}%`);
            
            if (chunkData.isLast) {
                showSystemMessage('비디오 전송 완료');
            }
        }, index * 100); // 각 청크를 100ms 간격으로 전송
    });
    
    // 내 화면에도 표시
    displayMessage(videoDataUrl, true, 'video', parseInt(deleteTimer.value));
}

// 비디오 청크 처리
function handleVideoChunk(chunkData, deleteAfter) {
    const { videoId, chunk, index, total, isLast } = chunkData;
    
    if (!videoChunks.has(videoId)) {
        videoChunks.set(videoId, {
            chunks: new Array(total),
            total: total,
            deleteAfter: deleteAfter,
            received: 0
        });
        showSystemMessage(`비디오 수신 중... 0%`);
    }
    
    const videoData = videoChunks.get(videoId);
    videoData.chunks[index] = chunk;
    videoData.received++;
    
    const progress = Math.round((videoData.received / total) * 100);
    showSystemMessage(`비디오 수신 중... ${progress}%`);
    
    if (isLast && videoData.received === total) {
        // 모든 청크 수신 완료, 조립
        const completeVideo = videoData.chunks.join('');
        displayMessage(completeVideo, false, 'video', deleteAfter);
        videoChunks.delete(videoId);
        showSystemMessage('비디오 수신 완료');
    }
}

// 메시지 전송 이벤트
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// 서버 IP 가져오기
const serverURL = window.location.origin;

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