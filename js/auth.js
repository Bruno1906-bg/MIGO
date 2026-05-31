(() => {
    const API_BASE_URL = 'https://ga6f1d821261f2a-migodb.adb.mx-queretaro-1.oraclecloudapps.com/ords/migo_user';

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    const coloniaData = [];
    let coloniasLoadPromise = null;
    const messageTimers = new Map();

    const normalizeText = (value) => (value || '').trim().toLowerCase();

    const getMessageElement = (formType) => document.getElementById(`${formType}-message`);

    const setMessage = (formType, text, type) => {
        const messageElement = getMessageElement(formType);
        if (!messageElement) {
            return;
        }

        const previousTimer = messageTimers.get(formType);
        if (previousTimer) {
            window.clearTimeout(previousTimer);
            messageTimers.delete(formType);
        }

        messageElement.textContent = text;
        messageElement.classList.remove('success', 'error');
        if (type) {
            messageElement.classList.add(type);
        }

        if (text) {
            const timerId = window.setTimeout(() => {
                messageElement.textContent = '';
                messageElement.classList.remove('success', 'error');
                messageTimers.delete(formType);
            }, 2000);

            messageTimers.set(formType, timerId);
        }
    };

    const parseCollection = (payload) => {
        if (Array.isArray(payload)) {
            return payload;
        }

        if (Array.isArray(payload?.items)) {
            return payload.items;
        }

        if (Array.isArray(payload?.data)) {
            return payload.data;
        }

        if (Array.isArray(payload?.result)) {
            return payload.result;
        }

        return [];
    };

    const toColonias = (payload) => parseCollection(payload)
        .map((item) => ({
            id_colonia: Number(item.id_colonia ?? item.ID_COLONIA ?? item.id ?? item.ID ?? item.colonia_id),
            nombre_colonia: String(item.nombre_colonia ?? item.NOMBRE_COLONIA ?? item.nombre ?? item.NOMBRE ?? '').trim(),
        }))
        .filter((item) => Number.isFinite(item.id_colonia) && item.nombre_colonia);

    const fetchJson = async (url, options = {}) => {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            },
            ...options,
        });

        const rawText = await response.text();
        let payload = null;

        try {
            payload = rawText ? JSON.parse(rawText) : null;
        } catch {
            payload = rawText;
        }

        if (!response.ok) {
            const errorMessage = payload?.message || payload?.error || response.statusText || 'Error de conexión con el backend';
            throw new Error(errorMessage);
        }

        return payload;
    };

    const getSelectedColonias = () => coloniaData.slice();

    const loadAllColonias = async () => {
        const colonias = [];
        let nextUrl = `${API_BASE_URL}/colonias/?limit=1000`;
        let guard = 0;

        while (nextUrl && guard < 20) {
            const payload = await fetchJson(nextUrl);
            colonias.push(...toColonias(payload));

            const nextLink = Array.isArray(payload?.links)
                ? payload.links.find((link) => link?.rel === 'next')?.href
                : null;

            nextUrl = nextLink || null;
            guard += 1;
        }

        const uniqueColonias = new Map();
        colonias.forEach((item) => {
            uniqueColonias.set(item.id_colonia, item);
        });

        return [...uniqueColonias.values()];
    };

    const ensureColoniasLoaded = () => {
        if (!coloniasLoadPromise) {
            coloniasLoadPromise = loadAllColonias()
                .then((colonias) => {
                    coloniaData.splice(0, coloniaData.length, ...colonias);
                    return coloniaData;
                })
                .catch(() => {
                    coloniaData.splice(0, coloniaData.length);
                    return coloniaData;
                });
        }

        return coloniasLoadPromise;
    };

    const isValidEmail = (value) => {
        const text = String(value || '').trim();
        return text.includes('@') && text.indexOf('@') > 0 && text.indexOf('@') < text.length - 1;
    };

    const setupPasswordToggle = () => {
        document.querySelectorAll('[data-password-toggle]').forEach((button) => {
            const targetId = button.getAttribute('data-password-toggle');
            const input = targetId ? document.getElementById(targetId) : null;

            if (!input) {
                return;
            }

            const sync = () => {
                const visible = input.type === 'text';
                button.setAttribute('aria-pressed', String(visible));
                button.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Ver contraseña');
                button.dataset.state = visible ? 'visible' : 'hidden';
            };

            button.addEventListener('click', () => {
                input.type = input.type === 'password' ? 'text' : 'password';
                sync();
            });

            sync();
        });
    };

    const setupColoniaSearch = async () => {
        const coloniaInput = document.getElementById('colonia');
        const coloniaHidden = document.getElementById('id_colonia');
        const suggestionsElement = document.getElementById('colonia-suggestions');

        if (!coloniaInput || !coloniaHidden || !suggestionsElement) {
            return;
        }

        const selectColonia = (item) => {
            coloniaInput.value = item.nombre_colonia;
            coloniaHidden.value = String(item.id_colonia);
            suggestionsElement.hidden = true;
            coloniaInput.setAttribute('aria-expanded', 'false');
            setMessage('register', '', '');
        };

        const renderSuggestions = (query) => {
            const text = normalizeText(query);
            const filteredColonias = getSelectedColonias().filter((item) =>
                !text || normalizeText(item.nombre_colonia).includes(text)
            );
            const matches = filteredColonias.length > 0 ? filteredColonias : getSelectedColonias();

            suggestionsElement.innerHTML = '';

            if (!matches.length) {
                suggestionsElement.hidden = true;
                coloniaInput.setAttribute('aria-expanded', 'false');
                return;
            }

            if (text && filteredColonias.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.className = 'colonia-empty';
                emptyState.textContent = 'No hay coincidencias. Puedes elegir una colonia de la lista.';
                suggestionsElement.appendChild(emptyState);
            }

            matches.slice(0, 8).forEach((item, index) => {
                const optionButton = document.createElement('button');
                optionButton.type = 'button';
                optionButton.className = 'colonia-option';
                optionButton.textContent = item.nombre_colonia;
                optionButton.setAttribute('role', 'option');
                optionButton.setAttribute('data-id-colonia', String(item.id_colonia));
                optionButton.setAttribute('data-nombre-colonia', item.nombre_colonia);
                optionButton.setAttribute('aria-selected', index === 0 ? 'true' : 'false');

                optionButton.addEventListener('pointerdown', (event) => {
                    event.preventDefault();
                    selectColonia(item);
                });

                suggestionsElement.appendChild(optionButton);
            });

            suggestionsElement.hidden = false;
            coloniaInput.setAttribute('aria-expanded', 'true');
        };

        const refreshSuggestions = () => {
            void ensureColoniasLoaded().then(() => {
                if (document.activeElement === coloniaInput || coloniaInput.value.trim()) {
                    renderSuggestions(coloniaInput.value);
                }
            });
        };

        const syncHiddenColonia = () => {
            const enteredValue = normalizeText(coloniaInput.value);
            const exactMatch = getSelectedColonias().find((item) => normalizeText(item.nombre_colonia) === enteredValue);

            coloniaHidden.value = exactMatch ? String(exactMatch.id_colonia) : '';
            return exactMatch;
        };

        coloniaInput.addEventListener('input', () => {
            coloniaHidden.value = '';
            refreshSuggestions();
        });

        coloniaInput.addEventListener('focus', () => {
            refreshSuggestions();
        });

        coloniaInput.addEventListener('blur', () => {
            window.setTimeout(() => {
                suggestionsElement.hidden = true;
                coloniaInput.setAttribute('aria-expanded', 'false');
                syncHiddenColonia();
            }, 150);
        });

        document.addEventListener('click', (event) => {
            if (!event.target.closest('[data-colonia-search]')) {
                suggestionsElement.hidden = true;
                coloniaInput.setAttribute('aria-expanded', 'false');
            }
        });

        refreshSuggestions();
    };

    const validatePasswordLength = (value) => String(value || '').length >= 8;

    const handleLogin = async (event) => {
        event.preventDefault();
        setMessage('login', '', '');

        const correo = document.getElementById('email')?.value.trim() || '';
        const contrasena = document.getElementById('password')?.value || '';

        if (!correo || !contrasena) {
            setMessage('login', 'Completa correo y contraseña.', 'error');
            return;
        }

        if (!isValidEmail(correo)) {
            setMessage('login', 'Escribe un correo válido que incluya @.', 'error');
            return;
        }

        if (!validatePasswordLength(contrasena)) {
            setMessage('login', 'La contraseña debe tener al menos 8 caracteres.', 'error');
            return;
        }

        try {
            const loginPaths = ['/usuarios/login', '/usuarios/login/', '/usuarios_api/login', '/usuarios_api/login/'];
            let payload = null;
            let lastError = null;

            for (const path of loginPaths) {
                try {
                    payload = await fetchJson(`${API_BASE_URL}${path}`, {
                        method: 'POST',
                        body: JSON.stringify({ correo, contrasena }),
                    });
                    break;
                } catch (error) {
                    lastError = error;
                }
            }

            if (!payload) {
                throw lastError || new Error('No se pudo iniciar sesión.');
            }

            if (String(payload?.status || '').toLowerCase() !== 'success') {
                throw new Error(payload?.message || 'Credenciales inválidas');
            }

            sessionStorage.setItem('migo_user', JSON.stringify(payload));
            setMessage('login', 'Ingreso correcto. Redirigiendo...', 'success');
            window.setTimeout(() => {
                window.location.href = '../ScreenDashboard/dashboard.html';
            }, 900);
        } catch (error) {
            setMessage('login', error.message || 'No se pudo iniciar sesión.', 'error');
        }
    };

    const handleRegister = async (event) => {
        event.preventDefault();
        setMessage('register', '', '');

        const nombre = document.getElementById('nombre')?.value.trim() || '';
        const apellido = document.getElementById('apellido')?.value.trim() || '';
        const correo = document.getElementById('correo')?.value.trim() || '';
        const contrasena = document.getElementById('contraseña')?.value || '';
        const telefono = document.getElementById('telefono')?.value.trim() || '';
        const direccion = document.getElementById('direccion')?.value.trim() || '';
        const idColonia = document.getElementById('id_colonia')?.value || '';
        const coloniaTexto = document.getElementById('colonia')?.value.trim() || '';

        if (!nombre || !apellido || !correo || !contrasena) {
            setMessage('register', 'Completa los campos obligatorios.', 'error');
            return;
        }

        if (!isValidEmail(correo)) {
            setMessage('register', 'Escribe un correo válido que incluya @.', 'error');
            return;
        }

        if (!validatePasswordLength(contrasena)) {
            setMessage('register', 'La contraseña debe tener al menos 8 caracteres.', 'error');
            return;
        }

        const coloniaSeleccionada = getSelectedColonias().find((item) => String(item.id_colonia) === String(idColonia))
            || getSelectedColonias().find((item) => normalizeText(item.nombre_colonia) === normalizeText(coloniaTexto));

        if (!coloniaSeleccionada) {
            setMessage('register', 'Selecciona una colonia válida de la lista.', 'error');
            return;
        }

        try {
            const payload = await fetchJson(`${API_BASE_URL}/usuarios/`, {
                method: 'POST',
                body: JSON.stringify({
                    nombre,
                    apellido,
                    correo,
                    contrasena,
                    telefono,
                    direccion,
                    id_colonia: coloniaSeleccionada.id_colonia,
                    rol: 'ciudadano',
                    estado_cuenta: 'activo',
                }),
            });

            const successMessage = payload?.message || 'Cuenta creada correctamente. Ya puedes iniciar sesión.';
            setMessage('register', successMessage, 'success');
            registerForm.reset();
            const coloniaInput = document.getElementById('colonia');
            const coloniaHidden = document.getElementById('id_colonia');
            if (coloniaInput) coloniaInput.value = '';
            if (coloniaHidden) coloniaHidden.value = '';

            window.setTimeout(() => {
                window.location.href = '../ScreenLogin/login.html';
            }, 1200);
        } catch (error) {
            setMessage('register', error.message || 'No se pudo registrar el usuario.', 'error');
        }
    };

    const initialize = async () => {
        await setupColoniaSearch();
        setupPasswordToggle();
        void ensureColoniasLoaded();

        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }

        if (registerForm) {
            registerForm.addEventListener('submit', handleRegister);
        }
    };

    document.addEventListener('DOMContentLoaded', initialize, { once: true });
})();