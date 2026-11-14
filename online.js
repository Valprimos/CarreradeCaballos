/* Sala online con Supabase Realtime (Broadcast + Presence). No usa tablas ni SQL.
   Si config.js está vacío, Online.disponible() es false y la web usa el modo sin servidor. */
(function () {
  'use strict';
  const cfg = window.CARRERA_ONLINE || {};
  const ok = !!(cfg.url && cfg.key && window.supabase && window.supabase.createClient);
  const miId = Math.random().toString(36).slice(2, 10);
  let cliente = null, canal = null;

  // Conectados: primero quien creó la sala (el anfitrión) y luego por orden de llegada.
  const lista = () => (canal
    ? Object.entries(canal.presenceState()).map(([id, m]) => Object.assign({ id }, m[0]))
        .sort((a, b) => ((b.creador ? 1 : 0) - (a.creador ? 1 : 0)) || (a.t - b.t) || (a.id < b.id ? -1 : 1))
    : []);

  window.Online = {
    disponible: () => ok,
    soyAnfitrion() { const l = lista(); return l.length > 0 && l[0].id === miId; },
    entrar(codigo, jugadores, h, creador) {
      if (!ok) return;
      this.salir();
      cliente = cliente || window.supabase.createClient(cfg.url, cfg.key);
      const t = Date.now();
      canal = cliente.channel('sala:' + codigo, { config: { broadcast: { self: true }, presence: { key: miId } } });
      canal
        .on('presence', { event: 'sync' }, () => h.alCambiar(lista()))
        .on('presence', { event: 'join' }, () => h.alUnirse())
        .on('broadcast', { event: 'inicio' }, m => h.alInicio(m.payload))
        .on('broadcast', { event: 'turno' }, m => h.alTurno(m.payload))
        .subscribe(estado => {
          if (estado === 'SUBSCRIBED') canal.track({ t, jugadores, creador: !!creador });   // también al reconectar
          else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') h.alError();
        });
    },
    enviarTurno(p) { if (canal) canal.send({ type: 'broadcast', event: 'turno', payload: p }); },
    enviarInicio(p) { if (canal) canal.send({ type: 'broadcast', event: 'inicio', payload: p }); },
    salir() { if (canal && cliente) { try { cliente.removeChannel(canal); } catch (e) { /* nada */ } } canal = null; }
  };
})();
