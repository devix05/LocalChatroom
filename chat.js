const socket = io();
let selectedFile = null;
let usersTyping = new Set();

socket.on('connect', () => {
    console.log('Socket verbunden');
    if (currentUser) {
        socket.emit('user-joined', {
            id: currentUser.id,
            username: currentUser.username,
            profileImage: currentUser.profileImage || '/default-avatar.png'
        });
    }
});

socket.on('new-message', (msg) => {
    displayMessage(msg);
    scrollToBottom();
});

socket.on('system-message', (msg) => {
    displaySystemMessage(msg);
    scrollToBottom();
});

socket.on('user-list', (users) => {
    updateUserList(users);
    const onlineCount = users.filter(u => u.isOnline).length;
    document.getElementById('onlineCount').textContent = onlineCount;
});

socket.on('user-typing', (data) => {
    if (data.isTyping) {
        usersTyping.add(data.username);
    } else {
        usersTyping.delete(data.username);
    }
    updateTypingIndicator();
});

async function loadMessages() {
    try {
        const res = await fetch('/api/messages');
        const messages = await res.json();
        document.getElementById('messages').innerHTML = '';
        messages.forEach(msg => displayMessage(msg));
        scrollToBottom();
    } catch (error) {
        console.error('Fehler beim Laden:', error);
    }
}

function displayMessage(msg) {
    const container = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.sender === currentUser?.username ? 'own-message' : ''}`;
    
    let content = '';
    if (msg.content) {
        content += `<p class="message-text">${escapeHtml(msg.content)}</p>`;
    }
    if (msg.fileUrl) {
        if (msg.fileType === 'video') {
            content += `<video controls class="message-video" src="${msg.fileUrl}"></video>`;
        } else {
            content += `<img src="${msg.fileUrl}" class="message-image" onclick="window.open('${msg.fileUrl}')">`;
        }
    }
    
    const time = new Date(msg.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const senderProfileImage = msg.profileImage || '/default-avatar.png';
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-header">
                <img src="${senderProfileImage}" alt="${msg.sender}" onerror="this.src='/default-avatar.png'">
                <strong>${msg.sender}</strong>
                <span class="message-time">${time}</span>
            </div>
            ${content}
        </div>
    `;
    
    container.appendChild(messageDiv);
}

function displaySystemMessage(msg) {
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = msg.content;
    document.getElementById('messages').appendChild(div);
}

document.getElementById('sendBtn').addEventListener('click', sendMessage);
document.getElementById('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

let typingTimer;
document.getElementById('messageInput').addEventListener('input', () => {
    socket.emit('typing', true);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => socket.emit('typing', false), 1000);
});

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content && !selectedFile) return;
    
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;
    
    try {
        if (selectedFile) {
            const formData = new FormData();
            formData.append('file', selectedFile);
            
            const res = await fetch('/api/upload-file', {
                method: 'POST',
                body: formData
            });
            
            if (!res.ok) throw new Error('Upload fehlgeschlagen');
            
            const data = await res.json();
            
            socket.emit('send-message', {
                content: content,
                fileUrl: data.fileUrl,
                fileType: data.fileType
            });
            
            clearFilePreview();
        } else {
            socket.emit('send-message', { content });
        }
        
        input.value = '';
        socket.emit('typing', false);
    } catch (error) {
        console.error('Fehler beim Senden:', error);
    } finally {
        sendBtn.disabled = false;
    }
}

document.getElementById('imageUpload').addEventListener('change', handleFileSelect);
document.getElementById('videoUpload').addEventListener('change', handleFileSelect);

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 50 * 1024 * 1024) {
        alert('Datei zu groß (max. 50MB)');
        return;
    }
    
    selectedFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImg').src = e.target.result;
        document.getElementById('imagePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
    
    e.target.value = '';
}

document.getElementById('removeImage').addEventListener('click', clearFilePreview);

function clearFilePreview() {
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('previewImg').src = '';
    selectedFile = null;
}

function updateUserList(users) {
    const list = document.getElementById('usersList');
    list.innerHTML = users.map(u => `
        <div class="user-item ${u.isOnline ? 'online' : ''}">
            <img src="${u.profileImage || '/default-avatar.png'}" onerror="this.src='/default-avatar.png'">
            <div class="user-info">
                <div class="user-name">${u.username}</div>
                <div class="user-status">${u.isOnline ? '🟢 Online' : '⚫ Offline'}</div>
            </div>
        </div>
    `).join('');
}

function updateTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (usersTyping.size > 0) {
        const names = Array.from(usersTyping).join(', ');
        indicator.textContent = `${names} ${usersTyping.size === 1 ? 'tippt' : 'tippen'}...`;
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const menuBtn = document.querySelector('.mobile-menu-btn i');
    
    sidebar.classList.toggle('open');
    
    if (sidebar.classList.contains('open')) {
        menuBtn.className = 'fas fa-times';
    } else {
        menuBtn.className = 'fas fa-bars';
    }
}

document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const menuBtn = document.querySelector('.mobile-menu-btn');
    
    if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !menuBtn?.contains(e.target) && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            const menuIcon = document.querySelector('.mobile-menu-btn i');
            if (menuIcon) menuIcon.className = 'fas fa-bars';
        }
    }
});

function toggleAttachMenu() {
    const menu = document.getElementById('attachMenu');
    menu.classList.toggle('show');
}

function scrollToBottom() {
    const messages = document.getElementById('messages');
    messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.attach-btn') && !e.target.closest('.attach-menu')) {
        document.getElementById('attachMenu')?.classList.remove('show');
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.remove('open');
            const menuIcon = document.querySelector('.mobile-menu-btn i');
            if (menuIcon) menuIcon.className = 'fas fa-bars';
        }
    }
});

if ('ontouchstart' in window) {
    document.querySelectorAll('button, .user-item').forEach(el => {
        el.addEventListener('touchstart', function() {
            this.style.opacity = '0.7';
        });
        el.addEventListener('touchend', function() {
            this.style.opacity = '1';
        });
    });
}