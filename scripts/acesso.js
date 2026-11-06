const elementoMetaApi = document.querySelector('meta[name="api-base"]')
const apiLocal = new URL(elementoMetaApi?.content || 'http://localhost:3000/api')
const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? `${window.location.protocol}//${window.location.hostname}:${apiLocal.port || '3000'}/api`
  : `${window.location.origin}/api`

const formularioEntrar = document.querySelector('#form-entrar')
const formularioCadastro = document.querySelector('#form-cadastro')
const mensagemAcesso = document.querySelector('#mensagem-acesso')
const avisoApi = document.querySelector('#aviso-api')
const botaoEntrar = document.querySelector('#botao-entrar')
const botaoCadastrar = document.querySelector('#botao-cadastrar')
const acessoAdministrativo = new URLSearchParams(window.location.search).get('perfil') === 'administrador'

if (acessoAdministrativo) {
  document.title = 'Acesso administrativo — BemViver'
  document.querySelector('#sobretitulo-acesso').textContent = 'BEMVIVER · ÁREA ADMINISTRATIVA'
  document.querySelector('#titulo-apresentacao-acesso').textContent = 'Administre a plataforma BemViver.'
  document.querySelector('#descricao-apresentacao-acesso').textContent = 'Entre com a conta administrativa para analisar solicitações profissionais e acompanhar os agendamentos.'
  document.querySelector('#sobretitulo-formulario-acesso').textContent = 'ACESSO RESTRITO'
  document.querySelector('#titulo-acesso').textContent = 'Entrar como administrador'
  document.querySelector('#introducao-acesso').textContent = 'Use as credenciais administrativas configuradas para este ambiente.'
  document.querySelector('#separador-cadastro').hidden = true
  document.querySelector('#link-cadastro').hidden = true
  document.querySelector('#link-acesso-equipe').hidden = false
  document.querySelector('#nota-acesso').textContent = 'Esta entrada é exclusiva para a administração. Profissionais devem usar o acesso da equipe.'
  document.querySelector('#botao-entrar').textContent = 'Entrar no painel administrativo'
}

function mostrarMensagem(texto) {
  mensagemAcesso.textContent = texto
}

function destinoDoPapel(papel) {
  return papel === 'administrador' ? './painel-admin.html' : './painel-medico.html'
}

async function requisitarApi(caminho, opcoes = {}) {
  let resposta
  try {
    resposta = await fetch(`${API_BASE}${caminho}`, {
      ...opcoes,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
        ...opcoes.headers,
      },
    })
  } catch {
    throw new Error('Não foi possível conectar à API local. Inicie o servidor com “npm run api” e tente novamente.')
  }

  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível concluir esta ação.')
  return dados
}

async function verificarSessaoExistente() {
  if (!formularioEntrar) return
  try {
    const dados = await requisitarApi('/auth/sessao')
    if (dados.usuario?.papel === 'administrador') {
      window.location.replace('./painel-admin.html')
    } else if (dados.usuario && !acessoAdministrativo) {
      window.location.replace(destinoDoPapel(dados.usuario.papel))
    } else if (dados.usuario && acessoAdministrativo) {
      mostrarMensagem('Há uma sessão profissional ativa. Entre com as credenciais administrativas para abrir este painel.')
    }
  } catch (erro) {
    if (avisoApi) {
      avisoApi.textContent = erro.message
      avisoApi.hidden = false
    }
  }
}

if (formularioEntrar) {
  formularioEntrar.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    botaoEntrar.disabled = true
    botaoEntrar.textContent = 'Verificando acesso…'
    if (avisoApi) avisoApi.hidden = true
    mostrarMensagem('')

    try {
      const campos = new FormData(formularioEntrar)
      const dados = await requisitarApi('/auth/entrar', {
        method: 'POST',
        body: JSON.stringify({
          email: campos.get('email'),
          senha: campos.get('senha'),
        }),
      })
      if (acessoAdministrativo && dados.usuario.papel !== 'administrador') {
        await requisitarApi('/auth/sair', { method: 'POST' })
        throw new Error('Esta conta não é administrativa. Use o acesso da equipe.')
      }
      window.location.replace(destinoDoPapel(dados.usuario.papel))
    } catch (erro) {
      mostrarMensagem(erro.message)
    } finally {
      botaoEntrar.disabled = false
      botaoEntrar.textContent = acessoAdministrativo ? 'Entrar no painel administrativo' : 'Entrar'
    }
  })

  verificarSessaoExistente()
}

if (formularioCadastro) {
  formularioCadastro.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    botaoCadastrar.disabled = true
    botaoCadastrar.textContent = 'Enviando solicitação…'
    mostrarMensagem('')

    try {
      const campos = new FormData(formularioCadastro)
      const dados = await requisitarApi('/auth/solicitacoes-profissionais', {
        method: 'POST',
        body: JSON.stringify({
          nome: campos.get('nome'),
          email: campos.get('email'),
          senha: campos.get('senha'),
          especialidade: campos.get('especialidade'),
          cidade: campos.get('cidade'),
          crm: campos.get('crm'),
          uf: campos.get('uf'),
          modalidades: campos.getAll('modalidades'),
        }),
      })

      const sucesso = document.querySelector('#sucesso-cadastro')
      const prazo = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(dados.solicitacao.prazoAnaliseEm))
      sucesso.replaceChildren()
      const titulo = document.createElement('strong')
      titulo.textContent = 'Solicitação recebida!'
      const detalhe = document.createElement('span')
      detalhe.textContent = `${dados.mensagem} Prazo estimado: ${prazo}.`
      sucesso.append(titulo, detalhe)
      sucesso.hidden = false
      formularioCadastro.reset()
      formularioCadastro.hidden = true
    } catch (erro) {
      mostrarMensagem(erro.message)
    } finally {
      botaoCadastrar.disabled = false
      botaoCadastrar.textContent = 'Enviar para análise'
    }
  })
}
