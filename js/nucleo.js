/*
 * Agenda Barbearia: núcleo das regras.
 * Este mesmo arquivo roda no navegador (modo demonstração) e no Apps Script (Nucleo.gs).
 * Não use nada específico do navegador nem do Google aqui: tudo de fora chega pelo "ctx".
 *
 * ctx = {
 *   banco: { listar(tabela), inserir(tabela, obj), atualizar(tabela, id, campos), remover(tabela, id),
 *            lerConfig(), salvarConfig(campos), segredo(chave), guardarSegredo(chave, valor) },
 *   agora(): { data: 'AAAA-MM-DD', minutos: 0..1439, iso: '...' },
 *   aleatorio(n): texto aleatório de n caracteres [a-z0-9],
 *   http(pedidos): [{ codigo }]   pedidos = [{ url, corpo, cabecalhos }],
 *   email(para, assunto, texto), emailDono(): texto,
 *   travar(fn): roda fn com trava (evita dois agendamentos no mesmo horário),
 *   robos(ligar): liga/desliga as rotinas diárias (só no servidor)
 * }
 */
var Nucleo = (function () {
  'use strict';

  var VERSAO = '1.0.0';

  var TABELAS = {
    Servicos: ['id', 'nome', 'valor', 'duracao', 'descricao', 'ativo', 'ordem'],
    Profissionais: ['id', 'nome', 'foto', 'telefone', 'servicos', 'turnos', 'ativo', 'ordem'],
    Clientes: ['id', 'nome', 'whatsapp', 'email', 'nascimento', 'criadoEm', 'obs'],
    Agendamentos: ['id', 'codigo', 'criadoEm', 'data', 'inicio', 'fim', 'duracao', 'profissionalId',
      'profissionalNome', 'clienteId', 'clienteNome', 'whatsapp', 'servicos', 'valor', 'status', 'origem', 'obs'],
    Bloqueios: ['id', 'data', 'profissionalId', 'inicio', 'fim', 'motivo'],
    Log: ['quando', 'tipo', 'detalhe']
  };

  var CONFIG_PADRAO = {
    nome: 'Sua Barbearia',
    slogan: 'Corte, barba e cuidado no horário marcado.',
    logo: '',
    corDestaque: '#C8A04A',
    tema: 'escuro',
    whatsapp: '',
    telefone: '',
    instagram: '',
    endereco: '',
    mapa: '',
    sobre: '',
    intervalo: 30,
    antecedencia: 60,
    diasAFrente: 30,
    cancelarAteHoras: 2,
    pedirNascimento: true,
    pedirEmail: true,
    mensagemLembrete: 'Olá, {nome}! Passando para lembrar do seu horário na {barbearia}: {data} às {hora} com {profissional}. Até lá!',
    mensagemConfirmacao: 'Olá, {nome}! Seu horário na {barbearia} está confirmado: {data} às {hora} com {profissional} ({servicos}). Código: {codigo}.'
  };

  var CAMPOS_CONFIG = Object.keys(CONFIG_PADRAO);

  var EVENTOS = ['agendamento.criado', 'agendamento.cancelado', 'agendamento.concluido',
    'agendamento.faltou', 'cliente.criado'];

  var STATUS = ['confirmado', 'concluido', 'cancelado', 'faltou'];
  var OCUPA = { confirmado: true, concluido: true };

  // ------------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------------
  function ErroPublico(msg) { var e = new Error(msg); e.publico = true; return e; }
  function falhar(msg) { throw ErroPublico(msg); }

  function texto(v, max) {
    var s = (v === null || v === undefined) ? '' : String(v);
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
    return max ? s.slice(0, max) : s;
  }
  function numero(v, padrao) {
    if (typeof v === 'number') return isFinite(v) ? v : (padrao || 0);
    var s = String(v === undefined || v === null ? '' : v).replace(/[^\d,.-]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : (padrao || 0);
  }
  function inteiro(v, padrao) { return Math.round(numero(v, padrao)); }
  function booleano(v) { return v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1' || v === 'sim'; }
  function soDigitos(v) { return String(v || '').replace(/\D/g, ''); }
  function whatsapp(v) {
    var d = soDigitos(v);
    if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
    return d;
  }
  function lerJSON(v, padrao) {
    if (v && typeof v === 'object') return v;
    try { var r = JSON.parse(v); return (r === null || r === undefined) ? padrao : r; } catch (e) { return padrao; }
  }
  function dinheiro(v) { return Math.round(numero(v) * 100) / 100; }

  function dataValida(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
  function horaValida(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || '')) || s === '24:00'; }
  function paraMin(h) { var p = String(h || '0:0').split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1] || 0, 10); }
  function paraHora(m) {
    var h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function partesData(s) { var p = s.split('-'); return [parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10)]; }
  function diaSemana(s) { var p = partesData(s); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
  function somarDias(s, n) {
    var p = partesData(s);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
  }
  function diasEntre(a, b) {
    var pa = partesData(a), pb = partesData(b);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  }
  function dataBR(s) { if (!dataValida(s)) return s || ''; var p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function duracaoTexto(min) {
    min = inteiro(min);
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    return m ? h + 'h' + (m < 10 ? '0' : '') + m : h + 'h';
  }
  function preencher(modelo, valores) {
    return String(modelo || '').replace(/\{(\w+)\}/g, function (t, k) {
      return Object.prototype.hasOwnProperty.call(valores, k) ? String(valores[k]) : t;
    });
  }

  // ------------------------------------------------------------------
  // SHA-256 e HMAC (puro, para rodar igual nos dois lados)
  // ------------------------------------------------------------------
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];

  function utf8(s) {
    var b = unescape(encodeURIComponent(String(s))), out = [];
    for (var i = 0; i < b.length; i++) out.push(b.charCodeAt(i));
    return out;
  }
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function sha256Bytes(bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var msg = bytes.slice(), bits = bytes.length * 8, i, t;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    var alto = Math.floor(bits / 4294967296), baixo = bits >>> 0;
    msg.push((alto >>> 24) & 255, (alto >>> 16) & 255, (alto >>> 8) & 255, alto & 255,
      (baixo >>> 24) & 255, (baixo >>> 16) & 255, (baixo >>> 8) & 255, baixo & 255);
    var w = new Array(64);
    for (var j = 0; j < msg.length; j += 64) {
      for (t = 0; t < 16; t++) w[t] = (msg[j + 4 * t] << 24) | (msg[j + 4 * t + 1] << 16) | (msg[j + 4 * t + 2] << 8) | msg[j + 4 * t + 3];
      for (t = 16; t < 64; t++) {
        var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[t] + w[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = [];
    for (i = 0; i < 8; i++) out.push((H[i] >>> 24) & 255, (H[i] >>> 16) & 255, (H[i] >>> 8) & 255, H[i] & 255);
    return out;
  }
  function hex(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2); return s; }
  function sha256(s) { return hex(sha256Bytes(utf8(s))); }
  function hmac(chave, msg) {
    var k = utf8(chave);
    if (k.length > 64) k = sha256Bytes(k);
    while (k.length < 64) k.push(0);
    var ipad = [], opad = [];
    for (var i = 0; i < 64; i++) { ipad.push(k[i] ^ 0x36); opad.push(k[i] ^ 0x5c); }
    return hex(sha256Bytes(opad.concat(sha256Bytes(ipad.concat(utf8(msg))))));
  }

  // ------------------------------------------------------------------
  // Leitura e conversão das linhas
  // ------------------------------------------------------------------
  function config(ctx) {
    var c = ctx.banco.lerConfig() || {}, out = {};
    CAMPOS_CONFIG.forEach(function (k) {
      var padrao = CONFIG_PADRAO[k], v = c[k];
      if (v === undefined || v === null) { out[k] = padrao; return; }
      if (v === '') { out[k] = (typeof padrao === 'string' && k !== 'nome') ? '' : padrao; return; }
      if (typeof padrao === 'number') out[k] = numero(v, padrao);
      else if (typeof padrao === 'boolean') out[k] = booleano(v);
      else out[k] = String(v);
    });
    return out;
  }

  function servicoDeLinha(l) {
    return { id: String(l.id), nome: texto(l.nome), valor: dinheiro(l.valor), duracao: inteiro(l.duracao, 30),
      descricao: texto(l.descricao), ativo: l.ativo === '' || l.ativo === undefined ? true : booleano(l.ativo), ordem: inteiro(l.ordem) };
  }
  function profDeLinha(l) {
    return { id: String(l.id), nome: texto(l.nome), foto: String(l.foto || ''), telefone: whatsapp(l.telefone),
      servicos: lerJSON(l.servicos, []), turnos: lerJSON(l.turnos, []),
      ativo: l.ativo === '' || l.ativo === undefined ? true : booleano(l.ativo), ordem: inteiro(l.ordem) };
  }
  function agDeLinha(l) {
    return { id: String(l.id), codigo: String(l.codigo || ''), criadoEm: String(l.criadoEm || ''), data: String(l.data || ''),
      inicio: String(l.inicio || ''), fim: String(l.fim || ''), duracao: inteiro(l.duracao), profissionalId: String(l.profissionalId || ''),
      profissionalNome: texto(l.profissionalNome), clienteId: String(l.clienteId || ''), clienteNome: texto(l.clienteNome),
      whatsapp: whatsapp(l.whatsapp), servicos: texto(l.servicos), valor: dinheiro(l.valor), status: String(l.status || 'confirmado'),
      origem: String(l.origem || ''), obs: texto(l.obs) };
  }
  function clienteDeLinha(l) {
    return { id: String(l.id), nome: texto(l.nome), whatsapp: whatsapp(l.whatsapp), email: texto(l.email),
      nascimento: String(l.nascimento || ''), criadoEm: String(l.criadoEm || ''), obs: texto(l.obs) };
  }
  function bloqDeLinha(l) {
    return { id: String(l.id), data: String(l.data || ''), profissionalId: String(l.profissionalId || ''),
      inicio: String(l.inicio || ''), fim: String(l.fim || ''), motivo: texto(l.motivo) };
  }

  function servicos(ctx) { return ctx.banco.listar('Servicos').map(servicoDeLinha).sort(porOrdem); }
  function profissionais(ctx) { return ctx.banco.listar('Profissionais').map(profDeLinha).sort(porOrdem); }
  function agendamentos(ctx) { return ctx.banco.listar('Agendamentos').map(agDeLinha); }
  function clientes(ctx) { return ctx.banco.listar('Clientes').map(clienteDeLinha); }
  function bloqueios(ctx) { return ctx.banco.listar('Bloqueios').map(bloqDeLinha); }
  function porOrdem(a, b) { return (a.ordem - b.ordem) || a.nome.localeCompare(b.nome); }

  function novoId(ctx, prefixo) { return prefixo + ctx.aleatorio(8); }
  function novoCodigo(ctx) {
    var alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', base = ctx.aleatorio(12), s = '';
    for (var i = 0; i < 6; i++) s += alfabeto[(base.charCodeAt(i) * 7 + base.charCodeAt(i + 6)) % alfabeto.length];
    return s;
  }

  function registrar(ctx, tipo, detalhe) {
    try {
      ctx.banco.inserir('Log', { quando: ctx.agora().iso, tipo: tipo, detalhe: texto(detalhe, 400) });
    } catch (e) { /* o log nunca derruba a ação */ }
  }

  // ------------------------------------------------------------------
  // Motor de horários
  // ------------------------------------------------------------------
  function servicosDoProf(prof, todos) {
    var ativos = todos.filter(function (s) { return s.ativo; });
    if (!prof.servicos || !prof.servicos.length) return ativos;
    return ativos.filter(function (s) { return prof.servicos.indexOf(s.id) >= 0; });
  }

  /** Intervalos ocupados de um profissional num dia (agendamentos + bloqueios). */
  function ocupados(data, profId, ags, bloqs, ignorarId) {
    var lista = [];
    ags.forEach(function (a) {
      if (a.data === data && a.profissionalId === profId && OCUPA[a.status] && a.id !== ignorarId) {
        lista.push([paraMin(a.inicio), paraMin(a.fim)]);
      }
    });
    bloqs.forEach(function (b) {
      if (b.data === data && (!b.profissionalId || b.profissionalId === profId)) {
        lista.push([b.inicio ? paraMin(b.inicio) : 0, b.fim ? paraMin(b.fim) : 1440]);
      }
    });
    return lista;
  }

  function livresDoProf(cfg, agora, data, prof, duracao, ags, bloqs, ignorarId) {
    var dia = diaSemana(data);
    var turnos = (prof.turnos || []).filter(function (t) { return Number(t.dia) === dia; });
    var oc = ocupados(data, prof.id, ags, bloqs, ignorarId);
    var passo = Math.max(5, inteiro(cfg.intervalo, 30));
    var minimo = data === agora.data ? agora.minutos + Math.max(0, inteiro(cfg.antecedencia)) : -1;
    var livres = [];
    turnos.forEach(function (t) {
      var ini = paraMin(t.inicio), fim = paraMin(t.fim);
      for (var m = ini; m + duracao <= fim; m += passo) {
        if (m < minimo) continue;
        var bate = oc.some(function (o) { return m < o[1] && (m + duracao) > o[0]; });
        if (!bate) livres.push(m);
      }
    });
    return livres;
  }

  function validarDia(cfg, agora, data) {
    if (!dataValida(data)) falhar('Escolha uma data.');
    var dif = diasEntre(agora.data, data);
    if (dif < 0) falhar('Essa data já passou.');
    if (dif > inteiro(cfg.diasAFrente, 30)) falhar('A agenda abre só ' + inteiro(cfg.diasAFrente, 30) + ' dias para a frente.');
  }

  function escolha(ctx, servicoIds, profId) {
    var todos = servicos(ctx), profs = profissionais(ctx).filter(function (p) { return p.ativo; });
    var ids = (servicoIds || []).map(String);
    if (!ids.length) falhar('Escolha pelo menos um serviço.');
    var escolhidos = ids.map(function (id) {
      var s = todos.filter(function (x) { return x.id === id && x.ativo; })[0];
      if (!s) falhar('Um dos serviços escolhidos não está mais disponível. Atualize a página.');
      return s;
    });
    var candidatos;
    if (!profId || profId === 'qualquer') candidatos = profs;
    else candidatos = profs.filter(function (p) { return p.id === String(profId); });
    if (!candidatos.length) falhar('Esse profissional não está disponível.');
    candidatos = candidatos.filter(function (p) {
      var dele = servicosDoProf(p, todos).map(function (s) { return s.id; });
      return escolhidos.every(function (s) { return dele.indexOf(s.id) >= 0; });
    });
    if (!candidatos.length) falhar('Nenhum profissional faz todos esses serviços juntos.');
    var duracao = escolhidos.reduce(function (t, s) { return t + s.duracao; }, 0);
    var valor = escolhidos.reduce(function (t, s) { return t + s.valor; }, 0);
    return { servicos: escolhidos, profissionais: candidatos, duracao: duracao, valor: dinheiro(valor) };
  }

  function horarios(ctx, p) {
    var cfg = config(ctx), agora = ctx.agora();
    validarDia(cfg, agora, p.data);
    var esc = escolha(ctx, p.servicos, p.profissionalId);
    var ags = agendamentos(ctx), bloqs = bloqueios(ctx);
    var mapa = {};
    esc.profissionais.forEach(function (prof) {
      livresDoProf(cfg, agora, p.data, prof, esc.duracao, ags, bloqs).forEach(function (m) {
        (mapa[m] = mapa[m] || []).push(prof.id);
      });
    });
    var lista = Object.keys(mapa).map(Number).sort(function (a, b) { return a - b; }).map(function (m) {
      return { hora: paraHora(m), profissionais: mapa[m] };
    });
    return { data: p.data, duracao: esc.duracao, valor: esc.valor, horarios: lista };
  }

  // ------------------------------------------------------------------
  // Clientes
  // ------------------------------------------------------------------
  function acharOuCriarCliente(ctx, dados) {
    var zap = whatsapp(dados.whatsapp);
    if (zap.length < 10 || zap.length > 11) falhar('Confira o WhatsApp: use DDD e número, como 11 91234-5678.');
    var nome = texto(dados.nome, 80);
    if (nome.length < 2) falhar('Escreva seu nome.');
    var existente = clientes(ctx).filter(function (c) { return c.whatsapp === zap; })[0];
    if (existente) {
      var campos = {};
      if (nome && nome !== existente.nome) campos.nome = nome;
      if (dados.email && texto(dados.email, 120) !== existente.email) campos.email = texto(dados.email, 120);
      if (dados.nascimento && dataValida(dados.nascimento) && dados.nascimento !== existente.nascimento) campos.nascimento = dados.nascimento;
      if (Object.keys(campos).length) ctx.banco.atualizar('Clientes', existente.id, campos);
      for (var k in campos) existente[k] = campos[k];
      return { cliente: existente, novo: false };
    }
    var c = { id: novoId(ctx, 'c'), nome: nome, whatsapp: zap, email: texto(dados.email, 120),
      nascimento: dataValida(dados.nascimento) ? dados.nascimento : '', criadoEm: ctx.agora().iso, obs: '' };
    ctx.banco.inserir('Clientes', c);
    return { cliente: c, novo: true };
  }

  // ------------------------------------------------------------------
  // Integrações: webhooks de saída
  // ------------------------------------------------------------------
  function integracoes(ctx) {
    var i = lerJSON(ctx.banco.segredo('integracoes'), {}) || {};
    return {
      webhooks: Array.isArray(i.webhooks) ? i.webhooks : [],
      segredoWebhook: i.segredoWebhook || '',
      apiChave: i.apiChave || '',
      emailDono: i.emailDono === undefined ? '' : i.emailDono,
      avisarDono: i.avisarDono === undefined ? true : !!i.avisarDono,
      lembreteCliente: i.lembreteCliente === undefined ? true : !!i.lembreteCliente,
      resumoDiario: !!i.resumoDiario,
      robos: !!i.robos
    };
  }
  function guardarIntegracoes(ctx, i) { ctx.banco.guardarSegredo('integracoes', JSON.stringify(i)); }

  function agPublico(a) {
    return { id: a.id, codigo: a.codigo, data: a.data, inicio: a.inicio, fim: a.fim, duracao: a.duracao,
      profissional: { id: a.profissionalId, nome: a.profissionalNome },
      cliente: { id: a.clienteId, nome: a.clienteNome, whatsapp: a.whatsapp },
      servicos: a.servicos, valor: a.valor, status: a.status, origem: a.origem, obs: a.obs, criadoEm: a.criadoEm };
  }

  function disparar(ctx, evento, dados, soEste) {
    var integ = integracoes(ctx);
    var alvos = integ.webhooks.filter(function (w) {
      if (soEste) return w.id === soEste;
      return w.ativo !== false && w.url && (!w.eventos || !w.eventos.length || w.eventos.indexOf(evento) >= 0);
    });
    if (!alvos.length) return [];
    var corpo = JSON.stringify({ evento: evento, quando: ctx.agora().iso, barbearia: config(ctx).nome, dados: dados });
    var assinatura = integ.segredoWebhook ? hmac(integ.segredoWebhook, corpo) : '';
    var pedidos = alvos.map(function (w) {
      return { url: w.url, corpo: corpo, cabecalhos: { 'X-Agenda-Evento': evento, 'X-Agenda-Assinatura': 'sha256=' + assinatura } };
    });
    var res = [];
    try { res = ctx.http(pedidos) || []; } catch (e) { res = pedidos.map(function () { return { codigo: 0, erro: String(e) }; }); }
    alvos.forEach(function (w, i) {
      var r = res[i] || {};
      registrar(ctx, 'webhook', evento + ' -> ' + w.url + ' = ' + (r.codigo || 'falhou') + (r.erro ? ' (' + r.erro + ')' : ''));
    });
    return res;
  }

  function avisarDono(ctx, a) {
    var integ = integracoes(ctx);
    if (!integ.avisarDono) return;
    var para = integ.emailDono || (ctx.emailDono ? ctx.emailDono() : '');
    if (!para) return;
    var cfg = config(ctx);
    try {
      ctx.email(para, 'Novo agendamento: ' + a.clienteNome + ' em ' + dataBR(a.data) + ' às ' + a.inicio,
        'Novo agendamento na ' + cfg.nome + '\n\n' +
        'Cliente: ' + a.clienteNome + '\nWhatsApp: ' + a.whatsapp + '\nProfissional: ' + a.profissionalNome +
        '\nData: ' + dataBR(a.data) + ' às ' + a.inicio + ' (' + duracaoTexto(a.duracao) + ')' +
        '\nServiços: ' + a.servicos + '\nValor: R$ ' + a.valor.toFixed(2).replace('.', ',') +
        (a.obs ? '\nObservação: ' + a.obs : '') + '\n\nCódigo: ' + a.codigo);
    } catch (e) { registrar(ctx, 'email', 'Falhou o aviso ao dono: ' + e); }
  }

  // ------------------------------------------------------------------
  // Criar agendamento (cliente, painel ou API)
  // ------------------------------------------------------------------
  function criarAgendamento(ctx, p, origem) {
    var cfg = config(ctx);
    return ctx.travar(function () {
      var agora = ctx.agora();
      var painel = origem === 'painel';
      if (!painel) validarDia(cfg, agora, p.data);
      else if (!dataValida(p.data)) falhar('Escolha uma data.');
      if (!horaValida(p.inicio)) falhar('Escolha um horário.');
      var esc = escolha(ctx, p.servicos, p.profissionalId);
      var ags = agendamentos(ctx), bloqs = bloqueios(ctx), ini = paraMin(p.inicio), prof = null;
      for (var i = 0; i < esc.profissionais.length && !prof; i++) {
        var c = esc.profissionais[i];
        if (painel && p.forcar && String(p.profissionalId) === c.id) { prof = c; break; }
        var cfgUsada = painel ? merge(cfg, { antecedencia: -100000 }) : cfg;
        var agoraUsado = painel ? { data: '0000-00-00', minutos: 0 } : agora;
        if (livresDoProf(cfgUsada, agoraUsado, p.data, c, esc.duracao, ags, bloqs).indexOf(ini) >= 0) prof = c;
      }
      if (!prof) {
        if (painel) falhar('Esse horário está ocupado ou fora do expediente. Marque "Encaixar mesmo assim" se quiser forçar.');
        falhar('Esse horário acabou de ser ocupado. Escolha outro, por favor.');
      }
      var cli = acharOuCriarCliente(ctx, p);
      var a = {
        id: novoId(ctx, 'a'), codigo: novoCodigo(ctx), criadoEm: agora.iso, data: p.data, inicio: paraHora(ini),
        fim: paraHora(ini + esc.duracao), duracao: esc.duracao, profissionalId: prof.id, profissionalNome: prof.nome,
        clienteId: cli.cliente.id, clienteNome: cli.cliente.nome, whatsapp: cli.cliente.whatsapp,
        servicos: esc.servicos.map(function (s) { return s.nome; }).join(', '), valor: esc.valor,
        status: 'confirmado', origem: origem, obs: texto(p.obs, 300)
      };
      ctx.banco.inserir('Agendamentos', a);
      if (cli.novo) disparar(ctx, 'cliente.criado', cli.cliente);
      disparar(ctx, 'agendamento.criado', agPublico(a));
      if (origem !== 'painel') avisarDono(ctx, a);
      return a;
    });
  }
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  function mudarStatus(ctx, id, status, motivo) {
    if (STATUS.indexOf(status) < 0) falhar('Situação inválida.');
    var a = agendamentos(ctx).filter(function (x) { return x.id === String(id); })[0];
    if (!a) falhar('Agendamento não encontrado.');
    var campos = { status: status };
    if (motivo) campos.obs = texto((a.obs ? a.obs + ' | ' : '') + motivo, 300);
    ctx.banco.atualizar('Agendamentos', a.id, campos);
    a.status = status; if (campos.obs) a.obs = campos.obs;
    var ev = { cancelado: 'agendamento.cancelado', concluido: 'agendamento.concluido', faltou: 'agendamento.faltou' }[status];
    if (ev) disparar(ctx, ev, agPublico(a));
    return a;
  }

  // ------------------------------------------------------------------
  // Ações públicas (página do cliente)
  // ------------------------------------------------------------------
  function infoPublica(ctx) {
    var cfg = config(ctx), todos = servicos(ctx);
    var profs = profissionais(ctx).filter(function (p) { return p.ativo; }).map(function (p) {
      return { id: p.id, nome: p.nome, foto: p.foto, servicos: servicosDoProf(p, todos).map(function (s) { return s.id; }),
        dias: p.turnos.map(function (t) { return Number(t.dia); }).filter(function (d, i, arr) { return arr.indexOf(d) === i; }) };
    });
    return {
      versao: VERSAO,
      configurado: !!ctx.banco.segredo('senhaHash'),
      config: cfg,
      servicos: todos.filter(function (s) { return s.ativo; }),
      profissionais: profs,
      hoje: ctx.agora().data
    };
  }

  var PUBLICAS = {
    info: function (ctx) { return infoPublica(ctx); },
    horarios: function (ctx, p) { return horarios(ctx, p); },
    agendar: function (ctx, p) {
      var a = criarAgendamento(ctx, p, 'site');
      return { agendamento: agPublico(a) };
    },
    meusHorarios: function (ctx, p) {
      var zap = whatsapp(p.whatsapp);
      var codigos = (p.codigos || []).map(function (c) { return String(c).toUpperCase().trim(); });
      if (!zap || !codigos.length) falhar('Informe o WhatsApp e o código da reserva.');
      var hoje = ctx.agora().data;
      var lista = agendamentos(ctx).filter(function (a) {
        return a.whatsapp === zap && codigos.indexOf(a.codigo) >= 0 && a.data >= hoje;
      }).sort(function (x, y) { return (x.data + x.inicio).localeCompare(y.data + y.inicio); });
      return { agendamentos: lista.map(agPublico) };
    },
    cancelar: function (ctx, p) {
      var zap = whatsapp(p.whatsapp), cod = String(p.codigo || '').toUpperCase().trim();
      var a = agendamentos(ctx).filter(function (x) { return x.codigo === cod && x.whatsapp === zap; })[0];
      if (!a) falhar('Não achamos essa reserva. Confira o código e o WhatsApp.');
      if (a.status !== 'confirmado') falhar('Essa reserva já não está ativa.');
      var cfg = config(ctx), agora = ctx.agora();
      var faltaMin = diasEntre(agora.data, a.data) * 1440 + paraMin(a.inicio) - agora.minutos;
      var limite = inteiro(cfg.cancelarAteHoras) * 60;
      if (faltaMin < limite) falhar('Pelo site dá para cancelar até ' + inteiro(cfg.cancelarAteHoras) + 'h antes. Fale com a barbearia pelo WhatsApp.');
      return { agendamento: agPublico(mudarStatus(ctx, a.id, 'cancelado', 'Cancelado pelo cliente')) };
    }
  };

  // ------------------------------------------------------------------
  // Acesso do dono
  // ------------------------------------------------------------------
  function sessoes(ctx) { return lerJSON(ctx.banco.segredo('sessoes'), {}) || {}; }
  function criarSessao(ctx) {
    var s = sessoes(ctx), agora = Date.parse(ctx.agora().iso) || 0, token = ctx.aleatorio(40);
    Object.keys(s).forEach(function (k) { if (s[k] < agora) delete s[k]; });
    var chaves = Object.keys(s).sort(function (a, b) { return s[a] - s[b]; });
    while (chaves.length >= 10) delete s[chaves.shift()];
    s[sha256(token)] = agora + 30 * 86400000;
    ctx.banco.guardarSegredo('sessoes', JSON.stringify(s));
    return token;
  }
  function exigirSessao(ctx, token) {
    if (!token) falhar('Entre de novo no painel.');
    var s = sessoes(ctx), k = sha256(String(token)), agora = Date.parse(ctx.agora().iso) || 0;
    if (!s[k] || s[k] < agora) { var e = ErroPublico('Sua sessão expirou. Entre de novo.'); e.sessao = true; throw e; }
  }
  function definirSenha(ctx, senha) {
    senha = String(senha || '');
    if (senha.length < 6) falhar('A senha precisa de pelo menos 6 caracteres.');
    var sal = ctx.aleatorio(16);
    ctx.banco.guardarSegredo('senhaSal', sal);
    ctx.banco.guardarSegredo('senhaHash', sha256(sal + ':' + senha));
    ctx.banco.guardarSegredo('sessoes', '{}');
  }
  function senhaConfere(ctx, senha) {
    var sal = ctx.banco.segredo('senhaSal') || '';
    return sha256(sal + ':' + String(senha || '')) === ctx.banco.segredo('senhaHash');
  }

  var ACESSO = {
    primeiroAcesso: function (ctx, p) {
      if (ctx.banco.segredo('senhaHash')) falhar('Este sistema já tem senha. Use a tela de entrar.');
      definirSenha(ctx, p.senha);
      if (p.nome) ctx.banco.salvarConfig({ nome: texto(p.nome, 60) });
      registrar(ctx, 'acesso', 'Senha criada no primeiro acesso');
      return { token: criarSessao(ctx) };
    },
    entrar: function (ctx, p) {
      if (!ctx.banco.segredo('senhaHash')) falhar('Crie a senha no primeiro acesso.');
      var agora = Date.parse(ctx.agora().iso) || 0;
      var trava = lerJSON(ctx.banco.segredo('tentativas'), { n: 0, ate: 0 });
      if (trava.ate > agora) falhar('Muitas tentativas. Espere alguns minutos e tente de novo.');
      if (!senhaConfere(ctx, p.senha)) {
        trava.n = (trava.n || 0) + 1;
        if (trava.n >= 5) { trava.ate = agora + 10 * 60000; trava.n = 0; }
        ctx.banco.guardarSegredo('tentativas', JSON.stringify(trava));
        registrar(ctx, 'acesso', 'Senha errada no painel');
        falhar('Senha incorreta.');
      }
      ctx.banco.guardarSegredo('tentativas', JSON.stringify({ n: 0, ate: 0 }));
      return { token: criarSessao(ctx) };
    }
  };

  // ------------------------------------------------------------------
  // Ações do painel (precisam de sessão)
  // ------------------------------------------------------------------
  function resumoMes(ctx, mes) {
    var agora = ctx.agora(), hoje = agora.data;
    mes = /^\d{4}-\d{2}$/.test(String(mes || '')) ? mes : hoje.slice(0, 7);
    var ags = agendamentos(ctx), r = {
      mes: mes, faturamentoDia: 0, faturamentoMes: 0, atendimentosMes: 0, cancelamentosMes: 0, faltasMes: 0,
      ticketMedio: 0, servicoTop: '', porDia: {}, ranking: [], proximos: [], clientesNovos: 0, aniversariantes: []
    };
    var contServ = {}, rank = {};
    ags.forEach(function (a) {
      if (a.data.slice(0, 7) !== mes) return;
      if (a.status === 'cancelado') { r.cancelamentosMes++; return; }
      if (a.status === 'faltou') { r.faltasMes++; return; }
      r.faturamentoMes += a.valor; r.atendimentosMes++;
      var d = parseInt(a.data.slice(8, 10), 10);
      r.porDia[d] = (r.porDia[d] || 0) + 1;
      var k = a.profissionalNome || 'Sem nome';
      rank[k] = rank[k] || { nome: k, atendimentos: 0, faturamento: 0 };
      rank[k].atendimentos++; rank[k].faturamento += a.valor;
      a.servicos.split(',').forEach(function (s) { s = s.trim(); if (s) contServ[s] = (contServ[s] || 0) + 1; });
    });
    ags.forEach(function (a) {
      if (a.data === hoje && OCUPA[a.status]) {
        r.faturamentoDia += a.valor;
        if (paraMin(a.fim) > agora.minutos && a.status === 'confirmado') r.proximos.push(agPublico(a));
      }
    });
    r.proximos.sort(function (x, y) { return x.inicio.localeCompare(y.inicio); });
    r.proximos = r.proximos.slice(0, 5);
    r.ticketMedio = r.atendimentosMes ? dinheiro(r.faturamentoMes / r.atendimentosMes) : 0;
    r.faturamentoMes = dinheiro(r.faturamentoMes); r.faturamentoDia = dinheiro(r.faturamentoDia);
    var top = 0; for (var s in contServ) if (contServ[s] > top) { top = contServ[s]; r.servicoTop = s; }
    r.ranking = Object.keys(rank).map(function (k) { rank[k].faturamento = dinheiro(rank[k].faturamento); return rank[k]; })
      .sort(function (a, b) { return b.faturamento - a.faturamento; });
    var mm = mes.slice(5, 7);
    clientes(ctx).forEach(function (c) {
      if (c.criadoEm && c.criadoEm.slice(0, 7) === mes) r.clientesNovos++;
      if (c.nascimento && c.nascimento.slice(5, 7) === mm) r.aniversariantes.push({ nome: c.nome, whatsapp: c.whatsapp, dia: parseInt(c.nascimento.slice(8, 10), 10) });
    });
    r.aniversariantes.sort(function (a, b) { return a.dia - b.dia; });
    return r;
  }

  function salvarServico(ctx, p) {
    var s = { nome: texto(p.nome, 60), valor: dinheiro(p.valor), duracao: inteiro(p.duracao, 30),
      descricao: texto(p.descricao, 200), ativo: p.ativo === undefined ? true : booleano(p.ativo), ordem: inteiro(p.ordem) };
    if (!s.nome) falhar('Dê um nome ao serviço.');
    if (s.duracao < 5 || s.duracao > 600) falhar('A duração precisa ficar entre 5 e 600 minutos.');
    if (s.valor < 0) falhar('O valor não pode ser negativo.');
    if (p.id) { ctx.banco.atualizar('Servicos', String(p.id), s); s.id = String(p.id); }
    else { s.id = novoId(ctx, 's'); if (!p.ordem) s.ordem = servicos(ctx).length + 1; ctx.banco.inserir('Servicos', s); }
    return s;
  }

  function salvarProfissional(ctx, p) {
    var turnos = (Array.isArray(p.turnos) ? p.turnos : lerJSON(p.turnos, [])).map(function (t) {
      return { dia: inteiro(t.dia), inicio: String(t.inicio || ''), fim: String(t.fim || '') };
    }).filter(function (t) { return t.dia >= 0 && t.dia <= 6 && horaValida(t.inicio) && horaValida(t.fim) && paraMin(t.fim) > paraMin(t.inicio); });
    var foto = String(p.foto || '');
    if (foto && (foto.indexOf('data:image/') !== 0 || foto.length > 48000)) falhar('A foto ficou grande demais. Escolha outra.');
    var s = { nome: texto(p.nome, 60), telefone: whatsapp(p.telefone),
      servicos: JSON.stringify((p.servicos || []).map(String)), turnos: JSON.stringify(turnos),
      ativo: p.ativo === undefined ? true : booleano(p.ativo), ordem: inteiro(p.ordem) };
    if (p.foto !== undefined) s.foto = foto;
    if (!s.nome) falhar('Escreva o nome do profissional.');
    if (p.id) {
      ctx.banco.atualizar('Profissionais', String(p.id), s); s.id = String(p.id);
      // mantém o nome certo nos agendamentos futuros
      var hoje = ctx.agora().data;
      agendamentos(ctx).forEach(function (a) {
        if (a.profissionalId === s.id && a.data >= hoje && a.profissionalNome !== s.nome) ctx.banco.atualizar('Agendamentos', a.id, { profissionalNome: s.nome });
      });
    } else { s.id = novoId(ctx, 'p'); if (!p.ordem) s.ordem = profissionais(ctx).length + 1; if (s.foto === undefined) s.foto = ''; ctx.banco.inserir('Profissionais', s); }
    return profDeLinha(s);
  }

  function salvarConfig(ctx, p) {
    var c = {};
    CAMPOS_CONFIG.forEach(function (k) {
      if (p[k] === undefined) return;
      if (k === 'logo' && String(p[k]).length > 48000) falhar('A logo ficou grande demais. Use uma imagem menor.');
      var padrao = CONFIG_PADRAO[k];
      if (typeof padrao === 'number') c[k] = Math.max(0, inteiro(p[k], padrao));
      else if (typeof padrao === 'boolean') c[k] = booleano(p[k]);
      else c[k] = texto(p[k], k === 'logo' ? 50000 : (k.indexOf('mensagem') === 0 || k === 'sobre' ? 600 : 200));
    });
    if (c.logo && c.logo.indexOf('data:image/') !== 0) falhar('Logo inválida. Envie um arquivo de imagem.');
    if (c.corDestaque && !/^#[0-9a-fA-F]{6}$/.test(c.corDestaque)) falhar('Cor inválida.');
    if (c.tema && c.tema !== 'claro' && c.tema !== 'escuro') c.tema = 'escuro';
    if (c.intervalo !== undefined && (c.intervalo < 5 || c.intervalo > 120)) falhar('O intervalo da agenda precisa ficar entre 5 e 120 minutos.');
    if (c.nome !== undefined && !c.nome) falhar('O nome da barbearia não pode ficar vazio.');
    ctx.banco.salvarConfig(c);
    return config(ctx);
  }

  function integracoesParaTela(ctx) {
    var i = integracoes(ctx);
    return { webhooks: i.webhooks, segredoWebhook: i.segredoWebhook, apiChave: i.apiChave, emailDono: i.emailDono,
      emailPadrao: ctx.emailDono ? ctx.emailDono() : '', avisarDono: i.avisarDono, lembreteCliente: i.lembreteCliente,
      resumoDiario: i.resumoDiario, robos: i.robos, eventos: EVENTOS };
  }

  var ADMIN = {
    sair: function (ctx, p) {
      var s = sessoes(ctx); delete s[sha256(String(p.token))];
      ctx.banco.guardarSegredo('sessoes', JSON.stringify(s));
      return {};
    },
    painel: function (ctx, p) { return resumoMes(ctx, p.mes); },
    tudo: function (ctx) {
      return { config: config(ctx), servicos: servicos(ctx), profissionais: profissionais(ctx), bloqueios: bloqueios(ctx),
        hoje: ctx.agora().data, versao: VERSAO };
    },
    agenda: function (ctx, p) {
      var de = dataValida(p.de) ? p.de : ctx.agora().data, ate = dataValida(p.ate) ? p.ate : de;
      var lista = agendamentos(ctx).filter(function (a) { return a.data >= de && a.data <= ate; })
        .sort(function (x, y) { return (x.data + x.inicio).localeCompare(y.data + y.inicio); });
      return { de: de, ate: ate, agendamentos: lista.map(agPublico) };
    },
    horariosPainel: function (ctx, p) {
      var cfg = config(ctx), esc = escolha(ctx, p.servicos, p.profissionalId);
      if (!dataValida(p.data)) falhar('Escolha uma data.');
      var ags = agendamentos(ctx), bloqs = bloqueios(ctx), mapa = {};
      esc.profissionais.forEach(function (prof) {
        livresDoProf(merge(cfg, { antecedencia: 0 }), ctx.agora(), p.data, prof, esc.duracao, ags, bloqs).forEach(function (m) { (mapa[m] = mapa[m] || []).push(prof.id); });
      });
      return { duracao: esc.duracao, valor: esc.valor, horarios: Object.keys(mapa).map(Number).sort(function (a, b) { return a - b; })
        .map(function (m) { return { hora: paraHora(m), profissionais: mapa[m] }; }) };
    },
    novoAgendamento: function (ctx, p) { return { agendamento: agPublico(criarAgendamento(ctx, p, 'painel')) }; },
    mudarStatus: function (ctx, p) { return { agendamento: agPublico(mudarStatus(ctx, p.id, String(p.status), texto(p.motivo, 120))) }; },
    salvarServico: function (ctx, p) { return { servico: salvarServico(ctx, p) }; },
    removerServico: function (ctx, p) { ctx.banco.remover('Servicos', String(p.id)); return {}; },
    salvarProfissional: function (ctx, p) { return { profissional: salvarProfissional(ctx, p) }; },
    removerProfissional: function (ctx, p) {
      var hoje = ctx.agora().data;
      var futuros = agendamentos(ctx).filter(function (a) { return a.profissionalId === String(p.id) && a.data >= hoje && a.status === 'confirmado'; });
      if (futuros.length && !p.forcar) falhar('Esse profissional tem ' + futuros.length + ' horário(s) marcado(s). Desative em vez de remover, ou cancele os horários antes.');
      ctx.banco.remover('Profissionais', String(p.id)); return {};
    },
    clientes: function (ctx) {
      var ags = agendamentos(ctx), est = {};
      ags.forEach(function (a) {
        var e = est[a.clienteId] = est[a.clienteId] || { visitas: 0, gasto: 0, ultima: '', faltas: 0 };
        if (a.status === 'concluido' || a.status === 'confirmado') { e.visitas++; e.gasto += a.valor; if (a.data > e.ultima) e.ultima = a.data; }
        if (a.status === 'faltou') e.faltas++;
      });
      return { clientes: clientes(ctx).map(function (c) {
        var e = est[c.id] || { visitas: 0, gasto: 0, ultima: '', faltas: 0 };
        c.visitas = e.visitas; c.gasto = dinheiro(e.gasto); c.ultima = e.ultima; c.faltas = e.faltas; return c;
      }).sort(function (a, b) { return a.nome.localeCompare(b.nome); }) };
    },
    salvarCliente: function (ctx, p) {
      if (!p.id) { var r = acharOuCriarCliente(ctx, p); if (r.novo) disparar(ctx, 'cliente.criado', r.cliente); return { cliente: r.cliente }; }
      var campos = { nome: texto(p.nome, 80), email: texto(p.email, 120), obs: texto(p.obs, 300),
        nascimento: dataValida(p.nascimento) ? p.nascimento : '' };
      if (!campos.nome) falhar('Escreva o nome.');
      ctx.banco.atualizar('Clientes', String(p.id), campos); return {};
    },
    removerCliente: function (ctx, p) { ctx.banco.remover('Clientes', String(p.id)); return {}; },
    salvarBloqueio: function (ctx, p) {
      if (!dataValida(p.data)) falhar('Escolha a data do bloqueio.');
      var b = { id: novoId(ctx, 'b'), data: p.data, profissionalId: String(p.profissionalId || ''),
        inicio: horaValida(p.inicio) ? p.inicio : '', fim: horaValida(p.fim) ? p.fim : '', motivo: texto(p.motivo, 80) };
      if (b.inicio && b.fim && paraMin(b.fim) <= paraMin(b.inicio)) falhar('O fim precisa ser depois do início.');
      ctx.banco.inserir('Bloqueios', b); return { bloqueio: b };
    },
    removerBloqueio: function (ctx, p) { ctx.banco.remover('Bloqueios', String(p.id)); return {}; },
    salvarConfig: function (ctx, p) { return { config: salvarConfig(ctx, p.config || {}) }; },
    integracoes: function (ctx) { return integracoesParaTela(ctx); },
    salvarIntegracoes: function (ctx, p) {
      var i = integracoes(ctx), d = p.integracoes || {};
      if (d.webhooks !== undefined) {
        if (!Array.isArray(d.webhooks) || d.webhooks.length > 10) falhar('Até 10 webhooks.');
        i.webhooks = d.webhooks.map(function (w) {
          var url = texto(w.url, 500);
          if (!/^https:\/\/[^\s]+$/.test(url)) falhar('O endereço do webhook precisa começar com https://');
          return { id: w.id || novoId(ctx, 'w'), nome: texto(w.nome, 40), url: url, ativo: w.ativo !== false,
            eventos: (w.eventos || []).filter(function (e) { return EVENTOS.indexOf(e) >= 0; }) };
        });
        if (i.webhooks.length && !i.segredoWebhook) i.segredoWebhook = ctx.aleatorio(32);
      }
      if (d.emailDono !== undefined) {
        var em = texto(d.emailDono, 120);
        if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) falhar('E-mail inválido.');
        i.emailDono = em;
      }
      ['avisarDono', 'lembreteCliente', 'resumoDiario'].forEach(function (k) { if (d[k] !== undefined) i[k] = !!d[k]; });
      guardarIntegracoes(ctx, i);
      return integracoesParaTela(ctx);
    },
    novaChaveApi: function (ctx) { var i = integracoes(ctx); i.apiChave = 'ab_' + ctx.aleatorio(32); guardarIntegracoes(ctx, i); registrar(ctx, 'api', 'Chave de API nova gerada'); return integracoesParaTela(ctx); },
    apagarChaveApi: function (ctx) { var i = integracoes(ctx); i.apiChave = ''; guardarIntegracoes(ctx, i); return integracoesParaTela(ctx); },
    novoSegredoWebhook: function (ctx) { var i = integracoes(ctx); i.segredoWebhook = ctx.aleatorio(32); guardarIntegracoes(ctx, i); return integracoesParaTela(ctx); },
    testarWebhook: function (ctx, p) {
      var r = disparar(ctx, 'teste', { mensagem: 'Teste da Agenda Barbearia' }, String(p.id));
      if (!r.length) falhar('Salve o webhook antes de testar.');
      return { codigo: r[0].codigo || 0, erro: r[0].erro || '' };
    },
    robos: function (ctx, p) {
      var i = integracoes(ctx), ligar = !!p.ligar;
      if (ctx.robos) ctx.robos(ligar);
      i.robos = ligar; guardarIntegracoes(ctx, i);
      return integracoesParaTela(ctx);
    },
    trocarSenha: function (ctx, p) {
      if (!senhaConfere(ctx, p.atual)) falhar('A senha atual não confere.');
      definirSenha(ctx, p.nova);
      return { token: criarSessao(ctx) };
    },
    log: function (ctx) {
      var l = ctx.banco.listar('Log');
      return { log: l.slice(-60).reverse() };
    }
  };

  // ------------------------------------------------------------------
  // API de entrada (outros sistemas chamam com a chave)
  // ------------------------------------------------------------------
  function apiEntrada(ctx, p) {
    var integ = integracoes(ctx);
    if (!integ.apiChave || String(p.chave || '') !== integ.apiChave) falhar('Chave de API inválida.');
    var m = String(p.metodo || '');
    var d = p.dados || {};
    if (m === 'info') return infoPublica(ctx);
    if (m === 'horarios') return horarios(ctx, d);
    if (m === 'agendamentos') return ADMIN.agenda(ctx, d);
    if (m === 'clientes') return ADMIN.clientes(ctx);
    if (m === 'agendar') return { agendamento: agPublico(criarAgendamento(ctx, d, 'api')) };
    if (m === 'status') return ADMIN.mudarStatus(ctx, d);
    if (m === 'resumo') return resumoMes(ctx, d.mes);
    falhar('Método desconhecido. Use: info, horarios, agendamentos, clientes, agendar, status, resumo.');
  }

  // ------------------------------------------------------------------
  // Rotina diária (lembretes por e-mail e resumo do dia para o dono)
  // ------------------------------------------------------------------
  function rotinaDiaria(ctx) {
    var integ = integracoes(ctx), cfg = config(ctx), hoje = ctx.agora().data, amanha = somarDias(hoje, 1);
    var ags = agendamentos(ctx), cli = clientes(ctx), enviados = 0;
    var emailDe = {}; cli.forEach(function (c) { emailDe[c.id] = c.email; });
    if (integ.lembreteCliente) {
      ags.forEach(function (a) {
        if (a.data !== amanha || a.status !== 'confirmado') return;
        var para = emailDe[a.clienteId];
        if (!para || !/@/.test(para)) return;
        var v = { nome: a.clienteNome.split(' ')[0], barbearia: cfg.nome, data: dataBR(a.data), hora: a.inicio,
          profissional: a.profissionalNome, servicos: a.servicos, codigo: a.codigo };
        try { ctx.email(para, 'Lembrete: amanhã às ' + a.inicio + ' na ' + cfg.nome, preencher(cfg.mensagemLembrete, v) +
          (cfg.endereco ? '\n\nEndereço: ' + cfg.endereco : '') + (cfg.whatsapp ? '\nWhatsApp: ' + cfg.whatsapp : '')); enviados++; }
        catch (e) { registrar(ctx, 'email', 'Lembrete falhou para ' + para + ': ' + e); }
      });
    }
    if (integ.resumoDiario) {
      var doDia = ags.filter(function (a) { return a.data === hoje && a.status === 'confirmado'; })
        .sort(function (x, y) { return x.inicio.localeCompare(y.inicio); });
      var para = integ.emailDono || (ctx.emailDono ? ctx.emailDono() : '');
      if (para && doDia.length) {
        try { ctx.email(para, 'Agenda de hoje: ' + doDia.length + ' horário(s)', doDia.map(function (a) {
          return a.inicio + '  ' + a.clienteNome + ' com ' + a.profissionalNome + ' (' + a.servicos + ')';
        }).join('\n')); } catch (e) { registrar(ctx, 'email', 'Resumo falhou: ' + e); }
      }
    }
    registrar(ctx, 'rotina', 'Rotina diária: ' + enviados + ' lembrete(s) enviados');
    return { lembretes: enviados };
  }

  // ------------------------------------------------------------------
  // Porta de entrada
  // ------------------------------------------------------------------
  function executar(ctx, pedido) {
    pedido = pedido || {};
    var acao = String(pedido.acao || '');
    try {
      var dados;
      if (Object.prototype.hasOwnProperty.call(PUBLICAS, acao)) dados = PUBLICAS[acao](ctx, pedido);
      else if (Object.prototype.hasOwnProperty.call(ACESSO, acao)) dados = ACESSO[acao](ctx, pedido);
      else if (acao === 'api') dados = apiEntrada(ctx, pedido);
      else if (Object.prototype.hasOwnProperty.call(ADMIN, acao)) { exigirSessao(ctx, pedido.token); dados = ADMIN[acao](ctx, pedido); }
      else falhar('Ação desconhecida: ' + acao);
      return { ok: true, dados: dados };
    } catch (e) {
      if (e && e.publico) return { ok: false, erro: e.message, sessao: !!e.sessao };
      return { ok: false, erro: 'Algo deu errado no servidor. Tente de novo em instantes.', detalhe: String(e && e.message || e) };
    }
  }

  return {
    VERSAO: VERSAO, TABELAS: TABELAS, CONFIG_PADRAO: CONFIG_PADRAO, EVENTOS: EVENTOS,
    executar: executar, rotinaDiaria: rotinaDiaria,
    util: { sha256: sha256, hmac: hmac, paraMin: paraMin, paraHora: paraHora, diaSemana: diaSemana, somarDias: somarDias,
      dataBR: dataBR, duracaoTexto: duracaoTexto, preencher: preencher, whatsapp: whatsapp }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Nucleo;
