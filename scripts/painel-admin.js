const elementoMetaApi = document.querySelector('meta[name="api-base"]')
const apiLocal = new URL(elementoMetaApi?.content || 'http://localhost:3000/api')
const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? `${window.location.protocol}//${window.location.hostname}:${apiLocal.port || '3000'}/api`
  : `${window.location.origin}/api`

const listaAgendamentos = document.querySelector('#lista-agendamentos-admin')
const listaProfissionais = document.querySelector('#lista-profissionais-admin')
const filtroProfissional = document.querySelector('#filtro-profissional')
const filtroData = document.querySelector('#filtro-data')
const filtroStatus = document.querySelector('#filtro-status')
const mensagemAdmin = document.querySelector('#mensagem-admin')
const quantidadeAgendamentos = document.querySelector('#quantidade-agendamentos')
const listaSolicitacoes = document.querySelector('#lista-solicitacoes')

let dadosPainel = { profissionais: [], agendamentos: [], resumo: {} }

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
      cache: 'no-store',
    })
  } catch {
    throw new Error('Não foi possível conectar à API local. Inicie o servidor com “npm run api” e tente novamente.')
  }

  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível concluir esta ação.')
  return dados
}

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag)
  if (classe) elemento.className = classe
  if (texto) elemento.textContent = texto
  return elemento
}

function formatarData(data) {
  const [ano, mes, dia] = data.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ano, mes - 1, dia))
}

function mostrarMensagem(texto, tipo = '') {
  mensagemAdmin.textContent = texto
  mensagemAdmin.className = tipo ? `mensagem-admin ${tipo}` : 'mensagem-admin'
}

function diasUteisRestantes(prazoISO) {
  const [ano, mes, dia] = prazoISO.slice(0, 10).split('-').map(Number)
  const prazo = new Date(ano, mes - 1, dia)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  let cursor = new Date(hoje)
  let quantidade = 0

  while (cursor < prazo) {
    cursor.setDate(cursor.getDate() + 1)
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) quantidade += 1
  }
  if (prazo < hoje) return 'Prazo excedido'
  if (quantidade === 0) return 'Prazo hoje'
  return `${quantidade} ${quantidade === 1 ? 'dia útil restante' : 'dias úteis restantes'}`
}

function renderizarSolicitacoes() {
  const pendentes = dadosPainel.solicitacoesProfissionais.filter((item) => item.status === 'pendente')
  document.querySelector('#total-pendentes').textContent = String(pendentes.length)
  listaSolicitacoes.replaceChildren()

  if (pendentes.length === 0) {
    const vazio = criarElemento('div', 'estado-vazio-admin')
    vazio.append(
      criarElemento('strong', '', 'Nenhuma solicitação aguardando análise.'),
      criarElemento('span', '', 'Novas solicitações profissionais aparecerão aqui.'),
    )
    listaSolicitacoes.append(vazio)
    return
  }

  for (const solicitacao of pendentes) {
    const cartao = criarElemento('article', 'cartao-solicitacao')
    const cabecalho = criarElemento('div', 'cabecalho-solicitacao')
    const dados = criarElemento('div', 'dados-solicitacao')
    dados.append(
      criarElemento('strong', '', solicitacao.nome),
      criarElemento('span', '', `${solicitacao.especialidade} · ${solicitacao.cidade}`),
    )
    cabecalho.append(dados, criarElemento('span', 'prazo-solicitacao', diasUteisRestantes(solicitacao.prazoAnaliseEm)))

    const detalhes = criarElemento('div', 'detalhes-solicitacao')
    detalhes.append(
      criarElemento('span', '', `CRM ${solicitacao.crm}/${solicitacao.uf}`),
      criarElemento('span', '', solicitacao.email),
      criarElemento('span', '', `Modalidades: ${solicitacao.modalidades.join(' · ')}`),
      criarElemento('span', '', `Recebida em ${formatarData(solicitacao.enviadaEm)}`),
      criarElemento('span', '', `Prazo até ${formatarData(solicitacao.prazoAnaliseEm)}`),
    )

    const acoes = criarElemento('div', 'acoes-solicitacao')
    const aprovar = criarElemento('button', 'botao-aprovar', 'Aprovar após conferir CRM')
    aprovar.type = 'button'
    aprovar.addEventListener('click', () => decidirSolicitacao(solicitacao, 'aprovado'))
    const rejeitar = criarElemento('button', 'botao-rejeitar', 'Rejeitar')
    rejeitar.type = 'button'
    rejeitar.addEventListener('click', () => decidirSolicitacao(solicitacao, 'rejeitado'))
    acoes.append(aprovar, rejeitar)
    cartao.append(cabecalho, detalhes, acoes)
    listaSolicitacoes.append(cartao)
  }
}

