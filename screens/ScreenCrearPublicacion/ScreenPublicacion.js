(() => {
    const API_BASE_URL = 'https://ga6f1d821261f2a-migodb.adb.mx-queretaro-1.oraclecloudapps.com/ords/migo_user';

    const form = document.getElementById('formPublicacion');
    const dropArea = document.getElementById('dropArea');
    const fotoInput = document.getElementById('fotoInput');
    const publicationMessage = document.getElementById('publication-message');
    const nombrePetInput = document.getElementById('nombre_pet');
    const tipoSelect = document.getElementById('tipo');
    const especieSelect = document.getElementById('especie');
    const estadoSelect = document.getElementById('estado');
    const coloniaSelect = document.getElementById('colonia');
    const descripcionInput = document.getElementById('descripcion');
    const userHiddenInput = document.getElementById('id_usuario');

    const messageTimers = new Map();
    const catalogos = {
        colonias: [],
        especies: [],
        tipos: [],
        estados: [],
    };

    const typeDisplayNames = {
        buscar: 'Se busca',
        'dar en adopción': 'Adopción',
        'dar en adopcion': 'Adopción',
    };

    let imagenBase64 = '';

    const normalizeText = (value) => String(value || '').trim().toLowerCase();

    const pickValue = (item, keys) => {
        for (const key of keys) {
            const value = item?.[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                return value;
            }
        }

        return '';
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

    const resolveApiUrl = (value) => {
        if (!value) {
            return null;
        }

        if (/^https?:\/\//i.test(value)) {
            return value;
        }

        return `${API_BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
    };

    const loadAllItems = async (endpoint) => {
        const items = [];
        let nextUrl = resolveApiUrl(endpoint);
        let guard = 0;

        while (nextUrl && guard < 20) {
            const payload = await fetchJson(nextUrl);
            items.push(...parseCollection(payload));

            const nextLink = Array.isArray(payload?.links)
                ? payload.links.find((link) => link?.rel === 'next')?.href
                : null;

            nextUrl = resolveApiUrl(nextLink);
            guard += 1;
        }

        return items;
    };

    const setMessage = (text, type) => {
        if (!publicationMessage) {
            return;
        }

        const previousTimer = messageTimers.get('publication');
        if (previousTimer) {
            window.clearTimeout(previousTimer);
            messageTimers.delete('publication');
        }

        publicationMessage.textContent = text;
        publicationMessage.classList.remove('success', 'error');

        if (type) {
            publicationMessage.classList.add(type);
        }

        if (text) {
            const timerId = window.setTimeout(() => {
                publicationMessage.textContent = '';
                publicationMessage.classList.remove('success', 'error');
                messageTimers.delete('publication');
            }, 2500);

            messageTimers.set('publication', timerId);
        }
    };

    const getSessionUser = () => {
        try {
            return JSON.parse(sessionStorage.getItem('migo_user') || 'null');
        } catch {
            return null;
        }
    };

    const getUserId = (session) => Number(pickValue(session, ['id_usuario', 'ID_USUARIO', 'id']));

    const populateSelect = (select, items, placeholderText, valueKeys, labelKeys, labelResolver = null) => {
        if (!select) {
            return;
        }

        select.innerHTML = '';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = placeholderText;
        placeholder.selected = true;
        placeholder.disabled = true;
        select.appendChild(placeholder);

        items.forEach((item) => {
            const value = Number(pickValue(item, valueKeys));
            const baseLabel = String(pickValue(item, labelKeys) || '').trim();
            const label = labelResolver ? labelResolver(baseLabel, item) : baseLabel;

            if (!Number.isFinite(value) || !label) {
                return;
            }

            const option = document.createElement('option');
            option.value = String(value);
            option.textContent = label;
            select.appendChild(option);
        });

        select.disabled = select.options.length <= 1;
    };

    const extractPublicationId = (payload) => {
        const idValue = pickValue(payload, ['id_publicacion', 'ID_PUBLICACION', 'id', 'ID']);
        const parsedId = Number(idValue);
        return Number.isFinite(parsedId) ? parsedId : null;
    };

    const syncPhotoPreview = (dataUrl) => {
        if (!dropArea) {
            return;
        }

        if (dataUrl) {
            dropArea.style.backgroundImage = `url(${dataUrl})`;
            dropArea.style.backgroundSize = 'cover';
            dropArea.style.backgroundPosition = 'center';
            const uploadContent = dropArea.querySelector('.upload-content');
            if (uploadContent) {
                uploadContent.style.display = 'none';
            }
            return;
        }

        dropArea.style.backgroundImage = '';
        const uploadContent = dropArea.querySelector('.upload-content');
        if (uploadContent) {
            uploadContent.style.display = 'flex';
        }
    };

    const handlePhotoSelection = (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            imagenBase64 = '';
            syncPhotoPreview('');
            return;
        }

        const reader = new FileReader();
        reader.onload = (readerEvent) => {
            imagenBase64 = String(readerEvent.target?.result || '');
            syncPhotoPreview(imagenBase64);
        };
        reader.readAsDataURL(file);
    };

    const initializeCatalogs = async () => {
        const [colonias, especies, tipos, estados] = await Promise.all([
            loadAllItems('/colonias/'),
            loadAllItems('/especies/'),
            loadAllItems('/tipos_publi/'),
            loadAllItems('/estados_publi/'),
        ]);

        catalogos.colonias = colonias;
        catalogos.especies = especies;
        catalogos.tipos = tipos;
        catalogos.estados = estados;

        populateSelect(coloniaSelect, colonias, 'Selecciona una colonia', ['id_colonia', 'ID_COLONIA', 'id', 'ID'], ['nombre_colonia', 'NOMBRE_COLONIA', 'nombre', 'NOMBRE']);
        populateSelect(especieSelect, especies, 'Selecciona una especie', ['id_especie', 'ID_ESPECIE', 'id', 'ID'], ['nombre', 'NOMBRE']);
        populateSelect(tipoSelect, tipos, 'Selecciona un tipo', ['id_tipo', 'ID_TIPO', 'id', 'ID'], ['nombre', 'NOMBRE'], (baseLabel) => typeDisplayNames[normalizeText(baseLabel)] || baseLabel);
        populateSelect(estadoSelect, estados, 'Selecciona un estado', ['id_estado', 'ID_ESTADO', 'id', 'ID'], ['nombre', 'NOMBRE']);

        if (!colonias.length || !especies.length || !tipos.length || !estados.length) {
            throw new Error('No se pudieron cargar todos los catálogos desde el backend.');
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage('', '');

        const sessionUser = getSessionUser();
        const idUsuario = getUserId(sessionUser);

        if (!Number.isFinite(idUsuario) || idUsuario <= 0) {
            setMessage('Tu sesión no está disponible. Inicia sesión de nuevo.', 'error');
            window.setTimeout(() => {
                window.location.href = '../ScreenLogin/login.html';
            }, 1200);
            return;
        }

        const nombrePet = nombrePetInput?.value.trim() || '';
        const descripcion = descripcionInput?.value.trim() || '';
        const idColonia = Number(coloniaSelect?.value || 0);
        const idEspecie = Number(especieSelect?.value || 0);
        const idTipo = Number(tipoSelect?.value || 0);
        const idEstado = Number(estadoSelect?.value || 0);
        const isPositiveId = (value) => Number.isInteger(value) && value > 0;

        if (!nombrePet || !descripcion || !isPositiveId(idColonia) || !isPositiveId(idEspecie) || !isPositiveId(idTipo) || !isPositiveId(idEstado)) {
            setMessage('Completa todos los campos y selecciona una opción válida en cada catálogo.', 'error');
            return;
        }

        try {
            const response = await fetchJson(`${API_BASE_URL}/publicaciones/`, {
                method: 'POST',
                body: JSON.stringify({
                    id_usuario: idUsuario,
                    id_colonia: idColonia,
                    id_especie: idEspecie,
                    id_tipo: idTipo,
                    id_estado: idEstado,
                    nombre_pet: nombrePet,
                    descripcion,
                }),
            });

            const publicationId = extractPublicationId(response);
            let photoNote = '';

            if (imagenBase64 && publicationId) {
                try {
                    await fetchJson(`${API_BASE_URL}/publicaciones/${publicationId}/fotos`, {
                        method: 'POST',
                        body: JSON.stringify({ ruta_imagen: imagenBase64 }),
                    });
                } catch {
                    photoNote = ' La foto local no se pudo asociar.';
                }
            }

            setMessage(`Publicación creada correctamente.${photoNote} Redirigiendo al tablero...`, 'success');

            form.reset();
            imagenBase64 = '';
            syncPhotoPreview('');

            window.setTimeout(() => {
                window.location.href = '../ScreenDashboard/dashboard.html';
            }, 1200);
        } catch (error) {
            setMessage(error.message || 'No se pudo guardar la publicación.', 'error');
        }
    };

    const initialize = async () => {
        const sessionUser = getSessionUser();
        const idUsuario = getUserId(sessionUser);

        if (!Number.isFinite(idUsuario)) {
            window.location.href = '../ScreenLogin/login.html';
            return;
        }

        if (userHiddenInput) {
            userHiddenInput.value = String(idUsuario);
        }

        try {
            await initializeCatalogs();
        } catch (error) {
            setMessage(error.message || 'No se pudieron cargar los catálogos del backend.', 'error');
            return;
        }

        if (dropArea && fotoInput) {
            dropArea.addEventListener('click', () => fotoInput.click());
        }

        if (fotoInput) {
            fotoInput.addEventListener('change', handlePhotoSelection);
        }

        if (form) {
            form.addEventListener('submit', handleSubmit);
        }
    };

    document.addEventListener('DOMContentLoaded', initialize, { once: true });
})();