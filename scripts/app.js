const elementoMetaApi = document.querySelector('meta[name="api-base"]')
const apiLocal = new URL(elementoMetaApi?.content || 'http://localhost:3000/api')
const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? `${window.location.protocol}//${window.location.hostname}:${apiLocal.port || '3000'}/api`
  : `${window.location.origin}/api`

const elementoEspecialidade = document.querySelector('#especialidade')
const elementoCidade = document.querySelector('#cidade')
const listaCidades = document.querySelector('#lista-cidades')
const elementoModalidade = document.querySelector('#modalidade')
const atalhosEspecialidade = document.querySelectorAll('.atalho-especialidade')
const elementoOrdenacao = document.querySelector('#ordenacao')
const listaProfissionais = document.querySelector('#lista-profissionais')
const botaoBuscar = document.querySelector('.botao-busca')
const resumoResultados = document.querySelector('#resumo-resultados')
const mensagem = document.querySelector('#mensagem')
const dialogoAgendamento = document.querySelector('#dialogo-agendamento')
const formularioAgendamento = document.querySelector('#form-agendamento')
const campoErroAgendamento = document.querySelector('#erro-agendamento')
const campoCidade = document.querySelector('.campo-cidade')

let profissionais = []
let escolhaAtual = null
let cidadesDisponiveis = []
let indiceCidadeAtiva = -1
let sequenciaBusca = 0

function mostrarMensagem(texto, tipo = '') {
  mensagem.textContent = texto
  mensagem.className = tipo ? `mensagem ${tipo}` : 'mensagem'
}

async function requisitarApi(caminho, opcoes = {}) {
  let resposta
  const cabecalhos = { Accept: 'application/json', ...opcoes.headers }

  if (opcoes.body) cabecalhos['Content-Type'] = 'application/json'

  try {
    resposta = await fetch(`${API_BASE}${caminho}`, {
      ...opcoes,
      credentials: 'include',
      headers: cabecalhos,
    })
  } catch {
    throw new Error('Não foi possível conectar à API local. Inicie o servidor com “npm run api” e tente novamente.')
  }

  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Não foi possível concluir esta ação. Tente novamente.')
  }

  return dados
}

function preencherOpcoes(select, opcoes, rotuloPadrao) {
  const valorAnterior = select.value
  select.replaceChildren(new Option(rotuloPadrao, ''))

  for (const valor of opcoes) {
    select.add(new Option(valor, valor))
  }

  if (opcoes.includes(valorAnterior)) select.value = valorAnterior
}

function normalizarTexto(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

function fecharSugestoesCidades() {
  listaCidades.hidden = true
  elementoCidade.setAttribute('aria-expanded', 'false')
  elementoCidade.removeAttribute('aria-activedescendant')
  indiceCidadeAtiva = -1
}

function selecionarCidade(cidade) {
  elementoCidade.value = cidade
  fecharSugestoesCidades()
  elementoCidade.dispatchEvent(new Event('change', { bubbles: true }))
}

function atualizarSugestoesCidades() {
  const termo = normalizarTexto(elementoCidade.value.trim())
  const sugestoes = cidadesDisponiveis
    .filter((cidade) => normalizarTexto(cidade).includes(termo))
    .slice(0, 8)

  listaCidades.replaceChildren()
  indiceCidadeAtiva = -1
  if (sugestoes.length === 0) {
    fecharSugestoesCidades()
    return
  }

  for (const [indice, cidade] of sugestoes.entries()) {
    const opcao = document.createElement('button')
    opcao.id = `sugestao-cidade-${indice}`
    opcao.className = 'sugestao-cidade'
    opcao.type = 'button'
    opcao.setAttribute('role', 'option')
    opcao.setAttribute('aria-selected', 'false')
    opcao.textContent = cidade
    opcao.addEventListener('pointerdown', (evento) => evento.preventDefault())
    opcao.addEventListener('click', () => selecionarCidade(cidade))
    listaCidades.append(opcao)
  }

  listaCidades.hidden = false
  elementoCidade.setAttribute('aria-expanded', 'true')
}

function preencherCidades(cidades) {
  cidadesDisponiveis = cidades
}

function formatarData(data, incluirAno = false) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(incluirAno ? { year: 'numeric' } : {}),
  })
    .format(new Date(ano, mes - 1, dia))
    .replace('.', '')
}

