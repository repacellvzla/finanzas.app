document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('login-form').addEventListener('submit', function(event) {
        event.preventDefault();

        function showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
            if (container) {
                const toast = document.createElement('div');
                toast.className = `toast toast-${type}`;
                toast.textContent = message;
                container.appendChild(toast);
                setTimeout(() => {
                    toast.remove();
                }, 4000);
            }
        }

        const usuarios = [
            { username: 'admin', password: 'admin123', rol: 'administrador' },
            { username: 'supervisor', password: 'super123', rol: 'supervisor' },
            { username: 'ventas', password: 'ventas123', rol: 'ventas' }
        ];

        const usernameInput = document.getElementById('username').value;
        const passwordInput = document.getElementById('password').value;

        const usuarioEncontrado = usuarios.find(user => user.username === usernameInput && user.password === passwordInput);

        if (usuarioEncontrado) {
            showToast('¡Inicio de sesión exitoso!');
            localStorage.setItem('usuario-autenticado', JSON.stringify(usuarioEncontrado));

            if (usuarioEncontrado.rol === 'administrador' || usuarioEncontrado.rol === 'supervisor') {
                window.location.href = 'dashboard.html';
            } else if (usuarioEncontrado.rol === 'ventas') {
                window.location.href = 'ventas.html';
            }
        } else {
            showToast('Usuario o contraseña incorrectos.', 'error');
        }
    });

    const togglePassword = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }
});