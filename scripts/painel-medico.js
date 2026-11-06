const elementoMetaApi = document.querySelector('meta[name="api-base"]')
const apiLocal = new URL(elementoMetaApi?.content || 'http://localhost:3000/api')
const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? `${window.location.protocol}//${window.location.hostname}:${apiLocal.port || '3000'}/api`
  : `${window.location.origin}/api`

const filtroData = document.querySelector('#filtro-data')
const listaAgendamentos = document.querySelector('#lista-agendamentos')
const listaHorarios = document.querySelector('#lista-horarios')
const formularioHorario = document.querySelector('#form-horario')
const campoDiaHorario = document.querySelector('#dia-horario')
const campoModalidade = document.querySelector('#modalidade-horario')
const mensagemPainel = document.querySelector('#mensagem-painel')
const dialogoTeste = document.querySelector('#dialogo-teste')
const videoPrevia = document.querySelector('#previa-camera')
const placeholderPrevia = document.querySelector('#placeholder-previa')
const mensagemTeste = document.querySelector('#mensagem-teste')
const botaoIniciarTeste = document.querySelector('#iniciar-teste')
const botaoPararTeste = document.querySelector('#parar-teste')
const nivelMicrofone = document.querySelector('#nivel-microfone')
const trilhoMedidor = document.querySelector('.trilho-medidor')
const rotuloMedidor = document.querySelector('#rotulo-medidor')

let profissionalSelecionado = null
let agendaAtual = { agendamentos: [], horarios: [] }
let streamEquipamentos = null
let contextoAudio = null
let quadroMedidor = 0
let tentativaTeste = 0

function mostrarMensagem(texto, tipo = '') {
  mensagemPainel.textContent = texto
  mensagemPainel.className = tipo ? `mensagem-painel ${tipo}` : 'mensagem-painel'
}

async function requisitarApi(caminho, opcoes = {}) {
  const cabecalhos = { Accept: 'application/json', ...opcoes.headers }
  if (opcoes.body) cabecalhos['Content-Type'] = 'application/json'

  let resposta
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
  if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível concluir esta ação.')
  return dados
}

function formatarData(data, opcoes = {}) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: opcoes.curta ? undefined : 'long',
    day: 'numeric',
    month: opcoes.curta ? 'short' : 'long',
    ...(opcoes.ano ? { year: 'numeric' } : {}),
  }).format(new Date(ano, mes - 1, dia))
}

function dataLocalISO(data = new Date()) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function criarEstadoVazio(titulo, descricao) {
  const estado = document.createElement('div')
  estado.className = 'estado-vazio'
  const nome = document.createElement('strong')
  nome.textContent = titulo
  const detalhe = document.createElement('span')
  detalhe.textContent = descricao
  estado.append(nome, detalhe)
  return estado
}

function mostrarResumo(agenda) {
  const confirmados = agenda.agendamentos.filter((agendamento) =>
    (agendamento.status || 'confirmado') === 'confirmado',
  )

  document.querySelector('#total-consultas').textContent = String(confirmados.length)
  document.querySelector('#total-horarios').textContent = String(agenda.horarios.length)
  document.querySelector('#total-modalidades').textContent = String(agenda.profissional.modalidades.length)
  document.querySelector('#contador-horarios').textContent = String(agenda.horarios.length)
}

