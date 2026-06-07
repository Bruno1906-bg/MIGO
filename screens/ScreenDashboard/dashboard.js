(() => {
    const API_BASE_URL = 'https://ga6f1d821261f2a-migodb.adb.mx-queretaro-1.oraclecloudapps.com/ords/migo_user';

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

    const pickValue = (item, keys) => {
        for (const key of keys) {
            const value = item?.[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                return value;
            }
        }

        return '';
    };

    const normalizeText = (value) => String(value || '').trim().toLowerCase();

    const fetchApi = async (endpoint) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const rawText = await response.text();
        let payload = null;

        try {
            payload = rawText ? JSON.parse(rawText) : null;
        } catch {
            payload = rawText;
        }

        if (!response.ok) {
            const errorMessage = payload?.message || payload?.error || 'Error al conectar con la base de datos';
            throw new Error(errorMessage);
        }

        return parseCollection(payload);
    };

    const getPublicationTitle = (post) => pickValue(post, ['nombre_pet', 'nombre', 'NOMBRE_PET', 'NOMBRE']) || 'Sin nombre';
    const getPublicationLocation = (post) => pickValue(post, ['nombre_colonia', 'colonia_nombre', 'COLONIA', 'colonia', 'id_colonia', 'ID_COLONIA']) || 'No especificada';
    const getPublicationDescription = (post) => pickValue(post, ['descripcion', 'DESCRIPCION']) || '';
    const getPublicationDate = (post) => pickValue(post, ['fecha_registro', 'fecha', 'FECHA_REGISTRO', 'FECHA']) || '';
    const getPublicationImage = (post) => pickValue(post, ['ruta_imagen', 'imagen', 'RUTA_IMAGEN', 'IMAGEN']) || '';
    const getPublicationLabel = (post) => pickValue(post, ['nombre_tipo', 'tipo_nombre', 'nombre_estado', 'estado_nombre', 'tipo_reporte', 'TIPO_REPORTE', 'tipo', 'TIPO']) || 'Publicación';

    const renderizarGrid = (listaPublicaciones) => {
        const grid = document.getElementById('publicationsGrid');
        if (!grid) {
            return;
        }

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

            const publicaciones = await fetchApi('/publicaciones/');

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

    document.addEventListener('DOMContentLoaded', initializeDashboard);
})();