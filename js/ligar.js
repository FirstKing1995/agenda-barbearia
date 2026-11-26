/* Tela "Ligar o sistema": recebe o endereço do servidor, testa e cria a senha do painel. */
(function () {
  'use strict';
  var esc = U.esc;
  var campo = document.getElementById('url');
  var dado = new URLSearchParams(location.search).get('u');
  if (dado) campo.value = dado;

  document.getElementById('form-ligar').onsubmit = function (ev) {
    ev.preventDefault();
    var url = API.normalizar(campo.value);
    if (!url || !API.hostPermitido(url)) {
      U.aviso('Esse endereço não parece o do servidor. Ele começa com https://script.google.com e termina em /exec.', 'erro');
      return;
    }
    var btn = document.getElementById('btn-ligar');
    U.ocupado(btn, true, 'Testando');
    API.testar(url).then(function (info) {
      API.salvarServidor(url);
      if (info.configurado) { location.href = 'painel.html'; return; }
      criarSenha(url, info);
    }).catch(function (e) {
      U.ocupado(btn, false);
      var msg = e.message;
      if (/conexão|fetch/i.test(msg)) msg = 'Não conseguimos falar com o servidor. Confira se a implantação está como "Qualquer pessoa" e se você autorizou o acesso.';
      U.aviso(msg, 'erro');
    });
  };

  function criarSenha(url, info) {
    var host = '';
    try { host = new URL(url).hostname; } catch (e) {}
    document.getElementById('caixa').innerHTML = '<div class="cartao"><div class="topo"><div class="monograma"><span class="ic">check</span></div>' +
      '<h1>Servidor ligado</h1><p class="texto-suave" style="margin-top:8px">Agora crie a senha do painel. Só você vai usar.</p>' +
      '<p class="texto-suave pequeno" style="margin-top:6px">Servidor: ' + esc(host) + '</p></div>' +
      '<form id="form-senha"><div class="campo"><label for="nome">Nome da barbearia</label><input id="nome" maxlength="60" required value="' +
      esc(info.config.nome === 'Sua Barbearia' ? '' : info.config.nome) + '" placeholder="Ex.: Barbearia do Centro"></div>' +
      '<div class="campo"><label for="s1">Senha do painel</label><input id="s1" type="password" autocomplete="new-password" minlength="6" required>' +
      '<span class="ajuda">Pelo menos 6 caracteres.</span></div>' +
      '<div class="campo"><label for="s2">Repita a senha</label><input id="s2" type="password" autocomplete="new-password" minlength="6" required></div>' +
      '<button class="btn btn-destaque btn-grande" type="submit" id="btn-senha"><span class="ic">lock</span>Criar senha e abrir o painel</button></form></div>';
    document.getElementById('form-senha').onsubmit = function (ev) {
      ev.preventDefault();
      var nome = document.getElementById('nome').value.trim(), s1 = document.getElementById('s1').value, s2 = document.getElementById('s2').value;
      if (nome.length < 2) { U.aviso('Escreva o nome da barbearia.', 'erro'); return; }
      if (s1.length < 6) { U.aviso('A senha precisa de pelo menos 6 caracteres.', 'erro'); return; }
      if (s1 !== s2) { U.aviso('As duas senhas não estão iguais.', 'erro'); return; }
      var btn = document.getElementById('btn-senha');
      U.ocupado(btn, true, 'Criando');
      API.testar(url).then(function () {
        // chama direto no servidor recém-ligado
        return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ acao: 'primeiroAcesso', senha: s1, nome: nome }) })
          .then(function (r) { return r.json(); });
      }).then(function (r) {
        if (!r.ok) throw new Error(r.erro || 'Não foi possível criar a senha.');
        localStorage.setItem('agenda_token_' + idCurto(url), r.dados.token);
        location.href = 'painel.html#inicio';
      }).catch(function (e) { U.ocupado(btn, false); U.aviso(e.message, 'erro'); });
    };
  }
  function idCurto(url) { var m = /script\.google\.com\/macros\/s\/([\w-]+)\/exec/.exec(url); return m ? m[1] : url; }
})();
