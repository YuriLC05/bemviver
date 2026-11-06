import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import bcrypt from 'bcryptjs'
import { rateLimit } from 'express-rate-limit'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const diretorioServidor = dirname(fileURLToPath(import.meta.url))
const diretorioProjeto = resolve(diretorioServidor, '..')
dotenv.config({ path: join(diretorioProjeto, '.env') })
const caminhoBanco = process.env.DB_FILE
  ? resolve(diretorioProjeto, process.env.DB_FILE)
  : join(diretorioProjeto, 'dados', 'db.json')
const caminhoMunicipios = join(diretorioProjeto, 'dados', 'municipios.json')
const porta = Number(process.env.PORT || 3000)
const aplicativo = express()
const duracaoSessaoMs = 8 * 60 * 60 * 1000
const estadosBrasileiros = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
])
let municipiosDoBrasil = []

const limiteEntradas = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' },
})

const limiteSolicitacoes = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { erro: 'Muitas solicitações deste endereço. Tente novamente mais tarde.' },
})

function dataEmDias(diasAdiante) {
  const data = new Date()
  data.setDate(data.getDate() + diasAdiante)
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function criarHorarios(deslocamento = 0, modalidade = 'Presencial') {
  const datas = [1 + deslocamento, 2 + deslocamento, 4 + deslocamento]
  const horas = ['09:00', '11:30', '14:00']
  return datas.flatMap((dias, indice) => [
    { data: dataEmDias(dias), hora: horas[indice], modalidade },
    { data: dataEmDias(dias), hora: horas[(indice + 1) % horas.length], modalidade },
  ])
}

function criarProfissionaisDeDemonstracao() {
  const profissionaisIniciais = [
    {
      id: 'prof-demo-001',
      nome: 'Dra. Marina Duarte',
      especialidade: 'Clínica geral',
      cidade: 'São Paulo',
      modalidades: ['Presencial', 'Teleconsulta'],
      horarios: [...criarHorarios(0), ...criarHorarios(5, 'Teleconsulta')],
    },
    {
      id: 'prof-demo-002',
      nome: 'Dr. Rafael Nogueira',
      especialidade: 'Dermatologia',
      cidade: 'Rio de Janeiro',
      modalidades: ['Presencial', 'Teleconsulta'],
      horarios: [...criarHorarios(1), ...criarHorarios(6, 'Teleconsulta')],
    },
    {
      id: 'prof-demo-003',
      nome: 'Dra. Camila Reis',
      especialidade: 'Psicologia',
      cidade: 'Brasília',
      modalidades: ['Teleconsulta', 'Presencial'],
      horarios: [...criarHorarios(0, 'Teleconsulta'), ...criarHorarios(5)],
    },
    {
      id: 'prof-demo-004',
      nome: 'Dr. André Martins',
      especialidade: 'Cardiologia',
      cidade: 'São Paulo',
      modalidades: ['Presencial', 'Teleconsulta'],
      horarios: [...criarHorarios(2), ...criarHorarios(8, 'Teleconsulta')],
    },
    {
      id: 'prof-demo-005',
      nome: 'Dra. Beatriz Lima',
      especialidade: 'Clínica geral',
      cidade: 'Rio de Janeiro',
      modalidades: ['Presencial', 'Teleconsulta'],
      horarios: [...criarHorarios(1), ...criarHorarios(6, 'Teleconsulta')],
    },
  ]
  const profissionaisAdicionais = [
    { nome: 'Dra. Luiza Mendonça', especialidade: 'Pediatria', cidade: 'Brasília' },
    { nome: 'Dra. Helena Prado', especialidade: 'Ginecologia e obstetrícia', cidade: 'São Paulo' },
    { nome: 'Dr. Caio Ferreira', especialidade: 'Ortopedia e traumatologia', cidade: 'Rio de Janeiro' },
    { nome: 'Dra. Elisa Campos', especialidade: 'Neurologia', cidade: 'São Paulo' },
    { nome: 'Dr. Bruno Almeida', especialidade: 'Psiquiatria', cidade: 'Brasília' },
    { nome: 'Dra. Sofia Azevedo', especialidade: 'Oftalmologia', cidade: 'São Paulo' },
    { nome: 'Dr. Pedro Vasconcelos', especialidade: 'Endocrinologia', cidade: 'Rio de Janeiro' },
    { nome: 'Dra. Renata Freitas', especialidade: 'Otorrinolaringologia', cidade: 'Brasília' },
    { nome: 'Dr. Felipe Moreira', especialidade: 'Gastroenterologia', cidade: 'São Paulo' },
    { nome: 'Dra. Isabela Costa', especialidade: 'Urologia', cidade: 'Rio de Janeiro' },
  ]

  return [
    ...profissionaisIniciais,
    ...profissionaisAdicionais.map((profissional, indice) => ({
      id: `prof-demo-${String(indice + 6).padStart(3, '0')}`,
      ...profissional,
      modalidades: ['Presencial', 'Teleconsulta'],
      horarios: [
        ...criarHorarios(indice % 4),
        ...criarHorarios(7 + (indice % 4), 'Teleconsulta'),
      ],
    })),
  ]
}

async function lerBanco() {
  const conteudo = await readFile(caminhoBanco, 'utf8')
  return JSON.parse(conteudo)
}

let filaDeGravacao = Promise.resolve()

function atualizarBanco(atualizacao) {
  const operacao = filaDeGravacao.then(async () => {
    const banco = await lerBanco()
    const resultado = await atualizacao(banco)
    await writeFile(caminhoBanco, `${JSON.stringify(banco, null, 2)}\n`, 'utf8')
    return resultado
  })

  filaDeGravacao = operacao.then(() => undefined, () => undefined)
  return operacao
}

async function prepararBanco() {
  const municipios = JSON.parse(await readFile(caminhoMunicipios, 'utf8'))
  if (
    !Array.isArray(municipios)
    || municipios.length === 0
    || municipios.some((municipio) =>
      typeof municipio?.nome !== 'string'
      || typeof municipio?.uf !== 'string'
      || !estadosBrasileiros.has(municipio.uf),
    )
  ) {
    throw new Error('O arquivo municipios.json precisa conter a lista de municípios brasileiros do IBGE.')
  }
  municipiosDoBrasil = municipios

  const banco = await lerBanco()
  if (!Array.isArray(banco.profissionais)) {
    throw new Error('O arquivo db.json precisa conter a lista "profissionais".')
  }
  if (!Array.isArray(banco.agendamentos)) {
    throw new Error('O arquivo db.json precisa conter a lista "agendamentos".')
  }

  let bancoAlterado = false
  for (const chave of ['usuarios', 'solicitacoesProfissionais', 'sessoes']) {
    if (!Array.isArray(banco[chave])) {
      banco[chave] = []
      bancoAlterado = true
    }
  }

  const profissionaisDeDemonstracao = criarProfissionaisDeDemonstracao()
  if (banco.profissionais.length === 0) {
    banco.profissionais = profissionaisDeDemonstracao
    banco.versaoCatalogoDemonstracao = 2
    bancoAlterado = true
  } else if ((banco.versaoCatalogoDemonstracao || 0) < 2) {
    const idsExistentes = new Set(banco.profissionais.map((profissional) => profissional.id))
    for (const profissional of profissionaisDeDemonstracao) {
      if (!idsExistentes.has(profissional.id)) banco.profissionais.push(profissional)
    }
    banco.versaoCatalogoDemonstracao = 2
    bancoAlterado = true
  }

  if ((banco.versaoCatalogoDemonstracao || 0) < 3) {
    const ufsPorCidade = { Brasília: 'DF', 'Rio de Janeiro': 'RJ', 'São Paulo': 'SP' }
    for (const profissional of banco.profissionais) {
      if (profissional.id.startsWith('prof-demo-') && !profissional.uf) {
        profissional.uf = ufsPorCidade[profissional.cidade] || ''
      }
    }
    banco.versaoCatalogoDemonstracao = 3
    bancoAlterado = true
  }

  const emailAdmin = typeof process.env.ADMIN_EMAIL === 'string'
    ? process.env.ADMIN_EMAIL.trim().toLowerCase()
    : ''
  const senhaAdmin = process.env.ADMIN_PASSWORD || ''
  if (Boolean(emailAdmin) !== Boolean(senhaAdmin)) {
    throw new Error('Configure ADMIN_EMAIL e ADMIN_PASSWORD juntos no arquivo .env.')
  }
  if (emailAdmin && senhaAdmin.length < 12) {
    throw new Error('A senha inicial do administrador precisa ter pelo menos 12 caracteres.')
  }

  if (emailAdmin) {
    const usuarioExistente = banco.usuarios.find((usuario) => usuario.email === emailAdmin)
    if (usuarioExistente && usuarioExistente.papel !== 'administrador') {
      throw new Error('ADMIN_EMAIL já está vinculado a uma conta que não é administradora.')
    }
    if (!usuarioExistente) {
      banco.usuarios.push({
        id: randomUUID(),
        nome: 'Administrador BemViver',
        email: emailAdmin,
        senhaHash: await bcrypt.hash(senhaAdmin, 12),
        papel: 'administrador',
        status: 'ativo',
        criadoEm: new Date().toISOString(),
      })
      bancoAlterado = true
      console.log(`Conta administrativa inicial criada para ${emailAdmin}.`)
    }
  }

  if (bancoAlterado) {
    await writeFile(caminhoBanco, `${JSON.stringify(banco, null, 2)}\n`, 'utf8')
  }
}

function origemPermitida(origem) {
  if (!origem) return true

  try {
    const endereco = new URL(origem)
    if (['localhost', '127.0.0.1', '::1'].includes(endereco.hostname)) return true

    const origemPublica = process.env.RENDER_EXTERNAL_URL
    return typeof origemPublica === 'string' && endereco.origin === new URL(origemPublica).origin
  } catch {
    return false
  }
}

function origemLocal(origem, callback) {
  const hostPermitido = origemPermitida(origem)
  const erro = hostPermitido ? null : Object.assign(
    new Error('A API demonstrativa aceita apenas páginas locais.'),
    { status: 403 },
  )
  callback(erro, hostPermitido ? origem : false)
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function lerCookie(requisicao, nome) {
  const cookie = requisicao.headers.cookie
  if (typeof cookie !== 'string') return ''

  const item = cookie.split(';').map((parte) => parte.trim()).find((parte) => parte.startsWith(`${nome}=`))
  return item ? item.slice(nome.length + 1) : ''
}

function definirCookieSessao(resposta, requisicao, token) {
  const atributos = [
    `bv_sessao=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(duracaoSessaoMs / 1000)}`,
  ]
  if (requisicao.secure || process.env.NODE_ENV === 'production') atributos.push('Secure')
  resposta.setHeader('Set-Cookie', atributos.join('; '))
}

function apagarCookieSessao(resposta, requisicao) {
  const atributos = ['bv_sessao=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (requisicao.secure || process.env.NODE_ENV === 'production') atributos.push('Secure')
  resposta.setHeader('Set-Cookie', atributos.join('; '))
}

function dataEmDiasUteis(data, quantidade) {
  const resultado = new Date(data)
  let diasAdicionados = 0
  while (diasAdicionados < quantidade) {
    resultado.setDate(resultado.getDate() + 1)
    if (resultado.getDay() !== 0 && resultado.getDay() !== 6) diasAdicionados += 1
  }
  return resultado
}

function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    profissionalId: usuario.profissionalId || null,
  }
}

async function obterSessao(requisicao) {
  const token = lerCookie(requisicao, 'bv_sessao')
  if (!token) return null

  const banco = await lerBanco()
  const sessao = banco.sessoes.find((item) =>
    item.tokenHash === hashToken(token) && new Date(item.expiraEm) > new Date(),
  )
  if (!sessao) return null

  const usuario = banco.usuarios.find((item) => item.id === sessao.usuarioId)
  if (!usuario) return null
  if (usuario.papel === 'profissional' && usuario.status !== 'aprovado') return null
  if (usuario.papel === 'administrador' && usuario.status !== 'ativo') return null
  return usuario
}

function exigirPapel(...papeisPermitidos) {
  return async (requisicao, resposta, proximo) => {
    try {
      const usuario = await obterSessao(requisicao)
      if (!usuario) {
        resposta.status(401).json({ erro: 'Entre com sua conta da equipe para continuar.' })
        return
      }
      if (!papeisPermitidos.includes(usuario.papel)) {
        resposta.status(403).json({ erro: 'Sua conta não tem permissão para acessar este recurso.' })
        return
      }

      requisicao.usuarioAutenticado = usuario
      proximo()
    } catch (erro) {
      proximo(erro)
    }
  }
}

aplicativo.use(cors({ origin: origemLocal, credentials: true }))
aplicativo.use(express.json({ limit: '10kb' }))
aplicativo.use('/api', (requisicao, resposta, proximo) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(requisicao.method)) {
    proximo()
    return
  }

  const origem = requisicao.get('Origin')
  if (!origem || !origemPermitida(origem)) {
    resposta.status(403).json({ erro: 'Origem não permitida para esta operação.' })
    return
  }
  proximo()
})
aplicativo.use('/api', (_requisicao, resposta, proximo) => {
  resposta.set('Cache-Control', 'no-store')
  proximo()
})

