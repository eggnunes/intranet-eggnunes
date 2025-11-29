# Configuração do Administrador Inicial

## Instruções para adicionar rafael@eggnunes.com.br como primeiro administrador

### Passo 1: Cadastrar-se no sistema
1. Acesse a aplicação em `/auth`
2. Faça o cadastro com o email: **rafael@eggnunes.com.br**
3. Crie uma senha forte

### Passo 2: Aprovar e promover a administrador

Após o cadastro, execute os seguintes comandos SQL no painel do Lovable Cloud (Backend → Database → SQL Editor):

```sql
-- 1. Aprovar o usuário
UPDATE profiles 
SET approval_status = 'approved', 
    approved_at = NOW() 
WHERE email = 'rafael@eggnunes.com.br';

-- 2. Promover a administrador
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role 
FROM auth.users 
WHERE email = 'rafael@eggnunes.com.br'
ON CONFLICT (user_id, role) DO NOTHING;
```

### Passo 3: Fazer login novamente
1. Faça logout se necessário
2. Faça login novamente com rafael@eggnunes.com.br
3. Agora você terá acesso ao painel administrativo em `/admin`

## Funcionalidades do administrador

Como administrador, você poderá:
- ✅ Aprovar ou rejeitar novos cadastros de usuários
- ✅ Adicionar ou remover outros administradores
- ✅ Visualizar o histórico de uso de todos os usuários
- ✅ Acessar todas as ferramentas do sistema

## Adicionando novos administradores

Após estar logado como admin, você pode adicionar outros administradores através do painel `/admin` na aba "Administradores".
