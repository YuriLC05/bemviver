# BemViver — protótipo de agendamento

Protótipo em **JavaScript**, HTML e CSS para testar um fluxo simples de busca e agendamento médico. A interface e a API usam dados fictícios; nenhuma consulta real é marcada.

## O que aprendemos com as referências

Foram observadas as páginas públicas indicadas para identificar padrões de navegação — sem copiar marca, textos ou identidade visual:

- [Doctoralia](https://www.doctoralia.com.br/): deixa a busca por profissional/especialidade e região em destaque e ajuda a descobrir categorias populares.
- [Rede D'Or](https://www.rededorsaoluiz.com.br/paciente/marcar-consulta): organiza a marcação como uma jornada guiada e oferece a escolha entre modalidades de atendimento.
- [Agendar Consulta](https://agendarconsulta.com/): comunica conveniência, busca local e opções presenciais ou on-line.
- [Conecta Médico](https://conectamedico.com.br/): referência visual escolhida para a página inicial — destaque com fotografia, chamada principal bem visível, ações diretas e acesso rápido às especialidades.

O BemViver usa esses padrões como inspiração, mas mantém nome, cores, textos, componentes e identidade próprios. A foto de destaque e uma fotografia médica diferente ao fundo da seção de três passos são carregadas do Unsplash; são imagens ilustrativas, não imagens geradas por IA. O restante da interface não depende das referências externas.

A seção de três cartões explica o fluxo do nosso protótipo: encontrar uma especialidade, escolher profissional e horário e revisar a confirmação demonstrativa. Ela aparece após a lista de profissionais, mantendo os resultados próximos da busca e a explicação da jornada disponível mais abaixo.

O painel profissional também tem um **teste local de câmera e microfone**: ele só solicita acesso após o clique, exibe uma prévia no navegador e mede o som ambiente. Ao fechar ou desligar o teste, os dispositivos são liberados. Esse recurso não grava nem transmite mídia e não é uma chamada de teleconsulta. Câmera e microfone exigem permissão do navegador e uma origem segura, como `localhost` ou HTTPS.

### Decisões para este protótipo

1. **Começar pela necessidade da pessoa:** especialidade, cidade e modalidade são os filtros principais.
2. **Mostrar disponibilidade junto do perfil:** reduz passos e ajuda a comparar opções sem abrir várias páginas.
3. **Confirmar somente depois de revisar:** a pessoa escolhe um horário e vê o resumo antes de enviar.
4. **Deixar os limites visíveis:** os perfis e horários estão marcados como fictícios e a confirmação explica que não é um atendimento real.
5. **Construir por etapas:** autenticação, convênios, pagamentos, prontuário e videochamada ficam fora deste primeiro teste. Videochamada exige planejamento próprio de privacidade, segurança e operação.

O catálogo demonstrativo reúne 14 opções, como Clínica geral, Pediatria, Ginecologia e obstetrícia, Cardiologia, Dermatologia, Ortopedia e traumatologia, Neurologia, Psiquiatria e Psicologia. Cada opção tem ao menos um perfil e horários fictícios para que a busca possa ser testada de ponta a ponta; esses nomes não representam profissionais reais.

As páginas foram consultadas como referências públicas; isso **não é uma auditoria de segurança** nem uma garantia de que qualquer site esteja “livre de vírus”. Nenhum arquivo executável foi baixado. O projeto também não está pronto para armazenar dados reais de pacientes.

## Tecnologias

- **HTML, CSS e JavaScript no navegador:** a interface pode ser servida pela extensão Live Server.
- **Node.js e Express:** a API local fornece perfis, filtros e criação de agendamentos demonstrativos.
- **CORS:** permite que uma página servida localmente em outra porta, como a `5500` do Live Server, converse com a API.
- **`dados/db.json`:** armazenamento local de perfis fictícios e agendamentos de teste.
- **`dados/municipios.json`:** lista dos 5.571 municípios obtida da [API pública de Localidades do IBGE](https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome), armazenada localmente para busca de cidade/UF sem depender de conexão após o download.
- **`painel-medico.html`:** agenda vinculada à conta profissional autenticada e aprovada.
- **`painel-admin.html`:** visão administrativa autenticada, com fila para analisar solicitações profissionais.
- **`bcryptjs` e sessões em cookie:** senhas são armazenadas como hash e os identificadores de sessão são guardados no banco somente como hash.

O paciente continua agendando como visitante, sem criar conta. O cadastro público é apenas para profissionais e gera uma solicitação pendente. Um administrador provisionado localmente analisa manualmente o CRM/UF e decide se aprova ou rejeita; a aprovação não consulta automaticamente o conselho profissional. O prazo demonstrativo de três dias úteis conta segunda a sexta-feira e ainda não considera feriados.

Esta autenticação é uma etapa de desenvolvimento, não uma certificação de segurança ou autorização para dados reais. O JSON local não oferece as garantias de concorrência, disponibilidade, auditoria e proteção de dados necessárias para produção.

## Como iniciar usando o Live Server

1. Instale uma versão atual do Node.js.
2. No terminal do VS Code, dentro desta pasta, instale as dependências uma vez:

   ```bash
   npm install
   ```

3. Em um terminal, mantenha a API rodando:

   ```bash
   npm run api
   ```

   A API estará em `http://localhost:3000`. Na primeira inicialização, o servidor preenche `dados/db.json` com profissionais, agendamentos e listas locais de contas/sessões. Em bancos de versões anteriores, adiciona uma única vez os novos perfis fictícios do catálogo, preservando os registros que já existiam. A lista `dados/municipios.json` é usada para sugerir cidade e UF no filtro.

4. Em outro terminal, abra `paginas/index.html` com a extensão **Live Server**. O navegador normalmente usará uma URL como `http://127.0.0.1:5500/paginas/`.
5. Para habilitar a primeira conta administrativa local, copie `.env.example` para `.env`, defina `ADMIN_EMAIL` e uma `ADMIN_PASSWORD` com pelo menos 12 caracteres e reinicie a API. A conta é criada uma única vez; a senha não é escrita em `dados/db.json`. Mantenha `.env` privado e nunca o envie ao Git.
6. Use **Acesso da equipe** na página inicial para entrar; para o administrador, use o link **Acesso administrativo** no rodapé. A equipe administrativa usa a conta configurada no `.env`; o profissional usa a conta criada no formulário **Solicitar análise profissional**.
7. No painel administrativo, confira o CRM/UF no conselho correspondente antes de aprovar a solicitação. A aprovação cria o perfil profissional vinculado e libera a agenda; a rejeição exige um motivo.
8. Pesquise, escolha um horário e confirme como paciente visitante usando somente dados fictícios. A confirmação só aparece depois que a API grava o registro em `dados/db.json`.

### Contas de profissionais para demonstração

Os perfis `prof-demo-*` são fictícios e não representam médicos reais. Para testar o painel com todos eles, pare a API e execute:

```bash
npm run criar-contas-demo
```

O comando cria uma conta aprovada de demonstração para cada perfil sem conta vinculada, grava apenas hashes bcrypt em `dados/db.json` e mostra as senhas geradas uma única vez no terminal. Guarde a lista em local privado; o projeto não armazena nem recupera as senhas em texto puro. As contas usam e-mails `@demo.bemviver.test`, são exclusivas para testes locais e não devem ser usadas com pacientes ou profissionais reais. O comando pode ser repetido com segurança: contas existentes e suas senhas não são alteradas.

No painel profissional, a conta aprovada acessa apenas o perfil vinculado, pode ver os contatos fictícios, abrir ou remover horários e cancelar agendamentos. O cancelamento preserva o registro como cancelado e devolve à busca o horário futuro correspondente.

O painel administrativo mostra indicadores, permite filtrar agendamentos e apresenta os profissionais. As solicitações ficam numa fila com o CRM/UF, prazo e ações de aprovação/rejeição; o sistema registra a decisão, mas não verifica a licença profissional automaticamente.

**Importante:** Live Server sozinho serve os arquivos estáticos; ele não inicia o Node.js e não pode escrever no `dados/db.json`. Por isso, a API precisa continuar ativa no outro terminal. Se ela estiver parada, a interface avisa que não conseguiu conectar.

Use o mesmo nome de host na página e na API: se o Live Server estiver em `http://127.0.0.1:5500`, a página ajusta a API para `http://127.0.0.1:3000`; se estiver em `http://localhost:5500`, usa `http://localhost:3000`. Cookies de sessão são vinculados ao host, portanto não misture `localhost` com `127.0.0.1` durante o teste.

As rotas administrativas e profissionais verificam sessão e papel no servidor. As mutações também exigem uma origem local permitida. Cookies são `HttpOnly` e `SameSite=Lax`; em `NODE_ENV=production` são marcados como `Secure`, o que exige HTTPS. Esta configuração CORS local não deve ser ampliada sem uma configuração de produção revisada.

## Publicar uma prévia gratuita no Render

O arquivo `render.yaml` configura um único serviço Node.js para servir a API e as páginas pela mesma URL. Para publicar:

1. Envie o projeto para um repositório GitHub e, no Render, crie um serviço usando esse repositório ou o Blueprint `render.yaml`.
2. Configure `ADMIN_EMAIL` e `ADMIN_PASSWORD` como variáveis privadas do serviço. A senha precisa ter pelo menos 12 caracteres. Não coloque esses valores no GitHub.
3. Use o plano gratuito e aguarde a implantação. A página inicial fica na URL Render do serviço; a API e o front-end são publicados juntos.

**Limites do plano gratuito:** o serviço pode suspender após inatividade e o sistema de arquivos não é persistente. O `dados/db.json` pode voltar ao conteúdo do repositório após reinícios ou novas implantações; portanto, esta configuração serve apenas para uma prévia e não para manter agendamentos entre sessões. O projeto não está pronto para dados reais de pacientes.

## API local

| Método | Caminho | Uso |
| --- | --- | --- |
| `GET` | `/api/saude` | Confere se a API está disponível. |
| `GET` | `/api/auth/sessao` | Retorna a identidade da sessão atual, se houver. |
| `POST` | `/api/auth/entrar` | Autentica profissional aprovado ou administrador. |
| `POST` | `/api/auth/sair` | Encerra a sessão atual. |
| `POST` | `/api/auth/solicitacoes-profissionais` | Cria conta profissional pendente e solicita análise. |
| `GET` | `/api/opcoes` | Lista especialidades e cidades presentes no banco. |
| `GET` | `/api/profissionais` | Lista perfis; aceita `especialidade`, `cidade` e `modalidade` como filtros. |
| `GET` | `/api/admin/painel` | Retorna indicadores, profissionais, solicitações e agendamentos; exige papel administrativo. |
| `PATCH` | `/api/admin/solicitacoes-profissionais/:id` | Aprova ou rejeita solicitação pendente; exige papel administrativo. |
| `POST` | `/api/agendamentos` | Valida e registra um horário fictício, impedindo reserva duplicada. |
| `GET` | `/api/medico/perfil` | Retorna o perfil associado à conta profissional aprovada. |
| `GET` | `/api/medico/profissionais/:id/agenda` | Retorna a agenda do próprio profissional autenticado. |
| `POST` | `/api/medico/profissionais/:id/horarios` | Adiciona horário futuro à própria disponibilidade. |
| `DELETE` | `/api/medico/profissionais/:id/horarios` | Remove horário da própria disponibilidade. |
| `DELETE` | `/api/medico/agendamentos/:id` | Cancela somente agendamento da própria agenda. |

O arquivo JSON contém hashes de senha, identificadores de sessão em hash, dados de solicitações e informações de agendamentos fictícios. Ele é gravado novamente a cada alteração; faça cópias de segurança e nunca use dados reais neste protótipo.

## Estrutura

```text
Agendamento-A3/
├── paginas/       Páginas HTML abertas pelo Live Server
├── estilos/       Arquivos CSS das páginas
├── scripts/       JavaScript do navegador e script auxiliar
├── servidor/      API Express
├── dados/         Banco local JSON e municípios brasileiros
├── .env           Configurações privadas locais (não enviar ao Git)
├── .env.example   Modelo de configuração do administrador
├── package.json   Comandos e dependências do projeto
└── README.md      Documentação
```

## Próximos passos sugeridos

1. Testar com pessoas se os filtros e os nomes dos passos são compreensíveis.
2. Ajustar as mensagens e o fluxo com base nas dúvidas observadas.
3. Definir regras reais de disponibilidade, cancelamento e confirmação antes de conectar profissionais.
4. Antes de lidar com dados verdadeiros, migrar do JSON para um banco apropriado e revisar autenticação, controle de acesso, criptografia, auditoria, retenção e adequação à LGPD com especialistas.
5. Integrar uma fonte confiável para validar CRM, calendário de feriados e regras de prazo antes de oferecer prazos operacionais.
6. Planejar uma futura sala de teleconsulta como módulo separado; o teste de equipamentos existente é apenas uma prévia local, sem conectar pacientes, gravar ou transmitir áudio/vídeo.