function obterIniciais(nome) {
  return nome
    .replace(/^(Dra?\.|Prof\.)\s*/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
}

function criarCartaoProfissional(profissional) {
  const cartao = document.createElement('article')
  cartao.className = 'cartao-profissional'

  const avatar = document.createElement('div')
  avatar.className = 'avatar'
  avatar.setAttribute('aria-hidden', 'true')
  avatar.textContent = obterIniciais(profissional.nome)

  const dados = document.createElement('div')
  dados.className = 'dados-profissional'

  const nome = document.createElement('h3')
  nome.className = 'nome-profissional'
  nome.textContent = profissional.nome

  const especialidade = document.createElement('p')
  especialidade.className = 'especialidade-profissional'
  especialidade.textContent = profissional.especialidade

  const local = document.createElement('div')
  local.className = 'local-profissional'
  const cidade = document.createElement('span')
  cidade.textContent = `⌖ ${profissional.cidade}`
  const modalidade = document.createElement('span')
  modalidade.textContent = profissional.modalidades.join(' · ')
  local.append(cidade, modalidade)
  dados.append(nome, especialidade, local)

  const horarios = document.createElement('div')
  horarios.className = 'horarios-profissional'
  const tituloHorarios = document.createElement('span')
  tituloHorarios.className = 'texto-horarios'
  tituloHorarios.textContent = 'Próximos horários disponíveis'
  const listaHorarios = document.createElement('div')
  listaHorarios.className = 'lista-horarios'

  for (const horario of profissional.horarios.slice(0, 3)) {
    const botao = document.createElement('button')
    botao.type = 'button'
    botao.className = 'botao-horario'
    botao.textContent = horario.hora
    botao.setAttribute(
      'aria-label',
      `Agendar com ${profissional.nome} em ${formatarData(horario.data)} às ${horario.hora}`,
    )
    botao.addEventListener('click', () => abrirFormulario(profissional, horario))
    listaHorarios.append(botao)
  }

  horarios.append(tituloHorarios, listaHorarios)
  cartao.append(avatar, dados, horarios)
  return cartao
}

function desenharResultados() {
  const ordem = elementoOrdenacao.value
  const lista = [...profissionais]

  if (ordem === 'nome') {
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  } else {
    lista.sort((a, b) => {
      const horarioA = a.horarios[0]
      const horarioB = b.horarios[0]
      return `${horarioA?.data || ''} ${horarioA?.hora || ''}`.localeCompare(
        `${horarioB?.data || ''} ${horarioB?.hora || ''}`,
      )
    })
  }

  listaProfissionais.replaceChildren()
  for (const profissional of lista) {
    listaProfissionais.append(criarCartaoProfissional(profissional))
  }

  resumoResultados.textContent = lista.length === 1
    ? '1 profissional encontrado.'
    : `${lista.length} profissionais encontrados.`

  if (lista.length === 0) {
    const vazio = document.createElement('div')
    vazio.className = 'estado-vazio'
    const titulo = document.createElement('strong')
    titulo.textContent = 'Não encontramos horários com esses filtros.'
    const detalhe = document.createElement('span')
    detalhe.textContent = 'Tente outra especialidade, cidade ou tipo de atendimento.'
    vazio.append(titulo, detalhe)
    listaProfissionais.append(vazio)
  }
}

async function carregarFiltros() {
  const dados = await requisitarApi('/opcoes')
  preencherOpcoes(elementoEspecialidade, dados.especialidades, 'Todas as especialidades')
  preencherCidades(dados.cidades)
}

async function buscarProfissionais() {
  const buscaAtual = ++sequenciaBusca
  mostrarMensagem('')
  resumoResultados.textContent = 'Buscando opções…'
  listaProfissionais.replaceChildren()

  const parametros = new URLSearchParams()
  if (elementoEspecialidade.value) parametros.set('especialidade', elementoEspecialidade.value)
  if (elementoCidade.value) parametros.set('cidade', elementoCidade.value.trim())
  if (elementoModalidade.value) parametros.set('modalidade', elementoModalidade.value)

  try {
    const dados = await requisitarApi(`/profissionais?${parametros}`)
    if (buscaAtual !== sequenciaBusca) return
    profissionais = dados.profissionais
    desenharResultados()
  } catch (erro) {
    if (buscaAtual !== sequenciaBusca) return
    profissionais = []
    resumoResultados.textContent = 'Não foi possível carregar as opções.'
    mostrarMensagem(erro.message, 'erro')
    const tentarNovamente = document.createElement('button')
    tentarNovamente.type = 'button'
    tentarNovamente.className = 'botao-texto'
    tentarNovamente.textContent = 'Tentar novamente'
    tentarNovamente.addEventListener('click', buscarProfissionais)
    listaProfissionais.append(tentarNovamente)
  }
}

async function buscarEIrParaProfissionais() {
  const textoOriginal = botaoBuscar.innerHTML
  botaoBuscar.disabled = true
  botaoBuscar.textContent = 'Buscando…'

  try {
    await buscarProfissionais()
    await new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(resolver)))
    listaProfissionais.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } finally {
    botaoBuscar.innerHTML = textoOriginal
    botaoBuscar.disabled = false
  }
}

