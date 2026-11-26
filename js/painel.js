/* Painel do dono da barbearia. */
(function () {
  'use strict';
  var esc = U.esc, ic = U.icone, $ = U.$, $$ = U.$$;
  var raiz = document.getElementById('raiz');
  var demo = API.alvo.modo === 'demo';
  var T = { token: null, dados: null, dia: null, filtroProf: '', mes: null, clientes: null, busca: '' };
  var ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
  var STATUS_NOME = { confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado', faltou: 'Faltou' };

  var MENU = [
    ['agenda', 'calendar_month', 'Agenda'],
    ['resumo', 'monitoring', 'Resumo'],
    ['clientes', 'group', 'Clientes'],
    ['equipe', 'badge', 'Equipe e folgas'],
    ['servicos', 'content_cut', 'Serviços'],
    ['aparencia', 'palette', 'Aparência'],
    ['integracoes', 'hub', 'Integrações'],
    ['ajustes', 'tune', 'Ajustes']
  ];

  if (demo) {
    document.getElementById('faixa').innerHTML = '<div class="faixa-demo">' + ic('science') + '<span>Painel de demonstração. Tudo fica só neste aparelho.</span>' +
      '<a href="index.html?demo=1" target="_blank">Ver a página do cliente</a><a href="#" id="recomecar">Recomeçar</a></div>';
    document.getElementById('recomecar').onclick = function (e) { e.preventDefault(); API.recomecarDemo(); localStorage.removeItem(API.chaveToken()); location.reload(); };
  }

  // ------------------------------------------------------------
  // Chamadas com sessão
  // ------------------------------------------------------------
  function chamar(acao, dados) {
    return API.chamar(acao, Object.assign({ token: T.token }, dados || {})).catch(function (e) {
      if (e.sessao) { localStorage.removeItem(API.chaveToken()); T.token = null; telaEntrar(); }
      throw e;
    });
  }
  function falha(e) { U.aviso(e.message || String(e), 'erro'); }

  // ------------------------------------------------------------
  // Entrada
  // ------------------------------------------------------------
  function iniciar() {
    if (API.alvo.modo === 'nenhum') return telaSemServidor();
    T.token = localStorage.getItem(API.chaveToken());
    API.chamar('info').then(function (info) {
      U.aplicarTema(info.config);
      if (!info.configurado) { location.href = 'ligar.html?u=' + encodeURIComponent(API.alvo.url); return; }
      if (!T.token) {
        if (demo) return API.chamar('entrar', { senha: 'demo' }).then(function (r) { T.token = r.token; localStorage.setItem(API.chaveToken(), r.token); carregarTudo(); });
        return telaEntrar(info.config);
      }
      carregarTudo();
    }).catch(function (e) {
      raiz.innerHTML = '<div class="centro"><div class="caixa"><div class="cartao" style="text-align:center"><h2>Servidor sem resposta</h2><p class="texto-suave" style="margin:10px 0 16px">' +
        esc(e.message) + '</p><button class="btn btn-destaque btn-grande" id="denovo">Tentar de novo</button>' +
        '<a class="btn btn-fantasma" style="width:100%;margin-top:10px" href="ligar.html">Ligar outro endereço</a></div></div></div>';
      $('#denovo').onclick = iniciar;
    });
  }

  function telaSemServidor() {
    raiz.innerHTML = '<div class="centro"><div class="caixa"><div class="cartao"><div class="topo"><div class="monograma">' + ic('content_cut') + '</div>' +
      '<h1>Agenda Barbearia</h1><p class="texto-suave" style="margin-top:8px">Este aparelho ainda não está ligado a uma barbearia.</p></div>' +
      '<div class="opcoes-inicio"><a class="btn btn-destaque btn-grande" href="ligar.html">' + ic('bolt') + 'Ligar o sistema</a>' +
      '<a class="btn btn-fantasma" href="painel.html?demo=1">' + ic('science') + 'Ver a demonstração</a></div></div></div></div>';
  }

  function telaEntrar(cfg) {
    cfg = cfg || (T.dados && T.dados.config) || {};
    raiz.innerHTML = '<div class="centro"><div class="caixa"><div class="cartao"><div class="topo">' +
      (cfg.logo ? '<img class="logo" src="' + esc(cfg.logo) + '" alt="">' : '<div class="monograma">' + ic('lock') + '</div>') +
      '<h1>' + esc(cfg.nome || 'Painel') + '</h1><p class="texto-suave" style="margin-top:6px">Painel do dono</p></div>' +
      '<form id="f-entrar"><div class="campo"><label for="senha">Senha</label><input id="senha" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn btn-destaque btn-grande" id="b-entrar" type="submit">' + ic('login') + 'Entrar</button></form>' +
      '<p class="texto-suave pequeno" style="margin-top:14px;text-align:center">Esqueceu? Abra a planilha e use o menu Agenda Barbearia &gt; Esqueci a senha do painel.</p></div></div></div>';
    setTimeout(function () { $('#senha').focus(); }, 30);
    $('#f-entrar').onsubmit = function (ev) {
      ev.preventDefault();
      var b = $('#b-entrar'); U.ocupado(b, true, 'Entrando');
      API.chamar('entrar', { senha: $('#senha').value }).then(function (r) {
        T.token = r.token; localStorage.setItem(API.chaveToken(), r.token); carregarTudo();
      }).catch(function (e) { U.ocupado(b, false); falha(e); });
    };
  }

  function carregarTudo(rota) {
    return chamar('tudo').then(function (d) {
      T.dados = d; T.dia = T.dia || d.hoje; T.mes = T.mes || d.hoje.slice(0, 7);
      U.aplicarTema(d.config);
      document.title = 'Painel | ' + d.config.nome;
      if (!$('.painel')) montarCasca();
      else atualizarMarca();
      irPara(rota || location.hash.replace('#', '') || 'agenda');
    }).catch(function (e) { if (!e.sessao) falha(e); });
  }

  function montarCasca() {
    raiz.innerHTML = '<div class="topo-movel"><button class="btn-icone" id="abrir-menu" aria-label="Menu">' + ic('menu') + '</button><b id="nome-movel"></b></div>' +
      '<div class="painel"><nav class="lateral" id="lateral"><div class="marca-painel" id="marca"></div>' +
      MENU.map(function (m) { return '<a class="menu-item" href="#' + m[0] + '" data-rota="' + m[0] + '">' + ic(m[1]) + esc(m[2]) + '</a>'; }).join('') +
      '<div class="fim"><a class="menu-item" id="ver-pagina" target="_blank" rel="noopener">' + ic('open_in_new') + 'Página dos clientes</a>' +
      '<button class="menu-item" id="sair">' + ic('logout') + 'Sair</button></div></nav><main class="conteudo" id="conteudo"></main></div>';
    atualizarMarca();
    $('#ver-pagina').href = API.linkCliente();
    $('#abrir-menu').onclick = function () { abrirMenu(true); };
    $('#sair').onclick = function () {
      chamar('sair').catch(function () {}).then(function () { localStorage.removeItem(API.chaveToken()); location.href = demo ? 'ligar.html' : 'painel.html'; });
    };
    window.addEventListener('hashchange', function () { irPara(location.hash.replace('#', '')); });
  }
  function atualizarMarca() {
    var c = T.dados.config;
    $('#marca').innerHTML = (c.logo ? '<img src="' + esc(c.logo) + '" alt="">' : U.avatar(c.nome, '')) + '<b>' + esc(c.nome) + '</b>';
    $('#nome-movel').textContent = c.nome;
  }
  function abrirMenu(sim) {
    $('#lateral').classList.toggle('aberta', sim);
    var cort = $('.cortina');
    if (sim && !cort) { cort = document.createElement('div'); cort.className = 'cortina'; cort.onclick = function () { abrirMenu(false); }; document.body.appendChild(cort); }
    if (!sim && cort) cort.remove();
  }

  var TELAS = {};
  function irPara(rota) {
    if (!TELAS[rota]) rota = 'agenda';
    if (location.hash !== '#' + rota) history.replaceState(null, '', '#' + rota);
    $$('.menu-item[data-rota]').forEach(function (a) { a.classList.toggle('ativo', a.dataset.rota === rota); });
    abrirMenu(false);
    window.scrollTo(0, 0);
    TELAS[rota]($('#conteudo'));
  }
  function cabecalho(titulo, acoes) { return '<div class="cabecalho"><h1>' + esc(titulo) + '</h1><div class="acoes">' + (acoes || '') + '</div></div>'; }
  function carregando(el) { el.innerHTML += '<div class="vazio" id="carregando"><span class="giro" style="display:inline-block"></span></div>'; }
  function profNome(id) { var p = T.dados.profissionais.filter(function (x) { return x.id === id; })[0]; return p ? p.nome : ''; }
  function variaveis(a) {
    return { nome: (a.cliente.nome || '').split(' ')[0], barbearia: T.dados.config.nome, data: U.dataBR(a.data), hora: a.inicio,
      profissional: a.profissional.nome, servicos: a.servicos, codigo: a.codigo, valor: U.dinheiro(a.valor) };
  }

  // ------------------------------------------------------------
  // Agenda
  // ------------------------------------------------------------
  TELAS.agenda = function (el) {
    var d = T.dia, hoje = T.dados.hoje;
    var rotulo = d === hoje ? 'Hoje, ' + U.dataLonga(d).split(', ')[1] : d === U.somarDias(hoje, 1) ? 'Amanhã, ' + U.dataLonga(d).split(', ')[1] : U.dataLonga(d);
    el.innerHTML = cabecalho('Agenda', '<button class="btn btn-fantasma" id="lembrar">' + ic('notifications') + 'Lembrar amanhã</button>' +
      '<button class="btn btn-destaque" id="novo">' + ic('add') + 'Novo horário</button>') +
      '<div class="filtros"><div class="navdata"><button class="btn-icone" id="ant" aria-label="Dia anterior">' + ic('chevron_left') + '</button><b>' + esc(rotulo) +
      '</b><button class="btn-icone" id="prox" aria-label="Próximo dia">' + ic('chevron_right') + '</button></div>' +
      '<input type="date" class="entrada" id="data" value="' + d + '">' + (d !== hoje ? '<button class="btn btn-fantasma btn-p" id="hoje">Hoje</button>' : '') +
      '<select class="entrada" id="filtro"><option value="">Todos os profissionais</option>' + T.dados.profissionais.map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (T.filtroProf === p.id ? ' selected' : '') + '>' + esc(p.nome) + '</option>';
      }).join('') + '</select></div><div id="resumo-dia" class="texto-suave" style="margin-bottom:12px"></div><div class="lista-ag" id="lista"></div>';
    $('#ant').onclick = function () { T.dia = U.somarDias(d, -1); TELAS.agenda(el); };
    $('#prox').onclick = function () { T.dia = U.somarDias(d, 1); TELAS.agenda(el); };
    if ($('#hoje')) $('#hoje').onclick = function () { T.dia = hoje; TELAS.agenda(el); };
    $('#data').onchange = function () { if (this.value) { T.dia = this.value; TELAS.agenda(el); } };
    $('#filtro').onchange = function () { T.filtroProf = this.value; TELAS.agenda(el); };
    $('#novo').onclick = function () { janelaNovo(d); };
    $('#lembrar').onclick = janelaLembrar;
    var lista = $('#lista');
    lista.innerHTML = '<div class="vazio"><span class="giro" style="display:inline-block"></span></div>';
    chamar('agenda', { de: d, ate: d }).then(function (r) {
      var ags = r.agendamentos.filter(function (a) { return !T.filtroProf || a.profissional.id === T.filtroProf; });
      var ativos = ags.filter(function (a) { return a.status === 'confirmado' || a.status === 'concluido'; });
      var soma = ativos.reduce(function (t, a) { return t + a.valor; }, 0);
      $('#resumo-dia').textContent = ativos.length + ' atendimento' + (ativos.length === 1 ? '' : 's') + ' · ' + U.dinheiro(soma) + ' previsto';
      if (!ags.length) { lista.innerHTML = '<div class="cartao vazio">' + ic('event_available') + 'Nenhum horário neste dia.</div>'; return; }
      lista.innerHTML = ags.map(cartaoAgendamento).join('');
      ligarCartoes(lista, function () { TELAS.agenda(el); });
    }).catch(falha);
  };

  function cartaoAgendamento(a) {
    var v = variaveis(a), c = T.dados.config;
    var lembrete = U.linkWhats(a.cliente.whatsapp, U.preencher(c.mensagemLembrete, v));
    var confirmacao = U.linkWhats(a.cliente.whatsapp, U.preencher(c.mensagemConfirmacao, v));
    return '<div class="ag ' + esc(a.status) + '"><div class="hora-ag">' + esc(a.inicio) + '<small>até ' + esc(a.fim) + '</small></div>' +
      '<div class="info"><b>' + esc(a.cliente.nome) + '</b> <span class="pilula ' + esc(a.status) + '">' + esc(STATUS_NOME[a.status] || a.status) + '</span>' +
      '<div class="texto-suave">' + esc(a.servicos) + ' · ' + esc(a.profissional.nome) + ' · ' + esc(U.dinheiro(a.valor)) + '</div>' +
      '<div class="texto-suave pequeno">' + esc(U.telefone(a.cliente.whatsapp)) + ' · ' + (a.origem === 'site' ? 'pelo site' : a.origem === 'api' ? 'por integração' : 'pelo painel') +
      ' · ' + esc(a.codigo) + (a.obs ? ' · ' + esc(a.obs) : '') + '</div></div>' +
      '<div class="botoes">' +
      '<a class="btn-icone" title="Mandar lembrete no WhatsApp" target="_blank" rel="noopener" href="' + esc(lembrete) + '">' + ic('chat') + '</a>' +
      '<a class="btn-icone" title="Mandar confirmação no WhatsApp" target="_blank" rel="noopener" href="' + esc(confirmacao) + '">' + ic('mark_chat_read') + '</a>' +
      (a.status === 'confirmado' ? '<button class="btn-icone" title="Concluído" data-st="concluido" data-id="' + esc(a.id) + '">' + ic('task_alt') + '</button>' +
        '<button class="btn-icone" title="Faltou" data-st="faltou" data-id="' + esc(a.id) + '">' + ic('person_off') + '</button>' +
        '<button class="btn-icone" title="Cancelar" data-st="cancelado" data-id="' + esc(a.id) + '">' + ic('event_busy') + '</button>'
        : '<button class="btn-icone" title="Voltar para confirmado" data-st="confirmado" data-id="' + esc(a.id) + '">' + ic('undo') + '</button>') + '</div></div>';
  }
  function ligarCartoes(raizLista, depois) {
    $$('[data-st]', raizLista).forEach(function (b) {
      b.onclick = function () {
        var st = b.dataset.st;
        var p = st === 'cancelado' ? U.confirmar('Cancelar horário', 'O horário fica livre de novo. Se tiver webhook ligado, ele recebe o aviso.', 'Cancelar horário', true) : Promise.resolve(true);
        p.then(function (sim) {
          if (!sim) return;
          b.disabled = true;
          chamar('mudarStatus', { id: b.dataset.id, status: st }).then(function () { U.aviso('Atualizado.'); depois(); }).catch(function (e) { b.disabled = false; falha(e); });
        });
      };
    });
  }

  function janelaLembrar() {
    var amanha = U.somarDias(T.dados.hoje, 1);
    var j = U.janela({ titulo: 'Lembrar os de amanhã', html: '<div id="lembretes"><div class="vazio"><span class="giro" style="display:inline-block"></span></div></div>', foco: false });
    chamar('agenda', { de: amanha, ate: amanha }).then(function (r) {
      var ags = r.agendamentos.filter(function (a) { return a.status === 'confirmado'; });
      var caixa = $('#lembretes', j.el);
      if (!ags.length) { caixa.innerHTML = '<div class="vazio">' + ic('event_available') + 'Ninguém marcado para amanhã.</div>'; return; }
      caixa.innerHTML = '<p class="texto-suave" style="margin-bottom:8px">Toque em cada um para abrir o WhatsApp com a mensagem pronta.</p>' + ags.map(function (a) {
        return '<div class="linha-lista"><div class="meio"><b>' + esc(a.inicio) + ' · ' + esc(a.cliente.nome) + '</b><div class="texto-suave pequeno">' + esc(a.servicos) + ' com ' + esc(a.profissional.nome) +
          '</div></div><a class="btn btn-whats btn-p" target="_blank" rel="noopener" data-feito href="' + esc(U.linkWhats(a.cliente.whatsapp, U.preencher(T.dados.config.mensagemLembrete, variaveis(a)))) + '">' + ic('chat') + 'Enviar</a></div>';
      }).join('');
      $$('[data-feito]', caixa).forEach(function (b) { b.addEventListener('click', function () { b.classList.remove('btn-whats'); b.classList.add('btn-fantasma'); b.innerHTML = ic('done') + 'Aberto'; }); });
    }).catch(falha);
  }

  function janelaNovo(dataInicial) {
    var d = T.dados, ativos = d.servicos.filter(function (s) { return s.ativo; });
    var j = U.janela({ titulo: 'Novo horário', html:
      '<div class="duas"><div class="campo"><label>Cliente</label><input id="n-nome" maxlength="80"></div><div class="campo"><label>WhatsApp</label><input id="n-zap" type="tel"></div></div>' +
      '<div class="campo"><label>Serviços</label><div id="n-serv">' + ativos.map(function (s) {
        return '<label class="marcar"><input type="checkbox" value="' + esc(s.id) + '"> ' + esc(s.nome) + ' <span class="texto-suave pequeno">' + esc(U.duracao(s.duracao)) + ' · ' + esc(U.dinheiro(s.valor)) + '</span></label>';
      }).join('') + '</div></div>' +
      '<div class="duas"><div class="campo"><label>Profissional</label><select id="n-prof">' + d.profissionais.filter(function (p) { return p.ativo; }).map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.nome) + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Data</label><input type="date" id="n-data" value="' + dataInicial + '"></div></div>' +
      '<div class="campo"><label>Horário</label><div id="n-horas" class="texto-suave pequeno">Escolha os serviços para ver os horários livres.</div></div>' +
      '<div class="duas"><div class="campo"><label>Ou digite a hora</label><input type="time" id="n-hora"></div>' +
      '<div class="campo"><label>&nbsp;</label><label class="marcar"><input type="checkbox" id="n-forcar"> Encaixar mesmo assim</label></div></div>' +
      '<div class="campo"><label>Observação</label><input id="n-obs" maxlength="300"></div>',
      rodape: '<button class="btn btn-fantasma" data-fechar>Fechar</button><button class="btn btn-destaque" id="n-salvar">' + ic('check') + 'Marcar</button>' });
    var el = j.el;
    function servs() { return $$('#n-serv input:checked', el).map(function (i) { return i.value; }); }
    function atualizarHoras() {
      var caixa = $('#n-horas', el), s = servs();
      if (!s.length) { caixa.innerHTML = 'Escolha os serviços para ver os horários livres.'; return; }
      caixa.innerHTML = '<span class="giro" style="display:inline-block"></span>';
      chamar('horariosPainel', { data: $('#n-data', el).value, profissionalId: $('#n-prof', el).value, servicos: s }).then(function (r) {
        if (!r.horarios.length) { caixa.innerHTML = 'Sem horário livre no expediente. Digite a hora e marque "Encaixar mesmo assim".'; return; }
        caixa.innerHTML = '<div class="horas">' + r.horarios.map(function (h) { return '<button type="button" class="hora" data-h="' + h.hora + '">' + h.hora + '</button>'; }).join('') + '</div>';
        $$('.hora', caixa).forEach(function (b) { b.onclick = function () { $$('.hora', caixa).forEach(function (x) { x.classList.toggle('marcada', x === b); }); $('#n-hora', el).value = b.dataset.h; }; });
      }).catch(function (e) { caixa.textContent = e.message; });
    }
    $$('#n-serv input', el).forEach(function (i) { i.onchange = atualizarHoras; });
    $('#n-prof', el).onchange = atualizarHoras;
    $('#n-data', el).onchange = atualizarHoras;
    $('#n-salvar', el).onclick = function () {
      var b = this;
      var dados = { nome: $('#n-nome', el).value, whatsapp: $('#n-zap', el).value, servicos: servs(), profissionalId: $('#n-prof', el).value,
        data: $('#n-data', el).value, inicio: $('#n-hora', el).value, forcar: $('#n-forcar', el).checked, obs: $('#n-obs', el).value };
      U.ocupado(b, true, 'Marcando');
      chamar('novoAgendamento', dados).then(function (r) {
        j.fechar(); U.aviso('Horário marcado.');
        T.dia = r.agendamento.data;
        if (location.hash === '#agenda') TELAS.agenda($('#conteudo')); else irPara('agenda');
        var link = U.linkWhats(r.agendamento.cliente.whatsapp, U.preencher(T.dados.config.mensagemConfirmacao, variaveis(r.agendamento)));
        var j2 = U.janela({ titulo: 'Avisar o cliente', html: '<p class="texto-suave">Quer mandar a confirmação no WhatsApp de ' + esc(r.agendamento.cliente.nome) + '?</p>',
          rodape: '<button class="btn btn-fantasma" data-fechar>Agora não</button><a class="btn btn-whats" target="_blank" rel="noopener" data-fechar href="' + esc(link) + '">' + ic('chat') + 'Enviar</a>' });
        void j2;
      }).catch(function (e) { U.ocupado(b, false); falha(e); });
    };
  }

  // ------------------------------------------------------------
  // Resumo
  // ------------------------------------------------------------
  TELAS.resumo = function (el) {
    el.innerHTML = cabecalho('Resumo', '<input type="month" class="entrada" id="mes" value="' + T.mes + '">') + '<div id="corpo"></div>';
    $('#mes').onchange = function () { if (this.value) { T.mes = this.value; TELAS.resumo(el); } };
    var corpo = $('#corpo');
    corpo.innerHTML = '<div class="vazio"><span class="giro" style="display:inline-block"></span></div>';
    chamar('painel', { mes: T.mes }).then(function (r) {
      var p = T.mes.split('-'), diasNoMes = new Date(Number(p[0]), Number(p[1]), 0).getDate(), max = 1, barras = '';
      for (var i = 1; i <= diasNoMes; i++) max = Math.max(max, r.porDia[i] || 0);
      var diaHoje = T.dados.hoje.slice(0, 7) === T.mes ? parseInt(T.dados.hoje.slice(8, 10), 10) : 0;
      for (i = 1; i <= diasNoMes; i++) {
        var v = r.porDia[i] || 0;
        barras += '<div class="barra' + (i === diaHoje ? ' hoje' : '') + '" style="height:' + Math.max(1.5, v / max * 100) + '%" data-v="Dia ' + i + ': ' + v + '"></div>';
      }
      function kpi(icone, rot, val, sub) { return '<div class="kpi"><small>' + ic(icone) + esc(rot) + '</small><b>' + esc(val) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>'; }
      var mesNome = U.MESES[Number(p[1]) - 1];
      corpo.innerHTML = '<div class="grade-kpi">' +
        kpi('today', 'Hoje', U.dinheiro(r.faturamentoDia), 'previsto no dia') +
        kpi('payments', 'Faturamento', U.dinheiro(r.faturamentoMes), 'em ' + mesNome) +
        kpi('event_available', 'Atendimentos', String(r.atendimentosMes), 'ticket médio ' + U.dinheiro(r.ticketMedio)) +
        kpi('star', 'Mais pedido', r.servicoTop || 'Nenhum', '') +
        kpi('event_busy', 'Cancelamentos', String(r.cancelamentosMes), r.faltasMes + ' falta' + (r.faltasMes === 1 ? '' : 's')) +
        kpi('person_add', 'Clientes novos', String(r.clientesNovos), 'em ' + mesNome) + '</div>' +
        '<div class="duas-colunas"><div class="cartao"><h3>Atendimentos por dia</h3><div class="grafico">' + barras + '</div><div class="eixo"><span>1</span><span>' +
        Math.round(diasNoMes / 2) + '</span><span>' + diasNoMes + '</span></div></div>' +
        '<div class="cartao"><h3>Próximos de hoje</h3>' + (r.proximos.length ? r.proximos.map(function (a) {
          return '<div class="linha-lista"><b style="font-family:var(--titulo);font-size:20px;width:56px">' + esc(a.inicio) + '</b><div class="meio"><b>' + esc(a.cliente.nome) +
            '</b><div class="texto-suave pequeno">' + esc(a.servicos) + ' · ' + esc(a.profissional.nome) + '</div></div></div>';
        }).join('') : '<p class="texto-suave">Nenhum horário pela frente hoje.</p>') + '</div></div>' +
        '<div class="duas-colunas" style="margin-top:14px"><div class="cartao"><h3>Ranking da equipe</h3>' + (r.ranking.length ? '<table class="tabela"><thead><tr><th>Profissional</th><th class="num">Atendimentos</th><th class="num">Faturamento</th></tr></thead><tbody>' +
        r.ranking.map(function (x) { return '<tr><td>' + esc(x.nome) + '</td><td class="num">' + x.atendimentos + '</td><td class="num">' + esc(U.dinheiro(x.faturamento)) + '</td></tr>'; }).join('') + '</tbody></table>'
          : '<p class="texto-suave">Sem atendimentos neste mês.</p>') + '</div>' +
        '<div class="cartao"><h3>Aniversariantes de ' + esc(mesNome) + '</h3>' + (r.aniversariantes.length ? r.aniversariantes.map(function (a) {
          return '<div class="linha-lista"><div class="meio"><b>' + esc(a.nome) + '</b><div class="texto-suave pequeno">Dia ' + a.dia + '</div></div>' +
            (a.whatsapp ? '<a class="btn btn-fantasma btn-p" target="_blank" rel="noopener" href="' + esc(U.linkWhats(a.whatsapp, 'Parabéns, ' + a.nome.split(' ')[0] + '! A ' + T.dados.config.nome + ' deseja um ótimo aniversário. Venha comemorar com a gente!')) + '">' + ic('cake') + 'Parabéns</a>' : '') + '</div>';
        }).join('') : '<p class="texto-suave">Ninguém faz aniversário neste mês (ou a data não foi informada).</p>') + '</div></div>';
    }).catch(falha);
  };

  // ------------------------------------------------------------
  // Clientes
  // ------------------------------------------------------------
  TELAS.clientes = function (el) {
    el.innerHTML = cabecalho('Clientes', '<button class="btn btn-fantasma" id="csv">' + ic('download') + 'Baixar planilha</button><button class="btn btn-destaque" id="novo">' + ic('person_add') + 'Novo cliente</button>') +
      '<div class="filtros"><input class="entrada" id="busca" placeholder="Buscar por nome ou WhatsApp" style="flex:1;min-width:220px" value="' + esc(T.busca) + '"></div><div class="cartao" id="lista"><div class="vazio"><span class="giro" style="display:inline-block"></span></div></div>';
    $('#novo').onclick = function () { janelaCliente(null, function () { TELAS.clientes(el); }); };
    chamar('clientes').then(function (r) {
      T.clientes = r.clientes;
      function desenhar() {
        var q = T.busca.toLowerCase().trim(), qd = q.replace(/\D/g, '');
        var lista = r.clientes.filter(function (c) { return !q || c.nome.toLowerCase().indexOf(q) >= 0 || (qd && c.whatsapp.indexOf(qd) >= 0); });
        $('#lista').innerHTML = lista.length ? lista.slice(0, 300).map(function (c) {
          return '<div class="linha-lista">' + U.avatar(c.nome, '') + '<div class="meio"><b>' + esc(c.nome) + '</b><div class="texto-suave pequeno">' + esc(U.telefone(c.whatsapp)) +
            ' · ' + c.visitas + ' visita' + (c.visitas === 1 ? '' : 's') + ' · ' + esc(U.dinheiro(c.gasto)) + (c.ultima ? ' · última ' + esc(U.dataBR(c.ultima)) : '') + (c.faltas ? ' · ' + c.faltas + ' falta(s)' : '') + '</div></div>' +
            '<a class="btn-icone" target="_blank" rel="noopener" title="WhatsApp" href="' + esc(U.linkWhats(c.whatsapp)) + '">' + ic('chat') + '</a>' +
            '<button class="btn-icone" title="Editar" data-ed="' + esc(c.id) + '">' + ic('edit') + '</button></div>';
        }).join('') + (lista.length > 300 ? '<p class="texto-suave pequeno">Mostrando 300 de ' + lista.length + '. Use a busca.</p>' : '')
          : '<div class="vazio">' + ic('group') + (q ? 'Ninguém encontrado.' : 'Os clientes aparecem aqui quando agendam.') + '</div>';
        $$('[data-ed]').forEach(function (b) { b.onclick = function () { janelaCliente(r.clientes.filter(function (c) { return c.id === b.dataset.ed; })[0], function () { TELAS.clientes(el); }); }; });
      }
      $('#busca').oninput = function () { T.busca = this.value; desenhar(); };
      desenhar();
      $('#csv').onclick = function () {
        var linhas = [['Nome', 'WhatsApp', 'E-mail', 'Nascimento', 'Visitas', 'Gasto', 'Última visita', 'Faltas', 'Observação']].concat(r.clientes.map(function (c) {
          return [c.nome, c.whatsapp, c.email, c.nascimento, c.visitas, String(c.gasto).replace('.', ','), c.ultima, c.faltas, c.obs];
        }));
        var csv = '﻿' + linhas.map(function (l) { return l.map(function (v) { return '"' + String(v === undefined ? '' : v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'clientes.csv'; a.click();
      };
    }).catch(falha);
  };
  function janelaCliente(c, depois) {
    var j = U.janela({ titulo: c ? 'Editar cliente' : 'Novo cliente', html:
      '<div class="campo"><label>Nome</label><input id="c-nome" maxlength="80" value="' + esc(c ? c.nome : '') + '"></div>' +
      '<div class="campo"><label>WhatsApp</label><input id="c-zap" type="tel" value="' + esc(c ? U.telefone(c.whatsapp) : '') + '"' + (c ? ' disabled' : '') + '></div>' +
      '<div class="duas"><div class="campo"><label>E-mail</label><input id="c-email" type="email" value="' + esc(c ? c.email : '') + '"></div>' +
      '<div class="campo"><label>Nascimento</label><input id="c-nasc" type="date" value="' + esc(c ? c.nascimento : '') + '"></div></div>' +
      '<div class="campo"><label>Observação</label><textarea id="c-obs" maxlength="300" placeholder="Ex.: prefere máquina 2 nas laterais">' + esc(c ? c.obs : '') + '</textarea></div>',
      rodape: (c ? '<button class="btn btn-fantasma" id="c-rem">' + ic('delete') + 'Remover</button>' : '<button class="btn btn-fantasma" data-fechar>Fechar</button>') + '<button class="btn btn-destaque" id="c-ok">Salvar</button>' });
    $('#c-ok', j.el).onclick = function () {
      var b = this; U.ocupado(b, true, 'Salvando');
      chamar('salvarCliente', { id: c ? c.id : '', nome: $('#c-nome', j.el).value, whatsapp: $('#c-zap', j.el).value, email: $('#c-email', j.el).value,
        nascimento: $('#c-nasc', j.el).value, obs: $('#c-obs', j.el).value }).then(function () { j.fechar(); U.aviso('Salvo.'); depois(); }).catch(function (e) { U.ocupado(b, false); falha(e); });
    };
    if (c) $('#c-rem', j.el).onclick = function () {
      U.confirmar('Remover cliente', 'Remove o cadastro. Os horários antigos continuam no histórico.', 'Remover', true).then(function (sim) {
        if (!sim) return;
        chamar('removerCliente', { id: c.id }).then(function () { j.fechar(); U.aviso('Removido.'); depois(); }).catch(falha);
      });
    };
  }

  // ------------------------------------------------------------
  // Equipe e folgas
  // ------------------------------------------------------------
  function resumoTurnos(turnos) {
    var por = {};
    turnos.forEach(function (t) { (por[t.dia] = por[t.dia] || []).push(t.inicio + '–' + t.fim); });
    var partes = ORDEM_DIAS.filter(function (d) { return por[d]; }).map(function (d) { return U.DIAS_CURTOS[d] + ' ' + por[d].join(', '); });
    return partes.length ? partes.join(' · ') : 'Sem horários';
  }
  TELAS.equipe = function (el) {
    var d = T.dados;
    el.innerHTML = cabecalho('Equipe e folgas', '<button class="btn btn-destaque" id="novo">' + ic('person_add') + 'Novo profissional</button>') +
      '<div class="grade-cartoes" style="margin-bottom:24px">' + (d.profissionais.length ? d.profissionais.map(function (p) {
        var faz = p.servicos.length ? p.servicos.map(function (id) { var s = d.servicos.filter(function (x) { return x.id === id; })[0]; return s ? s.nome : ''; }).filter(String).join(', ') : 'Todos os serviços';
        return '<div class="cartao"><div class="pessoa">' + U.avatar(p.nome, p.foto) + '<div class="meio"><b>' + esc(p.nome) + (p.ativo ? '' : ' <span class="pilula">Inativo</span>') + '</b><div class="texto-suave pequeno">' + esc(faz) + '</div></div>' +
          '<button class="btn-icone" data-ed="' + esc(p.id) + '" title="Editar">' + ic('edit') + '</button></div><p class="texto-suave pequeno" style="margin-top:10px">' + esc(resumoTurnos(p.turnos)) + '</p></div>';
      }).join('') : '<div class="cartao vazio">' + ic('badge') + 'Cadastre quem atende na barbearia.</div>') + '</div>' +
      cabecalho('Folgas e feriados', '<button class="btn btn-fantasma" id="nova-folga">' + ic('event_busy') + 'Bloquear dia ou horário</button>') +
      '<div class="cartao">' + (function () {
        var hoje = d.hoje, futuros = d.bloqueios.filter(function (b) { return b.data >= hoje; }).sort(function (a, b) { return a.data.localeCompare(b.data); });
        if (!futuros.length) return '<p class="texto-suave">Nenhum bloqueio marcado. Use para feriados, folgas e compromissos: ninguém consegue agendar nesses horários.</p>';
        return futuros.map(function (b) {
          return '<div class="linha-lista"><div class="meio"><b>' + esc(U.dataLonga(b.data)) + '</b><div class="texto-suave pequeno">' + (b.inicio ? esc(b.inicio + '–' + (b.fim || '24:00')) : 'Dia inteiro') +
            ' · ' + esc(b.profissionalId ? profNome(b.profissionalId) : 'Toda a barbearia') + (b.motivo ? ' · ' + esc(b.motivo) : '') + '</div></div><button class="btn-icone" data-rem-b="' + esc(b.id) + '" title="Remover">' + ic('delete') + '</button></div>';
        }).join('');
      })() + '</div>';
    $('#novo').onclick = function () { janelaProfissional(null); };
    $$('[data-ed]').forEach(function (b) { b.onclick = function () { janelaProfissional(d.profissionais.filter(function (p) { return p.id === b.dataset.ed; })[0]); }; });
    $('#nova-folga').onclick = janelaBloqueio;
    $$('[data-rem-b]').forEach(function (b) {
      b.onclick = function () { chamar('removerBloqueio', { id: b.dataset.remB }).then(function () { U.aviso('Bloqueio removido.'); carregarTudo('equipe'); }).catch(falha); };
    });
  };

  function janelaProfissional(p) {
    var d = T.dados, foto = p ? p.foto : '', turnos = p ? JSON.parse(JSON.stringify(p.turnos)) : [];
    if (!p) [1, 2, 3, 4, 5, 6].forEach(function (dia) { turnos.push({ dia: dia, inicio: '09:00', fim: '12:00' }); turnos.push({ dia: dia, inicio: '13:00', fim: '19:00' }); });
    var j = U.janela({ titulo: p ? 'Editar profissional' : 'Novo profissional', html:
      '<div class="pessoa" style="margin-bottom:14px"><span id="foto-prev">' + U.avatar(p ? p.nome : '?', foto, 'grande') + '</span><div class="meio"><label class="btn btn-fantasma btn-p">' + ic('photo_camera') +
      'Escolher foto<input type="file" accept="image/*" id="p-foto" hidden></label>' + (foto ? ' <button class="btn btn-fantasma btn-p" id="p-sem-foto">Tirar foto</button>' : '') + '</div></div>' +
      '<div class="duas"><div class="campo"><label>Nome</label><input id="p-nome" maxlength="60" value="' + esc(p ? p.nome : '') + '"></div>' +
      '<div class="campo"><label>WhatsApp <span class="ajuda">(só para você)</span></label><input id="p-tel" type="tel" value="' + esc(p ? U.telefone(p.telefone) : '') + '"></div></div>' +
      '<label class="chave">Aparece na agenda<input type="checkbox" id="p-ativo"' + (!p || p.ativo ? ' checked' : '') + '></label>' +
      '<div class="campo" style="margin-top:12px"><label>Serviços que faz <span class="ajuda">(nenhum marcado = todos)</span></label>' + d.servicos.map(function (s) {
        return '<label class="marcar"><input type="checkbox" class="p-serv" value="' + esc(s.id) + '"' + (p && p.servicos.indexOf(s.id) >= 0 ? ' checked' : '') + '> ' + esc(s.nome) + '</label>';
      }).join('') + '</div>' +
      '<div class="campo"><label>Horários de atendimento</label><div class="turnos-editor" id="turnos"></div>' +
      '<button type="button" class="btn btn-fantasma btn-p" id="copiar-seg" style="margin-top:8px">' + ic('content_copy') + 'Copiar o primeiro dia para todos os marcados</button></div>',
      rodape: (p ? '<button class="btn btn-fantasma" id="p-rem">' + ic('delete') + 'Remover</button>' : '<button class="btn btn-fantasma" data-fechar>Fechar</button>') + '<button class="btn btn-destaque" id="p-ok">Salvar</button>' });
    var el = j.el;
    function desenharTurnos() {
      $('#turnos', el).innerHTML = ORDEM_DIAS.map(function (dia) {
        var dele = turnos.filter(function (t) { return t.dia === dia; });
        return '<div class="dia-linha"><label class="marcar"><input type="checkbox" data-dia="' + dia + '"' + (dele.length ? ' checked' : '') + '> ' + U.DIAS[dia] + '</label><div class="intervalos">' +
          (dele.length ? dele.map(function (t) {
            var i = turnos.indexOf(t);
            return '<div class="intervalo"><input type="time" data-i="' + i + '" data-c="inicio" value="' + t.inicio + '"> até <input type="time" data-i="' + i + '" data-c="fim" value="' + t.fim + '">' +
              '<button type="button" class="btn-icone" data-tira="' + i + '" title="Tirar intervalo">' + ic('close') + '</button></div>';
          }).join('') + (dele.length < 3 ? '<button type="button" class="btn btn-fantasma btn-p" data-mais="' + dia + '" style="justify-self:start">' + ic('add') + 'Intervalo</button>' : '')
            : '<span class="texto-suave pequeno" style="padding-top:8px">Não atende</span>') + '</div></div>';
      }).join('');
      $$('[data-dia]', el).forEach(function (c) {
        c.onchange = function () {
          var dia = Number(c.dataset.dia);
          if (c.checked) { turnos.push({ dia: dia, inicio: '09:00', fim: '12:00' }); turnos.push({ dia: dia, inicio: '13:00', fim: '19:00' }); }
          else turnos = turnos.filter(function (t) { return t.dia !== dia; });
          desenharTurnos();
        };
      });
      $$('input[type=time]', el).forEach(function (inp) { inp.onchange = function () { turnos[Number(inp.dataset.i)][inp.dataset.c] = inp.value; }; });
      $$('[data-tira]', el).forEach(function (b) { b.onclick = function () { turnos.splice(Number(b.dataset.tira), 1); desenharTurnos(); }; });
      $$('[data-mais]', el).forEach(function (b) { b.onclick = function () { turnos.push({ dia: Number(b.dataset.mais), inicio: '19:00', fim: '21:00' }); desenharTurnos(); }; });
    }
    desenharTurnos();
    $('#copiar-seg', el).onclick = function () {
      var primeiro = ORDEM_DIAS.filter(function (dd) { return turnos.some(function (t) { return t.dia === dd; }); })[0];
      if (primeiro === undefined) return;
      var modelo = turnos.filter(function (t) { return t.dia === primeiro; });
      var marcados = ORDEM_DIAS.filter(function (dd) { return turnos.some(function (t) { return t.dia === dd; }); });
      turnos = [];
      marcados.forEach(function (dd) { modelo.forEach(function (m) { turnos.push({ dia: dd, inicio: m.inicio, fim: m.fim }); }); });
      desenharTurnos(); U.aviso('Copiado para ' + marcados.length + ' dias.');
    };
    $('#p-foto', el).onchange = function () {
      U.comprimirImagem(this.files[0], 200, 'image/jpeg', 40000).then(function (url) {
        foto = url; $('#foto-prev', el).innerHTML = U.avatar('', foto, 'grande');
      }).catch(falha);
    };
    if ($('#p-sem-foto', el)) $('#p-sem-foto', el).onclick = function () { foto = ''; $('#foto-prev', el).innerHTML = U.avatar($('#p-nome', el).value || '?', '', 'grande'); };
    $('#p-ok', el).onclick = function () {
      var b = this;
      var ruins = turnos.filter(function (t) { return !t.inicio || !t.fim || t.fim <= t.inicio; });
      if (ruins.length) { falha(new Error('Confira os horários: o fim precisa ser depois do início.')); return; }
      U.ocupado(b, true, 'Salvando');
      chamar('salvarProfissional', { id: p ? p.id : '', nome: $('#p-nome', el).value, telefone: $('#p-tel', el).value, ativo: $('#p-ativo', el).checked,
        foto: foto, ordem: p ? p.ordem : 0, servicos: $$('.p-serv:checked', el).map(function (i) { return i.value; }), turnos: turnos })
        .then(function () { j.fechar(); U.aviso('Salvo.'); carregarTudo('equipe'); }).catch(function (e) { U.ocupado(b, false); falha(e); });
    };
    if (p) $('#p-rem', el).onclick = function () {
      U.confirmar('Remover ' + p.nome, 'Se ele tiver horários marcados, o sistema avisa. Para só tirar da agenda, desligue "Aparece na agenda".', 'Remover', true).then(function (sim) {
        if (!sim) return;
        chamar('removerProfissional', { id: p.id }).then(function () { j.fechar(); U.aviso('Removido.'); carregarTudo('equipe'); }).catch(falha);
      });
    };
  }

  function janelaBloqueio() {
    var d = T.dados;
    var j = U.janela({ titulo: 'Bloquear dia ou horário', html:
      '<div class="duas"><div class="campo"><label>Data</label><input type="date" id="b-data" value="' + d.hoje + '"></div>' +
      '<div class="campo"><label>Quem</label><select id="b-prof"><option value="">Toda a barbearia</option>' + d.profissionais.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nome) + '</option>'; }).join('') + '</select></div></div>' +
      '<label class="chave">Dia inteiro<input type="checkbox" id="b-todo" checked></label>' +
      '<div class="duas escondido" id="b-horas" style="margin-top:12px"><div class="campo"><label>Das</label><input type="time" id="b-ini" value="12:00"></div><div class="campo"><label>Até</label><input type="time" id="b-fim" value="14:00"></div></div>' +
      '<div class="campo" style="margin-top:12px"><label>Motivo <span class="ajuda">(só você vê)</span></label><input id="b-mot" maxlength="80" placeholder="Ex.: Feriado"></div>',
      rodape: '<button class="btn btn-fantasma" data-fechar>Fechar</button><button class="btn btn-destaque" id="b-ok">Bloquear</button>' });
    $('#b-todo', j.el).onchange = function () { $('#b-horas', j.el).classList.toggle('escondido', this.checked); };
    $('#b-ok', j.el).onclick = function () {
      var todo = $('#b-todo', j.el).checked;
      chamar('salvarBloqueio', { data: $('#b-data', j.el).value, profissionalId: $('#b-prof', j.el).value, inicio: todo ? '' : $('#b-ini', j.el).value,
        fim: todo ? '' : $('#b-fim', j.el).value, motivo: $('#b-mot', j.el).value }).then(function () { j.fechar(); U.aviso('Bloqueado.'); carregarTudo('equipe'); }).catch(falha);
    };
  }

  // ------------------------------------------------------------
  // Serviços
  // ------------------------------------------------------------
  TELAS.servicos = function (el) {
    var lista = T.dados.servicos;
    el.innerHTML = cabecalho('Serviços', '<button class="btn btn-destaque" id="novo">' + ic('add') + 'Novo serviço</button>') +
      '<div class="cartao">' + (lista.length ? lista.map(function (s, i) {
        return '<div class="linha-lista"><div class="meio"><b>' + esc(s.nome) + (s.ativo ? '' : ' <span class="pilula">Oculto</span>') + '</b><div class="texto-suave pequeno">' + esc(U.duracao(s.duracao)) + ' · ' + esc(U.dinheiro(s.valor)) +
          (s.descricao ? ' · ' + esc(s.descricao) : '') + '</div></div>' +
          '<button class="btn-icone" data-sobe="' + i + '" title="Subir"' + (i === 0 ? ' disabled' : '') + '>' + ic('arrow_upward') + '</button>' +
          '<button class="btn-icone" data-desce="' + i + '" title="Descer"' + (i === lista.length - 1 ? ' disabled' : '') + '>' + ic('arrow_downward') + '</button>' +
          '<button class="btn-icone" data-ed="' + i + '" title="Editar">' + ic('edit') + '</button></div>';
      }).join('') : '<div class="vazio">' + ic('content_cut') + 'Cadastre o primeiro serviço: nome, valor e quanto tempo leva.</div>') + '</div>';
    $('#novo').onclick = function () { janelaServico(null); };
    $$('[data-ed]').forEach(function (b) { b.onclick = function () { janelaServico(lista[Number(b.dataset.ed)]); }; });
    function trocar(i, k) {
      var a = lista[i], b = lista[k];
      Promise.all([chamar('salvarServico', Object.assign({}, a, { ordem: k + 1 })), chamar('salvarServico', Object.assign({}, b, { ordem: i + 1 }))])
        .then(function () { carregarTudo('servicos'); }).catch(falha);
    }
    $$('[data-sobe]').forEach(function (b) { b.onclick = function () { var i = Number(b.dataset.sobe); trocar(i, i - 1); }; });
    $$('[data-desce]').forEach(function (b) { b.onclick = function () { var i = Number(b.dataset.desce); trocar(i, i + 1); }; });
  };
  function janelaServico(s) {
    var j = U.janela({ titulo: s ? 'Editar serviço' : 'Novo serviço', html:
      '<div class="campo"><label>Nome</label><input id="s-nome" maxlength="60" value="' + esc(s ? s.nome : '') + '" placeholder="Ex.: Corte degradê"></div>' +
      '<div class="duas"><div class="campo"><label>Valor (R$)</label><input id="s-valor" inputmode="decimal" value="' + esc(s ? String(s.valor).replace('.', ',') : '') + '" placeholder="45,00"></div>' +
      '<div class="campo"><label>Duração (minutos)</label><input id="s-dur" type="number" min="5" max="600" step="5" value="' + esc(s ? s.duracao : 30) + '"></div></div>' +
      '<div class="campo"><label>Descrição <span class="ajuda">(opcional)</span></label><input id="s-desc" maxlength="200" value="' + esc(s ? s.descricao : '') + '"></div>' +
      '<label class="chave">Aparece para os clientes<input type="checkbox" id="s-ativo"' + (!s || s.ativo ? ' checked' : '') + '></label>',
      rodape: (s ? '<button class="btn btn-fantasma" id="s-rem">' + ic('delete') + 'Remover</button>' : '<button class="btn btn-fantasma" data-fechar>Fechar</button>') + '<button class="btn btn-destaque" id="s-ok">Salvar</button>' });
    $('#s-ok', j.el).onclick = function () {
      var b = this; U.ocupado(b, true, 'Salvando');
      chamar('salvarServico', { id: s ? s.id : '', ordem: s ? s.ordem : 0, nome: $('#s-nome', j.el).value, valor: $('#s-valor', j.el).value, duracao: $('#s-dur', j.el).value,
        descricao: $('#s-desc', j.el).value, ativo: $('#s-ativo', j.el).checked }).then(function () { j.fechar(); U.aviso('Salvo.'); carregarTudo('servicos'); }).catch(function (e) { U.ocupado(b, false); falha(e); });
    };
    if (s) $('#s-rem', j.el).onclick = function () {
      U.confirmar('Remover serviço', 'Os horários já marcados continuam. Para só esconder, desligue "Aparece para os clientes".', 'Remover', true).then(function (sim) {
        if (sim) chamar('removerServico', { id: s.id }).then(function () { j.fechar(); U.aviso('Removido.'); carregarTudo('servicos'); }).catch(falha);
      });
    };
  }

  // ------------------------------------------------------------
  // Aparência
  // ------------------------------------------------------------
  var CORES = ['#C8A04A', '#B5462E', '#2F7D5B', '#2C6CB0', '#7A4BB3', '#D2691E', '#E0E0E0', '#1F1F1F'];
  TELAS.aparencia = function (el) {
    var c = JSON.parse(JSON.stringify(T.dados.config));
    el.innerHTML = cabecalho('Aparência', '<button class="btn btn-destaque" id="salvar">' + ic('save') + 'Salvar</button>') +
      '<div class="duas-colunas"><div>' +
      '<div class="cartao secao-painel"><h3>Marca</h3>' +
      '<div class="pessoa" style="margin-bottom:14px"><span id="logo-prev"></span><div class="meio"><label class="btn btn-fantasma btn-p">' + ic('upload') + 'Enviar logo<input type="file" accept="image/*" id="logo" hidden></label> ' +
      '<button class="btn btn-fantasma btn-p" id="sem-logo">Sem logo</button><div class="texto-suave pequeno" style="margin-top:6px">PNG com fundo transparente fica melhor.</div></div></div>' +
      '<div class="campo"><label>Nome da barbearia</label><input id="a-nome" maxlength="60" value="' + esc(c.nome) + '"></div>' +
      '<div class="campo"><label>Frase de destaque</label><input id="a-slogan" maxlength="200" value="' + esc(c.slogan) + '"></div>' +
      '<div class="campo"><label>Cor principal</label><div class="cores" id="cores">' + CORES.map(function (k) { return '<button class="cor" data-cor="' + k + '" style="background:' + k + '" aria-label="' + k + '"></button>'; }).join('') +
      '<input type="color" id="cor-livre" value="' + esc(c.corDestaque) + '" style="width:44px;height:36px;border:0;background:none"></div></div>' +
      '<div class="campo"><label>Fundo</label><div class="linha-acao"><label class="marcar"><input type="radio" name="tema" value="escuro"' + (c.tema !== 'claro' ? ' checked' : '') + '> Escuro</label>' +
      '<label class="marcar"><input type="radio" name="tema" value="claro"' + (c.tema === 'claro' ? ' checked' : '') + '> Claro</label></div></div></div>' +
      '<div class="cartao secao-painel"><h3>Contatos</h3><div class="duas"><div class="campo"><label>WhatsApp</label><input id="a-zap" type="tel" value="' + esc(U.telefone(c.whatsapp)) + '"></div>' +
      '<div class="campo"><label>Telefone</label><input id="a-tel" type="tel" value="' + esc(U.telefone(c.telefone)) + '"></div></div>' +
      '<div class="campo"><label>Instagram</label><input id="a-insta" placeholder="@suabarbearia" value="' + esc(c.instagram) + '"></div>' +
      '<div class="campo"><label>Endereço</label><input id="a-end" maxlength="200" value="' + esc(c.endereco) + '"></div>' +
      '<div class="campo"><label>Link do mapa <span class="ajuda">(opcional, do Google Maps)</span></label><input id="a-mapa" maxlength="200" value="' + esc(c.mapa) + '"></div>' +
      '<div class="campo"><label>Sobre a barbearia</label><textarea id="a-sobre" maxlength="600">' + esc(c.sobre) + '</textarea></div></div></div>' +
      '<div><div class="cartao secao-painel" style="position:sticky;top:16px"><h3>Prévia</h3><div class="previa"><div id="previa" style="padding:24px 16px;text-align:center"></div></div>' +
      '<div class="linha-acao" style="margin-top:12px"><a class="btn btn-fantasma btn-p" target="_blank" rel="noopener" href="' + esc(API.linkCliente()) + '">' + ic('open_in_new') + 'Abrir a página</a></div></div></div></div>';
    function lerForm() {
      c.nome = $('#a-nome').value; c.slogan = $('#a-slogan').value; c.whatsapp = $('#a-zap').value.replace(/\D/g, ''); c.telefone = $('#a-tel').value.replace(/\D/g, '');
      c.instagram = $('#a-insta').value.trim(); c.endereco = $('#a-end').value; c.mapa = $('#a-mapa').value; c.sobre = $('#a-sobre').value;
      c.tema = $('input[name=tema]:checked').value;
    }
    function previa() {
      lerForm();
      U.aplicarTema(c);
      $('#logo-prev').innerHTML = c.logo ? '<img src="' + esc(c.logo) + '" alt="" style="width:72px;height:72px;object-fit:contain;border-radius:14px">' : U.avatar(c.nome, '', 'grande');
      $('#previa').innerHTML = (c.logo ? '<img src="' + esc(c.logo) + '" alt="" style="width:80px;height:80px;object-fit:contain;margin:0 auto 10px;border-radius:16px">' : '<div class="monograma" style="width:70px;height:70px;border-radius:50%;border:2px solid var(--destaque);margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-family:var(--titulo);font-size:30px;color:var(--destaque)">' + esc(U.iniciais(c.nome)) + '</div>') +
        '<h2 style="font-size:28px">' + esc(c.nome) + '</h2><p class="texto-suave" style="margin:6px 0 14px">' + esc(c.slogan) + '</p><span class="btn btn-destaque" style="width:100%">' + ic('calendar_add_on') + 'Agendar horário</span>';
      $$('.cor').forEach(function (b) { b.classList.toggle('marcada', b.dataset.cor.toLowerCase() === String(c.corDestaque).toLowerCase()); });
    }
    $$('input,textarea', el).forEach(function (i) { if (i.type !== 'file') i.addEventListener('input', previa); });
    $$('input[name=tema]').forEach(function (i) { i.onchange = previa; });
    $$('.cor').forEach(function (b) { b.onclick = function () { c.corDestaque = b.dataset.cor; $('#cor-livre').value = b.dataset.cor; previa(); }; });
    $('#cor-livre').oninput = function () { c.corDestaque = this.value; previa(); };
    $('#logo').onchange = function () { U.comprimirImagem(this.files[0], 360, 'image/webp', 44000).then(function (u) { c.logo = u; previa(); }).catch(falha); };
    $('#sem-logo').onclick = function () { c.logo = ''; previa(); };
    $('#salvar').onclick = function () {
      var b = this; lerForm(); U.ocupado(b, true, 'Salvando');
      chamar('salvarConfig', { config: { nome: c.nome, slogan: c.slogan, logo: c.logo, corDestaque: c.corDestaque, tema: c.tema, whatsapp: c.whatsapp, telefone: c.telefone,
        instagram: c.instagram, endereco: c.endereco, mapa: c.mapa, sobre: c.sobre } })
        .then(function (r) { T.dados.config = r.config; atualizarMarca(); U.ocupado(b, false); U.aviso('Aparência salva. A página dos clientes já mudou.'); })
        .catch(function (e) { U.ocupado(b, false); falha(e); });
    };
    previa();
  };

  // ------------------------------------------------------------
  // Integrações
  // ------------------------------------------------------------
  var NOME_EVENTO = { 'agendamento.criado': 'Novo agendamento', 'agendamento.cancelado': 'Agendamento cancelado', 'agendamento.concluido': 'Atendimento concluído',
    'agendamento.faltou': 'Cliente faltou', 'cliente.criado': 'Cliente novo' };
  TELAS.integracoes = function (el) {
    el.innerHTML = cabecalho('Integrações') + '<div id="corpo"><div class="vazio"><span class="giro" style="display:inline-block"></span></div></div>';
    chamar('integracoes').then(function (i) { desenharIntegracoes($('#corpo'), i); }).catch(falha);
  };
  function desenharIntegracoes(corpo, i) {
    var servidor = API.alvo.modo === 'demo' ? 'https://script.google.com/macros/s/SEU_ID/exec' : API.alvo.url;
    var hooks = i.webhooks.map(function (w) { return Object.assign({}, w); });
    corpo.innerHTML =
      '<div class="cartao secao-painel"><h3>Avisos por e-mail</h3><p class="texto-suave">Saem do Gmail da conta onde o sistema está instalado, sem custo.</p>' +
      '<label class="chave">Me avisar a cada agendamento feito pelo site<input type="checkbox" id="i-dono"' + (i.avisarDono ? ' checked' : '') + '></label>' +
      '<div class="campo" style="margin-top:10px"><label>E-mail que recebe os avisos</label><input id="i-email" type="email" placeholder="' + esc(i.emailPadrao || 'seu@gmail.com') + '" value="' + esc(i.emailDono) + '">' +
      '<span class="ajuda">Vazio = o e-mail da conta Google do sistema.</span></div>' +
      '<label class="chave">Lembrete por e-mail para o cliente na véspera<input type="checkbox" id="i-lembrete"' + (i.lembreteCliente ? ' checked' : '') + '></label>' +
      '<label class="chave">Resumo do dia para mim, às 8h<input type="checkbox" id="i-resumo"' + (i.resumoDiario ? ' checked' : '') + '></label>' +
      '<div class="linha-acao" style="margin-top:12px"><button class="btn btn-destaque btn-p" id="salvar-emails">Salvar avisos</button></div>' +
      '<div class="linha-lista" style="margin-top:10px"><div class="meio"><b>Robô diário</b><div class="texto-suave pequeno">Precisa estar ligado para o lembrete da véspera e o resumo do dia. Também arquiva os horários com mais de 90 dias.</div></div>' +
      '<button class="btn ' + (i.robos ? 'btn-fantasma' : 'btn-destaque') + ' btn-p" id="robos">' + (i.robos ? ic('toggle_on') + 'Ligado' : ic('toggle_off') + 'Ligar') + '</button></div></div>' +

      '<div class="cartao secao-painel"><h3>Webhooks de saída</h3><p class="texto-suave">O sistema avisa outro sistema (Make, n8n, Zapier, robô de WhatsApp, CRM) quando algo acontece. Até 10 endereços.</p>' +
      '<div id="hooks"></div><div class="linha-acao" style="margin-top:10px"><button class="btn btn-fantasma btn-p" id="mais-hook">' + ic('add') + 'Adicionar webhook</button>' +
      '<button class="btn btn-destaque btn-p" id="salvar-hooks">Salvar webhooks</button></div>' +
      (i.segredoWebhook ? '<div style="margin-top:16px"><span class="rotulo">Segredo da assinatura</span><div class="linha-acao" style="margin-top:6px"><span class="etiqueta-api" id="segredo">' + esc(i.segredoWebhook) + '</span>' +
        '<button class="btn btn-fantasma btn-p" id="copiar-segredo">' + ic('content_copy') + 'Copiar</button><button class="btn btn-fantasma btn-p" id="novo-segredo">Trocar</button></div>' +
        '<p class="texto-suave pequeno" style="margin-top:6px">Cada envio leva o cabeçalho X-Agenda-Assinatura = sha256=HMAC do corpo com este segredo. Quem recebe confere e sabe que veio daqui.</p></div>' : '') +
      '<details style="margin-top:12px"><summary class="texto-suave" style="cursor:pointer">Como chega o aviso</summary><div class="bloco-codigo" style="margin-top:8px">POST (JSON)\n{\n  "evento": "agendamento.criado",\n  "quando": "2026-11-25T13:00:00.000Z",\n  "barbearia": "' + esc(T.dados.config.nome) + '",\n  "dados": {\n    "id": "a...", "codigo": "K7M2QX", "data": "2026-11-26", "inicio": "14:00", "fim": "14:30",\n    "profissional": { "id": "p...", "nome": "..." },\n    "cliente": { "id": "c...", "nome": "...", "whatsapp": "11912345678" },\n    "servicos": "Corte", "valor": 45, "status": "confirmado", "origem": "site"\n  }\n}</div></details></div>' +

      '<div class="cartao secao-painel"><h3>Chave de API (entrada)</h3><p class="texto-suave">Para outro sistema ler a agenda, marcar horários ou mudar a situação de um atendimento.</p>' +
      (i.apiChave ? '<div class="linha-acao"><span class="etiqueta-api">' + esc(i.apiChave) + '</span><button class="btn btn-fantasma btn-p" id="copiar-chave">' + ic('content_copy') + 'Copiar</button>' +
        '<button class="btn btn-fantasma btn-p" id="nova-chave">Gerar outra</button><button class="btn btn-fantasma btn-p" id="apagar-chave">Desligar</button></div>' +
        '<p class="texto-suave pequeno" style="margin-top:8px">Trate como senha. Se vazar, gere outra: a antiga para de funcionar na hora.</p>'
        : '<button class="btn btn-destaque btn-p" id="nova-chave">' + ic('key') + 'Gerar chave</button>') +
      '<details style="margin-top:12px"><summary class="texto-suave" style="cursor:pointer">Exemplos</summary><div class="bloco-codigo" style="margin-top:8px">' +
      'Endereço: ' + esc(servidor) + '\n\nLer a agenda (GET):\n' + esc(servidor) + '?chave=SUA_CHAVE&metodo=agendamentos&de=2026-11-01&ate=2026-11-30\n\n' +
      'Marcar horário (POST, corpo em texto JSON):\n{ "acao": "api", "chave": "SUA_CHAVE", "metodo": "agendar",\n  "dados": { "data": "2026-11-26", "inicio": "14:00", "profissionalId": "qualquer",\n    "servicos": ["ID_DO_SERVICO"], "nome": "Cliente", "whatsapp": "11912345678" } }\n\n' +
      'Métodos: info, horarios, agendamentos, clientes, agendar, status, resumo\nIDs dos serviços: ' + esc(T.dados.servicos.map(function (s) { return s.nome + ' = ' + s.id; }).join(', ')) + '\nIDs da equipe: ' +
      esc(T.dados.profissionais.map(function (p) { return p.nome + ' = ' + p.id; }).join(', ')) + '</div></details></div>' +
      '<div class="cartao secao-painel"><h3>Registro</h3><p class="texto-suave">Os últimos envios e acessos.</p><div id="log"><button class="btn btn-fantasma btn-p" id="ver-log">Ver registro</button></div></div>';

    function desenharHooks() {
      $('#hooks', corpo).innerHTML = hooks.length ? hooks.map(function (w, k) {
        return '<div class="cartao" style="background:var(--fundo-2);margin-bottom:10px"><div class="duas"><div class="campo"><label>Nome</label><input data-k="' + k + '" data-c="nome" value="' + esc(w.nome || '') + '" placeholder="Ex.: Robô do WhatsApp"></div>' +
          '<div class="campo"><label>Endereço (https)</label><input data-k="' + k + '" data-c="url" value="' + esc(w.url || '') + '" placeholder="https://..."></div></div>' +
          '<span class="rotulo">Eventos <span class="ajuda">(nenhum marcado = todos)</span></span><div style="display:flex;flex-wrap:wrap;gap:0 18px">' + Nucleo.EVENTOS.map(function (ev) {
            return '<label class="marcar"><input type="checkbox" data-k="' + k + '" data-ev="' + ev + '"' + ((w.eventos || []).indexOf(ev) >= 0 ? ' checked' : '') + '> ' + esc(NOME_EVENTO[ev]) + '</label>';
          }).join('') + '</div><div class="linha-acao" style="margin-top:6px"><label class="marcar"><input type="checkbox" data-k="' + k + '" data-c="ativo"' + (w.ativo !== false ? ' checked' : '') + '> Ligado</label>' +
          (w.id ? '<button class="btn btn-fantasma btn-p" data-testar="' + esc(w.id) + '">' + ic('send') + 'Testar</button>' : '') +
          '<button class="btn btn-fantasma btn-p" data-tirar="' + k + '">' + ic('delete') + 'Tirar</button></div></div>';
      }).join('') : '<p class="texto-suave pequeno">Nenhum webhook.</p>';
      $$('[data-c]', corpo).forEach(function (inp) {
        inp.oninput = inp.onchange = function () { var w = hooks[Number(inp.dataset.k)]; w[inp.dataset.c] = inp.type === 'checkbox' ? inp.checked : inp.value; };
      });
      $$('[data-ev]', corpo).forEach(function (inp) {
        inp.onchange = function () {
          var w = hooks[Number(inp.dataset.k)]; w.eventos = w.eventos || [];
          if (inp.checked) w.eventos.push(inp.dataset.ev); else w.eventos = w.eventos.filter(function (e) { return e !== inp.dataset.ev; });
        };
      });
      $$('[data-tirar]', corpo).forEach(function (b) { b.onclick = function () { hooks.splice(Number(b.dataset.tirar), 1); desenharHooks(); }; });
      $$('[data-testar]', corpo).forEach(function (b) {
        b.onclick = function () {
          U.ocupado(b, true, 'Enviando');
          chamar('testarWebhook', { id: b.dataset.testar }).then(function (r) {
            U.ocupado(b, false);
            U.aviso(r.codigo >= 200 && r.codigo < 300 ? 'Chegou: resposta ' + r.codigo + '.' : 'Não chegou (resposta ' + (r.codigo || 'nenhuma') + '). Confira o endereço.', r.codigo >= 200 && r.codigo < 300 ? '' : 'erro');
          }).catch(function (e) { U.ocupado(b, false); falha(e); });
        };
      });
    }
    desenharHooks();
    function recarregar(novo) { desenharIntegracoes(corpo, novo); }
    $('#mais-hook', corpo).onclick = function () { if (hooks.length >= 10) return; hooks.push({ nome: '', url: '', eventos: [], ativo: true }); desenharHooks(); };
    $('#salvar-hooks', corpo).onclick = function () {
      var b = this; U.ocupado(b, true, 'Salvando');
      chamar('salvarIntegracoes', { integracoes: { webhooks: hooks.filter(function (w) { return w.url; }) } }).then(function (r) { U.aviso('Webhooks salvos.'); recarregar(r); }).catch(function (e) { U.ocupado(b, false); falha(e); });
    };
    $('#salvar-emails', corpo).onclick = function () {
      var b = this; U.ocupado(b, true, 'Salvando');
      chamar('salvarIntegracoes', { integracoes: { avisarDono: $('#i-dono', corpo).checked, emailDono: $('#i-email', corpo).value, lembreteCliente: $('#i-lembrete', corpo).checked,
        resumoDiario: $('#i-resumo', corpo).checked } }).then(function (r) {
        U.aviso((r.lembreteCliente || r.resumoDiario) && !r.robos ? 'Salvo. Ligue o robô diário para os lembretes saírem.' : 'Avisos salvos.'); recarregar(r);
      }).catch(function (e) { U.ocupado(b, false); falha(e); });
    };
    $('#robos', corpo).onclick = function () {
      var b = this; U.ocupado(b, true, i.robos ? 'Desligando' : 'Ligando');
      chamar('robos', { ligar: !i.robos }).then(function (r) { U.aviso(r.robos ? 'Robô diário ligado.' : 'Robô diário desligado.'); recarregar(r); }).catch(function (e) { U.ocupado(b, false); falha(e); });
    };
    function acaoChave(acao, pergunta) {
      return function () {
        var p = pergunta ? U.confirmar('Chave de API', pergunta, 'Continuar', true) : Promise.resolve(true);
        p.then(function (sim) { if (sim) chamar(acao).then(recarregar).catch(falha); });
      };
    }
    $('#nova-chave', corpo).onclick = acaoChave('novaChaveApi', i.apiChave ? 'A chave atual para de funcionar. Quem usa precisa receber a nova.' : '');
    if ($('#apagar-chave', corpo)) $('#apagar-chave', corpo).onclick = acaoChave('apagarChaveApi', 'Nenhum sistema de fora vai conseguir entrar até você gerar outra chave.');
    if ($('#copiar-chave', corpo)) $('#copiar-chave', corpo).onclick = function () { U.copiar(i.apiChave); };
    if ($('#copiar-segredo', corpo)) $('#copiar-segredo', corpo).onclick = function () { U.copiar(i.segredoWebhook); };
    if ($('#novo-segredo', corpo)) $('#novo-segredo', corpo).onclick = function () {
      U.confirmar('Trocar segredo', 'Quem confere a assinatura precisa receber o segredo novo.', 'Trocar', true).then(function (s) { if (s) chamar('novoSegredoWebhook').then(recarregar).catch(falha); });
    };
    $('#ver-log', corpo).onclick = function () {
      chamar('log').then(function (r) {
        $('#log', corpo).innerHTML = r.log.length ? '<table class="tabela"><tbody>' + r.log.map(function (l) {
          return '<tr><td class="texto-suave pequeno" style="white-space:nowrap">' + esc(String(l.quando).slice(0, 16).replace('T', ' ')) + '</td><td>' + esc(l.tipo) + '</td><td class="pequeno">' + esc(l.detalhe) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<p class="texto-suave">Vazio.</p>';
      }).catch(falha);
    };
  }

  // ------------------------------------------------------------
  // Ajustes
  // ------------------------------------------------------------
  TELAS.ajustes = function (el) {
    var c = T.dados.config, link = API.linkCliente();
    el.innerHTML = cabecalho('Ajustes') +
      '<div class="cartao secao-painel"><h3>Link para os clientes</h3><p class="texto-suave">Coloque na bio do Instagram, no status do WhatsApp e no Google Meu Negócio.</p>' +
      '<div class="linha-acao"><span class="etiqueta-api">' + esc(link) + '</span><button class="btn btn-destaque btn-p" id="copiar-link">' + ic('content_copy') + 'Copiar</button>' +
      (navigator.share ? '<button class="btn btn-fantasma btn-p" id="compartilhar">' + ic('share') + 'Compartilhar</button>' : '') + '</div></div>' +
      '<div class="cartao secao-painel"><h3>Regras da agenda</h3><div class="duas">' +
      '<div class="campo"><label>Intervalo entre horários</label><select id="r-int">' + [10, 15, 20, 30, 40, 45, 60].map(function (m) { return '<option value="' + m + '"' + (c.intervalo === m ? ' selected' : '') + '>' + m + ' min</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Antecedência mínima</label><select id="r-ant">' + [[0, 'Nenhuma'], [30, '30 min'], [60, '1 hora'], [120, '2 horas'], [240, '4 horas'], [720, '12 horas'], [1440, '1 dia']].map(function (o) { return '<option value="' + o[0] + '"' + (c.antecedencia === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Agenda aberta por</label><select id="r-dias">' + [7, 14, 21, 30, 45, 60, 90].map(function (n) { return '<option value="' + n + '"' + (c.diasAFrente === n ? ' selected' : '') + '>' + n + ' dias</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Cliente cancela pelo site até</label><select id="r-canc">' + [[0, 'A qualquer hora'], [1, '1h antes'], [2, '2h antes'], [3, '3h antes'], [6, '6h antes'], [12, '12h antes'], [24, '24h antes']].map(function (o) { return '<option value="' + o[0] + '"' + (c.cancelarAteHoras === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div></div>' +
      '<label class="chave">Pedir e-mail do cliente<input type="checkbox" id="r-email"' + (c.pedirEmail ? ' checked' : '') + '></label>' +
      '<label class="chave">Pedir data de nascimento<input type="checkbox" id="r-nasc"' + (c.pedirNascimento ? ' checked' : '') + '></label></div>' +
      '<div class="cartao secao-painel"><h3>Mensagens do WhatsApp</h3><p class="texto-suave pequeno" style="margin-bottom:10px">Use {nome}, {barbearia}, {data}, {hora}, {profissional}, {servicos}, {codigo}, {valor}.</p>' +
      '<div class="campo"><label>Confirmação</label><textarea id="m-conf" maxlength="600">' + esc(c.mensagemConfirmacao) + '</textarea></div>' +
      '<div class="campo"><label>Lembrete</label><textarea id="m-lemb" maxlength="600">' + esc(c.mensagemLembrete) + '</textarea></div>' +
      '<button class="btn btn-destaque" id="salvar-regras">' + ic('save') + 'Salvar regras e mensagens</button></div>' +
      '<div class="cartao secao-painel"><h3>Senha do painel</h3><div class="duas"><div class="campo"><label>Senha atual</label><input type="password" id="s-atual" autocomplete="current-password"></div>' +
      '<div class="campo"><label>Senha nova</label><input type="password" id="s-nova" autocomplete="new-password" minlength="6"></div></div>' +
      '<button class="btn btn-fantasma" id="trocar-senha">' + ic('key') + 'Trocar senha</button><p class="texto-suave pequeno" style="margin-top:8px">Ao trocar, os outros aparelhos saem do painel.</p></div>' +
      '<div class="cartao secao-painel"><h3>Servidor</h3><p class="texto-suave pequeno" style="word-break:break-all">' + (API.alvo.modo === 'demo' ? 'Modo demonstração (sem servidor).' : esc(API.alvo.url)) +
      '</p><p class="texto-suave pequeno">Versão ' + esc(T.dados.versao) + '</p>' + (API.alvo.modo === 'real' && !API.alvo.fixo ? '<button class="btn btn-fantasma btn-p" id="desligar" style="margin-top:10px">' + ic('link_off') + 'Desligar este aparelho do servidor</button>' : '') + '</div>';
    $('#copiar-link').onclick = function () { U.copiar(link); };
    if ($('#compartilhar')) $('#compartilhar').onclick = function () { navigator.share({ title: c.nome, text: 'Agende seu horário na ' + c.nome, url: link }).catch(function () {}); };
    $('#salvar-regras').onclick = function () {
      var b = this; U.ocupado(b, true, 'Salvando');
      chamar('salvarConfig', { config: { intervalo: $('#r-int').value, antecedencia: $('#r-ant').value, diasAFrente: $('#r-dias').value, cancelarAteHoras: $('#r-canc').value,
        pedirEmail: $('#r-email').checked, pedirNascimento: $('#r-nasc').checked, mensagemConfirmacao: $('#m-conf').value, mensagemLembrete: $('#m-lemb').value } })
        .then(function (r) { T.dados.config = r.config; U.ocupado(b, false); U.aviso('Salvo.'); }).catch(function (e) { U.ocupado(b, false); falha(e); });
    };
    $('#trocar-senha').onclick = function () {
      var b = this;
      if ($('#s-nova').value.length < 6) { falha(new Error('A senha nova precisa de pelo menos 6 caracteres.')); return; }
      U.ocupado(b, true, 'Trocando');
      chamar('trocarSenha', { atual: $('#s-atual').value, nova: $('#s-nova').value }).then(function (r) {
        T.token = r.token; localStorage.setItem(API.chaveToken(), r.token); U.ocupado(b, false); $('#s-atual').value = $('#s-nova').value = ''; U.aviso('Senha trocada.');
      }).catch(function (e) { U.ocupado(b, false); falha(e); });
    };
    if ($('#desligar')) $('#desligar').onclick = function () {
      U.confirmar('Desligar este aparelho', 'Nada é apagado. Para voltar, cole o endereço de novo em Ligar o sistema.', 'Desligar', true).then(function (s) {
        if (!s) return; localStorage.removeItem(API.chaveToken()); API.esquecerServidor(); location.href = 'ligar.html';
      });
    };
  };

  iniciar();
})();
