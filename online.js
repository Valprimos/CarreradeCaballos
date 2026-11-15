/* Sala online con Supabase Realtime (Broadcast + Presence). No usa tablas ni SQL.
   Si config.js está vacío, Online.disponible() es false y la web usa el modo sin servidor.
   Solo el anfitrión (quien creó la sala, o el siguiente si se va) puede mandar órdenes:
   cada mensaje lleva quién lo envía y los demás ignoran los que no vienen del anfitrión. */
(function () {
  'use strict';
  const cfg = window.CARRERA_ONLINE || {};
  const ok = !!(cfg.url && cfg.key && window.supabase && window.supabase.createClient);
  const miId = Math.random().toString(36).slice(2, 10);
  let cliente = null, canal = null, hooks = null, tConexion = 0, conectado = false;

  // Conectados: primero quien creó la sala (el anfitrión) y luego por orden de llegada.
  const lista = () => (canal
    ? Object.entries(canal.presenceState()).map(([id, m]) => Object.assign({ id }, m[0]))
        .sort((a, b) => ((b.creador ? 1 : 0) - (a.creador ? 1 : 0)) || (a.t - b.t) || (a.id < b.id ? -1 : 1))
    : []);
  const delAnfitrion = p => { const l = lista(); return !!p && (l.length === 0 || l[0].id === p.de); };
  const enviar = (evento, p) => {
    if (!canal || !Online.soyAnfitrion()) return;
    canal.send({ type: 'broadcast', event: evento, payload: Object.assign({}, p, { de: miId }) });
  };

  const Online = window.Online = {
    disponible: () => ok,
    miId,
    soyAnfitrion() { const l = lista(); return l.length > 0 && l[0].id === miId; },
    entrar(codigo, jugadores, h, creador) {
      if (!ok) return;
      this.salir();
      hooks = h; conectado = false;
      cliente = cliente || window.supabase.createClient(cfg.url, cfg.key);
      const t = Date.now();
      const mio = canal = cliente.channel('sala:' + codigo, { config: { broadcast: { self: true }, presence: { key: miId } } });
      mio
        .on('presence', { event: 'sync' }, () => h.alCambiar(lista()))
        .on('presence', { event: 'join' }, () => h.alUnirse())
        .on('broadcast', { event: 'inicio' }, m => { if (delAnfitrion(m.payload)) h.alInicio(m.payload); })
        .on('broadcast', { event: 'turno' }, m => { if (delAnfitrion(m.payload)) h.alTurno(m.payload); })
        .on('broadcast', { event: 'modo' }, m => { if (delAnfitrion(m.payload)) h.alModo(m.payload); })
        .subscribe(estado => {
          if (canal !== mio) return;                                   // ya hemos salido de esa sala
          if (estado === 'SUBSCRIBED') {
            conectado = true; clearTimeout(tConexion); h.alEstado('ok');
            mio.track({ t, jugadores, creador: !!creador });           // también al reconectar
          } else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') { conectado = false; h.alEstado('reconectando'); h.alError(); }
          else if (estado === 'CLOSED') { conectado = false; h.alEstado('reconectando'); }
        });
      h.alEstado('reconectando');
      tConexion = setTimeout(() => { if (canal === mio && !conectado) { h.alEstado('error'); h.alError('timeout'); } }, 8000);
    },
    enviarInicio: p => enviar('inicio', p),
    enviarTurno: p => enviar('turno', p),
    enviarModo: p => enviar('modo', p),
    salir() {
      clearTimeout(tConexion);
      if (canal && cliente) { try { cliente.removeChannel(canal); } catch (e) { /* nada */ } }
      canal = null;
      const h = hooks; hooks = null;
      if (h && h.alEstado) h.alEstado('fuera');
    }
  };
})();
