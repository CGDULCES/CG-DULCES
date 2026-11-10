/* =====================================================================
 * CG DULCES · Estado compartido: conexión a la base y las listas de datos que usan todas las pantallas.
 * (archivo: js/app/estado.js)
 * ===================================================================== */

const SUPABASE_URL = "https://amfcmrvksewtqqadiuii.supabase.co";

const SUPABASE_KEY = "sb_publishable_oVCLDcffzu2l2aQxLzcexg_jbzsDaUi";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.sb = sb; // usado por js/rpc.js para llamar a las funciones transaccionales

const HELADOS_OCULTO = "Helados"; // se habilita en la próxima etapa

let categorias = [];

let productos = [];

let promociones = [];

let recetas = [];

const ADMIN = "Administrador"; // nombre que se guarda como responsable de cada operación

let ventasHistoricas = [];

let proveedores = [];

let compras = [];

let clientes = [];

let cajaActual = null;

let cajaMovimientos = [];

let historial = [];

let ventasClientes = [];

let cobros = [];

let cart = {};

let pajitasCart = {}; // { productoId: cantidadDePajitas }

let heladoCart = []; // ventas armadas de helado: { id, tipo: 'bola'|'pote14', bolas: [productoId,...], envaseId, cobertura, total }

let repartosClientes = []; // todas las cuentas compartidas, para calcular deuda de cualquier cliente

let activeTab = "dashboard";

let chartInstance = null;

let categoryColors = {};

const fmt = (n) => `Gs. ${Math.round(n).toLocaleString("es-PY")}`;

window.__config = {};

let procesandoAccion = false;

let procesandoVenta = false;
