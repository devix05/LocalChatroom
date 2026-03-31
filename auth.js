function toggleTheme() {
    const body = document.body;
    const themeIcon = document.querySelector('.theme-toggle i');
    
    if (body.classList.contains('light-mode')) {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        themeIcon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    } else {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        themeIcon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.add(savedTheme + '-mode');
    const themeIcon = document.querySelector('.theme-toggle i');
    if (themeIcon) {
        themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
});

let currentUser = null;

function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelectorAll('.auth-tab')[0].classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.querySelectorAll('.auth-tab')[1].classList.add('active');
        document.getElementById('registerForm').classList.add('active');
    }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        
        const data = await res.json();
        
        if (res.ok) {
            currentUser = data.user;
            document.getElementById('authContainer').style.display = 'none';
            document.getElementById('chatContainer').style.display = 'flex';
            document.getElementById('usernameDisplay').textContent = currentUser.username;
            
            const profileImage = currentUser.profileImage || '/default-avatar.png';
            document.getElementById('profileImage').src = profileImage;
            
            if (typeof socket !== 'undefined') {
                socket.emit('user-joined', {
                    id: currentUser.id,
                    username: currentUser.username,
                    profileImage: profileImage
                });
            }
            
            if (typeof loadMessages === 'function') {
                loadMessages();
            }
            
        } else {
            alert(data.error || 'Login fehlgeschlagen');
        }
    } catch (error) {
        alert('Verbindungsfehler zum Server');
    }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    
    if (password !== confirm) {
        alert('Passwörter stimmen nicht überein');
        return;
    }
    
    if (username.length < 3) {
        alert('Benutzername muss mindestens 3 Zeichen haben');
        return;
    }
    
    if (password.length < 6) {
        alert('Passwort muss mindestens 6 Zeichen haben');
        return;
    }
    
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        
        const data = await res.json();
        
        if (res.ok) {
            alert('✅ Registrierung erfolgreich! Bitte einloggen.');
            switchTab('login');
            document.getElementById('loginUsername').value = username;
        } else {
            alert(data.error || 'Registrierung fehlgeschlagen');
        }
    } catch (error) {
        alert('Verbindungsfehler zum Server');
    }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await fetch('/api/logout', {method: 'POST'});
        setTimeout(() => {
            location.reload();
        }, 100);
    } catch (error) {
        alert('Fehler beim Logout');
    }
});

document.getElementById('profileImage').addEventListener('click', () => {
    document.getElementById('profileUpload').click();
});

document.getElementById('profileUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        alert('Bitte ein Bild auswählen');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        alert('Bild zu groß (max. 5MB)');
        return;
    }
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const res = await fetch('/api/upload-profile', {
            method: 'POST',
            body: formData
        });
        
        const data = await res.json();
        
        if (res.ok) {
            document.getElementById('profileImage').src = data.imageUrl;
            if (currentUser) {
                currentUser.profileImage = data.imageUrl;
                
                if (typeof socket !== 'undefined') {
                    socket.emit('user-joined', {
                        id: currentUser.id,
                        username: currentUser.username,
                        profileImage: data.imageUrl
                    });
                }
            }
        } else {
            alert(data.error || 'Upload fehlgeschlagen');
        }
    } catch (error) {
        alert('Fehler beim Hochladen');
    }
});