aplicativo.use('/estilos', express.static(join(diretorioProjeto, 'estilos')))
aplicativo.use('/scripts', express.static(join(diretorioProjeto, 'scripts')))
aplicativo.use('/paginas', express.static(join(diretorioProjeto, 'paginas')))
aplicativo.get('/', (_requisicao, resposta) => {
  resposta.sendFile(join(diretorioProjeto, 'paginas', 'index.html'))
})

aplicativo.get('/api/saude', (_requisicao, resposta) => {
  resposta.json({ estado: 'disponivel', modo: 'demonstracao' })
})

aplicativo.get('/api/auth/sessao', async (requisicao, resposta, proximo) => {
  try {
    const usuario = await obterSessao(requisicao)
    resposta.json({ usuario: usuario ? usuarioPublico(usuario) : null })
  } catch (erro) {
    proximo(erro)
  }
})

aplicativo.post('/api/auth/entrar', limiteEntradas, async (requisicao, resposta, proximo) => {
  const email = typeof requisicao.body?.email === 'string'
    ? requisicao.body.email.trim().toLowerCase()
    : ''
  const senha = typeof requisicao.body?.senha === 'string' ? requisicao.body.senha : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160 || !senha || senha.length > 128) {
    resposta.status(400).json({ erro: 'Informe um e-mail e uma senha válidos.' })
    return
  }

  try {
    const banco = await lerBanco()
    const usuario = banco.usuarios.find((item) => item.email === email)
    if (!usuario || !(await bcrypt.compare(senha, usuario.senhaHash))) {
      resposta.status(401).json({ erro: 'E-mail ou senha incorretos.' })
      return
    }
    if (usuario.status === 'pendente') {
      resposta.status(403).json({ erro: 'Sua solicitação profissional ainda está em análise.' })
      return
    }
    if (usuario.status === 'rejeitado' || usuario.status === 'inativo') {
      resposta.status(403).json({ erro: 'Esta conta não está autorizada a entrar. Entre em contato com a administração.' })
      return
    }

    const token = randomBytes(32).toString('hex')
    const agora = new Date()
    await atualizarBanco((bancoAtualizado) => {
      bancoAtualizado.sessoes = bancoAtualizado.sessoes.filter((sessao) =>
        new Date(sessao.expiraEm) > agora,
      )
      bancoAtualizado.sessoes.push({
        id: randomUUID(),
        usuarioId: usuario.id,
        tokenHash: hashToken(token),
        criadoEm: agora.toISOString(),
        expiraEm: new Date(agora.getTime() + duracaoSessaoMs).toISOString(),
      })
    })

    definirCookieSessao(resposta, requisicao, token)
    resposta.json({ usuario: usuarioPublico(usuario) })
  } catch (erro) {
    proximo(erro)
  }
})

