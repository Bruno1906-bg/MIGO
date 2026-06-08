(() => {
    const API_BASE_URL = 'http://localhost:4000/api';

    const form = document.getElementById('formPublicacion');
    const dropArea = document.getElementById('dropArea');
    const fotoInput = document.getElementById('fotoInput');
    const publicationMessage = document.getElementById('publication-message');
    const nombrePetInput = document.getElementById('nombre_pet');
    const tipoSelect = document.getElementById('tipo');
    const especieSelect = document.getElementById('especie');
    const coloniaSelect = document.getElementById('colonia');
    const descripcionInput = document.getElementById('descripcion');
    const userHiddenInput = document.getElementById('id_usuario');

    const messageTimers = new Map();
    const catalogos = { colonias: [], especies: [], tipos: [] };

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
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.items)) return payload.items;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.result)) return payload.result;
        return [];
    };

    const fetchJson = async (url, options = {}) => {
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options,
        });
        const rawText = await response.text();
        let payload;
        try { payload = rawText ? JSON.parse(rawText) : null; } catch { payload = rawText; }
        if (!response.ok) throw new Error(payload?.message || payload?.error || response.statusText || 'Error de conexión con el backend');
        return payload;
    };

    const fetchApi = async (endpoint) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
        });
        const rawText = await response.text();
        let payload = null;
        try { payload = rawText ? JSON.parse(rawText) : null; } catch { payload = rawText; }
        if (!response.ok) {
            const errorMessage = payload?.message || payload?.error || 'Error al conectar con la base de datos';
            throw new Error(errorMessage);
        }
        return parseCollection(payload);
    };
    const resolveApiUrl = (value) => !value ? null : /^https?:\/\//i.test(value) ? value : `${API_BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;

    const loadAllItems = async (endpoint) => {
        const items = []; let nextUrl = resolveApiUrl(endpoint); let guard = 0;
        while (nextUrl && guard < 20) {
            const payload = await fetchJson(nextUrl);
            items.push(...parseCollection(payload));
            const nextLink = Array.isArray(payload?.links) ? payload.links.find(l => l?.rel === 'next')?.href : null;
            nextUrl = resolveApiUrl(nextLink); guard++;
        }
        return items;
    };

    const setMessage = (text, type) => {
        if (!publicationMessage) return;
        const prev = messageTimers.get('publication');
        if (prev) { window.clearTimeout(prev); messageTimers.delete('publication'); }
        publicationMessage.textContent = text;
        publicationMessage.classList.remove('success', 'error');
        if (type) publicationMessage.classList.add(type);
        if (text) {
            const timerId = window.setTimeout(() => {
                publicationMessage.textContent = '';
                publicationMessage.classList.remove('success', 'error');
                messageTimers.delete('publication');
            }, 2500);
            messageTimers.set('publication', timerId);
        }
    };

    const getSessionUser = () => { try { return JSON.parse(sessionStorage.getItem('migo_user') || 'null'); } catch { return null; } };
    const getUserId = (session) => Number(pickValue(session, ['id_usuario', 'ID_USUARIO', 'id']));

    const populateSelect = (select, items, placeholderText, valueKeys, labelKeys, labelResolver = null) => {
        if (!select) return;
        select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = ''; placeholder.textContent = placeholderText; placeholder.selected = true; placeholder.disabled = true;
        select.appendChild(placeholder);
        items.forEach((item) => {
            const value = Number(pickValue(item, valueKeys));
            const baseLabel = String(pickValue(item, labelKeys) || '').trim();
            const label = labelResolver ? labelResolver(baseLabel, item) : baseLabel;
            if (!Number.isFinite(value) || !label) return;
            const option = document.createElement('option');
            option.value = String(value); option.textContent = label;
            select.appendChild(option);
        });
        select.disabled = select.options.length <= 1;
    };

    const syncPhotoPreview = (dataUrl) => {
        if (!dropArea) return;
        if (dataUrl) {
            dropArea.style.backgroundImage = `url(${dataUrl})`;
            dropArea.style.backgroundSize = 'cover';
            dropArea.style.backgroundPosition = 'center';
            const uploadContent = dropArea.querySelector('.upload-content');
            if (uploadContent) uploadContent.style.display = 'none';
        } else {
            dropArea.style.backgroundImage = '';
            const uploadContent = dropArea.querySelector('.upload-content');
            if (uploadContent) uploadContent.style.display = 'flex';
        }
    };

    const handlePhotoSelection = (event) => {
        const file = event.target.files?.[0];
        if (!file) { imagenBase64 = ''; syncPhotoPreview(''); return; }
        const reader = new FileReader();
        reader.onload = (e) => { imagenBase64 = String(e.target?.result || ''); syncPhotoPreview(imagenBase64); };
        reader.readAsDataURL(file);
    };
    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage('', '');
        const sessionUser = getSessionUser();
        const idUsuario = getUserId(sessionUser);
        if (!Number.isFinite(idUsuario) || idUsuario <= 0) {
            setMessage('Tu sesión no está disponible. Inicia sesión de nuevo.', 'error');
            window.setTimeout(() => { window.location.href = '../ScreenLogin/login.html'; }, 1200);
            return;
        }
        const nombrePet = nombrePetInput?.value.trim() || '';
        const descripcion = descripcionInput?.value.trim() || '';
        const idColonia = Number(coloniaSelect?.value || 0);
        const idEspecie = Number(especieSelect?.value || 0);
        const idTipo = Number(tipoSelect?.value || 0);
        const isPositiveId = (v) => Number.isInteger(v) && v > 0;

        if (!nombrePet || !descripcion || !isPositiveId(idColonia) || !isPositiveId(idEspecie) || !isPositiveId(idTipo)) {
            setMessage('Completa todos los campos obligatorios.', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/publicaciones/publicaciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_usuario: idUsuario,
                    id_colonia: idColonia,
                    id_especie: idEspecie,
                    id_tipo: idTipo,
                    nombre_pet: nombrePet,
                    descripcion,
                }),
            });

            const data = await response.json();
            const publicationId = data.id_publi;

            if (imagenBase64 && publicationId) {
                try {
                    await fetch(`${API_BASE_URL}/fotos_publi/publicaciones/${publicationId}/fotos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ruta_imagen: imagenBase64 }),
                    });
                } catch {
                    setMessage('La foto local no se pudo asociar.', 'error');
                }
            }

            setMessage('Publicación creada correctamente. Redirigiendo al tablero...', 'success');
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

    const getPublicationTitle = (post) => pickValue(post, ['nombre_pet', 'nombre', 'NOMBRE_PET', 'NOMBRE']) || 'Sin nombre';
    const getPublicationLocation = (post) => pickValue(post, ['nombre_colonia', 'colonia_nombre', 'COLONIA', 'colonia', 'id_colonia', 'ID_COLONIA']) || 'No especificada';
    const getPublicationDescription = (post) => pickValue(post, ['descripcion', 'DESCRIPCION']) || '';
    const getPublicationDate = (post) => pickValue(post, ['fecha_registro', 'fecha', 'FECHA_REGISTRO', 'FECHA']) || '';
    const getPublicationImage = (post) => pickValue(post, ['ruta_imagen', 'imagen', 'RUTA_IMAGEN', 'IMAGEN']) || '';
    const getPublicationLabel = (post) => pickValue(post, ['nombre_tipo', 'tipo_nombre', 'nombre_estado', 'estado_nombre', 'tipo_reporte', 'TIPO_REPORTE', 'tipo', 'TIPO']) || 'Publicación';

    const renderizarGrid = (listaPublicaciones) => {
        const grid = document.getElementById('publicationsGrid');
        if (!grid) return;

        grid.innerHTML = '';

        if (listaPublicaciones.length === 0) {
            grid.innerHTML = '<p class="no-posts">No se encontraron reportes.</p>';
            return;
        }

        listaPublicaciones.forEach((post) => {
            const nombre = getPublicationTitle(post);
            const colonia = getPublicationLocation(post);
            const descripcion = getPublicationDescription(post);
            const fecha = getPublicationDate(post);
            const imagen = getPublicationImage(post);
            const etiqueta = getPublicationLabel(post);
            const badgeClass = normalizeText(etiqueta).replace(/[^a-z0-9_-]/g, '') || 'publicacion';

            const imageMarkup = imagen
                ? `<img class="card-img" src="${imagen}" alt="${nombre}">`
                : `<div class="card-img" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#e6fffa,#f7fafc);color:#0b1d28;font-weight:700;">${nombre.slice(0, 1).toUpperCase()}</div>`;

            const cardHTML = `
                <article class="post-card">
                    <div class="card-image-wrapper">
                        ${imageMarkup}
                        <span class="status-badge ${badgeClass}">${etiqueta.toUpperCase()}</span>
                    </div>
                    <div class="card-content">
                        <div class="card-meta">
                            <span class="card-location">📍 ${colonia}</span>
                            <span class="card-date">${fecha}</span>
                        </div>
                        <h3 class="card-pet-name">${nombre}</h3>
                        <p class="card-description">${descripcion}</p>
                        <div class="card-footer">
                            <button class="btn-card-action primary" type="button">Contactar</button>
                        </div>
                    </div>
                </article>
            `;

            grid.innerHTML += cardHTML;
        });
    };

    const initializeDashboard = async () => {
        try {
            const session = sessionStorage.getItem('migo_user');
            if (!session) {
                window.location.href = '../ScreenLogin/login.html';
                return;
            }

            const logoutLink = document.querySelector('.logout-link');
            if (logoutLink) {
                logoutLink.addEventListener('click', () => {
                    sessionStorage.removeItem('migo_user');
                });
            }

            const publicaciones = await fetchApi('/publicaciones/publicaciones');
            renderizarGrid(publicaciones);

            const inputBuscar = document.querySelector('.search-box input');
            if (inputBuscar) {
                inputBuscar.addEventListener('input', (event) => {
                    const texto = normalizeText(event.target.value);
                    const filtradas = publicaciones.filter((post) => {
                        const searchableText = [
                            getPublicationTitle(post),
                            getPublicationLocation(post),
                            getPublicationDescription(post),
                            getPublicationLabel(post),
                        ].join(' ');
                        return normalizeText(searchableText).includes(texto);
                    });
                    renderizarGrid(filtradas);
                });
            }
        } catch (error) {
            console.error('Error al cargar el dashboard:', error);
        }
    };

    document.addEventListener('DOMContentLoaded', initialize, { once: true });
    document.addEventListener('DOMContentLoaded', initializeDashboard);
})();
