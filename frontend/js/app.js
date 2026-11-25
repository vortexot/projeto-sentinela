/* Hospital São Lucas — sessão, navegação, avisos e utilitários compartilhados */
(function () {
  const CHAVE = "hsl_usuario";

  const PAGINAS = {
    atendimento:  { href: "atendimento.html",  label: "Atendimento",   icone: "🧾", perfis: ["atendimento", "admin"] },
    triagem:      { href: "triagem.html",      label: "Triagem",       icone: "🏥", perfis: ["triagem", "admin"] },
    medico:       { href: "medico.html",       label: "Consultas",     icone: "🩺", perfis: ["medico", "admin"] },
    medicacoes:   { href: "medicacoes.html",   label: "Prescrições",   icone: "💊", perfis: ["medico", "admin"] },
    almoxarifado: { href: "almoxarifado.html", label: "Almoxarifado",  icone: "📦", perfis: ["almoxarifado", "admin"] },
    admin:        { href: "admin.html",        label: "Usuários",      icone: "👥", perfis: ["admin"] }
  };
  const HOME = { atendimento: "atendimento.html", triagem: "triagem.html", medico: "medico.html", almoxarifado: "almoxarifado.html", admin: "admin.html" };
  const NOMES = { atendimento: "Atendimento", triagem: "Triagem", medico: "Médico", almoxarifado: "Almoxarifado", admin: "Administrador" };

  const App = {
    usuario() {
      try { return JSON.parse(sessionStorage.getItem(CHAVE)); } catch { return null; }
    },
    entrar(u) { sessionStorage.setItem(CHAVE, JSON.stringify(u)); location.href = HOME[u.tipo] || "index.html"; },
    sair() { sessionStorage.removeItem(CHAVE); location.href = "index.html"; },
    esc(t) {
      return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    },
    aviso(msg, tipo) {
      let box = document.getElementById("avisos");
      if (!box) { box = document.createElement("div"); box.id = "avisos"; box.setAttribute("role", "status"); document.body.appendChild(box); }
      const el = document.createElement("div");
      el.className = "aviso " + (tipo || "info");
      el.textContent = msg;
      box.appendChild(el);
      setTimeout(() => el.remove(), tipo === "alerta" ? 9000 : 4500);
    }
  };
  window.App = App;

  // alert() nativo vira aviso discreto; o tipo é deduzido pelo emoji da mensagem
  window.alert = function (msg) {
    const t = String(msg);
    const tipo = t.includes("✅") ? "ok" : t.includes("❌") ? "erro" : t.includes("⚠️") ? "alerta" : "info";
    App.aviso(t.replace(/^(✅|❌|⚠️)\s*/, ""), tipo);
  };

  function montarShell(pagina, u) {
    const links = Object.entries(PAGINAS)
      .filter(([, p]) => p.perfis.includes(u.tipo))
      .map(([k, p]) => `<a href="${p.href}" class="${k === pagina ? "ativo" : ""}">${p.icone} ${p.label}</a>`);
    if (["triagem", "medico", "admin"].includes(u.tipo)) {
      links.push(`<a href="tv.html" target="_blank" rel="noopener">📺 Painel TV</a>`);
    }
    const header = document.createElement("header");
    header.className = "topbar";
    header.innerHTML = `
      <a class="marca" href="${HOME[u.tipo]}"><img src="img/logo.jpg" alt=""><div><strong>Hospital São Lucas</strong><span>Gestão Hospitalar</span></div></a>
      <nav aria-label="Principal">${links.join("")}</nav>
      <div class="usuario">
        <span class="avatar">${App.esc(u.usuario.charAt(0).toUpperCase())}</span>
        <div><b>${App.esc(u.usuario)}</b><small>${NOMES[u.tipo] || u.tipo}</small></div>
        <button class="btn-sair" type="button">Sair</button>
      </div>`;
    header.querySelector(".btn-sair").addEventListener("click", App.sair);
    document.body.classList.add("com-shell");
    document.body.prepend(header);
  }

  document.addEventListener("DOMContentLoaded", function () {
    const pagina = document.body.dataset.pagina;
    if (!pagina || !PAGINAS[pagina]) return;          // login e TV não têm barra
    const u = App.usuario();
    if (!u && document.body.dataset.publica) {        // admin via atalho Ctrl+Alt+A
      const voltar = document.createElement("a");
      voltar.href = "index.html"; voltar.textContent = "← Voltar para o login";
      voltar.style.cssText = "position:fixed;top:14px;left:16px;z-index:50;font-weight:600;text-decoration:none";
      document.body.prepend(voltar);
      return;
    }
    if (!u) { location.replace("index.html"); return; }
    if (!PAGINAS[pagina].perfis.includes(u.tipo)) { location.replace(HOME[u.tipo] || "index.html"); return; }
    montarShell(pagina, u);
  });
})();
