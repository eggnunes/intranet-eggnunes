# Intranet Egg Nunes Advogados

Sistema interno de ferramentas para a equipe do escritório Egg Nunes Advogados Associados.

## 🎯 Sobre o Sistema

Esta intranet foi desenvolvida para centralizar ferramentas e recursos que otimizam o trabalho da equipe interna do escritório, promovendo maior eficiência e colaboração.

**Egg Nunes Advogados Associados** é um escritório de advocacia referência desde 1994, com atuação em todo o Brasil.

## 🚀 Ferramentas Disponíveis

### RotaDoc - Rotação e Organização Inteligente de Documentos

Ferramenta de IA para processamento automatizado de documentos com as seguintes funcionalidades:

- **Correção automática de orientação**: Detecta e corrige páginas que estão de cabeça para baixo, rotacionadas ou invertidas
- **Identificação inteligente**: Reconhece automaticamente tipos de documentos (relatórios médicos, procurações, etc.)
- **Organização por tipo**: Agrupa documentos similares em PDFs separados ou mescla tudo em um único arquivo
- **Suporte múltiplos formatos**: Processa imagens (JPG, PNG) e PDFs com múltiplas páginas
- **Extração de PDFs**: Extrai páginas individuais de PDFs para análise e correção

## 🔐 Sistema de Autenticação e Aprovação

O sistema possui controle de acesso com aprovação administrativa:

1. **Cadastro**: Novos usuários se cadastram através da página `/auth`
2. **Aprovação**: Um administrador deve aprovar o cadastro antes do acesso
3. **Histórico individual**: Cada usuário pode consultar seu próprio histórico de uso
4. **Painel administrativo**: Administradores podem gerenciar usuários e visualizar histórico completo

## 👤 Perfis de Usuário

### Usuário Comum
- Acesso às ferramentas após aprovação
- Visualização do próprio histórico de uso
- Dashboard personalizado

### Administrador
- Todas as permissões de usuário comum
- Aprovar/rejeitar novos cadastros
- Adicionar/remover outros administradores
- Visualizar histórico de uso de todos os usuários
- Gerenciamento completo do sistema

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Lovable Cloud (Supabase)
- **Autenticação**: Supabase Auth com sistema de aprovação
- **Banco de Dados**: PostgreSQL com Row Level Security (RLS)
- **IA**: Lovable AI (Google Gemini) para análise de documentos
- **Geração de PDFs**: pdf-lib

## 📋 Primeiros Passos

### Para o primeiro administrador (rafael@eggnunes.com.br)

Consulte o arquivo `ADMIN_SETUP.md` para instruções detalhadas sobre como configurar o primeiro administrador.

### Para novos usuários

1. Acesse a página de cadastro
2. Preencha seus dados
3. Aguarde a aprovação de um administrador
4. Após aprovação, faça login e acesse o dashboard

## 🔒 Segurança

- Todas as senhas são criptografadas
- Row Level Security (RLS) em todas as tabelas
- Sistema de roles separado (admin/user)
- Validação de entrada em todas as operações
- Logs de auditoria para todas as ações

## 📱 Páginas do Sistema

- `/auth` - Login e cadastro
- `/dashboard` - Dashboard principal com acesso às ferramentas
- `/tools/rotadoc` - Ferramenta RotaDoc
- `/historico` - Histórico pessoal de uso
- `/admin` - Painel administrativo (apenas admins)

## 🎨 Design

O sistema utiliza a identidade visual do escritório Egg Nunes, com:
- Logo oficial do escritório
- Esquema de cores profissional (azul navy e âmbar)
- Interface limpa e moderna
- Design responsivo para todos os dispositivos

## 📊 Banco de Dados

### Principais Tabelas

- `profiles` - Perfis de usuários com status de aprovação
- `user_roles` - Roles dos usuários (admin/user)
- `usage_history` - Histórico de uso das ferramentas

### Enums

- `app_role` - admin | user
- `approval_status` - pending | approved | rejected

## 🔄 Histórico de Uso

O sistema mantém um registro completo de todas as atividades:
- Ferramenta utilizada
- Ação realizada
- Metadados (arquivos processados, documentos gerados, tempo de processamento)
- Data e hora
- Usuário responsável

Usuários comuns podem visualizar apenas seu próprio histórico.
Administradores podem visualizar o histórico de todos os usuários.

---

## 💻 Desenvolvimento

### Como editar este código?

**Use Lovable**

Visite o [Projeto no Lovable](https://lovable.dev/projects/9e1ef2a4-8be2-4a8f-85a4-23a607501b47) e comece a fazer prompts.

Mudanças feitas via Lovable serão automaticamente commitadas neste repositório.

**Use sua IDE preferida**

Se você quer trabalhar localmente usando sua própria IDE, você pode clonar este repo e fazer push das mudanças.

Requisito: Node.js & npm instalados - [instalar com nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

```sh
# Passo 1: Clonar o repositório
git clone <YOUR_GIT_URL>

# Passo 2: Navegar para o diretório do projeto
cd <YOUR_PROJECT_NAME>

# Passo 3: Instalar as dependências
npm i

# Passo 4: Iniciar o servidor de desenvolvimento
npm run dev
```

### Como fazer deploy?

Abra o [Lovable](https://lovable.dev/projects/9e1ef2a4-8be2-4a8f-85a4-23a607501b47) e clique em Share -> Publish.

### Posso conectar um domínio customizado?

Sim! Navegue para Project > Settings > Domains e clique em Connect Domain.

Leia mais: [Configurando um domínio customizado](https://docs.lovable.dev/features/custom-domain#custom-domain)
