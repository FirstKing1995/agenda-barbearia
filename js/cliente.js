/* Página do cliente: vitrine da barbearia, agendamento em 4 passos e "Meus horários". */
(function () {
  'use strict';
  var esc = U.esc, ic = U.icone;
  if (API.alvo.modo === 'nenhum') API.usarDemo();
  var demo = API.alvo.modo === 'demo';
  var CHAVE_EU = 'agenda_eu_' + (demo ? 'demo' : API.alvo.url);
  var app = document.getElementById('app');
  var info = null;
  var escolha = { servicos: [], profissionalId: null, data: null, hora: null, horarios: null };

  function eu() { try { return JSON.parse(localStorage.getItem(CHAVE_EU)) || { reservas: [] }; } catch (e) { return { reservas: [] }; } }
  function guardarEu(d) { localStorage.setItem(CHAVE_EU, JSON.stringify(d)); }

  if (demo) {
    document.getElementById('faixa').innerHTML = '<div class="faixa-demo">' + ic('science') +
      '<span>Demonstração: o que você marcar aqui fica só neste aparelho.</span>' +
      '<a href="painel.html?demo=1">Ver o painel do dono</a></div>';
  }

  function carregar() {
    API.chamar('info').then(function (d) {
      info = d;
      U.aplicarTema(d.config);
      document.title = d.config.nome + ' | Agendar horário';
      if (location.hash === '#meus') telaMeus(); else telaInicio();
    }).catch(function (e) {
      app.innerHTML = '<div class="centro" style="min-height:70vh"><div class="caixa"><div class="cartao" style="text-align:center">' +
        ic('cloud_off', 'grande') + '<h2 style="margin:10px 0">Agenda fora do ar</h2><p class="texto-suave">' + esc(e.message) +
        '</p><button class="btn btn-destaque btn-grande" style="margin-top:16px" id="denovo">Tentar de novo</button></div></div></div>';
      document.getElementById('denovo').onclick = carregar;
    });
  }

  function servico(id) { return info.servicos.filter(function (s) { return s.id === id; })[0]; }
  function prof(id) { return info.profissionais.filter(function (p) { return p.id === id; })[0]; }
  function rolarTopo() { window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); }

  // ------------------------------------------------------------
  // Início
  // ------------------------------------------------------------
  function telaInicio() {
    var c = info.config, contatos = [];
    if (c.endereco) contatos.push('<a target="_blank" rel="noopener" href="' + esc(c.mapa || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.endereco))) + '">' + ic('location_on') + esc(c.endereco) + '</a>');
    if (c.whatsapp) contatos.push('<a target="_blank" rel="noopener" href="' + esc(U.linkWhats(c.whatsapp)) + '">' + ic('chat') + 'WhatsApp</a>');
    if (c.telefone) contatos.push('<a href="tel:' + esc(c.telefone.replace(/\D/g, '')) + '">' + ic('call') + esc(U.telefone(c.telefone)) + '</a>');
    if (c.instagram) contatos.push('<a target="_blank" rel="noopener" href="https://instagram.com/' + esc(c.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')) + '">' + ic('photo_camera') + '@' + esc(c.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')) + '</a>');
    var temReservas = eu().reservas.length > 0;
    var logo = c.logo ? '<img class="logo" src="' + esc(c.logo) + '" alt="' + esc(c.nome) + '">' : '<div class="monograma">' + esc(U.iniciais(c.nome)) + '</div>';
    var semAgenda = !info.servicos.length || !info.profissionais.length;
    app.innerHTML =
      '<header class="capa">' + logo + '<h1>' + esc(c.nome) + '</h1>' + (c.slogan ? '<p class="slogan">' + esc(c.slogan) + '</p>' : '') +
      (contatos.length ? '<div class="contatos">' + contatos.join('') + '</div>' : '') +
      '<div class="acoes-capa">' +
      (semAgenda ? '<div class="cartao texto-suave" style="text-align:center">A agenda online abre em breve. Fale com a gente pelo WhatsApp.</div>'
        : '<button class="btn btn-destaque btn-grande" id="agendar">' + ic('calendar_add_on') + 'Agendar horário</button>') +
      '<button class="btn btn-fantasma" id="meus">' + ic('event_note') + 'Meus horários' + (temReservas ? '' : '') + '</button></div></header>' +
      (info.servicos.length ? '<section class="secao"><h2>Serviços</h2><div class="cardapio">' + info.servicos.map(function (s) {
        return '<div class="item-menu"><div><b>' + esc(s.nome) + '</b><small>' + esc(U.duracao(s.duracao)) + (s.descricao ? ' · ' + esc(s.descricao) : '') + '</small></div><span class="preco">' + esc(U.dinheiro(s.valor)) + '</span></div>';
      }).join('') + '</div></section>' : '') +
      (info.profissionais.length ? '<section class="secao"><h2>Equipe</h2><div class="escolhas">' + info.profissionais.map(function (p) {
        return '<div class="escolha" style="cursor:default">' + U.avatar(p.nome, p.foto) + '<div class="meio"><b>' + esc(p.nome) + '</b><small>' +
          esc(p.dias.sort().map(function (d) { return U.DIAS_CURTOS[d]; }).join(', ')) + '</small></div></div>';
      }).join('') + '</div></section>' : '') +
      (c.sobre ? '<section class="secao"><h2>Sobre</h2><p class="sobre">' + esc(c.sobre) + '</p></section>' : '') +
      '<p class="rodape-cli">Agendamento online</p>';
    var b = document.getElementById('agendar');
    if (b) b.onclick = function () { escolha = { servicos: [], profissionalId: null, data: null, hora: null }; passoServicos(); };
    document.getElementById('meus').onclick = telaMeus;
  }

  function topoPasso(n, titulo, voltar) {
    var trilha = '';
    for (var i = 1; i <= 4; i++) trilha += '<i class="' + (i <= n ? 'feito' : '') + '"></i>';
    return '<div class="passos-topo"><button class="btn-icone" id="voltar" aria-label="Voltar">' + ic('arrow_back') + '</button><h2>' + esc(titulo) + '</h2><span class="texto-suave pequeno">' + n + ' de 4</span></div><div class="trilha">' + trilha + '</div>';
  }
  function ligarVoltar(fn) { document.getElementById('voltar').onclick = fn; }

  function somas() {
    var v = 0, t = 0;
    escolha.servicos.forEach(function (id) { var s = servico(id); if (s) { v += s.valor; t += s.duracao; } });
    return { valor: v, duracao: t };
  }

  // ------------------------------------------------------------
  // Passo 1: serviços
  // ------------------------------------------------------------
  function passoServicos() {
    rolarTopo();
    app.innerHTML = topoPasso(1, 'Serviços') + '<p class="texto-suave" style="margin-bottom:12px">Escolha um ou mais.</p><div class="escolhas" id="lista">' +
      info.servicos.map(function (s) {
        var m = escolha.servicos.indexOf(s.id) >= 0;
        return '<button class="escolha' + (m ? ' marcada' : '') + '" data-id="' + esc(s.id) + '"><span class="marca">' + ic('check') + '</span><span class="meio"><b>' + esc(s.nome) +
          '</b><small>' + esc(U.duracao(s.duracao)) + (s.descricao ? ' · ' + esc(s.descricao) : '') + '</small></span><span class="preco">' + esc(U.dinheiro(s.valor)) + '</span></button>';
      }).join('') + '</div><div class="barra-total escondido" id="barra"><div class="dentro"><div class="soma"><b id="soma-v"></b><small id="soma-t"></small></div>' +
      '<button class="btn btn-destaque" id="seguir">Continuar ' + ic('arrow_forward') + '</button></div></div>';
    ligarVoltar(telaInicio);
    function atualizar() {
      var s = somas(), barra = document.getElementById('barra');
      barra.classList.toggle('escondido', !escolha.servicos.length);
      document.getElementById('soma-v').textContent = U.dinheiro(s.valor);
      document.getElementById('soma-t').textContent = escolha.servicos.length + ' serviço' + (escolha.servicos.length > 1 ? 's' : '') + ' · ' + U.duracao(s.duracao);
    }
    U.$$('#lista .escolha').forEach(function (el) {
      el.onclick = function () {
        var id = el.dataset.id, i = escolha.servicos.indexOf(id);
        if (i >= 0) escolha.servicos.splice(i, 1); else escolha.servicos.push(id);
        el.classList.toggle('marcada', i < 0);
        atualizar();
      };
    });
    document.getElementById('seguir').onclick = passoProfissional;
    atualizar();
  }

  // ------------------------------------------------------------
  // Passo 2: profissional
  // ------------------------------------------------------------
  function candidatos() {
    return info.profissionais.filter(function (p) {
      return escolha.servicos.every(function (s) { return p.servicos.indexOf(s) >= 0; });
    });
  }
  function passoProfissional() {
    rolarTopo();
    var lista = candidatos();
    var html = topoPasso(2, 'Profissional');
    if (!lista.length) {
      html += '<div class="cartao vazio">' + ic('content_cut') + 'Nenhum profissional faz todos esses serviços juntos. Volte e escolha de outro jeito.</div>';
    } else {
      html += '<div class="escolhas" id="lista">' + (lista.length > 1 ? '<button class="escolha" data-id="qualquer"><span class="avatar avatar-letra">' + ic('groups') +
        '</span><span class="meio"><b>Sem preferência</b><small>O primeiro livre no horário que você escolher</small></span>' + ic('chevron_right') + '</button>' : '') +
        lista.map(function (p) {
          return '<button class="escolha" data-id="' + esc(p.id) + '">' + U.avatar(p.nome, p.foto) + '<span class="meio"><b>' + esc(p.nome) + '</b><small>Atende ' +
            esc(p.dias.sort().map(function (d) { return U.DIAS_CURTOS[d]; }).join(', ')) + '</small></span>' + ic('chevron_right') + '</button>';
        }).join('') + '</div>';
    }
    app.innerHTML = html;
    ligarVoltar(passoServicos);
    U.$$('#lista .escolha').forEach(function (el) {
      el.onclick = function () { escolha.profissionalId = el.dataset.id; escolha.data = null; escolha.hora = null; passoHorario(); };
    });
  }

  // ------------------------------------------------------------
  // Passo 3: dia e horário
  // ------------------------------------------------------------
  function diasQueAtende() {
    var ps = escolha.profissionalId === 'qualquer' ? candidatos() : [prof(escolha.profissionalId)];
    var d = {}; ps.forEach(function (p) { (p ? p.dias : []).forEach(function (x) { d[x] = true; }); });
    return d;
  }
  function passoHorario() {
    rolarTopo();
    var atende = diasQueAtende(), hoje = info.hoje, total = Math.min(info.config.diasAFrente, 45), botoes = '', primeiroLivre = null;
    for (var i = 0; i <= total; i++) {
      var d = U.somarDias(hoje, i), ds = Nucleo.util.diaSemana(d), ok = !!atende[ds];
      if (ok && !primeiroLivre) primeiroLivre = d;
      botoes += '<button class="dia" data-d="' + d + '"' + (ok ? '' : ' disabled') + '><small>' + (i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : U.DIAS_CURTOS[ds]) +
        '</small><b>' + parseInt(d.slice(8, 10), 10) + '</b><small>' + U.MESES[parseInt(d.slice(5, 7), 10) - 1].slice(0, 3) + '</small></button>';
    }
    var p = escolha.profissionalId === 'qualquer' ? null : prof(escolha.profissionalId);
    app.innerHTML = topoPasso(3, 'Dia e horário') +
      '<p class="texto-suave" style="margin-bottom:12px">' + (p ? 'Com ' + esc(p.nome) : 'Sem preferência de profissional') + ' · ' + esc(U.duracao(somas().duracao)) + '</p>' +
      '<div class="dias" id="dias">' + botoes + '</div><div id="horas"></div>' +
      '<div class="barra-total escondido" id="barra"><div class="dentro"><div class="soma"><b id="esc-hora"></b><small id="esc-dia"></small></div>' +
      '<button class="btn btn-destaque" id="seguir">Continuar ' + ic('arrow_forward') + '</button></div></div>';
    ligarVoltar(passoProfissional);
    U.$$('#dias .dia').forEach(function (b) { b.onclick = function () { escolherDia(b.dataset.d); }; });
    document.getElementById('seguir').onclick = passoDados;
    var alvo = escolha.data || primeiroLivre;
    if (alvo) escolherDia(alvo, escolha.hora, escolha.data ? 0 : 1);
    else document.getElementById('horas').innerHTML = '<div class="cartao vazio">' + ic('event_busy') + 'Sem dias de atendimento nas próximas semanas.</div>';
  }
  function escolherDia(d, manterHora, pularVazio) {
    escolha.data = d; escolha.hora = manterHora || null;
    U.$$('#dias .dia').forEach(function (b) { b.classList.toggle('marcado', b.dataset.d === d); });
    var marc = U.$('#dias .dia.marcado'); if (marc) marc.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    var caixa = document.getElementById('horas');
    caixa.innerHTML = '<div class="vazio"><span class="giro" style="display:inline-block"></span></div>';
    document.getElementById('barra').classList.toggle('escondido', !escolha.hora);
    API.chamar('horarios', { data: d, profissionalId: escolha.profissionalId, servicos: escolha.servicos }).then(function (r) {
      if (escolha.data !== d) return;
      escolha.horarios = r.horarios;
      if (!r.horarios.length && pularVazio && pularVazio < 8) {
        var prox = U.$$('#dias .dia').filter(function (b) { return !b.disabled && b.dataset.d > d; })[0];
        if (prox) { escolherDia(prox.dataset.d, null, pularVazio + 1); return; }
      }
      if (!r.horarios.length) { caixa.innerHTML = '<div class="cartao vazio">' + ic('event_busy') + 'Sem horários livres em ' + esc(U.dataLonga(d)) + '. Tente outro dia.</div>'; return; }
      var grupos = [['Manhã', 0, 720], ['Tarde', 720, 1080], ['Noite', 1080, 1440]], html = '';
      grupos.forEach(function (g) {
        var hs = r.horarios.filter(function (h) { var m = Nucleo.util.paraMin(h.hora); return m >= g[1] && m < g[2]; });
        if (!hs.length) return;
        html += '<p class="turno-titulo">' + g[0] + '</p><div class="horas">' + hs.map(function (h) {
          return '<button class="hora' + (h.hora === escolha.hora ? ' marcada' : '') + '" data-h="' + h.hora + '">' + h.hora + '</button>';
        }).join('') + '</div>';
      });
      caixa.innerHTML = html;
      U.$$('#horas .hora').forEach(function (b) {
        b.onclick = function () {
          escolha.hora = b.dataset.h;
          U.$$('#horas .hora').forEach(function (x) { x.classList.toggle('marcada', x === b); });
          document.getElementById('esc-hora').textContent = escolha.hora;
          document.getElementById('esc-dia').textContent = U.dataLonga(d);
          document.getElementById('barra').classList.remove('escondido');
        };
      });
      if (escolha.hora && !r.horarios.some(function (h) { return h.hora === escolha.hora; })) { escolha.hora = null; document.getElementById('barra').classList.add('escondido'); }
      else if (escolha.hora) { document.getElementById('esc-hora').textContent = escolha.hora; document.getElementById('esc-dia').textContent = U.dataLonga(d); }
    }).catch(function (e) { caixa.innerHTML = '<div class="cartao vazio">' + ic('error') + esc(e.message) + '</div>'; });
  }

  // ------------------------------------------------------------
  // Passo 4: dados e confirmação
  // ------------------------------------------------------------
  function passoDados() {
    rolarTopo();
    var c = info.config, me = eu(), s = somas();
    var p = escolha.profissionalId === 'qualquer' ? null : prof(escolha.profissionalId);
    app.innerHTML = topoPasso(4, 'Confirmar') +
      '<div class="cartao resumo" style="margin-bottom:18px">' +
      '<div class="linha">' + ic('event') + '<div><b>' + esc(U.dataLonga(escolha.data)) + '</b><div class="texto-suave">' + esc(escolha.hora) + ' · ' + esc(U.duracao(s.duracao)) + '</div></div></div>' +
      '<div class="linha">' + ic('person') + '<div>' + (p ? esc(p.nome) : 'Sem preferência') + '</div></div>' +
      '<div class="linha">' + ic('content_cut') + '<div>' + escolha.servicos.map(function (id) { return esc(servico(id).nome); }).join(', ') + '</div></div>' +
      '<div class="total"><span class="texto-suave">Total no local</span><b>' + esc(U.dinheiro(s.valor)) + '</b></div></div>' +
      '<form id="form" novalidate>' +
      '<div class="campo"><label for="f-nome">Seu nome</label><input id="f-nome" autocomplete="name" required maxlength="80" value="' + esc(me.nome || '') + '"></div>' +
      '<div class="campo"><label for="f-zap">WhatsApp</label><input id="f-zap" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 91234-5678" required value="' + esc(U.telefone(me.whatsapp || '')) + '"></div>' +
      (c.pedirEmail ? '<div class="campo"><label for="f-email">E-mail <span class="ajuda">(opcional, para receber o lembrete)</span></label><input id="f-email" type="email" autocomplete="email" maxlength="120" value="' + esc(me.email || '') + '"></div>' : '') +
      (c.pedirNascimento ? '<div class="campo"><label for="f-nasc">Data de nascimento <span class="ajuda">(opcional)</span></label><input id="f-nasc" type="date" value="' + esc(me.nascimento || '') + '"></div>' : '') +
      '<div class="campo"><label for="f-obs">Observação <span class="ajuda">(opcional)</span></label><input id="f-obs" maxlength="300" placeholder="Ex.: quero tirar só as laterais"></div>' +
      '<button class="btn btn-destaque btn-grande" id="confirmar" type="submit">' + ic('check_circle') + 'Confirmar agendamento</button>' +
      (c.cancelarAteHoras ? '<p class="texto-suave pequeno" style="text-align:center;margin-top:10px">Se precisar, você cancela por aqui até ' + c.cancelarAteHoras + 'h antes.</p>' : '') +
      '</form>';
    ligarVoltar(passoHorario);
    var zap = document.getElementById('f-zap');
    zap.addEventListener('input', function () {
      var d = zap.value.replace(/\D/g, '').slice(0, 11);
      zap.value = d.length > 2 ? '(' + d.slice(0, 2) + ') ' + (d.length > 7 ? d.slice(2, 7) + '-' + d.slice(7) : d.slice(2)) : d;
    });
    document.getElementById('form').onsubmit = function (ev) {
      ev.preventDefault();
      var dados = {
        nome: document.getElementById('f-nome').value.trim(),
        whatsapp: zap.value.replace(/\D/g, ''),
        email: c.pedirEmail ? document.getElementById('f-email').value.trim() : '',
        nascimento: c.pedirNascimento ? document.getElementById('f-nasc').value : '',
        obs: document.getElementById('f-obs').value.trim()
      };
      if (dados.nome.length < 2) { U.aviso('Escreva seu nome.', 'erro'); return; }
      if (dados.whatsapp.length < 10) { U.aviso('Confira o WhatsApp com DDD.', 'erro'); return; }
      var btn = document.getElementById('confirmar');
      U.ocupado(btn, true, 'Confirmando');
      API.chamar('agendar', Object.assign({ data: escolha.data, inicio: escolha.hora, profissionalId: escolha.profissionalId, servicos: escolha.servicos }, dados))
        .then(function (r) {
          var me = eu();
          me.nome = dados.nome; me.whatsapp = dados.whatsapp; me.email = dados.email; me.nascimento = dados.nascimento;
          me.reservas = (me.reservas || []).filter(function (x) { return x.data >= info.hoje; });
          me.reservas.push({ codigo: r.agendamento.codigo, data: r.agendamento.data, inicio: r.agendamento.inicio });
          guardarEu(me);
          telaSucesso(r.agendamento);
        }).catch(function (e) {
          U.ocupado(btn, false);
          U.aviso(e.message, 'erro');
          if (/ocupado/.test(e.message)) { escolha.hora = null; setTimeout(passoHorario, 900); }
        });
    };
  }

  function linkAgenda(a) {
    var c = info.config;
    var ini = a.data.replace(/-/g, '') + 'T' + a.inicio.replace(':', '') + '00', fim = a.data.replace(/-/g, '') + 'T' + a.fim.replace(':', '') + '00';
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(a.servicos + ' na ' + c.nome) +
      '&dates=' + ini + '/' + fim + '&ctz=America/Sao_Paulo&details=' + encodeURIComponent('Com ' + a.profissional.nome + '. Código ' + a.codigo) +
      (c.endereco ? '&location=' + encodeURIComponent(c.endereco) : '');
  }
  function textoComprovante(a) {
    return 'Olá! Acabei de agendar pelo site.\n\nNome: ' + a.cliente.nome + '\nData: ' + U.dataBR(a.data) + ' às ' + a.inicio +
      '\nProfissional: ' + a.profissional.nome + '\nServiços: ' + a.servicos + '\nTotal: ' + U.dinheiro(a.valor) + '\nCódigo: ' + a.codigo;
  }

  function telaSucesso(a) {
    rolarTopo();
    var c = info.config;
    app.innerHTML = '<div class="sucesso"><div class="selo">' + ic('check', 'ic-cheio') + '</div><h1 style="font-size:40px">Agendado</h1>' +
      '<p class="texto-suave" style="margin-top:8px">' + esc(U.dataLonga(a.data)) + ', às ' + esc(a.inicio) + ', com ' + esc(a.profissional.nome) + '.</p>' +
      '<p class="texto-suave pequeno" style="margin-top:18px">Código da reserva</p><p class="codigo">' + esc(a.codigo) + '</p>' +
      '<p class="texto-suave pequeno">Guarde o código. Ele já ficou salvo neste aparelho, em Meus horários.</p></div>' +
      '<div class="acoes-capa">' +
      (c.whatsapp ? '<a class="btn btn-whats btn-grande" target="_blank" rel="noopener" href="' + esc(U.linkWhats(c.whatsapp, textoComprovante(a))) + '">' + ic('chat') + 'Enviar comprovante no WhatsApp</a>' : '') +
      '<a class="btn btn-fantasma" target="_blank" rel="noopener" href="' + esc(linkAgenda(a)) + '">' + ic('calendar_month') + 'Salvar na minha agenda</a>' +
      '<button class="btn btn-fantasma" id="meus">' + ic('event_note') + 'Meus horários</button>' +
      '<button class="btn btn-fantasma" id="inicio">' + ic('home') + 'Voltar ao início</button></div>';
    document.getElementById('meus').onclick = telaMeus;
    document.getElementById('inicio').onclick = telaInicio;
  }

  // ------------------------------------------------------------
  // Meus horários
  // ------------------------------------------------------------
  function telaMeus() {
    rolarTopo();
    var me = eu();
    app.innerHTML = '<div class="passos-topo"><button class="btn-icone" id="voltar" aria-label="Voltar">' + ic('arrow_back') + '</button><h2>Meus horários</h2></div>' +
      '<div id="lista-meus" class="escolhas"></div>' +
      '<div class="cartao" style="margin-top:18px"><h3 style="font-size:18px;text-transform:uppercase;margin-bottom:10px">Buscar uma reserva</h3>' +
      '<form id="busca"><div class="duas"><div class="campo"><label for="b-zap">WhatsApp</label><input id="b-zap" type="tel" inputmode="tel" value="' + esc(U.telefone(me.whatsapp || '')) + '"></div>' +
      '<div class="campo"><label for="b-cod">Código</label><input id="b-cod" maxlength="6" style="text-transform:uppercase" placeholder="ABC234"></div></div>' +
      '<button class="btn btn-fantasma" type="submit" style="width:100%">' + ic('search') + 'Buscar</button></form></div>';
    ligarVoltar(telaInicio);
    var codigos = (me.reservas || []).map(function (r) { return r.codigo; });
    if (me.whatsapp && codigos.length) buscar(me.whatsapp, codigos);
    else document.getElementById('lista-meus').innerHTML = '<div class="cartao vazio">' + ic('event_available') + 'Nenhuma reserva salva neste aparelho.</div>';
    document.getElementById('busca').onsubmit = function (ev) {
      ev.preventDefault();
      var z = document.getElementById('b-zap').value.replace(/\D/g, ''), cod = document.getElementById('b-cod').value.trim().toUpperCase();
      if (!z || cod.length !== 6) { U.aviso('Informe o WhatsApp e o código de 6 letras.', 'erro'); return; }
      buscar(z, codigos.concat([cod]), cod);
    };
  }
  function buscar(zap, codigos, procurado) {
    var caixa = document.getElementById('lista-meus');
    caixa.innerHTML = '<div class="vazio"><span class="giro" style="display:inline-block"></span></div>';
    API.chamar('meusHorarios', { whatsapp: zap, codigos: codigos }).then(function (r) {
      var lista = r.agendamentos.filter(function (a) { return a.status !== 'cancelado'; });
      if (procurado && !r.agendamentos.some(function (a) { return a.codigo === procurado; })) U.aviso('Não achamos essa reserva. Confira o código e o WhatsApp.', 'erro');
      if (procurado && r.agendamentos.some(function (a) { return a.codigo === procurado; })) {
        var me = eu(), achado = r.agendamentos.filter(function (a) { return a.codigo === procurado; })[0];
        if (!me.reservas.some(function (x) { return x.codigo === procurado; })) { me.reservas.push({ codigo: procurado, data: achado.data, inicio: achado.inicio }); me.whatsapp = me.whatsapp || zap; guardarEu(me); }
      }
      if (!lista.length) { caixa.innerHTML = '<div class="cartao vazio">' + ic('event_available') + 'Nenhum horário marcado daqui para a frente.</div>'; return; }
      caixa.innerHTML = lista.map(function (a) {
        return '<div class="cartao reserva"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b style="font-size:18px">' + esc(U.dataLonga(a.data)) +
          ', ' + esc(a.inicio) + '</b><span class="pilula ' + esc(a.status) + '">' + esc(a.status) + '</span></div><div class="texto-suave">' + esc(a.servicos) + ' com ' +
          esc(a.profissional.nome) + ' · ' + esc(U.dinheiro(a.valor)) + '</div><div class="texto-suave pequeno">Código ' + esc(a.codigo) + '</div>' +
          '<div class="acoes"><a class="btn btn-fantasma btn-p" target="_blank" rel="noopener" href="' + esc(linkAgenda(a)) + '">' + ic('calendar_month') + 'Agenda</a>' +
          (a.status === 'confirmado' ? '<button class="btn btn-fantasma btn-p" data-cancelar="' + esc(a.codigo) + '">' + ic('event_busy') + 'Cancelar</button>' : '') + '</div></div>';
      }).join('');
      U.$$('[data-cancelar]').forEach(function (b) {
        b.onclick = function () {
          U.confirmar('Cancelar horário', 'O horário volta a ficar livre para outra pessoa.', 'Cancelar horário', true).then(function (sim) {
            if (!sim) return;
            U.ocupado(b, true, 'Cancelando');
            API.chamar('cancelar', { codigo: b.dataset.cancelar, whatsapp: zap }).then(function () {
              U.aviso('Horário cancelado.');
              buscar(zap, codigos);
            }).catch(function (e) { U.ocupado(b, false); U.aviso(e.message, 'erro'); });
          });
        };
      });
    }).catch(function (e) { caixa.innerHTML = '<div class="cartao vazio">' + ic('error') + esc(e.message) + '</div>'; });
  }

  carregar();
})();