aplicativo.post('/api/auth/sair', async (requisicao, resposta, proximo) => {
  const token = lerCookie(requisicao, 'bv_sessao')
  try {
    if (token) {
      await atualizarBanco((banco) => {
        banco.sessoes = banco.sessoes.filter((sessao) => sessao.tokenHash !== hashToken(token))
      })
    }
    apagarCookieSessao(resposta, requisicao)
    resposta.json({ encerrada: true })
  } catch (erro) {
    proximo(erro)
  }
})

aplicativo.post('/api/auth/solicitacoes-profissionais', limiteSolicitacoes, async (requisicao, resposta, proximo) => {
  const {
    nome,
    email: emailInformado,
    senha,
    especialidade,
    cidade,
    modalidades,
    crm: crmInformado,
    uf: ufInformada,
  } = requisicao.body || {}
  const email = typeof emailInformado === 'string' ? emailInformado.trim().toLowerCase() : ''
  const crm = typeof crmInformado === 'string' ? crmInformado.replace(/\D/g, '') : ''
  const uf = typeof ufInformada === 'string' ? ufInformada.trim().toUpperCase() : ''
  const modalidadesValidas = Array.isArray(modalidades)
    && modalidades.length > 0
    && modalidades.every((modalidade) => ['Presencial', 'Teleconsulta'].includes(modalidade))

  if (
    typeof nome !== 'string'
    || nome.trim().length < 3
    || nome.trim().length > 100
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || email.length > 160
    || typeof senha !== 'string'
    || senha.length < 12
    || senha.length > 128
    || typeof especialidade !== 'string'
    || especialidade.trim().length < 2
    || especialidade.trim().length > 80
    || typeof cidade !== 'string'
    || cidade.trim().length < 2
    || cidade.trim().length > 80
    || !modalidadesValidas
    || crm.length < 4
    || crm.length > 10
    || !estadosBrasileiros.has(uf)
  ) {
    resposta.status(400).json({ erro: 'Confira seus dados, CRM/UF, modalidade e senha (mínimo de 12 caracteres).' })
    return
  }

  try {
    const banco = await lerBanco()
    if (banco.usuarios.some((usuario) => usuario.email === email)) {
      resposta.status(409).json({ erro: 'Já existe uma solicitação ou conta com este e-mail.' })
      return
    }
    if (banco.solicitacoesProfissionais.some((solicitacao) =>
      solicitacao.crm === crm
      && solicitacao.uf === uf
      && solicitacao.status !== 'rejeitado',
    )) {
      resposta.status(409).json({ erro: 'Já existe uma solicitação ativa para este CRM e estado.' })
      return
    }

    const agora = new Date()
    const prazoAnalise = dataEmDiasUteis(agora, 3)
    const resultado = await atualizarBanco(async (bancoAtualizado) => {
      if (bancoAtualizado.usuarios.some((usuario) => usuario.email === email)) {
        const erro = new Error('Já existe uma solicitação ou conta com este e-mail.')
        erro.status = 409
        throw erro
      }
      if (bancoAtualizado.solicitacoesProfissionais.some((solicitacao) =>
        solicitacao.crm === crm
        && solicitacao.uf === uf
        && solicitacao.status !== 'rejeitado',
      )) {
        const erro = new Error('Já existe uma solicitação ativa para este CRM e estado.')
        erro.status = 409
        throw erro
      }

      const usuario = {
        id: randomUUID(),
        nome: nome.trim(),
        email,
        senhaHash: await bcrypt.hash(senha, 12),
        papel: 'profissional',
        status: 'pendente',
        profissionalId: null,
        criadoEm: agora.toISOString(),
      }
      const solicitacao = {
        id: randomUUID(),
        usuarioId: usuario.id,
        nome: usuario.nome,
        email,
        especialidade: especialidade.trim(),
        cidade: cidade.trim(),
        modalidades: [...new Set(modalidades)],
        crm,
        uf,
        status: 'pendente',
        enviadaEm: agora.toISOString(),
        prazoAnaliseEm: prazoAnalise.toISOString(),
      }

      bancoAtualizado.usuarios.push(usuario)
      bancoAtualizado.solicitacoesProfissionais.push(solicitacao)
      return solicitacao
    })

    resposta.status(202).json({
      solicitacao: {
        status: resultado.status,
        enviadaEm: resultado.enviadaEm,
        prazoAnaliseEm: resultado.prazoAnaliseEm,
      },
      mensagem: 'Solicitação recebida. A equipe administrativa analisará seus dados em até três dias úteis.',
    })
  } catch (erro) {
    if (erro.status) {
      resposta.status(erro.status).json({ erro: erro.message })
      return
    }
    proximo(erro)
  }
})