function criarCartaoAgendamento(agendamento) {
  const cartao = document.createElement('article')
  cartao.className = 'cartao-agendamento'

  const linha = document.createElement('div')
  linha.className = 'linha-agendamento'
  const data = document.createElement('div')
  data.className = 'data-agendamento'
  const dataTitulo = document.createElement('strong')
  dataTitulo.textContent = `${formatarData(agendamento.data)} · ${agendamento.hora}`
  const modalidade = document.createElement('span')
  modalidade.textContent = `${agendamento.modalidade} · ${agendamento.especialidade}`
  data.append(dataTitulo, modalidade)

  const cancelado = (agendamento.status || 'confirmado') === 'cancelado'
  const selo = document.createElement('span')
  selo.className = cancelado ? 'selo-status cancelado' : 'selo-status'
  selo.textContent = cancelado ? 'Cancelado' : 'Confirmado'
  linha.append(data, selo)

  const paciente = document.createElement('div')
  paciente.className = 'dados-paciente'
  const nome = document.createElement('strong')
  nome.textContent = agendamento.paciente?.nome || 'Pessoa de teste'
  const informacao = document.createElement('span')
  informacao.textContent = 'Registro de teste'
  paciente.append(nome, informacao)
  cartao.append(linha, paciente)

  const detalhes = document.createElement('details')
  detalhes.className = 'detalhes-agendamento'
  const resumo = document.createElement('summary')
  resumo.textContent = 'Ver contato'
  const dados = document.createElement('div')
  dados.className = 'detalhes-paciente'
  const email = document.createElement('span')
  email.textContent = `E-mail: ${agendamento.paciente?.email || 'Não informado'}`
  const telefone = document.createElement('span')
  telefone.textContent = `Telefone: ${agendamento.paciente?.telefone || 'Não informado'}`
  dados.append(email, telefone)
  detalhes.append(resumo, dados)
  cartao.append(detalhes)

  if (!cancelado) {
    if (agendamento.modalidade === 'Teleconsulta') {
      const botaoTeste = document.createElement('button')
      botaoTeste.className = 'botao-preparar-teleconsulta'
      botaoTeste.type = 'button'
      botaoTeste.dataset.abrirTeste = ''
      botaoTeste.textContent = 'Testar câmera e microfone'
      botaoTeste.addEventListener('click', abrirTesteEquipamentos)
      cartao.append(botaoTeste)
    }

    const botaoCancelar = document.createElement('button')
    botaoCancelar.className = 'botao-cancelar'
    botaoCancelar.type = 'button'
    botaoCancelar.textContent = 'Cancelar agendamento'
    botaoCancelar.addEventListener('click', () => cancelarAgendamento(agendamento))
    cartao.append(botaoCancelar)
  }

  return cartao
}

function desenharAgendamentos() {
  listaAgendamentos.replaceChildren()
  const dataSelecionada = filtroData.value
  const agendamentos = agendaAtual.agendamentos.filter((agendamento) =>
    !dataSelecionada || agendamento.data === dataSelecionada,
  )

  if (agendamentos.length === 0) {
    const texto = dataSelecionada
      ? 'Não há agendamentos nesta data. Escolha outro dia ou remova o filtro.'
      : 'Quando uma pessoa reservar um horário de teste, o agendamento aparecerá aqui.'
    listaAgendamentos.append(criarEstadoVazio('Sua agenda está tranquila.', texto))
    return
  }

  for (const agendamento of agendamentos) {
    listaAgendamentos.append(criarCartaoAgendamento(agendamento))
  }
}

function definirEstadoEquipamento(nome, estado) {
  const campoEstado = document.querySelector(`#estado-${nome}`)
  const indicador = document.querySelector(`#indicador-${nome}`)
  campoEstado.textContent = estado
  indicador.className = `indicador-equipamento${estado === 'Pronto' ? ' pronto' : estado === 'Indisponível' ? ' erro' : ''}`
}

function definirNivelMicrofone(nivel) {
  const valor = Math.round(nivel)
  nivelMicrofone.style.width = `${valor}%`
  trilhoMedidor.setAttribute('aria-valuenow', String(valor))
  rotuloMedidor.textContent = valor > 8 ? 'Microfone captando som' : 'Fale para testar'
}

function atualizarMedidorMicrofone(analisador) {
  const dados = new Uint8Array(analisador.fftSize)

  function medir() {
    analisador.getByteTimeDomainData(dados)
    let somaQuadrados = 0
    for (const amostra of dados) {
      const valor = (amostra - 128) / 128
      somaQuadrados += valor * valor
    }

    const volume = Math.sqrt(somaQuadrados / dados.length)
    definirNivelMicrofone(Math.min(100, volume * 360))
    quadroMedidor = requestAnimationFrame(medir)
  }

  medir()
}

