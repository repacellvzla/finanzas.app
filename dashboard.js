document.addEventListener('DOMContentLoaded', () => {
    try {
        let filtroActual = { tipo: 'hoy' }; 

        const usuarioLogeado = JSON.parse(localStorage.getItem('usuario-autenticado'));
        if (!usuarioLogeado) { window.location.href = 'index.html'; return; }

        // --- SELECTORES ---
        const debtList = document.getElementById('debt-list');
        const modalPago = document.getElementById('modal-pago-deuda');
        const closeModalBtn = modalPago ? modalPago.querySelector('.close-button') : null;
        const formPagoDeuda = document.getElementById('form-pago-deuda');
        const modalTitle = document.getElementById('modal-title');
        const deudaActualInfo = document.getElementById('deuda-actual-info');
        const montoPagoInput = document.getElementById('monto-pago');
        const deudaTransaccionIdInput = document.getElementById('deuda-transaccion-id');
        const fechaInicioInput = document.getElementById('fecha-inicio');
        const fechaFinInput = document.getElementById('fecha-fin');
        const settingsBtn = document.getElementById('settings-btn');
        const configModal = document.getElementById('modal-configuracion');
        const closeConfigBtn = document.getElementById('close-config-modal');
        const formFees = document.getElementById('form-fees');
        const feeCuentaSelect = document.getElementById('fee-cuenta');
        const feePorcentajeInput = document.getElementById('fee-porcentaje');
        const feeComentarioInput = document.getElementById('fee-comentario');
        const tablaFeesBody = document.getElementById('tabla-fees')?.querySelector('tbody');
        const formCostoFijo = document.getElementById('form-costo-fijo');
        const tablaCostosFijosBody = document.getElementById('tabla-costos-fijos')?.querySelector('tbody');
        const formAddUser = document.getElementById('form-add-user');
        const formMetas = document.getElementById('form-metas');
        const formGasto = document.getElementById('form-gasto');
        const utilidadesCard = document.getElementById('utilidades-card');
        const controlDiarioBtn = document.getElementById('control-diario-btn');
        const controlDiarioStatusDot = document.getElementById('control-diario-status-dot');
        const modalControlDiario = document.getElementById('modal-control-diario');
        const closeControlDiarioModalBtn = document.getElementById('close-control-diario-modal');
        const controlDiarioModalTitle = document.getElementById('control-diario-modal-title');
        const controlDiarioModalBody = document.getElementById('control-diario-modal-body');
        
        if (usuarioLogeado.rol === 'administrador') {
            if(formAddUser) formAddUser.style.display = 'block';
        }

        // --- FUNCIONES UTILITARIAS ---
        const getHoyYMD = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const formatNumber = (num) => {
            const number = parseFloat(num);
            if (isNaN(number)) return '0,00';
            return number.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };
        const parseFormattedNumber = (str) => {
            if (typeof str !== 'string' || str.trim() === '') return 0;
            return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
        };
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
        const safeJSONParse = (key, defaultValue) => {
            try {
                const item = localStorage.getItem(key);
                const result = item ? JSON.parse(item) : defaultValue;
                return result || defaultValue;
            } catch (e) { console.error("Error parsing JSON:", e); return defaultValue; }
        };
        const formatFechaCorta = (isoString) => {
            if (!isoString) return 'N/A';
            const dateStr = isoString.length === 10 ? isoString + 'T00:00:00' : isoString;
            const fecha = new Date(dateStr);
            return fecha.toLocaleDateString('es-VE');
        };
        const formatHora = (isoString) => {
            if (!isoString) return 'N/A';
            return new Date(isoString).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
        };
        function autoFormatNumberInput(inputId) {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('blur', () => { if (input.value) input.value = formatNumber(parseFormattedNumber(input.value)); });
                input.addEventListener('focus', () => { const value = parseFormattedNumber(input.value); input.value = value !== 0 ? value : ''; });
            }
        }

        function recalcularYRenderizarTodo() {
            const defaultConfig = { bancos: [], costos_fijos: [], fees: {}, metas: {} };
            const config = safeJSONParse('configuracion', defaultConfig);
            const transacciones = safeJSONParse('transacciones', []);
            const transaccionesFiltradas = filtrarTransacciones(transacciones, filtroActual);
            const saldosActualizados = calcularSaldos(config.bancos, transacciones);
            localStorage.setItem('saldos_actuales', JSON.stringify(saldosActualizados));
            renderizarKPIs(saldosActualizados, transacciones); 
            renderizarDeudas(transacciones);
            renderizarTablaCuentas(saldosActualizados); 
            renderizarTablaTransacciones(transaccionesFiltradas, saldosActualizados);
            
            const DEFAULT_METAS = { ventas: 5000, compras: 7000, gastos: 1000000, deliveries: 10, utilidad: 2000000 };
            const metas = config.metas && Object.keys(config.metas).length ? config.metas : DEFAULT_METAS;
            const todasLasCompras = transacciones.filter(t => t.tipo === 'Compra');
            const utilidad = calcularUtilidad(transaccionesFiltradas, todasLasCompras, config.costos_fijos);
            const metricasGraficos = {
                ventas: transaccionesFiltradas.filter(t => t.tipo === 'Venta').reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0),
                compras: transaccionesFiltradas.filter(t => t.tipo === 'Compra').reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0),
                gastos: transaccionesFiltradas.filter(t => t.tipo === 'Gasto').reduce((sum, t) => sum + (parseFloat(t.monto_gasto) || 0), 0),
                deliveries: transaccionesFiltradas.filter(t => t.delivery === true).length,
                utilidad: utilidad,
                metas: metas
            };
            if (typeof actualizarTodosLosGraficos === 'function') {
                actualizarTodosLosGraficos(metricasGraficos);
            }
            actualizarBotonesFiltro();
            renderizarFees();
            renderizarCostosFijos();
            renderizarMetas();
            actualizarBotonControlDiario();
            const jornadaAbierta = verificarEstadoJornada();
            document.querySelector('#form-add-cuenta button[type="submit"]').disabled = !jornadaAbierta;
            document.querySelector('#form-transferencia button[type="submit"]').disabled = !jornadaAbierta;
            document.querySelector('#form-gasto button[type="submit"]').disabled = !jornadaAbierta;
        }

        function calcularSaldos(bancos, transacciones) {
            if (!bancos) bancos = [];
            const saldos = bancos.map(banco => ({ ...banco, saldo: 0 }));
            transacciones.forEach(t => {
                const cuentaPropia = saldos.find(b => b.id === t.cuenta_propia_id);
                const custodiaUSD = saldos.find(b => b.id === 'Custodia $');
                if (t.tipo === 'Ingreso Saldo') { if (cuentaPropia) cuentaPropia.saldo += parseFloat(t.monto_ingreso); }
                else if (t.tipo === 'Venta') {
                    if (cuentaPropia && t.monto_ves) cuentaPropia.saldo += parseFloat(t.monto_ves);
                    if (custodiaUSD && t.monto_total_usd) custodiaUSD.saldo -= parseFloat(t.monto_total_usd);
                } else if (t.tipo === 'Compra') {
                    if (cuentaPropia && t.monto_ves) cuentaPropia.saldo -= parseFloat(t.monto_ves);
                    if (custodiaUSD && t.monto_entregado_usd) custodiaUSD.saldo += parseFloat(t.monto_entregado_usd);
                } else if (t.tipo === 'Transferencia Propia') {
                    const cuentaOrigen = saldos.find(b => b.id === t.cuenta_propia_id);
                    const cuentaDestino = saldos.find(b => b.id === t.cuenta_destino_id);
                    if (cuentaOrigen && cuentaDestino && t.monto_transferencia) {
                        cuentaOrigen.saldo -= parseFloat(t.monto_transferencia);
                        cuentaDestino.saldo += parseFloat(t.monto_transferencia);
                    }
                } else if (t.tipo === 'Pago Cliente') {
                    if (custodiaUSD && t.monto_pago_usd) custodiaUSD.saldo += parseFloat(t.monto_pago_usd);
                } else if (t.tipo === 'Gasto') {
                    const cuentaOrigenGasto = saldos.find(b => b.id === t.cuenta_origen_id);
                    if (cuentaOrigenGasto && t.monto_gasto) {
                        cuentaOrigenGasto.saldo -= parseFloat(t.monto_gasto);
                    }
                }
            });
            return saldos;
        }
        
        function calcularUtilidad(transaccionesFiltradas, todasLasCompras, costosFijos = []) {
            const ventasDelPeriodo = transaccionesFiltradas.filter(t => t.tipo === 'Venta');
            let utilidadBruta = 0;
            if (ventasDelPeriodo.length > 0 && todasLasCompras.length > 0) {
                let tasaPromedioCompra = 0;
                const totalBsInvertidoGlobal = todasLasCompras.reduce((sum, t) => sum + (parseFloat(t.monto_ves) || 0), 0);
                const totalUsdCompradoGlobal = todasLasCompras.reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0);
                if (totalUsdCompradoGlobal > 0) {
                    tasaPromedioCompra = totalBsInvertidoGlobal / totalUsdCompradoGlobal;
                }
                utilidadBruta = ventasDelPeriodo.reduce((sum, venta) => {
                    const gananciaPorDolar = (parseFloat(venta.tasa) || 0) - tasaPromedioCompra;
                    return sum + (gananciaPorDolar * (parseFloat(venta.monto_total_usd) || 0));
                }, 0);
            }
            const deliveryCostObject = costosFijos.find(c => c.nombre.toLowerCase() === 'delivery' && c.moneda === '$');
            const costoDeliveryUnitario = deliveryCostObject ? deliveryCostObject.monto : 0;
            const operacionesConDeliveryPeriodo = transaccionesFiltradas.filter(t => (t.tipo === 'Venta' || t.tipo === 'Compra') && t.delivery === true);
            const costoTotalDeliveryUSD = operacionesConDeliveryPeriodo.length * costoDeliveryUnitario;
            let tasaParaConversion = 0;
            if (todasLasCompras.length > 0) {
                 const totalBsInvertidoGlobal = todasLasCompras.reduce((sum, t) => sum + (parseFloat(t.monto_ves) || 0), 0);
                const totalUsdCompradoGlobal = todasLasCompras.reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0);
                if (totalUsdCompradoGlobal > 0) tasaParaConversion = totalBsInvertidoGlobal / totalUsdCompradoGlobal;
            } else if (ventasDelPeriodo.length > 0) {
                const totalBsVendido = ventasDelPeriodo.reduce((sum, t) => sum + (parseFloat(t.monto_ves) || 0), 0);
                const totalUsdVendido = ventasDelPeriodo.reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0);
                if (totalUsdVendido > 0) tasaParaConversion = totalBsVendido / totalUsdVendido;
            }
            const costoTotalDeliveryBs = costoTotalDeliveryUSD * tasaParaConversion;
            const utilidadNeta = utilidadBruta - costoTotalDeliveryBs;
            return utilidadNeta;
        }

        function filtrarTransacciones(transacciones, filtro) {
            if (!filtro || filtro.tipo === 'todos') return transacciones.slice();
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            return transacciones.filter(t => {
                const fechaT = new Date(t.fechaHora);
                fechaT.setHours(0, 0, 0, 0);
                switch (filtro.tipo) {
                    case 'hoy': return fechaT.getTime() === hoy.getTime();
                    case 'semana': 
                        const inicioSemana = new Date(hoy); 
                        inicioSemana.setDate(hoy.getDate() - hoy.getDay());
                        inicioSemana.setHours(0,0,0,0);
                        return fechaT >= inicioSemana;
                    case 'mes': 
                        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                        return fechaT >= inicioMes;
                    case 'rango': 
                        const inicio = new Date(filtro.inicio + 'T00:00:00'); 
                        const fin = new Date(filtro.fin + 'T23:59:59'); 
                        return new Date(t.fechaHora) >= inicio && new Date(t.fechaHora) <= fin;
                    default: return true;
                }
            });
        }
        
        function verificarEstadoJornada() {
            const controlActual = safeJSONParse('control_diario', null);
            const hoy = getHoyYMD();
            return controlActual && controlActual.fecha === hoy && controlActual.estado === 'abierto';
        }

        function actualizarBotonControlDiario() {
            if (verificarEstadoJornada()) {
                controlDiarioStatusDot.classList.add('active');
            } else {
                controlDiarioStatusDot.classList.remove('active');
            }
        }

        function abrirModalControlDiario() {
            const jornadaAbierta = verificarEstadoJornada();
            
            if (jornadaAbierta) {
                const controlActual = safeJSONParse('control_diario');
                controlDiarioModalTitle.textContent = 'Jornada en Curso';
                
                let saldosHTML = '';
                if (controlActual.saldosIniciales) {
                    controlActual.saldosIniciales.forEach(cuenta => {
                        const simbolo = cuenta.id === 'Custodia $' ? '$' : 'Bs.';
                        saldosHTML += `<div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>${cuenta.nombre}</h5><p>${simbolo} ${formatNumber(cuenta.saldo)}</p></div></div>`;
                    });
                }

                controlDiarioModalBody.innerHTML = `
                    <p>Jornada iniciada el <strong>${formatFechaCorta(controlActual.inicioTimestamp)}</strong> a las <strong>${formatHora(controlActual.inicioTimestamp)}</strong>.</p>
                    <h5>Saldos Iniciales:</h5>
                    <div class="kpi-grid">${saldosHTML}</div>
                    <div class="button-container" style="margin-top: 20px;">
                        <button id="modal-cerrar-dia-btn" class="button button-danger">Realizar Cierre del Día</button>
                    </div>`;

            } else {
                controlDiarioModalTitle.textContent = 'Iniciar Jornada';
                controlDiarioModalBody.innerHTML = `
                    <p style="text-align: center;">No hay una jornada activa. Para poder registrar transacciones, debe iniciar el día.</p>
                    <div class="button-container" style="margin-top: 20px;">
                         <button id="modal-iniciar-dia-btn" class="button button-primary" style="width: 100%; padding: 15px; font-size: 1.2em;">Iniciar Día</button>
                    </div>`;
            }
            modalControlDiario.classList.add('active');
        }

        function generarNombreArchivo() {
            const base = "Reporte";
            const hoy = new Date();
            const fechaHoy = getHoyYMD();
            switch (filtroActual.tipo) {
                case 'hoy': return `${base}_${fechaHoy}`;
                case 'semana':
                    const inicioSemana = new Date(hoy);
                    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
                    const finSemana = new Date(inicioSemana);
                    finSemana.setDate(inicioSemana.getDate() + 6);
                    return `${base}_Semana_${inicioSemana.toISOString().slice(0,10)}_a_${finSemana.toISOString().slice(0,10)}`;
                case 'mes':
                    const mes = hoy.toLocaleString('es-VE', { month: 'long' });
                    const anio = hoy.getFullYear();
                    return `${base}_Mes_${mes}_${anio}`;
                case 'rango': return `${base}_Rango_${filtroActual.inicio}_a_${filtroActual.fin}`;
                default: return `${base}_Completo_${fechaHoy}`;
            }
        }
        function renderizarTablaCuentas(bancos) {
            const origenSelect = document.getElementById('cuenta-origen');
            const destinoSelect = document.getElementById('cuenta-destino');
            const gastoOrigenSelect = document.getElementById('gasto-cuenta-origen');
            if (!origenSelect || !destinoSelect || !gastoOrigenSelect) return;
            origenSelect.innerHTML = destinoSelect.innerHTML = gastoOrigenSelect.innerHTML = '<option value="" disabled selected>Seleccione</option>';
            if (Array.isArray(bancos)) {
                bancos.forEach(banco => {
                    const optionHTML = `<option value="${banco.id}">${banco.nombre}</option>`;
                    origenSelect.innerHTML += optionHTML;
                    destinoSelect.innerHTML += optionHTML;
                    gastoOrigenSelect.innerHTML += optionHTML;
                });
            }
        }
        function renderizarFees() {
            const tablaFeesBody = document.getElementById('tabla-fees')?.querySelector('tbody');
            const feeCuentaSelect = document.getElementById('fee-cuenta');
            const config = safeJSONParse('configuracion', { bancos: [], costos_fijos: [], fees: {} });
            if (!tablaFeesBody) return;
            tablaFeesBody.innerHTML = '';
            if (config.fees && Object.keys(config.fees).length > 0) {
                for (const cuentaId in config.fees) {
                    const nombreCuenta = cuentaId;
                    const fee = config.fees[cuentaId];
                    const feeComentario = typeof fee === 'object' ? fee.comentario : '';
                    const feeValor = typeof fee === 'object' ? fee.valor : fee;
                    tablaFeesBody.innerHTML += `<tr><td>${nombreCuenta}</td><td>${feeValor} %</td><td>${feeComentario}</td><td><button class="button button-danger remove-fee" data-cuenta="${cuentaId}">Eliminar</button></td></tr>`;
                }
            } else {
                tablaFeesBody.innerHTML = '<tr><td colspan="4">No hay fees registrados.</td></tr>';
            }
            if (feeCuentaSelect) {
                const bancos = safeJSONParse('configuracion', { bancos: [] }).bancos || [];
                feeCuentaSelect.innerHTML = `<option value="" disabled selected>Seleccione una cuenta</option>`;
                bancos.forEach(banco => {
                    if (!config.fees || !config.fees[banco.id]) {
                        feeCuentaSelect.innerHTML += `<option value="${banco.id}">${banco.nombre}</option>`;
                    }
                });
            }
        }
        function renderizarCostosFijos() {
            const tablaCostosFijosBody = document.getElementById('tabla-costos-fijos')?.querySelector('tbody');
            if (!tablaCostosFijosBody) return;
            const config = safeJSONParse('configuracion', { costos_fijos: [] });
            tablaCostosFijosBody.innerHTML = '';
            if (config.costos_fijos && config.costos_fijos.length > 0) {
                config.costos_fijos.forEach(costo => {
                    tablaCostosFijosBody.innerHTML += `<tr><td>${costo.nombre}</td><td>${formatNumber(costo.monto)}</td><td>${costo.moneda}</td><td><button class="button button-danger remove-costo-fijo" data-id="${costo.id}">Eliminar</button></td></tr>`;
                });
            } else {
                tablaCostosFijosBody.innerHTML = '<tr><td colspan="4">No hay costos fijos registrados.</td></tr>';
            }
        }
        function renderizarUsuarios() {
            const tablaUsuariosBody = document.querySelector('#tabla-usuarios tbody');
            if (!tablaUsuariosBody) return;
            const usuarios = safeJSONParse('usuarios', [{ id: 1, username: 'admin', password: 'admin123', rol: 'administrador' },{ id: 2, username: 'supervisor', password: 'super123', rol: 'supervisor' },{ id: 3, username: 'ventas', password: 'ventas123', rol: 'ventas' }]);
            const rolesDisponibles = ['administrador', 'supervisor', 'ventas'];
            tablaUsuariosBody.innerHTML = '';
            usuarios.forEach(user => {
                let rolesOpciones = '';
                rolesDisponibles.forEach(rol => {
                    const seleccionado = user.rol === rol ? 'selected' : '';
                    rolesOpciones += `<option value="${rol}" ${seleccionado}>${rol}</option>`;
                });
                tablaUsuariosBody.innerHTML += `<tr><td><input type="text" value="${user.username}" class="user-input" data-userid="${user.id}"></td><td><input type="password" value="********" class="password-input"></td><td><select class="user-role-select" ${usuarioLogeado.rol !== 'administrador' ? 'disabled' : ''}>${rolesOpciones}</select></td><td><button class="button button-primary guardar-rol-btn" ${usuarioLogeado.rol !== 'administrador' ? 'disabled' : ''}>Guardar</button></td></tr>`;
            });
            document.querySelectorAll('.guardar-rol-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const row = e.target.closest('tr');
                    const username = row.querySelector('.user-input').value;
                    const newRole = row.querySelector('.user-role-select').value;
                    showToast(`Usuario ${username} actualizado al rol: ${newRole}. (Simulado)`, 'success');
                });
            });
        }
        function renderizarTablaTransacciones(transacciones, bancos) {
            const tbody = document.getElementById('tabla-transacciones')?.querySelector('tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            transacciones.sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));
            transacciones.forEach(t => {
                let operacion = t.tipo || 'N/A', cliente = t.cliente || 'N/A', tasa = 'N/A', saldoPendiente = 'N/A', observacion = t.concepto || '';
                let bancoMostrado = t.cuenta_propia_id || 'N/A';
                let montoPrincipal = 'N/A';
                if ((t.tipo === 'Venta' || t.tipo === 'Compra') && t.delivery === true) { operacion += ' 🛵'; }
                if (t.tipo === 'Venta' || t.tipo === 'Compra') {
                    tasa = t.tasa ? formatNumber(t.tasa) : 'N/A';
                    saldoPendiente = (t.saldo_pendiente_usd != null) ? `$${formatNumber(t.saldo_pendiente_usd)}` : 'N/A';
                    bancoMostrado = t.banco_cliente || 'N/A';
                    montoPrincipal = (t.tipo === 'Venta') ? `Bs. ${formatNumber(t.monto_ves)}` : `$${formatNumber(t.monto_total_usd)}`;
                } else if (t.tipo === 'Transferencia Propia') {
                    cliente = "Admin";
                    bancoMostrado = `${t.cuenta_propia_id} -> ${t.cuenta_destino_id}`;
                    montoPrincipal = `Bs. ${formatNumber(t.monto_transferencia)}`;
                } else if (t.tipo === 'Ingreso Saldo') {
                    cliente = 'Admin';
                    bancoMostrado = t.cuenta_propia_id;
                    montoPrincipal = (t.cuenta_propia_id === 'Custodia $') ? `$${formatNumber(t.monto_ingreso)}` : `Bs. ${formatNumber(t.monto_ingreso)}`;
                } else if (t.tipo === 'Pago Cliente') {
                    montoPrincipal = `$${formatNumber(t.monto_pago_usd)}`;
                    bancoMostrado = 'Custodia $'; saldoPendiente = '$0,00';
                } else if (t.tipo === 'Gasto') {
                    cliente = 'Admin';
                    bancoMostrado = t.cuenta_origen_id;
                    const simbolo = t.cuenta_origen_id === 'Custodia $' ? '$' : 'Bs.';
                    montoPrincipal = `${simbolo} ${formatNumber(t.monto_gasto)}`;
                }
                tbody.innerHTML += `<tr><td>${formatFechaCorta(t.fechaHora)}</td><td>${formatHora(t.fechaHora)}</td><td>${operacion}</td><td>${cliente}</td><td>${tasa}</td><td>${montoPrincipal}</td><td>${bancoMostrado}</td><td>${saldoPendiente}</td><td><span class="status ${t.estatus ? t.estatus.toLowerCase() : ''}">${t.estatus || 'N/A'}</span></td><td>${observacion}</td></tr>`;
            });
        }
        function renderizarKPIs(bancos, transacciones) {
            const kpiBancosContainer = document.getElementById('kpi-grid-bancos');
            const kpiTotalesContainer = document.getElementById('kpi-grid-totales');
            if (!kpiBancosContainer || !kpiTotalesContainer) return;
            const getKpiClass = (value) => (value > 0 ? 'positive' : '');
            const getUtilityClass = (value) => (value > 0 ? 'positive' : 'negative');
            const totalUSDOperados = transacciones.filter(t => t.tipo === 'Compra' || t.tipo === 'Venta').reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0);
            const totalBSDisponible = bancos.filter(b => b.id !== "Custodia $").reduce((sum, b) => sum + (parseFloat(b.saldo) || 0), 0);
            const totalCustodiaUSD = bancos.find(b => b.id === "Custodia $")?.saldo || 0;
            const deudaTotalUSD = transacciones.reduce((sum, t) => sum + (parseFloat(t.saldo_pendiente_usd) || 0), 0);
            const hoyTrans = filtrarTransacciones(transacciones, {tipo: 'hoy'});
            const todasLasCompras = transacciones.filter(t => t.tipo === 'Compra');
            const config = safeJSONParse('configuracion', {costos_fijos:[]});
            const utilidadDiaria = calcularUtilidad(hoyTrans, todasLasCompras, config.costos_fijos);
            const gastosDeHoy = hoyTrans.filter(t => t.tipo === 'Gasto');
            const gastosHoyBs = gastosDeHoy.filter(g => g.cuenta_origen_id !== 'Custodia $').reduce((sum, g) => sum + parseFloat(g.monto_gasto), 0);
            const gastosHoyUsd = gastosDeHoy.filter(g => g.cuenta_origen_id === 'Custodia $').reduce((sum, g) => sum + parseFloat(g.monto_gasto), 0);
            kpiTotalesContainer.innerHTML = `<div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Total USD Operados</h5><p class="${getKpiClass(totalUSDOperados)}">$ ${formatNumber(totalUSDOperados)}</p></div></div><div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Total Bs. Disponible</h5><p class="${getKpiClass(totalBSDisponible)}">Bs. ${formatNumber(totalBSDisponible)}</p></div></div><div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Total en Custodia USD</h5><p class="${getKpiClass(totalCustodiaUSD)}">$ ${formatNumber(totalCustodiaUSD)}</p></div></div><div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Deuda Total (USD)</h5><p class="${deudaTotalUSD > 0 ? 'negative' : ''}">$ ${formatNumber(deudaTotalUSD)}</p></div></div><div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Utilidad del Día (Bs.)</h5><p class="${getUtilityClass(utilidadDiaria)}">Bs. ${formatNumber(utilidadDiaria)}</p></div></div><div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Gastos del Día (Bs.)</h5><p class="negative">Bs. ${formatNumber(gastosHoyBs)}</p></div></div><div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>Gastos del Día ($)</h5><p class="negative">$ ${formatNumber(gastosHoyUsd)}</p></div></div>`;
            kpiBancosContainer.innerHTML = '';
            bancos.forEach(banco => {
                const simboloMoneda = (banco.id === "Custodia $") ? "$" : "Bs.";
                kpiBancosContainer.innerHTML += `<div class="kpi-card"><div class="kpi-card-accent"></div><div class="kpi-card-content"><h5>${banco.nombre}</h5><p class="${getKpiClass(banco.saldo)}">${simboloMoneda} ${formatNumber(banco.saldo)}</p></div></div>`;
            });
        }
        function renderizarDeudas(transacciones) {
            if (!debtList) return;
            debtList.innerHTML = '';
            const deudas = transacciones.filter(t => t.saldo_pendiente_usd > 0);
            if (deudas.length === 0) { debtList.innerHTML = '<li>No hay deudas pendientes.</li>'; return; }
            deudas.forEach(deuda => {
                const li = document.createElement('li');
                li.className = 'debt-item'; 
                li.innerHTML = `<span class="debt-info">${deuda.cliente} - $${formatNumber(deuda.saldo_pendiente_usd)}</span><div class="debt-actions"><span class="status pendiente">Pendiente</span><button class="button button-primary pagar-deuda-btn" data-id="${deuda.id}">Registrar Pago</button></div>`;
                debtList.appendChild(li);
            });
        }
        function getRowDataForExport(t) {
            let operacion = t.tipo || 'N/A', cliente = t.cliente || 'N/A', tasa = 'N/A', saldoPendiente = 'N/A', observacion = t.concepto || '';
            let bancoMostrado = t.cuenta_propia_id || 'N/A';
            let montoPrincipal = 'N/A';
            if ((t.tipo === 'Venta' || t.tipo === 'Compra') && t.delivery === true) { operacion += ' (Delivery)'; }
            if (t.tipo === 'Venta' || t.tipo === 'Compra') {
                tasa = t.tasa ? formatNumber(t.tasa) : 'N/A';
                saldoPendiente = (t.saldo_pendiente_usd != null) ? `$${formatNumber(t.saldo_pendiente_usd)}` : 'N/A';
                bancoMostrado = t.banco_cliente || 'N/A';
                montoPrincipal = (t.tipo === 'Venta') ? `Bs. ${formatNumber(t.monto_ves)}` : `$${formatNumber(t.monto_total_usd)}`;
            } else if (t.tipo === 'Transferencia Propia') {
                cliente = "Admin";
                bancoMostrado = `${t.cuenta_propia_id} -> ${t.cuenta_destino_id}`;
                montoPrincipal = `Bs. ${formatNumber(t.monto_transferencia)}`;
            } else if (t.tipo === 'Ingreso Saldo') {
                cliente = 'Admin';
                bancoMostrado = t.cuenta_propia_id;
                montoPrincipal = (t.cuenta_propia_id === 'Custodia $') ? `$${formatNumber(t.monto_ingreso)}` : `Bs. ${formatNumber(t.monto_ingreso)}`;
            } else if (t.tipo === 'Pago Cliente') {
                montoPrincipal = `$${formatNumber(t.monto_pago_usd)}`;
                bancoMostrado = 'Custodia $'; saldoPendiente = '$0,00';
            } else if (t.tipo === 'Gasto') {
                cliente = 'Admin';
                bancoMostrado = t.cuenta_origen_id;
                const simbolo = t.cuenta_origen_id === 'Custodia $' ? '$' : 'Bs.';
                montoPrincipal = `${simbolo} ${formatNumber(t.monto_gasto)}`;
            }
            return [formatFechaCorta(t.fechaHora), formatHora(t.fechaHora), operacion, cliente, tasa, montoPrincipal, bancoMostrado, saldoPendiente, t.estatus || 'N/A', observacion];
        }
        function renderizarMetas() {
            const config = safeJSONParse('configuracion', { metas: {} });
            const DEFAULT_METAS = { ventas: 5000, compras: 7000, gastos: 1000000, deliveries: 10, utilidad: 2000000 };
            const metas = config.metas && Object.keys(config.metas).length ? config.metas : DEFAULT_METAS;
            document.getElementById('meta-ventas').value = formatNumber(metas.ventas);
            document.getElementById('meta-compras').value = formatNumber(metas.compras);
            document.getElementById('meta-gastos').value = formatNumber(metas.gastos);
            document.getElementById('meta-utilidad').value = formatNumber(metas.utilidad);
            document.getElementById('meta-deliveries').value = metas.deliveries;
        }
        function actualizarBotonesFiltro() {
            document.querySelectorAll('.button-filtro').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filtro === filtroActual.tipo);
            });
        }
        function renderizarHistorialCierres() {
            const container = document.getElementById('historial-cierres-container');
            if (!container) return;
            const historial = safeJSONParse('historial_cierres', []).sort((a,b) => new Date(b.inicioTimestamp) - new Date(a.inicioTimestamp));
            if (historial.length === 0) {
                container.innerHTML = '<p style="text-align: center; padding: 20px 0;">No hay cierres de jornada registrados.</p>';
                return;
            }
            container.innerHTML = '';
            historial.forEach(cierre => {
                const el = document.createElement('div');
                el.className = 'cierre-item';
                el.innerHTML = `<div class="cierre-header" data-timestamp="${cierre.inicioTimestamp}"><h6>Jornada del ${formatFechaCorta(cierre.inicioTimestamp)}</h6><div class="cierre-header-actions"><button class="button button-secondary ver-detalles-cierre-btn">Ver Detalles</button><button class="button button-primary descargar-cierre-btn">Descargar PDF</button></div></div><div class="cierre-details"></div>`;
                container.appendChild(el);
            });
        }
        function generarPdfCierre(cierre) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text(`Reporte de Cierre de Jornada`, 14, 22);
            doc.setFontSize(11);
            doc.text(`Fecha: ${formatFechaCorta(cierre.fecha)}`, 14, 32);
            doc.autoTable({ startY: 40, head: [['Detalle', 'Valor']], body: [['Hora de Inicio', formatHora(cierre.inicioTimestamp)],['Hora de Cierre', formatHora(cierre.cierreTimestamp)],['---', '---'],['Ventas Totales', `$ ${formatNumber(cierre.resumen.ventas)}`],['Compras Totales', `$ ${formatNumber(cierre.resumen.compras)}`],['Gastos Totales', `Bs. ${formatNumber(cierre.resumen.gastos)}`],['Utilidad Neta', `Bs. ${formatNumber(cierre.resumen.utilidad)}`],['Nº de Deliveries', `${cierre.resumen.deliveries}`]], theme: 'grid', headStyles: { fillColor: [0, 128, 128] } });
            const lastY = doc.autoTable.previous.finalY;
            doc.autoTable({ startY: lastY + 10, head: [['Saldos Iniciales', '']], body: cierre.saldosIniciales.map(c => [c.nombre, `${c.id === 'Custodia $' ? '$' : 'Bs.'} ${formatNumber(c.saldo)}`]), theme: 'grid', headStyles: { fillColor: [0, 128, 128] } });
            doc.autoTable({ startY: doc.autoTable.previous.finalY + 10, head: [['Saldos Finales', '']], body: cierre.saldosFinales.map(c => [c.nombre, `${c.id === 'Custodia $' ? '$' : 'Bs.'} ${formatNumber(c.saldo)}`]), theme: 'grid', headStyles: { fillColor: [0, 128, 128] } });
            doc.save(`Cierre_de_Jornada_${cierre.fecha}.pdf`);
        }
        
        const cerrarJornada = () => {
             if (!confirm('¿Estás seguro de que deseas cerrar la jornada? Esta acción es definitiva.')) { return; }
            const controlActual = safeJSONParse('control_diario', null);
            if (!controlActual || controlActual.estado !== 'abierto') {
                showToast('No hay una jornada activa para cerrar.', 'error');
                return;
            }
            const transacciones = safeJSONParse('transacciones', []);
            const config = safeJSONParse('configuracion', { bancos: [] });
            const saldosFinales = calcularSaldos(config.bancos, transacciones);
            const transaccionesDelDia = transacciones.filter(t => new Date(t.fechaHora) >= new Date(controlActual.inicioTimestamp));
            const resumen = {
                ventas: transaccionesDelDia.filter(t => t.tipo === 'Venta').reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0),
                compras: transaccionesDelDia.filter(t => t.tipo === 'Compra').reduce((sum, t) => sum + (parseFloat(t.monto_total_usd) || 0), 0),
                gastos: transaccionesDelDia.filter(t => t.tipo === 'Gasto').reduce((sum, t) => sum + (parseFloat(t.monto_gasto) || 0), 0),
                deliveries: transaccionesDelDia.filter(t => t.delivery === true).length,
                utilidad: calcularUtilidad(transaccionesDelDia, transacciones.filter(t => t.tipo === 'Compra'), config.costos_fijos)
            };
            controlActual.estado = 'cerrado';
            controlActual.cierreTimestamp = new Date().toISOString();
            controlActual.saldosFinales = saldosFinales;
            controlActual.resumen = resumen;
            let historialCierres = safeJSONParse('historial_cierres', []);
            historialCierres.push(controlActual);
            localStorage.setItem('historial_cierres', JSON.stringify(historialCierres));
            localStorage.setItem('control_diario', JSON.stringify(controlActual));
            showToast(`Jornada del ${formatFechaCorta(controlActual.fecha)} cerrada exitosamente.`, 'success');
            recalcularYRenderizarTodo();
        };

        if (controlDiarioBtn) { controlDiarioBtn.addEventListener('click', abrirModalControlDiario); }
        if (closeControlDiarioModalBtn) { closeControlDiarioModalBtn.addEventListener('click', () => modalControlDiario.classList.remove('active')); }
        if (modalControlDiario) {
            modalControlDiario.addEventListener('click', (e) => {
                if (e.target.id === 'modal-iniciar-dia-btn') {
                    const transacciones = safeJSONParse('transacciones', []);
                    const config = safeJSONParse('configuracion', { bancos: [] });
                    const saldosActuales = calcularSaldos(config.bancos, transacciones);
                    const nuevoControl = { fecha: getHoyYMD(), estado: 'abierto', inicioTimestamp: new Date().toISOString(), saldosIniciales: saldosActuales, cierreTimestamp: null, saldosFinales: null, resumen: null };
                    localStorage.setItem('control_diario', JSON.stringify(nuevoControl));
                    showToast('¡Jornada iniciada exitosamente!', 'success');
                    modalControlDiario.classList.remove('active');
                    recalcularYRenderizarTodo();
                }
                if (e.target.id === 'modal-cerrar-dia-btn') {
                    cerrarJornada();
                    modalControlDiario.classList.remove('active');
                }
            });
        }
        document.getElementById('export-excel-btn').addEventListener('click', (e) => {
            const transacciones = filtrarTransacciones(safeJSONParse('transacciones', []), filtroActual);
            let data = [["Fecha", "Hora", "Operacion", "Cliente", "Tasa", "Monto", "Banco", "Saldo Pendiente", "Estatus", "Observacion"]];
            transacciones.forEach(t => data.push(getRowDataForExport(t)));
            const csvContent = "data:text/csv;charset=utf-8," + data.map(e => e.join(";")).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", generarNombreArchivo() + '.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
        document.getElementById('export-pdf-btn').addEventListener('click', (e) => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape' });
            const transacciones = filtrarTransacciones(safeJSONParse('transacciones', []), filtroActual);
            let data = transacciones.map(t => getRowDataForExport(t));
            const tableHeaders = ["Fecha", "Hora", "Operación", "Cliente", "Tasa", "Monto", "Banco", "Saldo Pendiente", "Estatus", "Observación"];
            doc.text("Historial de Transacciones", 14, 20);
            doc.autoTable({ head: [tableHeaders], body: data, startY: 30, styles: { fontSize: 7, cellPadding: 2, halign: 'center' }, headStyles: { fillColor: [0, 128, 128], textColor: [255, 255, 255], halign: 'center' } });
            doc.save(generarNombreArchivo() + '.pdf');
        });
        if (debtList) { debtList.addEventListener('click', (e) => {
            if (e.target.classList.contains('pagar-deuda-btn')) {
                const transaccionId = e.target.dataset.id;
                const transacciones = safeJSONParse('transacciones', []);
                const deuda = transacciones.find(t => t.id == transaccionId);
                if (deuda) {
                    modalTitle.textContent = `Registrar Abono de ${deuda.cliente}`;
                    deudaActualInfo.textContent = `$${formatNumber(deuda.saldo_pendiente_usd)}`;
                    montoPagoInput.value = deuda.saldo_pendiente_usd.toFixed(2);
                    deudaTransaccionIdInput.value = transaccionId;
                    modalPago.classList.add('active');
                }
            }
        }); }
        if (formPagoDeuda) { formPagoDeuda.addEventListener('submit', (e) => {
            e.preventDefault();
            const transaccionId = deudaTransaccionIdInput.value;
            const montoPagado = parseFloat(montoPagoInput.value);
            if (!transaccionId || isNaN(montoPagado) || montoPagado <= 0) { showToast('Monto inválido.', 'error'); return; }
            let transacciones = safeJSONParse('transacciones', []);
            const transaccionOriginal = transacciones.find(t => t.id == transaccionId);
            if (transaccionOriginal && montoPagado <= transaccionOriginal.saldo_pendiente_usd + 0.001) {
                transaccionOriginal.saldo_pendiente_usd -= montoPagado;
                if (transaccionOriginal.saldo_pendiente_usd < 0.01) {
                    transaccionOriginal.saldo_pendiente_usd = 0;
                    transaccionOriginal.estatus = 'Entregado';
                }
                transacciones.push({ id: Date.now(), tipo: 'Pago Cliente', cliente: transaccionOriginal.cliente, monto_pago_usd: montoPagado, fechaHora: new Date().toISOString(), id_transaccion_original: transaccionId, estatus: 'Pagado' });
                localStorage.setItem('transacciones', JSON.stringify(transacciones));
                showToast('¡Pago registrado exitosamente!', 'success');
                modalPago.classList.remove('active');
                recalcularYRenderizarTodo();
            } else {
                showToast('El monto del pago no puede ser mayor que la deuda.', 'error');
            }
        }); }
        if (closeModalBtn) { closeModalBtn.addEventListener('click', () => modalPago.classList.remove('active')); }
        if (modalPago) { modalPago.addEventListener('click', (e) => { if (e.target === modalPago) modalPago.classList.remove('active'); }); }
        
        // --- CORRECCIÓN AQUÍ ---
        document.querySelectorAll('.card .tabs .tab-link').forEach(link => {
             link.addEventListener('click', (e) => {
                const parentCard = e.target.closest('.card');
                parentCard.querySelectorAll('.tabs .tab-link, .tab-content').forEach(el => el.classList.remove('active'));
                e.target.classList.add('active');
                const tabContentId = e.target.dataset.tab;
                if(tabContentId) {
                    parentCard.querySelector(`#${tabContentId}`).classList.add('active');
                    // Si la pestaña es la de historial, se renderiza la lista de nuevo
                    if (tabContentId === 'tab-historial') {
                        renderizarHistorialCierres();
                    }
                }
            });
        });

        document.querySelectorAll('#modal-configuracion .tabs .tab-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const parentModal = e.target.closest('.modal-content');
                parentModal.querySelectorAll('.tabs .tab-link, .tab-content').forEach(el => el.classList.remove('active'));
                e.target.classList.add('active');
                const tabContentId = e.target.dataset.tabContent;
                if(tabContentId) {
                    parentModal.querySelector(`#${tabContentId}`).classList.add('active');
                    if (tabContentId === 'tab-usuarios') { renderizarUsuarios(); }
                    if (tabContentId === 'tab-historial') { renderizarHistorialCierres(); } // Esto es para el modal, está bien
                }
            });
        });
        document.getElementById('form-add-cuenta').addEventListener('submit', (e) => {
            e.preventDefault();
            let config = safeJSONParse('configuracion', { bancos: [], costos_fijos: [], fees: {} });
            const idCuenta = document.getElementById('nombre-cuenta-select').value;
            const nombreCuenta = document.getElementById('nombre-cuenta-select').options[document.getElementById('nombre-cuenta-select').selectedIndex].text;
            const saldoAingresar = parseFormattedNumber(document.getElementById('saldo-cuenta').value);
            const concepto = document.getElementById('saldo-concepto').value;
            if (!idCuenta || (isNaN(saldoAingresar) || saldoAingresar === 0)) { showToast('Seleccione cuenta e ingrese un saldo válido.','error'); return; }
            if (!config.bancos.find(b => b.id === idCuenta)) { config.bancos.push({ id: idCuenta, nombre: nombreCuenta }); }
            let transacciones = safeJSONParse('transacciones', []);
            transacciones.push({ id: Date.now(), tipo: 'Ingreso Saldo', cuenta_propia_id: idCuenta, monto_ingreso: saldoAingresar, fechaHora: new Date().toISOString(), estatus: 'Completado', concepto: concepto });
            localStorage.setItem('configuracion', JSON.stringify(config));
            localStorage.setItem('transacciones', JSON.stringify(transacciones));
            showToast('Saldo ingresado correctamente.', 'success');
            e.target.reset();
            recalcularYRenderizarTodo();
        });
        document.getElementById('form-transferencia').addEventListener('submit', (e) => {
             e.preventDefault();
            const origenId = document.getElementById('cuenta-origen').value;
            const destinoId = document.getElementById('cuenta-destino').value;
            const monto = parseFormattedNumber(document.getElementById('monto-transferencia').value);
            const concepto = document.getElementById('transferencia-concepto').value;
            if (!origenId || !destinoId || !monto || monto <= 0) { showToast('Los campos Desde, Hacia y Monto son obligatorios.', 'error'); return; }
            if (origenId === destinoId) { showToast('Las cuentas no pueden ser la misma.', 'error'); return; }
            let transacciones = safeJSONParse('transacciones', []);
            let config = safeJSONParse('configuracion', {});
            const saldosActuales = calcularSaldos(config.bancos, transacciones);
            const cuentaOrigen = saldosActuales.find(b => b.id === origenId);
            if (!cuentaOrigen || cuentaOrigen.saldo < monto) { showToast('Saldo insuficiente en la cuenta de origen.', 'error'); return; }
            transacciones.push({ id: Date.now(), tipo: 'Transferencia Propia', cuenta_propia_id: origenId, cuenta_destino_id: destinoId, monto_transferencia: monto, fechaHora: new Date().toISOString(), estatus: 'Completado', concepto: concepto });
            localStorage.setItem('transacciones', JSON.stringify(transacciones));
            showToast('Transferencia registrada exitosamente.', 'success');
            e.target.reset();
            recalcularYRenderizarTodo();
        });
        if (formGasto) {
            formGasto.addEventListener('submit', (e) => {
                e.preventDefault();
                const cuentaOrigenId = document.getElementById('gasto-cuenta-origen').value;
                const monto = parseFormattedNumber(document.getElementById('gasto-monto').value);
                const concepto = document.getElementById('gasto-concepto').value;
                if (!cuentaOrigenId || !monto || monto <= 0 || !concepto) { showToast('Todos los campos son obligatorios.', 'error'); return; }
                let transacciones = safeJSONParse('transacciones', []);
                const config = safeJSONParse('configuracion', {});
                const saldosActuales = calcularSaldos(config.bancos, transacciones);
                const cuentaOrigen = saldosActuales.find(b => b.id === cuentaOrigenId);
                if (!cuentaOrigen || cuentaOrigen.saldo < monto) { showToast('Saldo insuficiente en la cuenta de origen.', 'error'); return; }
                transacciones.push({ id: Date.now(), tipo: 'Gasto', cuenta_origen_id: cuentaOrigenId, monto_gasto: monto, concepto: concepto, fechaHora: new Date().toISOString(), estatus: 'Completado' });
                localStorage.setItem('transacciones', JSON.stringify(transacciones));
                showToast('Gasto registrado exitosamente.', 'success');
                e.target.reset();
                recalcularYRenderizarTodo();
            });
        }
        if(formCostoFijo) {
            formCostoFijo.addEventListener('submit', (e) => {
                e.preventDefault();
                const nombre = document.getElementById('costo-fijo-nombre').value;
                const moneda = document.getElementById('costo-fijo-moneda').value;
                const monto = parseFormattedNumber(document.getElementById('costo-fijo-monto').value);
                if (!nombre || !moneda || !monto || monto <= 0) { showToast('Todos los campos son obligatorios.', 'error'); return; }
                const config = safeJSONParse('configuracion', { costos_fijos: [] });
                if (!config.costos_fijos) config.costos_fijos = [];
                config.costos_fijos.push({ id: Date.now(), nombre, moneda, monto });
                localStorage.setItem('configuracion', JSON.stringify(config));
                showToast('Costo fijo guardado.', 'success');
                e.target.reset();
                recalcularYRenderizarTodo();
            });
        }
        if (tablaCostosFijosBody) {
            tablaCostosFijosBody.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-costo-fijo')) {
                    const costoId = parseInt(e.target.dataset.id, 10);
                    const config = safeJSONParse('configuracion', { costos_fijos: [] });
                    config.costos_fijos = config.costos_fijos.filter(c => c.id !== costoId);
                    localStorage.setItem('configuracion', JSON.stringify(config));
                    showToast('Costo fijo eliminado.', 'success');
                    recalcularYRenderizarTodo();
                }
            });
        }
        if (formAddUser) {
            formAddUser.addEventListener('submit', (e) => {
                e.preventDefault();
                const newUsername = document.getElementById('new-username').value;
                const newPassword = document.getElementById('new-password').value;
                const newRole = document.getElementById('new-user-role').value;
                if (!newUsername || !newPassword || !newRole) { showToast('Todos los campos son obligatorios.', 'error'); return; }
                showToast(`Usuario "${newUsername}" añadido con el rol "${newRole}". (Simulado)`, 'success');
                e.target.reset();
            });
        }
        if (formMetas) {
            formMetas.addEventListener('submit', (e) => {
                e.preventDefault();
                const nuevasMetas = {
                    ventas: parseFormattedNumber(document.getElementById('meta-ventas').value),
                    compras: parseFormattedNumber(document.getElementById('meta-compras').value),
                    gastos: parseFormattedNumber(document.getElementById('meta-gastos').value),
                    utilidad: parseFormattedNumber(document.getElementById('meta-utilidad').value),
                    deliveries: parseInt(document.getElementById('meta-deliveries').value, 10) || 0,
                };
                let config = safeJSONParse('configuracion', {});
                config.metas = nuevasMetas;
                localStorage.setItem('configuracion', JSON.stringify(config));
                showToast('Metas guardadas exitosamente.', 'success');
                configModal.classList.remove('active');
                recalcularYRenderizarTodo();
            });
        }
        document.querySelectorAll('.button-filtro').forEach(btn => {
            btn.addEventListener('click', () => {
                filtroActual = { tipo: btn.dataset.filtro };
                if(fechaInicioInput) fechaInicioInput.value = ''; 
                if(fechaFinInput) fechaFinInput.value = '';
                recalcularYRenderizarTodo();
            });
        });
        document.getElementById('filtrar-rango-btn').addEventListener('click', () => {
            const inicio = fechaInicioInput.value;
            const fin = fechaFinInput.value;
            if (!inicio || !fin) { showToast('Debe seleccionar ambas fechas.', 'error'); return; }
            const fechaInicio = new Date(inicio); const fechaFin = new Date(fin);
            if (fechaFin < fechaInicio) { showToast('La fecha de fin no puede ser anterior a la de inicio.', 'error'); return; }
            const diffDias = Math.ceil(Math.abs(fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1;
            if (diffDias > 90) { showToast('El rango no puede exceder los 90 días.', 'error'); return; }
            filtroActual = { tipo: 'rango', inicio: inicio, fin: fin };
            recalcularYRenderizarTodo();
        });
        document.getElementById('limpiar-filtros-btn').addEventListener('click', () => {
            filtroActual = { tipo: 'todos' };
            if(fechaInicioInput) fechaInicioInput.value = ''; 
            if(fechaFinInput) fechaFinInput.value = '';
            recalcularYRenderizarTodo();
        });
        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('usuario-autenticado');
            window.location.href = 'index.html';
        });
        if (settingsBtn) { 
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                configModal.classList.add('active');
                renderizarFees();
                renderizarCostosFijos();
                renderizarMetas();
                renderizarHistorialCierres();
            }); 
        }
        if (closeConfigBtn) {
            closeConfigBtn.addEventListener('click', () => configModal.classList.remove('active'));
        }
        if (utilidadesCard) {
            utilidadesCard.addEventListener('click', (e) => {
                if (e.target.classList.contains('ver-detalles-cierre-btn')) {
                    const header = e.target.closest('.cierre-header');
                    const details = header.nextElementSibling;
                    const timestamp = header.dataset.timestamp;
                    const historial = safeJSONParse('historial_cierres', []);
                    const cierre = historial.find(c => c.inicioTimestamp === timestamp);

                    if (details.style.display === 'block') {
                        details.style.display = 'none';
                        e.target.textContent = 'Ver Detalles';
                    } else {
                        let saldosInicialesHTML = '';
                        cierre.saldosIniciales.forEach(c => saldosInicialesHTML += `<li>${c.nombre}: ${c.id === 'Custodia $' ? '$' : 'Bs.'} ${formatNumber(c.saldo)}</li>`);
                        let saldosFinalesHTML = '';
                        cierre.saldosFinales.forEach(c => saldosFinalesHTML += `<li>${c.nombre}: ${c.id === 'Custodia $' ? '$' : 'Bs.'} ${formatNumber(c.saldo)}</li>`);

                        details.innerHTML = `
                            <h5>Saldos Iniciales</h5><ul>${saldosInicialesHTML}</ul>
                            <h5>Resumen de Operaciones</h5>
                            <ul>
                                <li>Ventas Totales: $${formatNumber(cierre.resumen.ventas)}</li>
                                <li>Compras Totales: $${formatNumber(cierre.resumen.compras)}</li>
                                <li>Gastos Totales: Bs. ${formatNumber(cierre.resumen.gastos)}</li>
                                <li>Utilidad Neta: Bs. ${formatNumber(cierre.resumen.utilidad)}</li>
                                <li>Nº de Deliveries: ${cierre.resumen.deliveries}</li>
                            </ul>
                            <h5>Saldos Finales</h5><ul>${saldosFinalesHTML}</ul>`;
                        details.style.display = 'block';
                        e.target.textContent = 'Ocultar Detalles';
                    }
                }

                if (e.target.classList.contains('descargar-cierre-btn')) {
                    const header = e.target.closest('.cierre-header');
                    const timestamp = header.dataset.timestamp;
                    const historial = safeJSONParse('historial_cierres', []);
                    const cierre = historial.find(c => c.inicioTimestamp === timestamp);
                    if(cierre) generarPdfCierre(cierre);
                }
            });
        }
        
        autoFormatNumberInput('saldo-cuenta');
        autoFormatNumberInput('monto-transferencia');
        autoFormatNumberInput('gasto-monto');
        autoFormatNumberInput('costo-fijo-monto');
        autoFormatNumberInput('meta-ventas');
        autoFormatNumberInput('meta-compras');
        autoFormatNumberInput('meta-gastos');
        autoFormatNumberInput('meta-utilidad');
        
        if (typeof inicializarGraficos === 'function') {
            inicializarGraficos();
        }
        recalcularYRenderizarTodo();

    } catch (error) {
        console.error("Error fatal al iniciar el dashboard:", error);
        showToast("Ha ocurrido un error grave.", 'error');
    }
});