aplicativo.get('/api/opcoes', async (_requisicao, resposta, proximo) => {
  try {
    const banco = await lerBanco()
    resposta.json({
      especialidades: [...new Set(banco.profissionais.map((profissional) => profissional.especialidade))].sort(),
      cidades: municipiosDoBrasil.map(({ nome, uf }) => `${nome} - ${uf}`),
    })
  } catch (erro) {
    proximo(erro)
  }
})

aplicativo.get('/api/admin/painel', exigirPapel('administrador'), async (_requisicao, resposta, proximo) => {
  try {
    const banco = await lerBanco()
    const agora = new Date()
    const profissionais = banco.profissionais.map((profissional) => ({
      id: profissional.id,
      nome: profissional.nome,
      especialidade: profissional.especialidade,
      cidade: profissional.cidade,
      modalidades: profissional.modalidades,
      horariosDisponiveis: profissional.horarios.filter((horario) =>
        new Date(`${horario.data}T${horario.hora}:00`) > agora,
      ).length,
    }))
    const agendamentos = banco.agendamentos
      .map((agendamento) => ({
        id: agendamento.id,
        profissionalId: agendamento.profissionalId,
        profissional: agendamento.profissional,
        especialidade: agendamento.especialidade,
        modalidade: agendamento.modalidade,
        data: agendamento.data,
        hora: agendamento.hora,
        paciente: { nome: agendamento.paciente?.nome || 'Pessoa de teste' },
        status: agendamento.status || 'confirmado',
      }))
      .sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`))

    resposta.json({
      profissionais,
      agendamentos,
      solicitacoesProfissionais: banco.solicitacoesProfissionais
        .map((solicitacao) => ({
          id: solicitacao.id,
          nome: solicitacao.nome,
          email: solicitacao.email,
          especialidade: solicitacao.especialidade,
          cidade: solicitacao.cidade,
          modalidades: solicitacao.modalidades,
          crm: solicitacao.crm,
          uf: solicitacao.uf,
          status: solicitacao.status,
          enviadaEm: solicitacao.enviadaEm,
          prazoAnaliseEm: solicitacao.prazoAnaliseEm,
          decididaEm: solicitacao.decididaEm || null,
          observacaoAdmin: solicitacao.observacaoAdmin || '',
        }))
        .sort((a, b) => a.prazoAnaliseEm.localeCompare(b.prazoAnaliseEm)),
      resumo: {
        profissionais: profissionais.length,
        horariosDisponiveis: profissionais.reduce((total, profissional) => total + profissional.horariosDisponiveis, 0),
        consultasConfirmadas: agendamentos.filter((agendamento) => agendamento.status === 'confirmado').length,
        consultasCanceladas: agendamentos.filter((agendamento) => agendamento.status === 'cancelado').length,
      },
    })
  } catch (erro) {
    proximo(erro)
  }
})

aplicativo.patch('/api/admin/solicitacoes-profissionais/:solicitacaoId', exigirPapel('administrador'), async (requisicao, resposta, proximo) => {
  const { decisao, observacao } = requisicao.body || {}
  if (
    !['aprovado', 'rejeitado'].includes(decisao)
    || (observacao !== undefined && (typeof observacao !== 'string' || observacao.length > 500))
  ) {
    resposta.status(400).json({ erro: 'Escolha aprovar ou rejeitar e limite a observação a 500 caracteres.' })
    return
  }

  try {
    const resultado = await atualizarBanco((banco) => {
      const solicitacao = banco.solicitacoesProfissionais.find((item) =>
        item.id === requisicao.params.solicitacaoId,
      )
      if (!solicitacao) {
        const erro = new Error('Solicitação profissional não encontrada.')
        erro.status = 404
        throw erro
      }
      if (solicitacao.status !== 'pendente') {
        const erro = new Error('Esta solicitação já foi analisada.')
        erro.status = 409
        throw erro
      }

      const usuario = banco.usuarios.find((item) => item.id === solicitacao.usuarioId)
      if (!usuario || usuario.papel !== 'profissional') {
        const erro = new Error('A conta vinculada à solicitação não foi encontrada.')
        erro.status = 409
        throw erro
      }

      solicitacao.status = decisao
      solicitacao.decididaEm = new Date().toISOString()
      solicitacao.observacaoAdmin = typeof observacao === 'string' ? observacao.trim() : ''
      usuario.status = decisao

      if (decisao === 'aprovado') {
        const profissional = {
          id: `prof-${randomUUID()}`,
          nome: solicitacao.nome,
          especialidade: solicitacao.especialidade,
          cidade: solicitacao.cidade,
          modalidades: solicitacao.modalidades,
          horarios: [],
        }
        banco.profissionais.push(profissional)
        usuario.profissionalId = profissional.id
        solicitacao.profissionalId = profissional.id
      }

      return {
        id: solicitacao.id,
        status: solicitacao.status,
        profissionalId: solicitacao.profissionalId || null,
      }
    })

    resposta.json({ solicitacao: resultado })
  } catch (erro) {
    if (erro.status) {
      resposta.status(erro.status).json({ erro: erro.message })
      return
    }
    proximo(erro)
  }
})

aplicativo.get('/api/profissionais', async (requisicao, resposta, proximo) => {
  try {
    const banco = await lerBanco()
    const { especialidade, cidade, modalidade } = requisicao.query
    const municipioSelecionado = cidade
      ? municipiosDoBrasil.find((municipio) => `${municipio.nome} - ${municipio.uf}` === cidade)
      : null
    if (cidade && !municipioSelecionado) {
      resposta.status(400).json({ erro: 'Escolha uma cidade da lista oficial de municípios brasileiros.' })
      return
    }
    const filtrados = banco.profissionais
      .filter((profissional) => !especialidade || profissional.especialidade === especialidade)
      .filter((profissional) => !municipioSelecionado || (
        profissional.cidade === municipioSelecionado.nome
        && (!profissional.uf || profissional.uf === municipioSelecionado.uf)
      ))
      .map((profissional) => ({
        ...profissional,
        horarios: profissional.horarios.filter((horario) =>
          (!modalidade || horario.modalidade === modalidade)
          && new Date(`${horario.data}T${horario.hora}:00`) > new Date(),
        ),
      }))
      .filter((profissional) => profissional.horarios.length > 0)

    resposta.json({ profissionais: filtrados })
  } catch (erro) {
    proximo(erro)
  }
})

aplicativo.get('/api/medico/perfil', exigirPapel('profissional'), async (requisicao, resposta, proximo) => {
  try {
    const banco = await lerBanco()
    const profissional = banco.profissionais.find((item) =>
      item.id === requisicao.usuarioAutenticado.profissionalId,
    )
    if (!profissional) {
      resposta.status(404).json({ erro: 'Perfil profissional associado à conta não encontrado.' })
      return
    }

    resposta.json({
      profissional: {
        id: profissional.id,
        nome: profissional.nome,
        especialidade: profissional.especialidade,
        cidade: profissional.cidade,
        modalidades: profissional.modalidades,
      },
    })
  } catch (erro) {
    proximo(erro)
  }
})

aplicativo.get('/api/medico/profissionais/:profissionalId/agenda', exigirPapel('profissional'), async (requisicao, resposta, proximo) => {
  if (requisicao.params.profissionalId !== requisicao.usuarioAutenticado.profissionalId) {
    resposta.status(403).json({ erro: 'Você só pode consultar a agenda vinculada à sua conta.' })
    return
  }
  try {
    const banco = await lerBanco()
    const profissional = banco.profissionais.find((item) => item.id === requisicao.params.profissionalId)
    if (!profissional) {
      resposta.status(404).json({ erro: 'Profissional não encontrado no banco demonstrativo.' })
      return
    }

    resposta.json({
      profissional: {
        id: profissional.id,
        nome: profissional.nome,
        especialidade: profissional.especialidade,
        cidade: profissional.cidade,
        modalidades: profissional.modalidades,
      },
      horarios: profissional.horarios
        .filter((horario) => new Date(`${horario.data}T${horario.hora}:00`) > new Date())
        .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`)),
      agendamentos: banco.agendamentos
        .filter((agendamento) => agendamento.profissionalId === profissional.id)
        .map((agendamento) => ({
          ...agendamento,
          status: agendamento.status || 'confirmado',
        }))
        .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`)),
    })
  } catch (erro) {
    proximo(erro)
  }
})

aplicativo.post('/api/medico/profissionais/:profissionalId/horarios', exigirPapel('profissional'), async (requisicao, resposta, proximo) => {
  if (requisicao.params.profissionalId !== requisicao.usuarioAutenticado.profissionalId) {
    resposta.status(403).json({ erro: 'Você só pode alterar a agenda vinculada à sua conta.' })
    return
  }
  const { data, hora, modalidade } = requisicao.body || {}
  const horarioValido = typeof hora === 'string'
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
  const dataValida = typeof data === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(data)
    && !Number.isNaN(Date.parse(`${data}T00:00:00`))
    && new Date(`${data}T00:00:00`).toISOString().slice(0, 10) === data

  if (!dataValida || !horarioValido || !['Presencial', 'Teleconsulta'].includes(modalidade)) {
    resposta.status(400).json({ erro: 'Informe uma data válida, um horário e uma modalidade de atendimento.' })
    return
  }
  if (new Date(`${data}T${hora}:00`) <= new Date()) {
    resposta.status(400).json({ erro: 'Escolha uma data e um horário futuros.' })
    return
  }

  try {
    const horario = await atualizarBanco((banco) => {
      const profissional = banco.profissionais.find((item) => item.id === requisicao.params.profissionalId)
      if (!profissional) {
        const erro = new Error('Profissional não encontrado no banco demonstrativo.')
        erro.status = 404
        throw erro
      }

      const conflito = profissional.horarios.some((item) =>
        item.data === data && item.hora === hora,
      ) || banco.agendamentos.some((item) =>
        item.profissionalId === profissional.id
        && item.data === data
        && item.hora === hora
        && (item.status || 'confirmado') === 'confirmado',
      )

      if (conflito) {
        const erro = new Error('Esse horário já está disponível ou ocupado na agenda.')
        erro.status = 409
        throw erro
      }

      const novoHorario = { data, hora, modalidade }
      profissional.horarios.push(novoHorario)
      profissional.horarios.sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`))
      return novoHorario
    })

    resposta.status(201).json({ horario })
  } catch (erro) {
    if (erro.status) {
      resposta.status(erro.status).json({ erro: erro.message })
      return
    }
    proximo(erro)
  }
})