function mostrarErroDePermissao(erro) {
  definirEstadoEquipamento('camera', 'Indisponível')
  definirEstadoEquipamento('microfone', 'Indisponível')
  mensagemTeste.classList.add('erro')

  if (erro?.name === 'NotAllowedError' || erro?.name === 'PermissionDeniedError' || erro?.name === 'SecurityError') {
    mensagemTeste.textContent = 'O acesso foi bloqueado. Permita câmera e microfone nas configurações de privacidade do navegador e tente novamente.'
  } else if (erro?.name === 'NotFoundError' || erro?.name === 'DevicesNotFoundError') {
    mensagemTeste.textContent = 'Não encontramos uma câmera ou um microfone neste dispositivo. Conecte os equipamentos e tente novamente.'
  } else if (erro?.name === 'NotReadableError' || erro?.name === 'TrackStartError') {
    mensagemTeste.textContent = 'Um equipamento está ocupado por outro aplicativo. Feche os outros aplicativos que usam câmera ou microfone e tente novamente.'
  } else if (erro?.name === 'OverconstrainedError') {
    mensagemTeste.textContent = 'Não foi possível iniciar os equipamentos solicitados. Confira os dispositivos conectados e tente novamente.'
  } else {
    mensagemTeste.textContent = 'Não foi possível iniciar câmera e microfone. Confira as permissões do navegador e se os equipamentos estão conectados.'
  }
}

async function desligarEquipamentos(texto = 'Equipamentos desligados. Nenhuma imagem ou áudio foi enviado ou gravado.') {
  tentativaTeste += 1
  if (quadroMedidor) cancelAnimationFrame(quadroMedidor)
  quadroMedidor = 0

  if (streamEquipamentos) {
    for (const faixa of streamEquipamentos.getTracks()) faixa.stop()
    streamEquipamentos = null
  }

  videoPrevia.pause()
  videoPrevia.srcObject = null
  videoPrevia.classList.remove('ativa')
  placeholderPrevia.hidden = false
  document.querySelector('#selo-previa').textContent = 'Câmera desligada'
  definirEstadoEquipamento('camera', 'Desligada')
  definirEstadoEquipamento('microfone', 'Desligado')
  definirNivelMicrofone(0)
  rotuloMedidor.textContent = 'Fale para testar'
  botaoIniciarTeste.disabled = false
  botaoIniciarTeste.textContent = 'Iniciar teste'
  botaoPararTeste.disabled = true
  mensagemTeste.classList.remove('erro')
  mensagemTeste.textContent = texto

  if (contextoAudio && contextoAudio.state !== 'closed') {
    const contextoAnterior = contextoAudio
    contextoAudio = null
    await contextoAnterior.close()
  } else {
    contextoAudio = null
  }
}

