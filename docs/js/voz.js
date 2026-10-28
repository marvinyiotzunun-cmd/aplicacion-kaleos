/* Kaleos: conversación por voz con el asistente del pastor.
   Con la clave de OpenAI usa la voz en tiempo real (WebRTC, como el modo de voz de ChatGPT);
   la clave vive en la función kaleos-voz y el teléfono solo recibe un pase de un minuto.
   Sin clave, conversa con el dictado y la voz del navegador. */
(function () {
  "use strict";
  const K = window.K, { esc, $, ic } = K;
  let S = null; // sesión activa

  // ===== pantalla =====
  function overlay() {
    const o = document.createElement("div");
    o.className = "voz"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Conversación por voz");
    o.innerHTML = `<div class="voz-top"><span class="eyebrow" id="vmode">Kaleos</span><button class="iconbtn" id="vmin" aria-label="Ver la pantalla">${ic("chev", "sm")}<span>Ver pantalla</span></button></div>
      <button class="orb" id="vorb" aria-label="Conversación activa"><i></i><i></i><i></i></button>
      <p class="voz-st" id="vst" aria-live="polite">Conectando…</p>
      <p class="voz-cap" id="vcap"></p>
      <div class="voz-acts"><button class="vbtn" id="vmute" aria-pressed="false" aria-label="Silenciar micrófono">${ic("mic")}</button><button class="vbtn end" id="vend" aria-label="Terminar">${ic("close")}</button></div>`;
    document.body.appendChild(o);
    $("#vend", o).addEventListener("click", () => K.voiceStop());
    $("#vmin", o).addEventListener("click", () => setMin(true));
    $("#vorb", o).addEventListener("click", () => { if (S && S.min) setMin(false); else if (S && S.tap) S.tap(); });
    $("#vmute", o).addEventListener("click", (e) => { if (!S) return; S.muted = !S.muted; e.currentTarget.setAttribute("aria-pressed", S.muted); if (S.mute) S.mute(S.muted); status(S.muted ? "Micrófono en silencio" : "Le escucho"); });
    requestAnimationFrame(() => o.classList.add("in"));
    return o;
  }
  const status = (t, state) => { if (!S) return; $("#vst", S.o).textContent = t; if (state) S.o.dataset.state = state; };
  const caption = (t) => { if (S) $("#vcap", S.o).textContent = t; };
  function setMin(v) { if (!S) return; S.min = v; S.o.classList.toggle("min", v); }

  // nivel del sonido para que la esfera respire
  function meter(stream, key) {
    try {
      const ac = S.ac || (S.ac = new (window.AudioContext || window.webkitAudioContext)());
      const an = ac.createAnalyser(); an.fftSize = 256;
      ac.createMediaStreamSource(stream).connect(an);
      S[key] = an;
    } catch (_) {}
  }
  function loop() {
    if (!S) return;
    const lv = (an) => { if (!an) return 0; const d = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(d); let t = 0; for (const x of d) t += x; return t / d.length / 255; };
    const v = Math.min(1, Math.max(lv(S.inA) * (S.muted ? 0 : 1), lv(S.outA) * 1.3) * 2.4);
    S.lv = S.lv * 0.7 + v * 0.3;
    S.o.style.setProperty("--lv", S.lv.toFixed(3));
    S.raf = requestAnimationFrame(loop);
  }
  const plain = (html) => { const d = document.createElement("div"); d.innerHTML = html; d.querySelectorAll("button,.acts,a").forEach((x) => x.remove()); return d.textContent.replace(/\s+/g, " ").trim(); };
  const pushChat = (who, text) => { if (!text) return; K.P.chat.push(who === "me" ? { who: "me", html: esc(text), text } : { who: "k", html: `<p>${esc(text)}</p>`, text }); };

  // ===== lo que el asistente puede hacer (mismas reglas de la base que el pastor) =====
  const dayRange = (n) => Array.from({ length: n }, (_, i) => K.addDays(K.today(), i));
  const TOOLS = {
    async ir_a({ seccion }) {
      if (!K.pastorSecs.some(([v]) => v === seccion)) return { error: "Esa sección no existe" };
      K.pastorGo(seccion); setMin(true);
      return { ok: true, abierta: K.pastorSecs.find(([v]) => v === seccion)[1] };
    },
    async ver_agenda({ dias = 1 }) {
      const D = K.pastorData, [people, reqs, evs, rems] = await Promise.all([K.people(), D.requests(), D.upcoming(), D.reminders()]);
      const days = new Set(dayRange(Math.min(7, Math.max(1, dias))));
      return {
        actividades: evs.filter((e) => days.has(K.dayOf(e.event_at))).map((e) => ({ titulo: e.title, cuando: K.fmtWhen(e.event_at), lugar: e.place || null })),
        recordatorios: rems.filter((r) => K.dayOf(r.due_at) <= [...days].pop()).map((r) => ({ titulo: r.title, cuando: K.fmtWhen(r.due_at) })),
        visitas: reqs.filter((r) => r.kind === "visita" && r.status !== "atendida").map((r) => ({ a: r.for_name || r.who?.full_name, fecha: r.for_date, nota: r.note })),
        cumpleanos: D.bdaysWithin(people, days.size).map(({ p, in: n }) => ({ nombre: p.full_name, en_dias: n })),
      };
    },
    async ver_pedidos() {
      const reqs = await K.pastorData.requests();
      return { pendientes: reqs.filter((r) => r.status !== "atendida").slice(0, 15).map((r) => ({ tipo: K.REQ[r.kind].n, de: r.who?.full_name, para: r.for_name, nota: r.note, estado: K.RSTAT[r.status][0] })) };
    },
    async ver_cumpleanos({ dias = 7 }) {
      return { cumpleanos: K.pastorData.bdaysWithin(await K.people(), Math.min(31, Math.max(1, dias))).map(({ p, in: n }) => ({ nombre: p.full_name, en_dias: n, cumple: (K.pastorData.age(p.birthday) || 0) + (n ? 1 : 0) || null })) };
    },
    async ver_cifras() {
      const [k, funds] = await Promise.all([K.giftKpis(), K.funds()]);
      return { mes: K.MONTHS[+K.today().slice(5, 7) - 1], confirmado_este_mes: k.cur, mes_pasado: k.prev, por_confirmar: k.rows.filter((g) => g.status !== "confirmado").length,
        proyectos: funds.filter((f) => f.active).map((f) => ({ nombre: f.name, tipo: f.kind, reunido: Number(f.got), meta: Number(f.goal), porcentaje: K.pct(f.got, f.goal) })) };
    },
    async buscar_hermano({ nombre }) {
      const q = String(nombre || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const people = await K.people(), comms = await K.communities();
      const hits = people.filter((p) => p.full_name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q)).slice(0, 5);
      return { hermanos: hits.map((p) => ({ nombre: p.full_name, numero: p.member_no, nivel: (K.LV[p.level] || K.LV.adherente).n, tiene_telefono: !!p.phone, cumpleanos: p.birthday ? K.fmtDate(p.birthday, "dm") : null, activo: p.active })),
        comunidades: comms.map((c) => c.name) };
    },
    async crear_recordatorio({ titulo, cuando }) {
      const due = cuando && !isNaN(new Date(cuando)) ? new Date(cuando).toISOString() : K.gtISO(K.addDays(K.today(), 1), "09:00");
      const { error } = await K.sb.from("kaleos_reminders").insert({ church_id: K.me.church_id, title: K.cap(String(titulo || "Recordatorio")), due_at: due });
      if (error) return { error: K.errMsg(error) };
      K.bust("rems"); return { ok: true, cuando: K.fmtWhen(due) };
    },
    async preparar_aviso({ titulo, detalle, cuando, lugar, comunidad }) {
      const comms = await K.communities(), c = comunidad ? comms.find((x) => x.slug === comunidad || x.name.toLowerCase() === String(comunidad).toLowerCase()) : null;
      setMin(true);
      K.annSheet({ prefill: { title: titulo || "", body: detalle || "", when: cuando || null, place: lugar || "", community: c ? c.id : null }, after: () => K.bust("upcoming") });
      return { ok: true, nota: "El editor del aviso quedó abierto en la pantalla; el pastor lo revisa y lo envía." };
    },
    async disenar_versiculo({ referencia, texto, estilo, color, formato }) {
      const st = K.P.studio;
      if (texto) Object.assign(st, { custom: true, ctext: texto, cref: referencia || "" });
      if (estilo && K.ART_KINDS[estilo]) st.kind = estilo;
      if (color && K.PAL[color]) st.pal = color;
      if (formato && ["cuadrado", "post", "historia"].includes(formato)) st.fmt = formato;
      st.seed = 1 + Math.floor(Math.random() * 90);
      K.pastorGo("versiculos"); setMin(true);
      return { ok: true, nota: "La imagen está en pantalla. El pastor la publica o la comparte con los botones." };
    },
    async preparar_tarjeta({ nombre }) {
      const q = String(nombre || "").toLowerCase(), p = (await K.people()).find((x) => x.full_name.toLowerCase().includes(q));
      if (!p) return { error: "No encontré a ese hermano" };
      setMin(true); K.greetBirthday(p);
      return { ok: true, nota: `La tarjeta para ${p.full_name} quedó abierta para revisarla y enviarla.` };
    },
  };

  // ===== voz en tiempo real (OpenAI) =====
  async function realtime() {
    const { data, error } = await K.sb.functions.invoke("kaleos-voz", { body: {} });
    if (error || !data || !data.token) throw new Error((data && data.error) || "sin_voz");
    const pc = new RTCPeerConnection(), audio = new Audio(); audio.autoplay = true;
    S.pc = pc;
    pc.ontrack = (e) => { audio.srcObject = e.streams[0]; meter(e.streams[0], "outA"); };
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    S.stream = mic; meter(mic, "inA");
    pc.addTrack(mic.getTracks()[0], mic);
    S.mute = (m) => mic.getTracks().forEach((t) => (t.enabled = !m));
    const dc = pc.createDataChannel("oai-events"); S.dc = dc;
    const send = (o) => dc.readyState === "open" && dc.send(JSON.stringify(o));
    let said = "";
    dc.addEventListener("open", () => {
      status("Le escucho", "listen");
      send({ type: "response.create", response: { instructions: "Salude al pastor en una frase corta y pregúntele en qué le ayuda." } });
    });
    dc.addEventListener("message", async (m) => {
      let e; try { e = JSON.parse(m.data); } catch (_) { return; }
      const t = e.type || "";
      if (t === "input_audio_buffer.speech_started") { status("Le escucho", "listen"); caption(""); }
      else if (t === "input_audio_buffer.speech_stopped") status("Pensando…", "think");
      else if (t === "conversation.item.input_audio_transcription.completed") pushChat("me", (e.transcript || "").trim());
      else if (/audio_transcript\.delta$/.test(t)) { said += e.delta || ""; caption(said.slice(-220)); status("Hablando", "speak"); }
      else if (t === "output_audio_buffer.stopped") status(S && S.muted ? "Micrófono en silencio" : "Le escucho", "listen");
      else if (t === "error") { status("Hubo un problema: " + ((e.error && e.error.message) || "intente de nuevo"), "listen"); }
      else if (t === "response.done") {
        if (said.trim()) { pushChat("k", said.trim()); said = ""; }
        const calls = ((e.response && e.response.output) || []).filter((o) => o.type === "function_call");
        if (!calls.length) return;
        status("Trabajando…", "think");
        for (const c of calls) {
          let args = {}; try { args = JSON.parse(c.arguments || "{}"); } catch (_) {}
          let out; try { out = TOOLS[c.name] ? await TOOLS[c.name](args) : { error: "Acción no permitida" }; } catch (err) { out = { error: K.errMsg(err) }; }
          send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: c.call_id, output: JSON.stringify(out) } });
        }
        send({ type: "response.create" });
      }
    });
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    const r = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", body: offer.sdp, headers: { Authorization: "Bearer " + data.token, "Content-Type": "application/sdp" } });
    if (!r.ok) throw new Error("No se pudo conectar la voz (" + r.status + ")");
    await pc.setRemoteDescription({ type: "answer", sdp: await r.text() });
    $("#vmode", S.o).textContent = "Kaleos · voz en tiempo real";
  }

  // ===== modo básico: dictado y voz del navegador =====
  function basic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { K.voiceStop(); return K.toast("Este navegador no permite conversar por voz. Escriba su pedido.", 4000); }
    $("#vmode", S.o).textContent = "Kaleos · modo básico";
    if (K.P.sec !== "asistente") K.pastorGo("asistente");
    const sp = window.speechSynthesis;
    const speak = (text) => new Promise((res) => {
      if (!sp || !text) return res();
      const u = new SpeechSynthesisUtterance(text.slice(0, 320)); u.lang = "es-MX"; u.rate = 1.02;
      const v = sp.getVoices().find((x) => /^es/i.test(x.lang)); if (v) u.voice = v;
      u.onend = u.onerror = res; status("Hablando", "speak"); caption(text.slice(0, 220)); sp.speak(u);
    });
    let rec = null;
    const listen = () => {
      if (!S || S.muted) return;
      rec = new SR(); rec.lang = "es-GT"; rec.interimResults = true; S.rec = rec;
      let final = "";
      rec.onresult = (e) => { const r = e.results[e.results.length - 1]; caption(r[0].transcript); if (r.isFinal) final = r[0].transcript; };
      rec.onerror = () => {};
      rec.onend = async () => {
        if (!S) return;
        if (!final.trim()) { status("Toque la esfera para hablar", "idle"); return; }
        status("Pensando…", "think");
        await K.pastorData.ask(final.trim());
        const last = K.P.chat[K.P.chat.length - 1];
        await speak(last ? plain(last.html) : "");
        if (S) listen();
      };
      status("Le escucho", "listen"); rec.start();
    };
    S.tap = () => { if (sp) sp.cancel(); try { rec && rec.abort(); } catch (_) {} setTimeout(listen, 120); };
    S.mute = (m) => { if (m) { try { rec && rec.abort(); } catch (_) {} } else listen(); };
    speak("Le escucho, pastor. ¿En qué le ayudo?").then(listen);
  }

  K.voiceStart = async () => {
    if (S) return setMin(false);
    S = { o: overlay(), lv: 0, muted: false, min: false };
    loop();
    try { await realtime(); }
    catch (_) {
      if (!S) return;
      if (S.pc) { try { S.pc.close(); } catch (e) {} S.pc = null; }
      if (S.stream) { S.stream.getTracks().forEach((t) => t.stop()); S.stream = null; }
      basic();
    }
  };
  K.voiceStop = () => {
    if (!S) return;
    const s = S; S = null;
    cancelAnimationFrame(s.raf);
    try { s.dc && s.dc.close(); s.pc && s.pc.close(); } catch (_) {}
    if (s.stream) s.stream.getTracks().forEach((t) => t.stop());
    try { s.rec && s.rec.abort(); } catch (_) {}
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    try { s.ac && s.ac.close(); } catch (_) {}
    s.o.classList.remove("in"); setTimeout(() => s.o.remove(), 250);
    if (K.mode === "pastor" && K.P.sec === "asistente") K.pastorGo("asistente");
  };
})();
