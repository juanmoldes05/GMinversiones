GM Recomendador — PWA JSON Core Desplegable

Estructura:
- index.html: estructura visual.
- styles.css: estética y responsive mobile-first.
- app.js: lógica de recomendación y render dinámico.
- unidades.json: base editable de unidades.
- manifest.webmanifest y service-worker.js: instalación PWA.
- assets/: logos, texturas e íconos.

Uso para actualizar unidades:
1. Abrir unidades.json.
2. Agregar, editar o eliminar unidades dentro del array "unidades".
3. Mantener estado: "disponible" y precio, anticipo y cuota_estimada numéricos para que entren en recomendaciones.
4. Guardar, hacer commit y deploy en Vercel/GitHub.

Cambios de esta versión:
- Resultados en cards desplegables.
- Cada opción permite abrir "Ver información completa".
- Urban Cramer incluido con unidades disponibles de la lista de precios cargada.
- GBA funciona como opción amplia: CABA + GBA/Canning.
- Packs tranquilos renombrados como "Pack con ofertas en X barrio".

Notas:
- Las cuotas de Emprendeprop/Club Conecta se estiman con 50% anticipo + saldo en 24 cuotas cuando no hay otro esquema informado.
- Antes de ofrecer, confirmar disponibilidad, precios y condiciones vigentes.
