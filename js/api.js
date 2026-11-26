/*
 * Conexão com o servidor (Apps Script do cliente) ou com o modo demonstração.
 * Modo demonstração: o mesmo núcleo do servidor roda aqui no navegador e guarda tudo neste aparelho.
 */
(function () {
  'use strict';
  var CFG = window.AGENDA_CONFIG || {};
  var CHAVE_SERVIDOR = 'agenda_servidor';
  var CHAVE_DEMO = 'agenda_demo_v1';
  var params = new URLSearchParams(location.search);

  function hostPermitido(u) {
    try {
      var h = new URL(u).hostname;
      return h === 'script.google.com' || h === 'localhost' || h === '127.0.0.1';
    } catch (e) { return false; }
  }

  /** Aceita o ID da implantação, o endereço /exec ou um texto colado que contenha o endereço. */
  function normalizar(v) {
    v = String(v || '').trim();
    if (!v) return '';
    var m = v.match(/https:\/\/script\.google\.com\/(?:a\/macros\/[^\/\s]+|macros)\/s\/([\w-]+)\/(?:exec|dev)/);
    if (m) return 'https://script.google.com/macros/s/' + m[1] + '/exec';
    m = v.match(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/[\w\/-]*exec/);
    if (m) return m[0];
    if (/^AKfy[\w-]{20,}$/.test(v)) return 'https://script.google.com/macros/s/' + v + '/exec';
    return '';
  }
  function idCurto(url) {
    var m = /script\.google\.com\/macros\/s\/([\w-]+)\/exec/.exec(url || '');
    return m ? m[1] : url;
  }

  function resolver() {
    if (params.get('demo') === '1') return { modo: 'demo' };
    if (CFG.API_URL) return { modo: 'real', url: normalizar(CFG.API_URL) || CFG.API_URL, fixo: true };
    var b = params.get('b');
    if (b && window.AGENDA_PAGINA === 'cliente') {
      var u = normalizar(b);
      if (u && hostPermitido(u)) return { modo: 'real', url: u, doLink: true };
    }
    if (window.AGENDA_PAGINA === 'painel') {
      var salvo = localStorage.getItem(CHAVE_SERVIDOR);
      if (salvo && hostPermitido(salvo)) return { modo: 'real', url: salvo };
    }
    return { modo: 'nenhum' };
  }

  var alvo = resolver();

  // ---------------------------------------------------------------
  // Servidor real
  // ---------------------------------------------------------------
  function chamarReal(acao, dados) {
    var corpo = Object.assign({ acao: acao }, dados || {});
    return fetch(alvo.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corpo),
      redirect: 'follow'
    }).then(function (r) {
      if (!r.ok) throw new Error('O servidor respondeu ' + r.status + '.');
      return r.text();
    }).then(function (t) {
      try { return JSON.parse(t); }
      catch (e) { throw new Error('O servidor não respondeu como esperado. Confira se a implantação está como "Qualquer pessoa".'); }
    });
  }

  // ---------------------------------------------------------------
  // Modo demonstração
  // ---------------------------------------------------------------
  function aleatorio(n) {
    var a = new Uint8Array(n), s = '', abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
    crypto.getRandomValues(a);
    for (var i = 0; i < n; i++) s += abc[a[i] % abc.length];
    return s;
  }
  function agoraLocal() {
    var d = new Date();
    return { data: d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2),
      minutos: d.getHours() * 60 + d.getMinutes(), iso: d.toISOString() };
  }

  function semente() {
    var U = Nucleo.util, hoje = agoraLocal().data, est = { tabelas: {}, config: {}, segredos: {} };
    est.config = { nome: 'Barbearia Exemplo', slogan: 'Corte clássico, barba na navalha e hora marcada.',
      whatsapp: '11999990000', telefone: '1133330000', instagram: 'barbeariaexemplo',
      endereco: 'Rua das Tesouras, 120, Centro', mapa: '', corDestaque: '#C8A04A', tema: 'escuro',
      sobre: 'Ambiente climatizado, café por nossa conta e estacionamento ao lado.' };
    var sal = 'demo';
    est.segredos.senhaSal = sal;
    est.segredos.senhaHash = U.sha256(sal + ':demo');
    var serv = [['Corte', 45, 30, 'Tesoura e máquina, finalizado com pomada.'], ['Barba', 35, 30, 'Toalha quente e navalha.'],
      ['Corte e barba', 70, 60, 'O combo completo.'], ['Pigmentação', 30, 20, 'Disfarça falhas na barba ou no cabelo.'],
      ['Sobrancelha', 15, 10, 'Na navalha.'], ['Corte infantil', 35, 30, 'Até 12 anos.']];
    est.tabelas.Servicos = serv.map(function (s, i) { return { id: 's' + (i + 1), nome: s[0], valor: s[1], duracao: s[2], descricao: s[3], ativo: 'true', ordem: i + 1 }; });
    function turnos(dias, ini, almocoIni, almocoFim, fim) {
      var t = []; dias.forEach(function (d) { t.push({ dia: d, inicio: ini, fim: almocoIni }); t.push({ dia: d, inicio: almocoFim, fim: fim }); }); return t;
    }
    var semana = turnos([2, 3, 4, 5], '09:00', '12:00', '13:00', '19:00').concat([{ dia: 6, inicio: '08:00', fim: '14:00' }]);
    est.tabelas.Profissionais = [
      { id: 'p1', nome: 'Rafael', foto: '', telefone: '', servicos: '[]', turnos: JSON.stringify(semana), ativo: 'true', ordem: 1 },
      { id: 'p2', nome: 'Diego', foto: '', telefone: '', servicos: '["s1","s2","s3","s5"]', turnos: JSON.stringify(semana), ativo: 'true', ordem: 2 },
      { id: 'p3', nome: 'Marcos', foto: '', telefone: '', servicos: '["s1","s4","s6"]', turnos: JSON.stringify(turnos([1, 2, 3, 4, 5], '10:00', '13:00', '14:00', '20:00')), ativo: 'true', ordem: 3 }
    ];
    var nomes = ['Lucas Andrade', 'Bruno Costa', 'Felipe Rocha', 'Thiago Martins', 'André Souza', 'Gustavo Lima', 'Rodrigo Alves',
      'Vinícius Prado', 'Leandro Melo', 'Caio Ribeiro', 'Henrique Dias', 'Mateus Freitas'];
    est.tabelas.Clientes = nomes.map(function (n, i) {
      return { id: 'c' + (i + 1), nome: n, whatsapp: '119' + String(80000000 + i * 1371).slice(0, 8), email: '',
        nascimento: (1985 + i) + '-' + hoje.slice(5, 7) + '-' + ('0' + (3 + i * 2)).slice(-2), criadoEm: hoje + 'T12:00:00.000Z', obs: '' };
    }).map(function (c, i) { if (i > 3) c.nascimento = (1980 + i) + '-0' + (1 + (i % 9)) + '-15'; return c; });
    var ags = [], n = 0;
    var dias = Math.min(24, parseInt(hoje.slice(8, 10), 10) - 1);
    for (var d = -dias; d <= 3; d++) {
      var data = U.somarDias(hoje, d), ds = U.diaSemana(data);
      est.tabelas.Profissionais.forEach(function (p, pi) {
        var ts = JSON.parse(p.turnos).filter(function (t) { return t.dia === ds; });
        if (!ts.length) return;
        var horas = ['09:00', '10:30', '14:00', '15:30', '17:00'].filter(function (h, hi) { return (hi + pi + d + 30) % 3 !== 0; });
        horas.forEach(function (h) {
          var m = U.paraMin(h);
          if (!ts.some(function (t) { return m >= U.paraMin(t.inicio) && m + 60 <= U.paraMin(t.fim); })) return;
          var pode = JSON.parse(p.servicos); var lista = est.tabelas.Servicos.filter(function (s) { return !pode.length || pode.indexOf(s.id) >= 0; });
          var s = lista[(n * 7 + pi) % lista.length], c = est.tabelas.Clientes[(n * 5 + pi) % est.tabelas.Clientes.length];
          var status = d < 0 ? ((n % 17 === 0) ? 'faltou' : (n % 11 === 0 ? 'cancelado' : 'concluido')) : 'confirmado';
          ags.push({ id: 'a' + (++n), codigo: 'DEMO' + ('0' + (n % 100)).slice(-2), criadoEm: hoje + 'T10:00:00.000Z', data: data, inicio: h,
            fim: U.paraHora(m + s.duracao), duracao: s.duracao, profissionalId: p.id, profissionalNome: p.nome, clienteId: c.id,
            clienteNome: c.nome, whatsapp: c.whatsapp, servicos: s.nome, valor: s.valor, status: status, origem: n % 4 ? 'site' : 'painel', obs: '' });
        });
      });
    }
    est.tabelas.Agendamentos = ags;
    est.tabelas.Bloqueios = [];
    est.tabelas.Log = [{ quando: new Date().toISOString(), tipo: 'demo', detalhe: 'Demonstração criada' }];
    return est;
  }

  function lerDemo() {
    try { var e = JSON.parse(localStorage.getItem(CHAVE_DEMO)); if (e && e.tabelas) return e; } catch (x) {}
    var s = semente(); localStorage.setItem(CHAVE_DEMO, JSON.stringify(s)); return s;
  }
  function gravarDemo(e) {
    try { localStorage.setItem(CHAVE_DEMO, JSON.stringify(e)); }
    catch (x) { throw new Error('O armazenamento deste navegador encheu. Toque em "Recomeçar demonstração".'); }
  }

  function ctxDemo() {
    var est = lerDemo();
    var banco = {
      listar: function (t) { return (est.tabelas[t] || []).map(function (l) { return Object.assign({}, l); }); },
      inserir: function (t, o) { (est.tabelas[t] = est.tabelas[t] || []).push(Object.assign({}, o)); gravarDemo(est); },
      atualizar: function (t, id, c) {
        var l = (est.tabelas[t] || []).filter(function (x) { return String(x.id) === String(id); })[0];
        if (!l) throw new Error('Registro não encontrado');
        Object.assign(l, c); gravarDemo(est); return true;
      },
      remover: function (t, id) { est.tabelas[t] = (est.tabelas[t] || []).filter(function (x) { return String(x.id) !== String(id); }); gravarDemo(est); },
      lerConfig: function () { return Object.assign({}, est.config); },
      salvarConfig: function (c) { Object.assign(est.config, c); gravarDemo(est); },
      segredo: function (k) { return est.segredos[k] === undefined ? null : est.segredos[k]; },
      guardarSegredo: function (k, v) { est.segredos[k] = v; gravarDemo(est); }
    };
    return {
      banco: banco, agora: agoraLocal, aleatorio: aleatorio,
      http: function (pedidos) { return pedidos.map(function () { return { codigo: 200 }; }); },
      email: function () {}, emailDono: function () { return 'voce@gmail.com'; },
      travar: function (fn) { return fn(); },
      robos: function () {}
    };
  }

  function chamarDemo(acao, dados) {
    return new Promise(function (ok) {
      setTimeout(function () { ok(Nucleo.executar(ctxDemo(), Object.assign({ acao: acao }, dados || {}))); }, 120);
    });
  }

  // ---------------------------------------------------------------
  // Interface pública
  // ---------------------------------------------------------------
  var API = {
    alvo: alvo,
    normalizar: normalizar,
    hostPermitido: hostPermitido,
    usarDemo: function () { alvo = API.alvo = { modo: 'demo' }; },
    chamar: function (acao, dados) {
      var p = alvo.modo === 'demo' ? chamarDemo(acao, dados) : alvo.modo === 'real' ? chamarReal(acao, dados)
        : Promise.reject(new Error('Sistema não ligado.'));
      return p.then(function (r) {
        if (!r || !r.ok) {
          var e = new Error((r && r.erro) || 'Não foi possível concluir.'); e.sessao = r && r.sessao; e.detalhe = r && r.detalhe; throw e;
        }
        return r.dados;
      }, function (e) {
        if (e && e.message && /Failed to fetch|NetworkError|Load failed/i.test(e.message)) throw new Error('Sem conexão com o servidor. Confira a internet e tente de novo.');
        throw e;
      });
    },
    /** Testa um endereço antes de salvar (tela Ligar o sistema). */
    testar: function (url) {
      var antes = alvo; alvo = { modo: 'real', url: url };
      return API.chamar('info').then(function (d) { alvo = antes; return d; }, function (e) { alvo = antes; throw e; });
    },
    salvarServidor: function (url) { localStorage.setItem(CHAVE_SERVIDOR, url); },
    esquecerServidor: function () { localStorage.removeItem(CHAVE_SERVIDOR); },
    recomecarDemo: function () { localStorage.removeItem(CHAVE_DEMO); },
    chaveToken: function () { return 'agenda_token_' + (alvo.modo === 'demo' ? 'demo' : idCurto(alvo.url)); },
    linkCliente: function () {
      var base = location.href.split('?')[0].split('#')[0].replace(/[^\/]*$/, '');
      if (alvo.modo === 'demo') return base + '?demo=1';
      if (alvo.fixo) return base;
      return base + '?b=' + encodeURIComponent(idCurto(alvo.url));
    }
  };
  window.API = API;
})();
