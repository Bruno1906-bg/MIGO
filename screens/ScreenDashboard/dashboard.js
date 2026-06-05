(() => {
    const API_BASE_URL = 'https://ga6f1d821261f2a-migodb.adb.mx-queretaro-1.oraclecloudapps.com/ords/migo_user';

    // 1. Función para obtener datos de la API
    const fetchApi = async (endpoint) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) throw new Error('Error al conectar con la base de datos');
        const data = await response.json();
        // Ajustamos según la estructura de tu API (data.items o data.result)
        return data.items || data.result || data || [];
    };

    // 2. Función para renderizar el Grid (Mantén tu lógica visual intacta)
    const renderizarGrid = (listaPublicaciones) => {
        const grid = document.getElementById("publicationsGrid");
        if (!grid) return;

        grid.innerHTML = "";

        if (listaPublicaciones.length === 0) {
            grid.innerHTML = `<p class="no-posts">No se encontraron reportes.</p>`;
            return;
        }

        listaPublicaciones.forEach(post => {
            // Ajusta estos nombres de campo según lo que devuelve tu API (ej: post.NOMBRE, post.TIPO)
            const nombre = post.nombre || post.NOMBRE || "Sin nombre";
            const tipo = (post.tipo_reporte || post.TIPO_REPORTE || "").toLowerCase();
            const colonia = post.colonia || post.COLONIA || "No especificada";
            const descripcion = post.descripcion || post.DESCRIPCION || "";
            const fecha = post.fecha || post.FECHA || "";
            
            const cardHTML = `
                <article class="post-card">
                    <div class="card-content">
                        <div class="card-meta">
                            <span class="card-location">📍 ${colonia}</span>
                            <span class="card-date">${fecha}</span>
                        </div>
                        <h3 class="card-pet-name">${nombre}</h3>
                        <span class="status-badge ${tipo}">${tipo.toUpperCase()}</span>
                        <p class="card-description">${descripcion}</p>
                        <div class="card-footer">
                            <button class="btn-card-action primary">Contactar</button>
                        </div>
                    </div>
                </article>
            `;
            grid.innerHTML += cardHTML;
        });
    };

    // 3. Inicialización combinada
    const initializeDashboard = async () => {
        try {
            // Verificamos si hay sesión activa (según tu auth.js)
            const session = sessionStorage.getItem('migo_user');
            if (!session) {
                window.location.href = '../ScreenLogin/login.html';
                return;
            }

            // Llamamos a la API para traer los reportes/publicaciones
            // Asegúrate de que el endpoint sea correcto (ej: /publicaciones/)
            const publicaciones = await fetchApi('/publicaciones/');
            
            renderizarGrid(publicaciones);
            
            // Configurar buscador con los datos cargados
            const inputBuscar = document.querySelector(".search-box input");
            if (inputBuscar) {
                inputBuscar.addEventListener("input", (e) => {
                    const texto = e.target.value.toLowerCase();
                    const filtradas = publicaciones.filter(p => 
                        (p.nombre || p.NOMBRE || "").toLowerCase().includes(texto) || 
                        (p.colonia || p.COLONIA || "").toLowerCase().includes(texto)
                    );
                    renderizarGrid(filtradas);
                });
            }
        } catch (error) {
            console.error("Error al cargar el dashboard:", error);
        }
    };

    document.addEventListener('DOMContentLoaded', initializeDashboard);
})();