async function iniciarTesteEquipamentos() {
  if (!navigator.mediaDevices?.getUserMedia) {
    mensagemTeste.classList.add('erro')
    mensagemTeste.textContent = 'Este navegador não permite acessar câmera e microfone nesta página. Abra o protótipo em localhost ou em uma conexão segura (HTTPS) e tente novamente.'
    return
  }
  if (!window.isSecureContext) {
    mensagemTeste.classList.add('erro')
    mensagemTeste.textContent = 'Para proteger sua privacidade, o navegador só libera câmera e microfone em localhost ou numa conexão segura (HTTPS).'
    return
  }

  const tentativaAtual = ++tentativaTeste
  botaoIniciarTeste.disabled = true
  botaoIniciarTeste.textContent = 'Solicitando permissão…'
  botaoPararTeste.disabled = false
  mensagemTeste.classList.remove('erro')
  mensagemTeste.textContent = 'Aguardando sua permissão para acessar câmera e microfone…'

  try {
    const novoStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    if (tentativaAtual !== tentativaTeste || !dialogoTeste.open) {
      for (const faixa of novoStream.getTracks()) faixa.stop()
      return
    }

    streamEquipamentos = novoStream
    videoPrevia.srcObject = novoStream
    placeholderPrevia.hidden = true
    videoPrevia.classList.add('ativa')
    await videoPrevia.play()
    document.querySelector('#selo-previa').textContent = 'Prévia somente neste dispositivo'
    definirEstadoEquipamento('camera', 'Pronto')
    definirEstadoEquipamento('microfone', 'Pronto')
    mensagemTeste.classList.remove('erro')

    const faixaAudio = novoStream.getAudioTracks()[0]
    if (!faixaAudio) {
      throw new Error('O navegador iniciou o teste sem um microfone disponível.')
    }

    if (window.AudioContext) {
      contextoAudio = new AudioContext()
      await contextoAudio.resume()
      const origem = contextoAudio.createMediaStreamSource(novoStream)
      const analisador = contextoAudio.createAnalyser()
      analisador.fftSize = 512
      origem.connect(analisador)
      atualizarMedidorMicrofone(analisador)
      mensagemTeste.textContent = 'Câmera e microfone prontos. Fale para verificar o nível de áudio.'
    } else {
      rotuloMedidor.textContent = 'Nível de áudio não disponível neste navegador'
      mensagemTeste.textContent = 'Câmera e microfone prontos. O navegador não oferece um medidor de áudio, mas você pode conferir a prévia.'
    }
  } catch (erro) {
    await desligarEquipamentos()
    mostrarErroDePermissao(erro)
  } finally {
    if (tentativaAtual === tentativaTeste && dialogoTeste.open) {
      botaoIniciarTeste.disabled = Boolean(streamEquipamentos)
      botaoIniciarTeste.textContent = streamEquipamentos ? 'Equipamentos ativos' : 'Tentar novamente'
      botaoPararTeste.disabled = !streamEquipamentos
    }
  }
}

async function abrirTesteEquipamentos() {
  if (!dialogoTeste.open) dialogoTeste.showModal()
}

function criarItemHorario(horario) {
  const item = document.createElement('article')
  item.className = 'item-horario'
  const informacoes = document.createElement('span')
  const data = document.createElement('strong')
  data.textContent = `${formatarData(horario.data, { curta: true })} · ${horario.hora}`
  const modalidade = document.createElement('small')
  modalidade.textContent = horario.modalidade
  informacoes.append(data, modalidade)

  const remover = document.createElement('button')
  remover.className = 'botao-remover'
  remover.type = 'button'
  remover.setAttribute('aria-label', `Remover horário ${formatarData(horario.data, { curta: true })} às ${horario.hora}`)
  remover.textContent = '×'
  remover.addEventListener('click', () => removerHorario(horario))
  item.append(informacoes, remover)
  return item
}

function desenharHorarios() {
  listaHorarios.replaceChildren()
  document.querySelector('#contador-horarios').textContent = String(agendaAtual.horarios.length)

  if (agendaAtual.horarios.length === 0) {
    listaHorarios.append(criarEstadoVazio('Nenhum horário livre por enquanto.', 'Use o formulário acima para abrir um horário na sua agenda.'))
    return
  }

  for (const horario of agendaAtual.horarios.slice(0, 8)) {
    listaHorarios.append(criarItemHorario(horario))
  }

  if (agendaAtual.horarios.length > 8) {
    const restante = document.createElement('p')
    restante.className = 'ajuda-secao'
    restante.textContent = `Mostrando os próximos 8 de ${agendaAtual.horarios.length} horários.`
    listaHorarios.append(restante)
  }
}

function atualizarOpcoesModalidade(modalidades) {
  const valorAnterior = campoModalidade.value
  campoModalidade.replaceChildren()
  for (const modalidade of modalidades) {
    campoModalidade.add(new Option(modalidade, modalidade))
  }
  if (modalidades.includes(valorAnterior)) campoModalidade.value = valorAnterior
}

async function carregarAgenda() {
  if (!profissionalSelecionado) return
  mostrarMensagem('')

  try {
    const agenda = await requisitarApi(`/medico/profissionais/${encodeURIComponent(profissionalSelecionado)}/agenda`)
    agendaAtual = agenda
    atualizarOpcoesModalidade(agenda.profissional.modalidades)
    mostrarResumo(agenda)
    desenharAgendamentos()
    desenharHorarios()
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro')
  }
}