aplicativo.delete('/api/medico/profissionais/:profissionalId/horarios', exigirPapel('profissional'), async (requisicao, resposta, proximo) => {
  if (requisicao.params.profissionalId !== requisicao.usuarioAutenticado.profissionalId) {
    resposta.status(403).json({ erro: 'Você só pode alterar a agenda vinculada à sua conta.' })
    return
  }
  const { data, hora, modalidade } = requisicao.body || {}
  if (
    typeof data !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(data)
    || typeof hora !== 'string'
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
    || !['Presencial', 'Teleconsulta'].includes(modalidade)
  ) {
    resposta.status(400).json({ erro: 'Selecione um horário válido para remover.' })
    return
  }

  try {
    const removido = await atualizarBanco((banco) => {
      const profissional = banco.profissionais.find((item) => item.id === requisicao.params.profissionalId)
      if (!profissional) {
        const erro = new Error('Profissional não encontrado no banco demonstrativo.')
        erro.status = 404
        throw erro
      }

      const indice = profissional.horarios.findIndex((item) =>
        item.data === data && item.hora === hora && item.modalidade === modalidade,
      )
      if (indice < 0) {
        const erro = new Error('Esse horário não está mais disponível para remoção.')
        erro.status = 404
        throw erro
      }

      profissional.horarios.splice(indice, 1)
      return true
    })

    resposta.json({ removido })
  } catch (erro) {
    if (erro.status) {
      resposta.status(erro.status).json({ erro: erro.message })
      return
    }
    proximo(erro)
  }
})