function atualizarEspecialidadeSelecionada() {
  atalhosEspecialidade.forEach((botao) => {
    botao.setAttribute('aria-pressed', String(botao.dataset.especialidade === elementoEspecialidade.value))
  })
}

function abrirFormulario(profissional, horario) {
  escolhaAtual = { profissional, horario }
  campoErroAgendamento.textContent = ''

  const resumo = document.querySelector('#resumo-escolha')
  resumo.replaceChildren()
  const nome = document.createElement('strong')
  nome.textContent = profissional.nome
  const especialidade = document.createElement('span')
  especialidade.textContent = profissional.especialidade
  const data = document.createElement('span')
  data.textContent = `${formatarData(horario.data)} · ${horario.hora} · ${horario.modalidade}`
  const local = document.createElement('span')
  local.textContent = horario.modalidade === 'Teleconsulta'
    ? 'Atendimento on-line'
    : `Atendimento presencial · ${profissional.cidade}`
  resumo.append(nome, especialidade, data, local)

  formularioAgendamento.reset()
  dialogoAgendamento.showModal()
}

async function confirmarAgendamento(evento) {
  evento.preventDefault()
  if (!escolhaAtual) return

  const botaoConfirmar = formularioAgendamento.querySelector('.botao-confirmar')
  const botaoHorarioSelecionado = [...document.querySelectorAll('.botao-horario')]
    .find((botao) => botao.getAttribute('aria-label')?.includes(escolhaAtual.profissional.nome))
  botaoConfirmar.disabled = true
  botaoConfirmar.textContent = 'Salvando no banco local…'
  if (botaoHorarioSelecionado) botaoHorarioSelecionado.disabled = true
  campoErroAgendamento.textContent = ''

  const campos = new FormData(formularioAgendamento)
  const payload = {
    profissionalId: escolhaAtual.profissional.id,
    data: escolhaAtual.horario.data,
    hora: escolhaAtual.horario.hora,
    modalidade: escolhaAtual.horario.modalidade,
    nome: campos.get('nome'),
    email: campos.get('email'),
    telefone: campos.get('telefone'),
  }

  try {
    const resultado = await requisitarApi('/agendamentos', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    dialogoAgendamento.close()
    const dataFormatada = formatarData(resultado.agendamento.data, true)
    window.alert([
      'Agendamento registrado no ambiente de testes.',
      '',
      `Paciente: ${payload.nome}`,
      `E-mail: ${payload.email}`,
      `Telefone: ${payload.telefone}`,
      `Profissional: ${resultado.agendamento.profissional}`,
      `Especialidade: ${escolhaAtual.profissional.especialidade}`,
      `Data e horário: ${dataFormatada}, às ${resultado.agendamento.hora}`,
      `Atendimento: ${escolhaAtual.horario.modalidade}`,
      '',
      'Este registro é local, não foi enviado a profissionais e não confirma uma consulta real.',
      '',
      'Clique em OK para fechar esta confirmação.',
    ].join('\n'))
    await buscarProfissionais()
  } catch (erro) {
    campoErroAgendamento.textContent = erro.message
  } finally {
    botaoConfirmar.disabled = false
    botaoConfirmar.textContent = 'Confirmar agendamento'
    if (botaoHorarioSelecionado) botaoHorarioSelecionado.disabled = false
  }
}

document.querySelector('#form-busca').addEventListener('submit', (evento) => {
  evento.preventDefault()
  buscarEIrParaProfissionais()
})

for (const select of [elementoEspecialidade, elementoCidade, elementoModalidade]) {
  select.addEventListener('change', buscarProfissionais)
}

elementoCidade.addEventListener('focus', atualizarSugestoesCidades)
elementoCidade.addEventListener('input', atualizarSugestoesCidades)
elementoCidade.addEventListener('keydown', (evento) => {
  const opcoes = [...listaCidades.querySelectorAll('[role="option"]')]

  if ((evento.key === 'ArrowDown' || evento.key === 'ArrowUp') && opcoes.length > 0) {
    evento.preventDefault()
    const direcao = evento.key === 'ArrowDown' ? 1 : -1
    indiceCidadeAtiva = indiceCidadeAtiva === -1
      ? (direcao === 1 ? 0 : opcoes.length - 1)
      : (indiceCidadeAtiva + direcao + opcoes.length) % opcoes.length
    opcoes.forEach((opcao, indice) => {
      opcao.setAttribute('aria-selected', String(indice === indiceCidadeAtiva))
    })
    elementoCidade.setAttribute('aria-activedescendant', opcoes[indiceCidadeAtiva].id)
    opcoes[indiceCidadeAtiva].scrollIntoView({ block: 'nearest' })
  } else if (evento.key === 'Enter' && indiceCidadeAtiva >= 0 && !listaCidades.hidden) {
    evento.preventDefault()
    selecionarCidade(opcoes[indiceCidadeAtiva].textContent)
  } else if (evento.key === 'Escape') {
    fecharSugestoesCidades()
  }
})
campoCidade.addEventListener('focusout', (evento) => {
  if (!campoCidade.contains(evento.relatedTarget)) fecharSugestoesCidades()
})

elementoOrdenacao.addEventListener('change', desenharResultados)

atalhosEspecialidade.forEach((botao) => {
  botao.setAttribute('aria-pressed', 'false')
  botao.addEventListener('click', async () => {
    elementoEspecialidade.value = botao.dataset.especialidade
    atualizarEspecialidadeSelecionada()
    await buscarEIrParaProfissionais()
  })
})

elementoEspecialidade.addEventListener('change', atualizarEspecialidadeSelecionada)

formularioAgendamento.addEventListener('submit', confirmarAgendamento)
document.querySelector('.fechar-dialogo').addEventListener('click', () => dialogoAgendamento.close())
document.querySelector('#cancelar-agendamento').addEventListener('click', () => dialogoAgendamento.close())

async function iniciar() {
  try {
    await carregarFiltros()
    await buscarProfissionais()
  } catch (erro) {
    resumoResultados.textContent = 'A API local ainda não está disponível.'
    mostrarMensagem(erro.message, 'erro')
  }
}

iniciar()