async function decidirSolicitacao(solicitacao, decisao) {
  let observacao = ''
  if (decisao === 'aprovado') {
    const confirmou = window.confirm(
      `Confirma que verificou o CRM ${solicitacao.crm}/${solicitacao.uf} no conselho regional e deseja aprovar ${solicitacao.nome}?`,
    )
    if (!confirmou) return
  } else {
    observacao = window.prompt(`Motivo para rejeitar a solicitação de ${solicitacao.nome}:`) || ''
    if (!observacao.trim()) {
      mostrarMensagem('Informe um motivo para registrar a rejeição.', 'erro')
      return
    }
  }

  try {
    await requisitarApi(`/admin/solicitacoes-profissionais/${encodeURIComponent(solicitacao.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ decisao, observacao }),
    })
    mostrarMensagem(decisao === 'aprovado'
      ? 'Profissional aprovado. A conta já pode entrar e acessar o perfil vinculado.'
      : 'Solicitação rejeitada. O motivo ficou registrado para a equipe.')
    await carregarPainel()
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro')
  }
}

function desenharIndicadores() {
  document.querySelector('#total-profissionais').textContent = String(dadosPainel.resumo.profissionais)
  document.querySelector('#total-horarios').textContent = String(dadosPainel.resumo.horariosDisponiveis)
  document.querySelector('#total-confirmados').textContent = String(dadosPainel.resumo.consultasConfirmadas)
  document.querySelector('#total-cancelados').textContent = String(dadosPainel.resumo.consultasCanceladas)
}

function desenharFiltroProfissional() {
  const valorAnterior = filtroProfissional.value
  filtroProfissional.replaceChildren(new Option('Todos os profissionais', ''))
  for (const profissional of dadosPainel.profissionais) {
    filtroProfissional.add(new Option(`${profissional.nome} · ${profissional.especialidade}`, profissional.id))
  }
  filtroProfissional.value = valorAnterior
}

function criarCartaoAgendamento(agendamento) {
  const cartao = criarElemento('article', 'cartao-agendamento-admin')
  const topo = criarElemento('div', 'topo-agendamento-admin')
  const data = criarElemento('strong', 'data-agendamento-admin', `${formatarData(agendamento.data)} · ${agendamento.hora}`)
  const cancelado = agendamento.status === 'cancelado'
  const status = criarElemento('span', `status-agendamento-admin${cancelado ? ' cancelado' : ''}`, cancelado ? 'Cancelada' : 'Confirmada')
  topo.append(data, status)

  const paciente = criarElemento('p', 'paciente-agendamento-admin', agendamento.paciente?.nome || 'Pessoa de teste')
  const detalhes = criarElemento(
    'p',
    'detalhes-agendamento-admin',
    `${agendamento.profissional} · ${agendamento.especialidade} · ${agendamento.modalidade}`,
  )
  cartao.append(topo, paciente, detalhes)
  return cartao
}

function desenharAgendamentos() {
  const profissional = filtroProfissional.value
  const data = filtroData.value
  const status = filtroStatus.value
  const filtrados = dadosPainel.agendamentos.filter((agendamento) =>
    (!profissional || agendamento.profissionalId === profissional)
    && (!data || agendamento.data === data)
    && (!status || agendamento.status === status),
  )

  listaAgendamentos.replaceChildren()
  quantidadeAgendamentos.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'agendamento encontrado' : 'agendamentos encontrados'}`
  if (filtrados.length === 0) {
    const vazio = criarElemento('div', 'estado-vazio-admin')
    vazio.append(
      criarElemento('strong', '', 'Nenhum agendamento neste filtro.'),
      criarElemento('span', '', 'Altere os filtros ou aguarde um novo agendamento.'),
    )
    listaAgendamentos.append(vazio)
    return
  }

  for (const agendamento of filtrados) {
    listaAgendamentos.append(criarCartaoAgendamento(agendamento))
  }
}

function desenharProfissionais() {
  listaProfissionais.replaceChildren()
  if (dadosPainel.profissionais.length === 0) {
    listaProfissionais.append(criarElemento('p', 'estado-vazio-admin', 'Nenhum profissional cadastrado.'))
    return
  }

  for (const profissional of dadosPainel.profissionais) {
    const cartao = criarElemento('article', 'cartao-profissional-admin')
    const marca = criarElemento('span', 'avatar-admin', profissional.nome.split(' ').slice(0, 2).map((parte) => parte[0]).join(''))
    const informacoes = criarElemento('div', 'informacoes-profissional-admin')
    informacoes.append(
      criarElemento('strong', '', profissional.nome),
      criarElemento('span', '', `${profissional.especialidade} · ${profissional.cidade}`),
    )
    const disponibilidade = criarElemento(
      'span',
      'disponibilidade-admin',
      `${profissional.horariosDisponiveis} ${profissional.horariosDisponiveis === 1 ? 'horário livre' : 'horários livres'}`,
    )
    const modalidades = criarElemento('small', 'modalidades-admin', profissional.modalidades.join(' · '))
    cartao.append(marca, informacoes, disponibilidade, modalidades)
    listaProfissionais.append(cartao)
  }
}

async function carregarPainel() {
  const botaoAtualizar = document.querySelector('#atualizar-painel')
  botaoAtualizar.disabled = true
  mostrarMensagem('Carregando os dados…')

  try {
    const dadosSessao = await requisitarApi('/auth/sessao')
    if (!dadosSessao.usuario) {
      window.location.replace('./acesso.html')
      return
    }
    if (dadosSessao.usuario.papel !== 'administrador') {
      window.location.replace(dadosSessao.usuario.papel === 'profissional' ? './painel-medico.html' : './acesso.html')
      return
    }

    dadosPainel = await requisitarApi('/admin/painel')
    desenharIndicadores()
    renderizarSolicitacoes()
    desenharFiltroProfissional()
    desenharAgendamentos()
    desenharProfissionais()
    mostrarMensagem('')
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro')
  } finally {
    botaoAtualizar.disabled = false
  }
}

for (const filtro of [filtroProfissional, filtroData, filtroStatus]) {
  filtro.addEventListener('change', desenharAgendamentos)
}

document.querySelector('#filtros-admin').addEventListener('reset', () => {
  window.setTimeout(desenharAgendamentos)
})
document.querySelector('#atualizar-painel').addEventListener('click', carregarPainel)
document.querySelector('#sair-conta').addEventListener('click', async () => {
  try {
    await requisitarApi('/auth/sair', { method: 'POST' })
    window.location.replace('./acesso.html')
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro')
  }
})

carregarPainel()
