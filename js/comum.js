/* Utilidades das telas (cliente, painel e ligar). */
(function () {
  'use strict';
  var U = {};

  U.esc = function (s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  U.$ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  U.$$ = function (sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); };
  U.icone = function (nome, classe) { return '<span class="ic' + (classe ? ' ' + classe : '') + '" aria-hidden="true">' + nome + '</span>'; };
  U.dinheiro = function (v) { return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  U.duracao = function (m) { return Nucleo.util.duracaoTexto(m); };
  U.dataBR = function (s) { return Nucleo.util.dataBR(s); };
  U.DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  U.DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  U.MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  U.dataLonga = function (s) {
    var p = s.split('-'), d = Nucleo.util.diaSemana(s);
    return U.DIAS[d] + ', ' + parseInt(p[2], 10) + ' de ' + U.MESES[parseInt(p[1], 10) - 1];
  };
  U.hojeLocal = function () {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  };
  U.somarDias = function (s, n) { return Nucleo.util.somarDias(s, n); };
  U.telefone = function (d) {
    d = String(d || '').replace(/\D/g, '');
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return d;
  };
  U.linkWhats = function (numero, texto) {
    var d = String(numero || '').replace(/\D/g, '');
    if (d && d.length <= 11) d = '55' + d;
    return 'https://wa.me/' + d + (texto ? '?text=' + encodeURIComponent(texto) : '');
  };
  U.iniciais = function (nome) {
    var p = String(nome || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  };
  U.avatar = function (nome, foto, classe) {
    if (foto && /^data:image\//.test(foto)) return '<img class="avatar ' + (classe || '') + '" src="' + U.esc(foto) + '" alt="">';
    return '<span class="avatar avatar-letra ' + (classe || '') + '">' + U.esc(U.iniciais(nome)) + '</span>';
  };

  // Cores e tema vindos da personalização
  function luminancia(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    function c(x) { return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
  }
  U.aplicarTema = function (cfg) {
    var raiz = document.documentElement, cor = /^#[0-9a-fA-F]{6}$/.test(cfg.corDestaque || '') ? cfg.corDestaque : '#C8A04A';
    raiz.setAttribute('data-tema', cfg.tema === 'claro' ? 'claro' : 'escuro');
    raiz.style.setProperty('--destaque', cor);
    raiz.style.setProperty('--sobre-destaque', luminancia(cor) > 0.35 ? '#141414' : '#ffffff');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', cfg.tema === 'claro' ? '#f6f3ee' : '#111214');
  };

  // Aviso rápido
  U.aviso = function (msg, tipo) {
    var el = document.getElementById('aviso');
    if (!el) { el = document.createElement('div'); el.id = 'aviso'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.className = 'aviso mostrar ' + (tipo || '');
    el.textContent = msg;
    clearTimeout(U._avisoT);
    U._avisoT = setTimeout(function () { el.className = 'aviso'; }, tipo === 'erro' ? 5200 : 3000);
  };

  // Janela (modal)
  U.janela = function (opcoes) {
    var fundo = document.createElement('div');
    fundo.className = 'janela-fundo';
    fundo.innerHTML = '<div class="janela" role="dialog" aria-modal="true" aria-label="' + U.esc(opcoes.titulo || '') + '">' +
      '<div class="janela-topo"><h3>' + U.esc(opcoes.titulo || '') + '</h3><button class="btn-icone" data-fechar aria-label="Fechar">' + U.icone('close') + '</button></div>' +
      '<div class="janela-corpo">' + (opcoes.html || '') + '</div>' +
      (opcoes.rodape ? '<div class="janela-rodape">' + opcoes.rodape + '</div>' : '') + '</div>';
    document.body.appendChild(fundo);
    document.body.classList.add('sem-rolagem');
    function fechar() { fundo.remove(); if (!document.querySelector('.janela-fundo')) document.body.classList.remove('sem-rolagem'); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') fechar(); }
    document.addEventListener('keydown', esc);
    fundo.addEventListener('click', function (e) { if (e.target === fundo || e.target.closest('[data-fechar]')) fechar(); });
    var primeiro = fundo.querySelector('input,select,textarea');
    if (primeiro && opcoes.foco !== false) setTimeout(function () { primeiro.focus(); }, 30);
    return { el: fundo, fechar: fechar };
  };
  U.confirmar = function (titulo, texto, rotulo, perigo) {
    return new Promise(function (ok) {
      var j = U.janela({ titulo: titulo, html: '<p class="texto-suave">' + U.esc(texto) + '</p>', foco: false,
        rodape: '<button class="btn btn-fantasma" data-fechar>Voltar</button><button class="btn ' + (perigo ? 'btn-perigo' : 'btn-destaque') + '" data-sim>' + U.esc(rotulo || 'Confirmar') + '</button>' });
      j.el.querySelector('[data-sim]').addEventListener('click', function () { j.fechar(); ok(true); });
      j.el.addEventListener('click', function (e) { if (e.target.closest('[data-fechar]') || e.target === j.el) ok(false); });
    });
  };

  // Botão ocupado
  U.ocupado = function (btn, sim, texto) {
    if (!btn) return;
    if (sim) { btn.dataset.texto = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="giro" aria-hidden="true"></span>' + U.esc(texto || 'Aguarde'); }
    else { btn.disabled = false; if (btn.dataset.texto) btn.innerHTML = btn.dataset.texto; }
  };

  // Reduz a imagem para caber na planilha
  U.comprimirImagem = function (arquivo, lado, tipo, limite) {
    return new Promise(function (ok, falha) {
      if (!arquivo || !/^image\//.test(arquivo.type)) { falha(new Error('Escolha um arquivo de imagem.')); return; }
      var leitor = new FileReader();
      leitor.onerror = function () { falha(new Error('Não deu para ler a imagem.')); };
      leitor.onload = function () {
        var img = new Image();
        img.onerror = function () { falha(new Error('Imagem inválida.')); };
        img.onload = function () {
          var tentativa = lado;
          function gerar() {
            var esc = Math.min(1, tentativa / Math.max(img.width, img.height));
            var c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.width * esc)); c.height = Math.max(1, Math.round(img.height * esc));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            var url = c.toDataURL(tipo || 'image/webp', 0.82);
            if (url.indexOf('data:image/webp') !== 0 && tipo === 'image/webp') url = c.toDataURL('image/png');
            if (url.length > limite && tentativa > 48) { tentativa = Math.round(tentativa * 0.75); return gerar(); }
            ok(url);
          }
          gerar();
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  };

  U.copiar = function (texto) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texto).then(function () { U.aviso('Copiado.'); });
    var t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); U.aviso('Copiado.'); } catch (e) { U.aviso('Não deu para copiar. Selecione e copie.', 'erro'); }
    t.remove(); return Promise.resolve();
  };

  U.preencher = function (modelo, valores) { return Nucleo.util.preencher(modelo, valores); };

  window.U = U;
})();
