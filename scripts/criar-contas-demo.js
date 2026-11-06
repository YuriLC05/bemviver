import { randomBytes, randomUUID } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'

const caminhoBanco = fileURLToPath(new URL('../dados/db.json', import.meta.url))
const caminhoTemporario = `${caminhoBanco}.tmp`
const banco = JSON.parse(await readFile(caminhoBanco, 'utf8'))

if (!Array.isArray(banco.profissionais) || !Array.isArray(banco.usuarios)) {
  throw new Error('O db.json precisa conter as listas "profissionais" e "usuarios".')
}

const perfisDemo = banco.profissionais.filter((perfil) => perfil.id.startsWith('prof-demo-'))
if (perfisDemo.length === 0) {
  throw new Error('Nenhum perfil de demonstração foi encontrado no db.json.')
}

const novasContas = []
let bancoAlterado = false
for (const perfil of perfisDemo) {
  if (perfil.demonstracao !== true) {
    perfil.demonstracao = true
    bancoAlterado = true
  }

  const contaExistente = banco.usuarios.find((usuario) => usuario.profissionalId === perfil.id)
  if (contaExistente) {
    if (contaExistente.papel !== 'profissional') {
      throw new Error(`O perfil ${perfil.id} está vinculado a uma conta que não é profissional.`)
    }
    continue
  }

  const nomeCurto = perfil.nome
    .replace(/^(?:dra?\.?)\s*/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
  const emailBase = `${nomeCurto}@demo.bemviver.test`
  let email = emailBase
  if (banco.usuarios.some((usuario) => usuario.email === email)) {
    email = `${nomeCurto}.${perfil.id.slice(-3)}@demo.bemviver.test`
  }
  if (banco.usuarios.some((usuario) => usuario.email === email)) {
    throw new Error(`Não foi possível gerar um e-mail exclusivo para ${perfil.id}.`)
  }

  const senha = `BV-${randomBytes(18).toString('base64url')}`
  banco.usuarios.push({
    id: randomUUID(),
    nome: perfil.nome,
    email,
    senhaHash: await bcrypt.hash(senha, 12),
    papel: 'profissional',
    status: 'aprovado',
    profissionalId: perfil.id,
    criadoEm: new Date().toISOString(),
    demonstracao: true,
  })
  bancoAlterado = true
  novasContas.push({ nome: perfil.nome, email, senha })
}

if (bancoAlterado) {
  await writeFile(caminhoTemporario, `${JSON.stringify(banco, null, 2)}\n`, 'utf8')
  await rename(caminhoTemporario, caminhoBanco)
}

if (novasContas.length === 0) {
  console.log('Todos os perfis de demonstração já têm conta vinculada; nenhuma senha foi alterada.')
} else {
  console.log('Credenciais das novas contas de demonstração (guarde esta lista):')
  for (const conta of novasContas) {
    console.log(`${conta.nome}\t${conta.email}\t${conta.senha}`)
  }
  console.log(`\nContas criadas: ${novasContas.length}. Senhas armazenadas somente como hash bcrypt.`)
}