async function cancelarAgendamento(agendamento) {
  const confirmacao = window.confirm(
    `Cancelar o agendamento de ${agendamento.paciente?.nome || 'Pessoa de teste'} em ${formatarData(agendamento.data, { ano: true })} às ${agendamento.hora}?\n\nSe o horário ainda for futuro, ele voltará a aparecer na busca.`,
  )
  if (!confirmacao) return

  try {
    await requisitarApi(`/medico/agendamentos/${encodeURIComponent(agendamento.id)}`, { method: 'DELETE' })
    mostrarMensagem('Agendamento cancelado. Se era futuro, o horário voltou para a disponibilidade.')
    await carregarAgenda()
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro')
  }
}

async function adicionarHorario(evento) {
  evento.preventDefault()
  if (!profissionalSelecionado) return

  const botao = formularioHorario.querySelector('button[type="submit"]')
  botao.disabled = true
  botao.textContent = 'Salvando horário…'
  const campos = new FormData(formularioHorario)

  try {
    await requisitarApi(
      `/medico/profissionais/${encodeURIComponent(profissionalSelecionado)}/horarios`,
      {
        method: 'POST',
        body: JSON.stringify({
          data: campos.get('data'),
          hora: campos.get('hora'),
          modalidade: campos.get('modalidade'),
        }),
      },
    )
    mostrarMensagem('Horário adicionado. Ele já está disponível na busca de consultas.')
    formularioHorario.reset()
    campoDiaHorario.min = dataLocalISO()
    campoDiaHorario.value = dataLocalISO()
    formularioHorario.elements.hora.value = '09:00'
    await carregarAgenda()
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro')
  } finally {
    botao.disabled = false
    botao.textContent = 'Adicionar à agenda'
  }
}

async function removerHorario(horario) {
  const confirmado = window.confirm(
    `Remover o horário de ${formatarData(horario.data, { ano: true })} às ${horario.hora}? Ele deixará de aparecer na busca.`,
  )
  if (!confirmado) return

  try {
    await requisitarApi(
      `/medico/profissionais/${encodeURIComponent(profissionalSelecionado)}/horarios`,
      {
        method: 'DELETE',
        body: JSON.stringify(horario),
      },
    )
    mostrarMensagem('Horário removido da disponibilidade.')
    await carregarAgenda()
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro')
  }
}

async function iniciarPainel() {
  campoDiaHorario.min = dataLocalISO()
  campoDiaHorario.value = dataLocalISO()
  filtroData.value = ''

  try {
    const sessao = await requisitarApi('/auth/sessao')
    if (!sessao.usuario) {
      window.location.replace('./acesso.html')
      return
    }
    if (sessao.usuario.papel !== 'profissional') {
      window.location.replace(sessao.usuario.papel === 'administrador' ? './painel-admin.html' : './acesso.html')
      return
    }

    const dados = await requisitarApi('/medico/perfil')
    profissionalSelecionado = dados.profissional.id
    document.querySelector('#nome-profissional').textContent = dados.profissional.nome
    await carregarAgenda()
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro')
    listaAgendamentos.append(criarEstadoVazio('Não foi possível abrir a agenda.', 'Confira se o servidor está ativo e recarregue a página.'))
  }
}

filtroData.addEventListener('change', desenharAgendamentos)
formularioHorario.addEventListener('submit', adicionarHorario)
document.querySelectorAll('[data-abrir-teste]').forEach((botao) => {
  botao.addEventListener('click', abrirTesteEquipamentos)
})
botaoIniciarTeste.addEventListener('click', iniciarTesteEquipamentos)
botaoPararTeste.addEventListener('click', () => desligarEquipamentos())
document.querySelector('#fechar-teste').addEventListener('click', () => dialogoTeste.close())
dialogoTeste.addEventListener('close', () => desligarEquipamentos())

document.querySelector('#sair-conta').addEventListener('click', async () => {
  try {
    await requisitarApi('/auth/sair', { method: 'POST' })
    window.location.replace('./acesso.html')
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro')
  }
})

iniciarPainel()