aplicativo.post('/api/agendamentos', async (requisicao, resposta, proximo) => {
  const { profissionalId, data, hora, modalidade, nome, email, telefone } = requisicao.body || {}
  const telefoneNormalizado = typeof telefone === 'string' ? telefone.replace(/\D/g, '') : ''
  const emailNormalizado = typeof email === 'string' ? email.trim().toLowerCase() : ''

  if (
    typeof profissionalId !== 'string'
    || typeof data !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(data)
    || typeof hora !== 'string'
    || !/^\d{2}:\d{2}$/.test(hora)
    || !['Presencial', 'Teleconsulta'].includes(modalidade)
    || typeof nome !== 'string'
    || nome.trim().length < 3
    || nome.trim().length > 100
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)
    || emailNormalizado.length > 160
    || telefoneNormalizado.length < 10
    || telefoneNormalizado.length > 13
  ) {
    resposta.status(400).json({ erro: 'Confira nome, e-mail, telefone e horário selecionado.' })
    return
  }

  try {
    const agendamento = await atualizarBanco((banco) => {
      const profissional = banco.profissionais.find((item) => item.id === profissionalId)
      if (!profissional) {
        const erro = new Error('Esse perfil não está mais disponível. Atualize a busca e escolha outro horário.')
        erro.status = 404
        throw erro
      }

      const horarioDisponivel = profissional.horarios.some((item) =>
        item.data === data && item.hora === hora && item.modalidade === modalidade,
      )
      if (!horarioDisponivel) {
        const erro = new Error('Esse horário não está mais disponível. Escolha um dos horários exibidos na busca.')
        erro.status = 409
        throw erro
      }

      const conflito = banco.agendamentos.some((item) =>
        item.profissionalId === profissionalId
        && item.data === data
        && item.hora === hora
        && (item.status || 'confirmado') === 'confirmado',
      )
      if (conflito) {
        const erro = new Error('Outra pessoa acabou de escolher esse horário. Selecione uma nova opção.')
        erro.status = 409
        throw erro
      }

      const novoAgendamento = {
        id: randomUUID(),
        profissionalId,
        profissional: profissional.nome,
        especialidade: profissional.especialidade,
        cidade: profissional.cidade,
        modalidade,
        data,
        hora,
        paciente: { nome: nome.trim(), email: emailNormalizado, telefone: telefoneNormalizado },
        criadoEm: new Date().toISOString(),
        status: 'confirmado',
        ficticio: true,
      }

      banco.agendamentos.push(novoAgendamento)
      profissional.horarios = profissional.horarios.filter((item) => item.data !== data || item.hora !== hora)
      return novoAgendamento
    })

    resposta.status(201).json({ agendamento })
  } catch (erro) {
    if (erro.status) {
      resposta.status(erro.status).json({ erro: erro.message })
      return
    }
    proximo(erro)
  }
})

