const dropArea = document.getElementById('dropArea');
const fotoInput = document.getElementById('fotoInput');
const form = document.getElementById('formPublicacion');

// Endpoint de tu base de datos (basado en el de tu auth.js)
const API_BASE_URL = 'https://ga6f1d821261f2a-migodb.adb.mx-queretaro-1.oraclecloudapps.com/ords/migo_user';
const API_ENDPOINT = `${API_BASE_URL}/publicaciones/`; 

let imagenBase64 = "";

// Click para subir foto
dropArea.addEventListener('click', () => fotoInput.click());

fotoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            imagenBase64 = event.target.result;
            dropArea.style.backgroundImage = `url(${imagenBase64})`;
            dropArea.style.backgroundSize = 'cover';
            dropArea.querySelector('.upload-content').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
});

// Enviar a la base de datos
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Obtener datos del formulario
    const nuevaPublicacion = {
        nombre: document.getElementById('nombre').value,
        tipo_reporte: document.getElementById('tipo').value,
        colonia: document.getElementById('colonia').value,
        descripcion: document.getElementById('descripcion').value,
        imagen: imagenBase64, // Enviamos el Base64
        fecha: new Date().toISOString().split('T')[0] // Formato YYYY-MM-DD
    };

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(nuevaPublicacion)
        });

        if (response.ok) {
            alert("¡Publicación enviada con éxito a la base de datos!");
            window.location.href = "../ScreenDashboard/dashboard.html";
        } else {
            throw new Error("No se pudo guardar en la base de datos.");
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Ocurrió un error al guardar. Verifica tu conexión.");
    }
});