aplicativo.delete('/api/medico/agendamentos/:agendamentoId', exigirPapel('profissional'), async (requisicao, resposta, proximo) => {
  try {
    const agendamento = await atualizarBanco((banco) => {
      const item = banco.agendamentos.find((registro) => registro.id === requisicao.params.agendamentoId)
      if (!item) {
        const erro = new Error('Agendamento não encontrado no banco demonstrativo.')
        erro.status = 404
        throw erro
      }
      if (item.profissionalId !== requisicao.usuarioAutenticado.profissionalId) {
        const erro = new Error('Você só pode cancelar agendamentos da sua própria agenda.')
        erro.status = 403
        throw erro
      }

      if ((item.status || 'confirmado') !== 'confirmado') {
        const erro = new Error('Este agendamento já foi cancelado.')
        erro.status = 409
        throw erro
      }

      item.status = 'cancelado'
      const profissional = banco.profissionais.find((registro) => registro.id === item.profissionalId)
      const horarioFuturo = new Date(`${item.data}T${item.hora}:00`) > new Date()
      if (
        profissional
        && horarioFuturo
        && !profissional.horarios.some((horario) => horario.data === item.data && horario.hora === item.hora)
      ) {
        profissional.horarios.push({
          data: item.data,
          hora: item.hora,
          modalidade: item.modalidade,
        })
        profissional.horarios.sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`))
      }

      return {
        id: item.id,
        profissionalId: item.profissionalId,
        data: item.data,
        hora: item.hora,
        status: item.status,
      }
    })

    resposta.json({ agendamento })
  } catch (erro) {
    if (erro.status) {
      resposta.status(erro.status).json({ erro: erro.message })
      return
    }
    proximo(erro)
  }
})

aplicativo.use((erro, _requisicao, resposta, _proximo) => {
  console.error('Erro na API de agendamento:', erro)
  const status = Number.isInteger(erro.status) && erro.status >= 400 && erro.status < 600
    ? erro.status
    : 500
  resposta.status(status).json({
    erro: status === 500
      ? 'Ocorreu um erro na API local. Consulte o terminal do servidor.'
      : erro.message,
  })
})

await prepararBanco()

const enderecoEscuta = process.env.RENDER ? '0.0.0.0' : '127.0.0.1'

aplicativo.listen(porta, enderecoEscuta, () => {
  console.log(`API de demonstração ativa em http://localhost:${porta}`)
  console.log(`Banco JSON local: ${caminhoBanco}`)
  console.log('Use dados fictícios. Esta API não agenda consultas reais.')
})
